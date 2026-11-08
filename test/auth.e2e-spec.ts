import { INestApplication } from "@nestjs/common";
import request from "supertest";
import * as jwt from "jsonwebtoken";
import { DataSource } from "typeorm";
import * as argon2 from "argon2";
import { createTestApp } from "./helpers/app";
import { openDb, resetDatabase } from "./helpers/db";
import { appConfig, isTestUserHeaderAllowed } from "../src/config/app.config";

const PASSWORD = "Rahim1234";
const reg = (over: Record<string, unknown> = {}) => ({
  fullName: "Rahim Uddin",
  email: "rahim@example.com",
  phone: "01712345678",
  password: PASSWORD,
  role: "RENTER",
  ...over,
});

describe("Registration and Login module (e2e)", () => {
  let app: INestApplication;
  let db: DataSource;
  let adminId: string;
  let adminToken: string;

  const register = (body: object) => request(app.getHttpServer()).post("/auth/register").send(body);
  const login = (email: string, password: string) =>
    request(app.getHttpServer()).post("/auth/login").send({ email, password });
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    await resetDatabase();
    app = await createTestApp();
    db = await openDb();
    // An admin is created by the team (seed), never through sign-up
    const hash = await argon2.hash("Admin1234", { type: argon2.argon2id });
    const rows = await db.query(
      `INSERT INTO users (role, full_name, email, phone, password_hash)
       VALUES ('ADMIN', 'Admin Gaari', 'admin@gaaribhara.test', '01711000001', $1) RETURNING id`,
      [hash],
    );
    adminId = rows[0].id;
    adminToken = (await login("admin@gaaribhara.test", "Admin1234")).body.accessToken;
  });

  afterAll(async () => {
    await db.destroy();
    await app.close();
  });

  describe("health", () => {
    it("GET /health pings the database", async () => {
      const res = await request(app.getHttpServer()).get("/health").expect(200);
      expect(res.body).toMatchObject({ status: "ok", database: "up" });
    });
  });

  describe("registration", () => {
    it("creates a RENTER, cleans the input, hides the password, returns a token", async () => {
      const res = await register(
        reg({ email: "  Rahim@Example.COM ", phone: "+88 017-1234 5678", fullName: "  Rahim Uddin " }),
      ).expect(201);
      expect(res.body.user).toMatchObject({
        role: "RENTER",
        email: "rahim@example.com",
        phone: "01712345678",
        fullName: "Rahim Uddin",
        status: "ACTIVE",
      });
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.user.tokenVersion).toBeUndefined();
      expect(res.body.user.suspendedReason).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain(PASSWORD);
      expect(res.body.tokenType).toBe("Bearer");
      expect(res.body.accessToken).toEqual(expect.any(String));
    });

    it("stores the password only as an argon2 hash", async () => {
      const rows = await db.query(`SELECT password_hash FROM users WHERE email = 'rahim@example.com'`);
      expect(rows[0].password_hash).toMatch(/^\$argon2id\$/);
      expect(rows[0].password_hash).not.toContain(PASSWORD);
    });

    it("can register an OWNER with a Bangla name", async () => {
      await register(reg({ email: "karim@example.com", phone: "01812345678", role: "OWNER", fullName: "করিম উদ্দিন" })).expect(201);
    });

    it("rejects ADMIN from the public sign-up", async () => {
      const res = await register(reg({ email: "evil@example.com", phone: "01912345678", role: "ADMIN" })).expect(400);
      expect(res.body.message).toBe("Validation failed");
      expect(JSON.stringify(res.body.details)).toContain("role must be RENTER or OWNER");
    });

    it.each([
      ["bad email", { email: "not-an-email" }],
      ["short password", { password: "Ab1" }],
      ["password without a digit", { password: "OnlyLetters" }],
      ["password without a letter", { password: "12345678" }],
      ["bad phone", { phone: "12345" }],
      ["landline-like phone", { phone: "01212345678" }],
      ["short name", { fullName: "A" }],
      ["missing role", { role: undefined }],
    ])("rejects %s with 400 and details", async (_name, over) => {
      const res = await register(reg({ email: "x@example.com", phone: "01512345678", ...over })).expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, message: "Validation failed" });
      expect(res.body.details.length).toBeGreaterThan(0);
    });

    it("rejects unknown fields (nobody can sneak in a field like status)", async () => {
      await register(reg({ email: "y@example.com", phone: "01512345679", status: "ACTIVE", id: "abc" })).expect(400);
    });

    it("rejects a duplicate email with 409", async () => {
      const res = await register(reg({ phone: "01612345678" })).expect(409);
      expect(res.body.message).toMatch(/email/i);
    });

    it("rejects a duplicate phone with 409", async () => {
      const res = await register(reg({ email: "other@example.com" })).expect(409);
      expect(res.body.message).toMatch(/phone/i);
    });

    it("answers with the shared error format", async () => {
      const res = await register(reg({ email: "bad" })).expect(400);
      expect(Object.keys(res.body).sort()).toEqual(
        ["details", "error", "message", "path", "statusCode", "timestamp"].sort(),
      );
      expect(res.body.error).toBe("Bad Request");
    });
  });

  describe("login", () => {
    it("logs in with the right password (email is not case sensitive)", async () => {
      const res = await login("RAHIM@example.com", PASSWORD).expect(200);
      expect(res.body.user.email).toBe("rahim@example.com");
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user.passwordHash).toBeUndefined();
      const payload = jwt.decode(res.body.accessToken) as any;
      expect(payload).toMatchObject({ role: "RENTER" });
      expect(payload.jti).toBeDefined();
    });

    it("gives the SAME 401 for a wrong password and an unknown email", async () => {
      const a = await login("rahim@example.com", "WrongPass123").expect(401);
      const b = await login("nobody@example.com", "WrongPass123").expect(401);
      expect(a.body.message).toBe("Invalid email or password");
      expect(b.body.message).toBe(a.body.message);
    });

    it("validates the body", async () => {
      await request(app.getHttpServer()).post("/auth/login").send({ email: "x" }).expect(400);
    });
  });

  describe("protected routes: the old boilerplate bug (any text passes) is gone", () => {
    it("401 without a token", async () => {
      await request(app.getHttpServer()).get("/users/me").expect(401);
    });

    it("401 with a fake token", async () => {
      await request(app.getHttpServer()).get("/users/me").set(auth("fake.token.value")).expect(401);
      await request(app.getHttpServer()).get("/users/me").set(auth("anything")).expect(401);
    });

    it("401 with a token signed with another secret", async () => {
      const t = jwt.sign({ sub: adminId, role: "ADMIN", jti: "11111111-1111-1111-1111-111111111111", ver: 0 }, "some-other-secret-1234567");
      await request(app.getHttpServer()).get("/admin/users").set(auth(t)).expect(401);
    });

    it("401 with an expired token", async () => {
      const t = jwt.sign(
        { sub: adminId, role: "ADMIN", jti: "22222222-2222-2222-2222-222222222222", ver: 0 },
        process.env.JWT_BEARER_SECRET!,
        { expiresIn: -10 },
      );
      await request(app.getHttpServer()).get("/users/me").set(auth(t)).expect(401);
    });

    it("401 with the wrong header format", async () => {
      await request(app.getHttpServer()).get("/users/me").set({ Authorization: "Token abc" }).expect(401);
    });

    it("a valid token whose user does not exist is rejected", async () => {
      const t = jwt.sign(
        { sub: "33333333-3333-3333-3333-333333333333", role: "RENTER", jti: "44444444-4444-4444-4444-444444444444", ver: 0 },
        process.env.JWT_BEARER_SECRET!,
      );
      await request(app.getHttpServer()).get("/users/me").set(auth(t)).expect(401);
    });
  });

  describe("profile", () => {
    let token: string;
    beforeAll(async () => {
      token = (await login("rahim@example.com", PASSWORD)).body.accessToken;
    });

    it("GET /users/me returns my profile", async () => {
      const res = await request(app.getHttpServer()).get("/users/me").set(auth(token)).expect(200);
      expect(res.body).toMatchObject({ email: "rahim@example.com", role: "RENTER" });
      expect(res.body.passwordHash).toBeUndefined();
      expect(res.body.tokenVersion).toBeUndefined();
      expect(res.body.passwordChangedAt).toBeUndefined();
    });

    it("PATCH /users/me changes name and phone", async () => {
      const res = await request(app.getHttpServer())
        .patch("/users/me")
        .set(auth(token))
        .send({ fullName: "Rahim U.", phone: "+8801912345600" })
        .expect(200);
      expect(res.body).toMatchObject({ fullName: "Rahim U.", phone: "01912345600" });
    });

    it("cannot take a phone number that another user has", async () => {
      await request(app.getHttpServer()).patch("/users/me").set(auth(token)).send({ phone: "01812345678" }).expect(409);
    });

    it("cannot change role, email or status (fields are rejected)", async () => {
      await request(app.getHttpServer()).patch("/users/me").set(auth(token)).send({ role: "ADMIN" }).expect(400);
      await request(app.getHttpServer()).patch("/users/me").set(auth(token)).send({ email: "new@example.com" }).expect(400);
      await request(app.getHttpServer()).patch("/users/me").set(auth(token)).send({ status: "ACTIVE" }).expect(400);
    });
  });

  describe("logout", () => {
    it("the token stops working at once, other sessions keep working", async () => {
      const t1 = (await login("rahim@example.com", PASSWORD)).body.accessToken;
      const t2 = (await login("rahim@example.com", PASSWORD)).body.accessToken;
      await request(app.getHttpServer()).get("/users/me").set(auth(t1)).expect(200);
      await request(app.getHttpServer()).post("/auth/logout").set(auth(t1)).expect(200);
      const after = await request(app.getHttpServer()).get("/users/me").set(auth(t1)).expect(401);
      expect(after.body.message).toMatch(/logged out/i);
      await request(app.getHttpServer()).get("/users/me").set(auth(t2)).expect(200);
    });

    it("logout needs a login", async () => {
      await request(app.getHttpServer()).post("/auth/logout").expect(401);
    });
  });

  describe("change password", () => {
    it("rejects a wrong current password and a weak new password", async () => {
      const t = (await login("karim@example.com", PASSWORD)).body.accessToken;
      await request(app.getHttpServer()).patch("/auth/password").set(auth(t)).send({ currentPassword: "Wrong12345", newPassword: "Newpass123" }).expect(401);
      await request(app.getHttpServer()).patch("/auth/password").set(auth(t)).send({ currentPassword: PASSWORD, newPassword: "short" }).expect(400);
    });

    it("changes the password and stops ALL old tokens", async () => {
      const t1 = (await login("karim@example.com", PASSWORD)).body.accessToken;
      const t2 = (await login("karim@example.com", PASSWORD)).body.accessToken;
      await request(app.getHttpServer()).patch("/auth/password").set(auth(t1)).send({ currentPassword: PASSWORD, newPassword: "Newpass123" }).expect(200);
      await request(app.getHttpServer()).get("/users/me").set(auth(t1)).expect(401);
      await request(app.getHttpServer()).get("/users/me").set(auth(t2)).expect(401);
      await login("karim@example.com", PASSWORD).expect(401);
      const fresh = await login("karim@example.com", "Newpass123").expect(200);
      await request(app.getHttpServer()).get("/users/me").set(auth(fresh.body.accessToken)).expect(200);
    });
  });

  describe("roles and the admin routes", () => {
    let renterToken: string;
    let renterId: string;
    beforeAll(async () => {
      const res = await login("rahim@example.com", PASSWORD);
      renterToken = res.body.accessToken;
      renterId = res.body.user.id;
    });

    it("401 without a token, 403 for a renter, 200 for an admin", async () => {
      await request(app.getHttpServer()).get("/admin/users").expect(401);
      const res = await request(app.getHttpServer()).get("/admin/users").set(auth(renterToken)).expect(403);
      expect(res.body.message).toMatch(/permission/i);
      await request(app.getHttpServer()).get("/admin/users").set(auth(adminToken)).expect(200);
    });

    it("lists users with pages, filters and search, never showing password hashes", async () => {
      const all = await request(app.getHttpServer()).get("/admin/users").set(auth(adminToken)).expect(200);
      expect(all.body.meta).toMatchObject({ page: 1, limit: 20 });
      expect(all.body.meta.total).toBeGreaterThanOrEqual(3);
      expect(JSON.stringify(all.body)).not.toContain("passwordHash");
      expect(JSON.stringify(all.body)).not.toContain("argon2");

      const owners = await request(app.getHttpServer()).get("/admin/users?role=OWNER").set(auth(adminToken)).expect(200);
      expect(owners.body.items.every((u: any) => u.role === "OWNER")).toBe(true);

      const search = await request(app.getHttpServer()).get("/admin/users?q=rahim").set(auth(adminToken)).expect(200);
      expect(search.body.items.map((u: any) => u.email)).toContain("rahim@example.com");

      const paged = await request(app.getHttpServer()).get("/admin/users?limit=1&page=2").set(auth(adminToken)).expect(200);
      expect(paged.body.items).toHaveLength(1);
      await request(app.getHttpServer()).get("/admin/users?limit=1000").set(auth(adminToken)).expect(400);
      await request(app.getHttpServer()).get("/admin/users?role=KING").set(auth(adminToken)).expect(400);
    });

    it("a search with SQL wildcard characters does not match everything", async () => {
      const res = await request(app.getHttpServer()).get("/admin/users?q=%25").set(auth(adminToken)).expect(200);
      expect(res.body.items).toHaveLength(0);
    });

    it("suspending: tokens stop working, login is refused, restore brings the user back", async () => {
      await request(app.getHttpServer())
        .patch(`/admin/users/${renterId}/suspend`)
        .set(auth(adminToken))
        .send({ reason: "Reported many times" })
        .expect(200)
        .expect((r) => expect(r.body).toMatchObject({ status: "SUSPENDED", suspendedReason: "Reported many times" }));

      const blocked = await request(app.getHttpServer()).get("/users/me").set(auth(renterToken)).expect(403);
      expect(blocked.body.message).toMatch(/suspended/i);
      await login("rahim@example.com", PASSWORD).expect(403);
      // A wrong password must NOT reveal that the account is suspended
      await login("rahim@example.com", "WrongPass123").expect(401);

      await request(app.getHttpServer()).patch(`/admin/users/${renterId}/restore`).set(auth(adminToken)).expect(200);
      await request(app.getHttpServer()).get("/users/me").set(auth(renterToken)).expect(200);
      await login("rahim@example.com", PASSWORD).expect(200);
    });

    it("a renter cannot suspend anyone; an admin cannot suspend themselves or another admin", async () => {
      await request(app.getHttpServer()).patch(`/admin/users/${adminId}/suspend`).set(auth(renterToken)).send({}).expect(403);
      await request(app.getHttpServer()).patch(`/admin/users/${adminId}/suspend`).set(auth(adminToken)).send({}).expect(400);
      const other = await db.query(
        `INSERT INTO users (role, full_name, email, phone, password_hash)
         VALUES ('ADMIN', 'Second Admin', 'admin2@gaaribhara.test', '01711000002', 'x') RETURNING id`,
      );
      await request(app.getHttpServer()).patch(`/admin/users/${other[0].id}/suspend`).set(auth(adminToken)).send({}).expect(403);
    });

    it("bad ids give 400 or 404, not 500", async () => {
      await request(app.getHttpServer()).patch("/admin/users/not-a-uuid/suspend").set(auth(adminToken)).send({}).expect(400);
      await request(app.getHttpServer())
        .patch("/admin/users/55555555-5555-5555-5555-555555555555/suspend")
        .set(auth(adminToken))
        .send({})
        .expect(404);
    });
  });

  describe("temporary test-user header (development helper for the team)", () => {
    it("lets teammates call private routes with x-test-user-id", async () => {
      const res = await request(app.getHttpServer()).get("/users/me").set("x-test-user-id", adminId).expect(200);
      expect(res.body.email).toBe("admin@gaaribhara.test");
    });

    it("works with roles too", async () => {
      await request(app.getHttpServer()).get("/admin/users").set("x-test-user-id", adminId).expect(200);
    });

    it("rejects a bad or unknown id", async () => {
      await request(app.getHttpServer()).get("/users/me").set("x-test-user-id", "abc").expect(401);
      await request(app.getHttpServer()).get("/users/me").set("x-test-user-id", "66666666-6666-6666-6666-666666666666").expect(401);
    });

    it("is switched off when ALLOW_TEST_USER_HEADER is false or in production", async () => {
      expect(isTestUserHeaderAllowed()).toBe(true);
      const env = appConfig.env as { ALLOW_TEST_USER_HEADER: boolean; NODE_ENV: string };
      env.NODE_ENV = "production";
      expect(isTestUserHeaderAllowed()).toBe(false);
      await request(app.getHttpServer()).get("/users/me").set("x-test-user-id", adminId).expect(401);
      env.NODE_ENV = "test";
      env.ALLOW_TEST_USER_HEADER = false;
      expect(isTestUserHeaderAllowed()).toBe(false);
      env.ALLOW_TEST_USER_HEADER = true;
    });
  });
});
