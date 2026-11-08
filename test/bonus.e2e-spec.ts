import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { DataSource } from "typeorm";
import * as argon2 from "argon2";
import { createTestApp } from "./helpers/app";
import { openDb, resetDatabase } from "./helpers/db";
import { redact } from "../src/modules/audit/audit.service";

describe("Bonus: middleware, interceptors, audit log (e2e)", () => {
  let app: INestApplication;
  let db: DataSource;
  let adminToken: string;
  let adminId: string;
  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    await resetDatabase();
    app = await createTestApp();
    db = await openDb();
    const hash = await argon2.hash("Admin1234", { type: argon2.argon2id });
    const rows = await db.query(
      `INSERT INTO users (role, full_name, email, phone, password_hash)
       VALUES ('ADMIN', 'Admin Gaari', 'admin@gaaribhara.test', '01711000001', $1) RETURNING id`,
      [hash],
    );
    adminId = rows[0].id;
    const res = await http().post("/auth/login").send({ email: "admin@gaaribhara.test", password: "Admin1234" });
    adminToken = res.body.accessToken;
  });

  afterAll(async () => {
    await db.destroy();
    await app.close();
  });

  describe("Middleware and timing interceptor", () => {
    it("adds X-Request-Id and X-Response-Time to every answer", async () => {
      const res = await http().get("/health");
      expect(res.headers["x-request-id"]).toMatch(/^[A-Za-z0-9-]{8,64}$/);
      expect(res.headers["x-response-time"]).toMatch(/ms$/);
    });

    it("keeps a valid X-Request-Id sent by the client", async () => {
      const res = await http().get("/health").set("X-Request-Id", "my-trace-id-12345");
      expect(res.headers["x-request-id"]).toBe("my-trace-id-12345");
    });

    it("replaces an unsafe X-Request-Id", async () => {
      const res = await http().get("/health").set("X-Request-Id", "bad id with spaces");
      expect(res.headers["x-request-id"]).not.toBe("bad id with spaces");
    });

    it("also sends X-Request-Id on error answers", async () => {
      const res = await http().get("/users/me");
      expect(res.status).toBe(401);
      expect(res.headers["x-request-id"]).toBeDefined();
    });
  });

  describe("Audit log", () => {
    it("redact() hides passwords and tokens, even when nested", () => {
      const out = redact({ fullName: "A", password: "x", nested: { accessToken: "y", ok: 1 }, list: [{ newPassword: "z" }] });
      expect(out).toEqual({ fullName: "A", password: "[hidden]", nested: { accessToken: "[hidden]", ok: 1 }, list: [{ newPassword: "[hidden]" }] });
    });

    it("saves a register request without the password", async () => {
      const res = await http().post("/auth/register").send({
        fullName: "Audit Tester", email: "audit1@example.com", phone: "01712345601", password: "Secret1234", role: "RENTER",
      });
      expect(res.status).toBe(201);
      const rows = await db.query(`SELECT * FROM audit_logs WHERE path = '/auth/register'`);
      expect(rows).toHaveLength(1);
      expect(rows[0].action).toBe("CREATE");
      expect(rows[0].entity).toBe("auth");
      expect(rows[0].status_code).toBe(201);
      expect(rows[0].new_value.email).toBe("audit1@example.com");
      expect(rows[0].new_value.password).toBe("[hidden]");
      expect(JSON.stringify(rows[0])).not.toContain("Secret1234");
    });

    it("saves the user and the request id for a signed-in change", async () => {
      const res = await http().patch("/users/me").set(auth(adminToken)).send({ fullName: "Admin Updated" });
      expect(res.status).toBe(200);
      const rows = await db.query(`SELECT * FROM audit_logs WHERE path = '/users/me' ORDER BY id DESC LIMIT 1`);
      expect(rows[0].user_id).toBe(adminId);
      expect(rows[0].action).toBe("UPDATE");
      expect(rows[0].request_id).toBe(res.headers["x-request-id"]);
      expect(rows[0].new_value).toEqual({ fullName: "Admin Updated" });
    });

    it("saves the record id from the route (suspend)", async () => {
      const reg = await http().post("/auth/register").send({
        fullName: "Target User", email: "audit2@example.com", phone: "01712345602", password: "Secret1234", role: "OWNER",
      });
      const targetId = reg.body.user.id;
      const res = await http().patch(`/admin/users/${targetId}/suspend`).set(auth(adminToken)).send({ reason: "test" });
      expect(res.status).toBe(200);
      const rows = await db.query(`SELECT * FROM audit_logs WHERE entity = 'users' AND entity_id = $1`, [targetId]);
      expect(rows).toHaveLength(1);
      expect(rows[0].user_id).toBe(adminId);
    });

    it("does not log GET requests", async () => {
      const before = await db.query(`SELECT count(*)::int AS n FROM audit_logs`);
      await http().get("/users/me").set(auth(adminToken));
      await http().get("/admin/users").set(auth(adminToken));
      const after = await db.query(`SELECT count(*)::int AS n FROM audit_logs`);
      expect(after[0].n).toBe(before[0].n);
    });

    it("does not log a failed request (400)", async () => {
      const before = await db.query(`SELECT count(*)::int AS n FROM audit_logs`);
      const res = await http().post("/auth/register").send({ email: "bad" });
      expect(res.status).toBe(400);
      const after = await db.query(`SELECT count(*)::int AS n FROM audit_logs`);
      expect(after[0].n).toBe(before[0].n);
    });

    it("admin can list and filter the audit log", async () => {
      const res = await http().get("/admin/audit-logs?entity=users&action=UPDATE&limit=5").set(auth(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThan(0);
      expect(res.body.items.every((i: any) => i.entity === "users" && i.action === "UPDATE")).toBe(true);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 5 });
    });

    it("admin can read one entry and gets 404 for a missing one", async () => {
      const list = await http().get("/admin/audit-logs?limit=1").set(auth(adminToken));
      const id = list.body.items[0].id;
      expect((await http().get(`/admin/audit-logs/${id}`).set(auth(adminToken))).status).toBe(200);
      expect((await http().get("/admin/audit-logs/99999999").set(auth(adminToken))).status).toBe(404);
    });

    it("rejects a bad filter with 400", async () => {
      const res = await http().get("/admin/audit-logs?userId=not-a-uuid").set(auth(adminToken));
      expect(res.status).toBe(400);
    });

    it("401 without a token and 403 for a non-admin", async () => {
      expect((await http().get("/admin/audit-logs")).status).toBe(401);
      const login = await http().post("/auth/login").send({ email: "audit1@example.com", password: "Secret1234" });
      const res = await http().get("/admin/audit-logs").set(auth(login.body.accessToken));
      expect(res.status).toBe(403);
    });

    it("keeps the entry when the user is deleted (user_id becomes empty)", async () => {
      const reg = await http().post("/auth/register").send({
        fullName: "Temp User", email: "audit3@example.com", phone: "01712345603", password: "Secret1234", role: "RENTER",
      });
      const id = reg.body.user.id;
      await http().patch("/users/me").set(auth(reg.body.accessToken)).send({ fullName: "Temp Changed" });
      await db.query(`DELETE FROM users WHERE id = $1`, [id]);
      const rows = await db.query(`SELECT user_id FROM audit_logs WHERE path = '/users/me' AND new_value->>'fullName' = 'Temp Changed'`);
      expect(rows).toHaveLength(1);
      expect(rows[0].user_id).toBeNull();
    });
  });
});
