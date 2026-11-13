import { INestApplication } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { existsSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { openDb, resetDatabase } from "./helpers/db";

/**
 * Post module (Arikh) on Sadat's real app: the REAL AppModule, the REAL AuthGuard, the REAL migrations.
 * Most tests sign in with the header  x-test-user-id  (allowed in tests, see setup-env.ts);
 * the "real login" tests at the end use a real token from /auth/login.
 */
const U = {
  owner1: "11111111-1111-4111-8111-111111111111",
  owner2: "22222222-2222-4222-8222-222222222222",
  renter1: "33333333-3333-4333-8333-333333333333",
  renter2: "44444444-4444-4444-8444-444444444444",
  admin: "55555555-5555-4555-8555-555555555555",
};
const as = (id: string) => ({ "x-test-user-id": id });
const OWNER1 = as(U.owner1);
const OWNER2 = as(U.owner2);
const RENTER1 = as(U.renter1);
const ADMIN = as(U.admin);
const GHOST_ID = 9999; // a category/district id that does not exist

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("fake-png-body")]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("fake-jpg-body")]);

describe("Post module (e2e, Sadat's real app)", () => {
  let app: NestExpressApplication;
  let ds: DataSource;
  let http: ReturnType<typeof request>;
  let categoryCar: number, categoryBike: number, dhaka: number, chattogram: number;
  const createdPostIds: string[] = [];

  const base = (over: Record<string, unknown> = {}) => ({
    postType: "OFFER",
    title: "Toyota Axio for rent",
    body: "Clean car, AC works, available all week.",
    categoryId: categoryCar,
    districtId: chattogram,
    ...over,
  });
  const create = async (headers: object, body: object, expect_ = 201) => {
    const res = await http.post("/posts").set(headers).send(body).expect(expect_);
    if (res.status === 201) createdPostIds.push(res.body.id);
    return res.body;
  };

  beforeAll(async () => {
    await resetDatabase(); // empty "_test" database -> all migrations (Sadat's + Arikh's)
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app); // same pipe + error format as the real app
    app.useStaticAssets(join(process.cwd(), "uploads"), { prefix: "/uploads/" }); // same as main.ts
    await app.init();
    http = request(app.getHttpServer()) as any;
    ds = await openDb();

    await ds.query(
      `INSERT INTO users (id, role, full_name, email, phone, password_hash) VALUES
        ($1,'OWNER','Owner One','owner1@test.bd','01711000001','test-hash'),
        ($2,'OWNER','Owner Two','owner2@test.bd','01711000002','test-hash'),
        ($3,'RENTER','Renter One','renter1@test.bd','01811000001','test-hash'),
        ($4,'RENTER','Renter Two','renter2@test.bd','01811000002','test-hash'),
        ($5,'ADMIN','Admin','admin@test.bd','01911000001','test-hash')`,
      [U.owner1, U.owner2, U.renter1, U.renter2, U.admin],
    );
    const cats = await ds.query(`SELECT id, name FROM categories`);
    const dist = await ds.query(`SELECT id, name FROM districts`);
    categoryCar = cats.find((c: any) => c.name === "Car").id;
    categoryBike = cats.find((c: any) => c.name === "Motorbike").id;
    dhaka = dist.find((d: any) => d.name === "Dhaka").id;
    chattogram = dist.find((d: any) => d.name === "Chattogram").id;
  });

  afterAll(async () => {
    for (const id of createdPostIds) rmSync(join(process.cwd(), "uploads", "posts", id), { recursive: true, force: true });
    await app.close();
    await ds.destroy();
  });

  // ───────────────────────── Migrations / seed ─────────────────────────
  describe("migrations and reference data", () => {
    it("built the tables from an empty database", async () => {
      const t = await ds.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`);
      const names = t.map((r: any) => r.table_name);
      for (const n of ["categories", "districts", "posts", "post_images"]) expect(names).toContain(n);
    });
    it("seeded 64 districts and 6 categories", async () => {
      expect(Number((await ds.query(`SELECT count(*) c FROM districts`))[0].c)).toBe(64);
      expect(Number((await ds.query(`SELECT count(*) c FROM categories`))[0].c)).toBe(6);
    });
    it("GET /categories and /districts work without login", async () => {
      const c = await http.get("/categories").expect(200);
      expect(c.body.map((x: any) => x.name).sort()).toEqual(["Car", "Microbus", "Motorbike", "Pickup", "SUV", "Scooter"]);
      const d = await http.get("/districts").expect(200);
      expect(d.body).toHaveLength(64);
      const sy = await http.get("/districts?division=Sylhet").expect(200);
      expect(sy.body.map((x: any) => x.name).sort()).toEqual(["Habiganj", "Moulvibazar", "Sunamganj", "Sylhet"]);
    });
  });

  // ───────────────────────── Database rules ─────────────────────────
  // ----- Database -----
  // Sadat's database.e2e-spec.ts already tests his posts constraints (price, dates, empty title, foreign keys).
  // Here only what Arikh's migration 1730000000010 adds.
  describe("database rules added by Arikh's migration", () => {
    let postId: string;
    beforeAll(async () => {
      postId = (await create(OWNER1, base({ title: "DB rule post" }))).id;
    });
    it("a sixth image row is rejected by the database itself", async () => {
      for (let i = 0; i < 5; i++) await ds.query(`INSERT INTO post_images (post_id,file_path,position) VALUES ($1,$2,$3)`, [postId, `x/${i}.png`, i]);
      await expect(ds.query(`INSERT INTO post_images (post_id,file_path,position) VALUES ($1,'x/5.png',5)`, [postId])).rejects.toThrow(/post_images_position_range/);
      await expect(ds.query(`INSERT INTO post_images (post_id,file_path,position) VALUES ($1,'x/dup.png',2)`, [postId])).rejects.toThrow(/post_images_position_unique/);
    });
    it("deleting a post removes its image rows (cascade)", async () => {
      await ds.query(`DELETE FROM posts WHERE id = $1`, [postId]);
      expect(Number((await ds.query(`SELECT count(*) c FROM post_images WHERE post_id=$1`, [postId]))[0].c)).toBe(0);
    });
    it("HIDDEN needs hidden_from_status, and only ACTIVE/CLOSED are allowed there", async () => {
      const id = (await create(OWNER1, base({ title: "Hidden rule post" }))).id;
      await expect(ds.query(`UPDATE posts SET status='HIDDEN' WHERE id=$1`, [id])).rejects.toThrow(/posts_hidden_consistent/);
      await expect(ds.query(`UPDATE posts SET status='HIDDEN', hidden_from_status='HIDDEN' WHERE id=$1`, [id])).rejects.toThrow(/posts_hidden_consistent/);
      await expect(ds.query(`UPDATE posts SET hidden_from_status='ACTIVE' WHERE id=$1`, [id])).rejects.toThrow(/posts_hidden_consistent/);
    });
    it("the database refuses a status or fuel that is not in its enum", async () => {
      await expect(ds.query(`UPDATE posts SET status='DELETED' WHERE id=$1`, [createdPostIds[0]])).rejects.toThrow(/invalid input value for enum/);
      await expect(ds.query(`UPDATE posts SET fuel_type='LPG' WHERE id=$1`, [createdPostIds[0]])).rejects.toThrow(/invalid input value for enum/);
    });
  });

  describe("create post", () => {
    it("Owner can create an OFFER; renter can create a REQUEST", async () => {
      const offer = await create(OWNER1, base());
      expect(offer).toMatchObject({ postType: "OFFER", status: "ACTIVE", rentStatus: "OPEN", withDriver: false });
      expect(offer.author).toEqual({ id: U.owner1, fullName: "Owner One", role: "OWNER" });
      expect(offer.category.name).toBe("Car");
      expect(offer.district.name).toBe("Chattogram");
      const req = await create(RENTER1, base({ postType: "REQUEST", title: "Need a microbus" }));
      expect(req.postType).toBe("REQUEST");
    });
    it("the WRONG user type cannot make the wrong post type", async () => {
      const a = await create(OWNER1, base({ postType: "REQUEST" }), 403);
      expect(a.message).toMatch(/Only a Renter/);
      const b = await create(RENTER1, base({ postType: "OFFER" }), 403);
      expect(b.message).toMatch(/Only an Owner/);
    });
    it("an admin cannot create posts", async () => {
      await create(ADMIN, base(), 403);
      await create(ADMIN, base({ postType: "REQUEST" }), 403);
    });
    it("logged-out users get 401", async () => {
      await http.post("/posts").send(base()).expect(401);
    });
    it.each([
      ["empty title", { title: "" }],
      ["whitespace title", { title: "     " }],
      ["missing body", { body: undefined }],
      ["whitespace body", { body: "\n\t " }],
      ["title too long (121, the column is varchar(120))", { title: "a".repeat(121) }],
      ["body too long (5001)", { body: "a".repeat(5001) }],
      ["negative price", { pricePerDay: -1 }],
      ["decimal price", { pricePerDay: 10.5 }],
      ["price as text", { pricePerDay: "ten" }],
      ["price above the maximum", { pricePerDay: 100_000_001 }],
      ["dateTo before dateFrom", { dateFrom: "2026-12-10", dateTo: "2026-12-09" }],
      ["impossible date", { dateFrom: "2026-02-30" }],
      ["date with time", { dateFrom: "2026-12-10T10:00:00Z" }],
      ["category id is text, not a number", { categoryId: "car" }],
      ["category does not exist", { categoryId: GHOST_ID }],
      ["district does not exist", { districtId: GHOST_ID }],
      ["unknown field", { hacker: true }],
      ["status chosen by client", { status: "CLOSED" }],
      ["rentStatus chosen by client", { rentStatus: "BOOKED" }],
      ["authorId chosen by client", { authorId: U.owner2 }],
      ["seats 0", { seats: 0 }],
      ["year 1900", { year: 1900 }],
      ["bad fuel", { fuel: "WATER" }],
      ["fuel LPG (not in the database enum)", { fuel: "LPG" }],
      ["area note too long (121)", { areaNote: "a".repeat(121) }],
      ["bad post type", { postType: "SELL" }],
    ])("rejects %s with 400", async (_n, over) => {
      await create(OWNER1, base(over), 400);
    });
    it("price 0, equal dates and all optional fields are accepted", async () => {
      const p = await create(OWNER1, base({
        pricePerDay: 0, dateFrom: "2026-12-10", dateTo: "2026-12-10", areaNote: "Agrabad", make: "Toyota",
        model: "Axio", year: 2018, seats: 5, transmission: "AUTOMATIC", fuel: "OCTANE", withDriver: true,
      }));
      expect(p).toMatchObject({ pricePerDay: 0, dateFrom: "2026-12-10", dateTo: "2026-12-10", seats: 5, fuel: "OCTANE", withDriver: true });
    });
    it("the author comes from the login, not from the request body", async () => {
      const p = await create(OWNER1, base());
      expect(p.author.id).toBe(U.owner1);
    });
    it("trims title and body", async () => {
      const p = await create(OWNER1, base({ title: "  Hello  ", body: "  World  " }));
      expect(p.title).toBe("Hello");
      expect(p.body).toBe("World");
    });
  });

  // ───────────────────────── Get one ─────────────────────────
  describe("get one post", () => {
    let id: string;
    beforeAll(async () => { id = (await create(OWNER1, base({ title: "Detail post" }))).id; });
    it("is public and never contains email or phone", async () => {
      const res = await http.get(`/posts/${id}`).expect(200);
      expect(res.body.title).toBe("Detail post");
      const text = JSON.stringify(res.body);
      expect(text).not.toMatch(/owner1@test\.bd/);
      expect(text).not.toMatch(/0171100000/);
      expect(res.body.author).not.toHaveProperty("email");
      expect(res.body.author).not.toHaveProperty("phone");
      expect(res.body).toHaveProperty("rentStatus", "OPEN");
      expect(res.body).toHaveProperty("images");
    });
    it("400 for a bad id, 404 for a missing post", async () => {
      await http.get("/posts/not-a-uuid").expect(400);
      await http.get("/posts/99999999-9999-4999-8999-999999999999").expect(404);
    });
  });

  // ───────────────────────── Edit / close ─────────────────────────
  describe("edit and close", () => {
    let id: string;
    beforeEach(async () => { id = (await create(OWNER1, base({ title: "Editable", make: "Honda", pricePerDay: 500000 }))).id; });

    it("a user cannot edit a post that is not theirs (and nothing changes)", async () => {
      const res = await http.patch(`/posts/${id}`).set(OWNER2).send({ title: "Hacked" }).expect(403);
      expect(res.body.message).toMatch(/your own/);
      await http.patch(`/posts/${id}`).set(RENTER1).send({ title: "Hacked" }).expect(403);
      await http.patch(`/posts/${id}`).set(ADMIN).send({ title: "Hacked" }).expect(403);
      expect((await http.get(`/posts/${id}`)).body.title).toBe("Editable");
    });
    it("a user cannot close a post that is not theirs", async () => {
      await http.patch(`/posts/${id}/close`).set(OWNER2).send().expect(403);
      expect((await http.get(`/posts/${id}`)).body.status).toBe("ACTIVE");
    });
    it("logged-out users get 401 on edit and close", async () => {
      await http.patch(`/posts/${id}`).send({ title: "x" }).expect(401);
      await http.patch(`/posts/${id}/close`).send().expect(401);
    });
    it("the author can edit; untouched fields stay; null clears an optional field", async () => {
      const res = await http.patch(`/posts/${id}`).set(OWNER1).send({ title: "  New title ", make: null, pricePerDay: 600000 }).expect(200);
      expect(res.body).toMatchObject({ title: "New title", make: null, pricePerDay: 600000 });
      expect(res.body.body).toBe("Clean car, AC works, available all week.");
    });
    it("edit validation: cannot clear title, change postType, send empty body or unknown field", async () => {
      await http.patch(`/posts/${id}`).set(OWNER1).send({ title: null }).expect(400);
      await http.patch(`/posts/${id}`).set(OWNER1).send({ title: "" }).expect(400);
      await http.patch(`/posts/${id}`).set(OWNER1).send({ postType: "REQUEST" }).expect(400);
      await http.patch(`/posts/${id}`).set(OWNER1).send({ rentStatus: "BOOKED" }).expect(400);
      await http.patch(`/posts/${id}`).set(OWNER1).send({ status: "HIDDEN" }).expect(400);
      await http.patch(`/posts/${id}`).set(OWNER1).send({}).expect(400);
      await http.patch(`/posts/${id}`).set(OWNER1).send({ categoryId: GHOST_ID }).expect(400);
    });
    it("date order is checked against the stored value too", async () => {
      await http.patch(`/posts/${id}`).set(OWNER1).send({ dateFrom: "2026-12-10", dateTo: "2026-12-20" }).expect(200);
      await http.patch(`/posts/${id}`).set(OWNER1).send({ dateTo: "2026-12-01" }).expect(400);
      await http.patch(`/posts/${id}`).set(OWNER1).send({ dateFrom: "2026-12-25" }).expect(400);
    });
    it("close works and is repeat-safe", async () => {
      const a = await http.patch(`/posts/${id}/close`).set(OWNER1).send().expect(200);
      expect(a.body.status).toBe("CLOSED");
      const b = await http.patch(`/posts/${id}/close`).set(OWNER1).send().expect(200);
      expect(b.body.status).toBe("CLOSED");
    });
    it("a closed post cannot be edited (409) but can still be opened by link", async () => {
      await http.patch(`/posts/${id}/close`).set(OWNER1).send().expect(200);
      await http.patch(`/posts/${id}`).set(OWNER1).send({ title: "late" }).expect(409);
      expect((await http.get(`/posts/${id}`).expect(200)).body.status).toBe("CLOSED");
    });
    it("a post with an active rent cannot be edited or closed (409)", async () => {
      await ds.query(`UPDATE posts SET rent_status='BOOKED' WHERE id=$1`, [id]); // what Adila's module does
      const e = await http.patch(`/posts/${id}`).set(OWNER1).send({ title: "x" }).expect(409);
      expect(e.body.message).toMatch(/active rent/);
      await http.patch(`/posts/${id}/close`).set(OWNER1).send().expect(409);
      await ds.query(`UPDATE posts SET rent_status='OPEN' WHERE id=$1`, [id]);
      await http.patch(`/posts/${id}`).set(OWNER1).send({ title: "ok now" }).expect(200);
    });
    it("edit never touches rent_status", async () => {
      await http.patch(`/posts/${id}`).set(OWNER1).send({ title: "again" }).expect(200);
      expect((await ds.query(`SELECT rent_status FROM posts WHERE id=$1`, [id]))[0].rent_status).toBe("OPEN");
    });
    it("a missing post is 404", async () => {
      await http.patch(`/posts/99999999-9999-4999-8999-999999999999`).set(OWNER1).send({ title: "x" }).expect(404);
    });
  });

  // ───────────────────────── Feed ─────────────────────────
  describe("feed, filters and search", () => {
    // Isolated data set: clear all posts, then build a known feed.
    const ids: Record<string, string> = {};
    beforeAll(async () => {
      await ds.query(`DELETE FROM posts`);
      const mk = async (key: string, headers: object, over: Record<string, unknown>) => {
        ids[key] = (await create(headers, base(over))).id;
        await new Promise((r) => setTimeout(r, 15)); // distinct created_at so "newest first" is testable
      };
      await mk("A", OWNER1, { title: "Toyota Axio sedan", body: "Comfortable family car", pricePerDay: 400000, dateFrom: "2026-12-01", dateTo: "2026-12-10", withDriver: false });
      await mk("B", OWNER1, { title: "Hiace microbus", body: "Great for tours, driver included", categoryId: categoryCar, districtId: dhaka, pricePerDay: 900000, dateFrom: "2026-12-15", dateTo: "2026-12-31", withDriver: true });
      await mk("C", OWNER2, { title: "Honda bike", body: "Fuel efficient motorbike", categoryId: categoryBike, districtId: chattogram, pricePerDay: 100000, withDriver: false });
      await mk("D", RENTER1, { postType: "REQUEST", title: "Need a car for wedding", body: "Looking for a decorated car", districtId: dhaka, pricePerDay: 600000, dateFrom: "2026-12-05", dateTo: "2026-12-06", withDriver: true });
      await mk("E", OWNER2, { title: "100% discount weekend car", body: "Special_offer", pricePerDay: 300000, dateFrom: "2026-11-01", dateTo: "2026-11-05" });
      await mk("F", OWNER1, { title: "Closed car", body: "will be closed" });
      await mk("G", OWNER1, { title: "Hidden car", body: "will be hidden" });
      await http.patch(`/posts/${ids.F}/close`).set(OWNER1).send().expect(200);
      await http.patch(`/admin/posts/${ids.G}/hide`).set(ADMIN).send({ reason: "spam" }).expect(200);
      await ds.query(`UPDATE posts SET rent_status='BOOKED' WHERE id=$1`, [ids.B]);
    });
    const feed = async (qs = "") => (await http.get(`/posts${qs}`).expect(200)).body;
    const keys = (body: any) => body.items.map((i: any) => i.id);
    const names = (body: any) => body.items.map((i: any) => i.title);

    it("is public, newest first, and hides CLOSED and HIDDEN posts", async () => {
      const b = await feed();
      expect(keys(b)).toEqual([ids.E, ids.D, ids.C, ids.B, ids.A]);
      expect(keys(b)).not.toContain(ids.F);
      expect(keys(b)).not.toContain(ids.G);
      expect(b.meta).toEqual({ page: 1, limit: 20, total: 5, totalPages: 1 });
    });
    it("items carry safe author info, preview text and a rent status", async () => {
      const b = await feed();
      const item = b.items[0];
      expect(item.author).toHaveProperty("fullName");
      expect(JSON.stringify(b)).not.toMatch(/@test\.bd/);
      expect(item).toHaveProperty("bodyPreview");
      expect(item).not.toHaveProperty("body");
      expect(item).toHaveProperty("rentStatus");
    });
    it("filter: type", async () => {
      expect(keys(await feed("?type=REQUEST"))).toEqual([ids.D]);
      expect(keys(await feed("?type=OFFER"))).toEqual([ids.E, ids.C, ids.B, ids.A]);
    });
    it("filter: category and district", async () => {
      expect(keys(await feed(`?categoryId=${categoryBike}`))).toEqual([ids.C]);
      expect(keys(await feed(`?districtId=${dhaka}`))).toEqual([ids.D, ids.B]);
      expect(keys(await feed(`?districtId=${dhaka}&type=OFFER`))).toEqual([ids.B]);
    });
    it("filter: price range (poisha), inclusive", async () => {
      expect(keys(await feed("?minPrice=400000&maxPrice=600000"))).toEqual([ids.D, ids.A]);
      expect(keys(await feed("?maxPrice=100000"))).toEqual([ids.C]);
      expect(keys(await feed("?minPrice=900000"))).toEqual([ids.B]);
    });
    it("filter: with driver true / false", async () => {
      expect(keys(await feed("?withDriver=true"))).toEqual([ids.D, ids.B]);
      expect(keys(await feed("?withDriver=false"))).toEqual([ids.E, ids.C, ids.A]);
    });
    it("filter: rent status", async () => {
      expect(keys(await feed("?rentStatus=BOOKED"))).toEqual([ids.B]);
      expect((await feed("?rentStatus=ON_RENT")).items).toEqual([]);
    });
    it("filter: dates use window overlap; posts without dates are flexible and included", async () => {
      // window 12-08..12-12 overlaps A (12-01..12-10); C has no dates so it is included
      expect(keys(await feed("?dateFrom=2026-12-08&dateTo=2026-12-12"))).toEqual([ids.C, ids.A]);
      // window 12-20..12-22 overlaps B; C flexible
      expect(keys(await feed("?dateFrom=2026-12-20&dateTo=2026-12-22"))).toEqual([ids.C, ids.B]);
      // single-day edge: touching the last day counts
      expect(keys(await feed("?dateFrom=2026-12-10&dateTo=2026-12-10"))).toEqual([ids.C, ids.A]);
      // only dateFrom: anything still available on/after it
      expect(keys(await feed("?dateFrom=2026-12-11"))).toEqual([ids.C, ids.B]);
      // only dateTo: anything that starts on/before it (E ends Nov, starts Nov 1)
      expect(keys(await feed("?dateTo=2026-11-02"))).toEqual([ids.E, ids.C]);
    });
    it("search: title or body, case-insensitive, all words must match", async () => {
      expect(names(await feed("?q=axio"))).toEqual(["Toyota Axio sedan"]);
      expect(names(await feed("?q=TOURS"))).toEqual(["Hiace microbus"]);
      expect(names(await feed("?q=family%20car"))).toEqual(["Toyota Axio sedan"]);
      expect((await feed("?q=axio%20motorbike")).items).toEqual([]);
    });
    it("search: % and _ are searched literally (no wildcard injection)", async () => {
      expect(names(await feed("?q=%25"))).toEqual(["100% discount weekend car"]);
      expect(names(await feed("?q=_"))).toEqual(["100% discount weekend car"]); // matches only the literal underscore in "Special_offer"
      expect((await feed("?q=%25%25")).items).toEqual([]);
    });
    it("search: SQL injection text is just text", async () => {
      const b = await feed(`?q=${encodeURIComponent("'; DROP TABLE posts; --")}`);
      expect(b.items).toEqual([]);
      expect(Number((await ds.query(`SELECT count(*) c FROM posts`))[0].c)).toBeGreaterThan(0);
    });
    it("filters combine", async () => {
      expect(keys(await feed(`?type=OFFER&districtId=${chattogram}&withDriver=false&maxPrice=400000&q=car`))).toEqual([ids.E, ids.A]);
    });
    it("pages: limit, page, totals, no overlap between pages", async () => {
      const p1 = await feed("?limit=2&page=1");
      const p2 = await feed("?limit=2&page=2");
      const p3 = await feed("?limit=2&page=3");
      expect(p1.meta).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
      expect([...keys(p1), ...keys(p2), ...keys(p3)]).toEqual([ids.E, ids.D, ids.C, ids.B, ids.A]);
      expect((await feed("?limit=2&page=4")).items).toEqual([]);
    });
    it("empty result gives a helpful message and the applied filters", async () => {
      const b = await feed("?q=zzzznothing&type=OFFER");
      expect(b.items).toEqual([]);
      expect(b.meta.total).toBe(0);
      expect(b.message).toMatch(/No posts match/);
      expect(b.filters).toEqual({ type: "OFFER", q: "zzzznothing" });
    });
    it.each([
      ["page 0", "?page=0"], ["negative page", "?page=-1"], ["page not a number", "?page=abc"],
      ["limit 0", "?limit=0"], ["limit above 50", "?limit=51"], ["bad type", "?type=SELL"],
      ["district is a name, not an id", "?districtId=dhaka"], ["bad date", "?dateFrom=2026-02-30"],
      ["dateTo before dateFrom", "?dateFrom=2026-12-10&dateTo=2026-12-01"],
      ["minPrice above maxPrice", "?minPrice=500&maxPrice=100"], ["negative price", "?minPrice=-5"],
      ["withDriver not boolean", "?withDriver=maybe"], ["unknown parameter", "?hacker=1"],
      ["q too long", `?q=${"a".repeat(101)}`], ["repeated parameter", "?type=OFFER&type=REQUEST"],
    ])("rejects %s with 400", async (_n, qs) => {
      await http.get(`/posts${qs}`).expect(400);
    });
    it("GET /posts/mine needs login and shows all my statuses", async () => {
      await http.get("/posts/mine").expect(401);
      const b = (await http.get("/posts/mine").set(OWNER1).expect(200)).body;
      expect(b.items.map((i: any) => i.id)).toEqual(expect.arrayContaining([ids.F, ids.G, ids.A]));
      expect(b.items.find((i: any) => i.id === ids.G)).toMatchObject({ status: "HIDDEN", hiddenReason: "spam" });
      expect(b.items.every((i: any) => i.author.id === U.owner1)).toBe(true);
      const closed = (await http.get("/posts/mine?status=CLOSED").set(OWNER1).expect(200)).body;
      expect(closed.items.map((i: any) => i.id)).toEqual([ids.F]);
    });
  });

  // ───────────────────────── Images ─────────────────────────
  describe("image upload", () => {
    let id: string;
    const countRows = async (pid: string) => Number((await ds.query(`SELECT count(*) c FROM post_images WHERE post_id=$1`, [pid]))[0].c);
    const filesOnDisk = (pid: string) => {
      const dir = join(process.cwd(), "uploads", "posts", pid);
      return existsSync(dir) ? readdirSync(dir) : [];
    };
    beforeEach(async () => { id = (await create(OWNER1, base({ title: "Image post" }))).id; });

    it("saves a PNG with a safe server-chosen name, stores the path and serves it", async () => {
      const res = await http.post(`/posts/${id}/images`).set(OWNER1).attach("images", PNG, { filename: "../../evil name.php.png", contentType: "image/png" }).expect(201);
      expect(res.body).toHaveLength(1);
      const { url, position } = res.body[0];
      expect(position).toBe(0);
      expect(url).toMatch(new RegExp(`^/uploads/posts/${id}/[0-9a-f-]{36}\\.png$`));
      expect(url).not.toMatch(/evil|php|\.\./);
      expect(filesOnDisk(id)).toHaveLength(1);
      const row = (await ds.query(`SELECT file_path FROM post_images WHERE post_id=$1`, [id]))[0];
      expect(row.file_path).toMatch(/^posts\/.+\.png$/);
      const served = await http.get(url).expect(200);
      expect(served.headers["content-type"]).toMatch(/image\/png/);
      expect(Buffer.compare(served.body, PNG)).toBe(0);
      // the post detail now lists it
      expect((await http.get(`/posts/${id}`)).body.images).toHaveLength(1);
    });
    it("the extension comes from the real content: a JPEG named .png is saved as .jpg", async () => {
      const res = await http.post(`/posts/${id}/images`).set(OWNER1).attach("images", JPG, { filename: "photo.png", contentType: "image/png" }).expect(201);
      expect(res.body[0].url).toMatch(/\.jpg$/);
    });
    it("rejects a text file pretending to be an image (named .jpg, sent as image/jpeg)", async () => {
      const res = await http.post(`/posts/${id}/images`).set(OWNER1).attach("images", Buffer.from("just text"), { filename: "a.jpg", contentType: "image/jpeg" }).expect(400);
      expect(res.body.message).toMatch(/not a JPEG, PNG or WEBP/);
      expect(await countRows(id)).toBe(0);
      expect(filesOnDisk(id)).toEqual([]);
    });
    it("rejects HTML, SVG and PDF content", async () => {
      for (const [name, data] of [["x.html", "<script>alert(1)</script>"], ["x.svg", '<svg onload="alert(1)"/>'], ["x.pdf", "%PDF-1.4"]] as const) {
        await http.post(`/posts/${id}/images`).set(OWNER1).attach("images", Buffer.from(data), { filename: name, contentType: "image/png" }).expect(400);
      }
      expect(filesOnDisk(id)).toEqual([]);
    });
    it("rejects a file over 5 MB with 413", async () => {
      const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 10)]);
      await http.post(`/posts/${id}/images`).set(OWNER1).attach("images", big, { filename: "big.png", contentType: "image/png" }).expect(413);
      expect(await countRows(id)).toBe(0);
    });
    it("accepts exactly 5 images and rejects a SIXTH (new request)", async () => {
      let req = http.post(`/posts/${id}/images`).set(OWNER1);
      for (let i = 0; i < 5; i++) req = req.attach("images", PNG, { filename: `p${i}.png`, contentType: "image/png" });
      const ok = await req.expect(201);
      expect(ok.body.map((i: any) => i.position)).toEqual([0, 1, 2, 3, 4]);
      const sixth = await http.post(`/posts/${id}/images`).set(OWNER1).attach("images", PNG, { filename: "six.png", contentType: "image/png" }).expect(400);
      expect(sixth.body.message).toMatch(/at most 5 images/);
      expect(await countRows(id)).toBe(5);
      expect(filesOnDisk(id)).toHaveLength(5);
    });
    it("rejects 6 files in ONE request, and 3+3 across two requests, saving nothing extra", async () => {
      let six = http.post(`/posts/${id}/images`).set(OWNER1);
      for (let i = 0; i < 6; i++) six = six.attach("images", PNG, { filename: `p${i}.png`, contentType: "image/png" });
      await six.expect(400);
      expect(await countRows(id)).toBe(0);
      let three = http.post(`/posts/${id}/images`).set(OWNER1);
      for (let i = 0; i < 3; i++) three = three.attach("images", PNG, { filename: `a${i}.png`, contentType: "image/png" });
      await three.expect(201);
      let more = http.post(`/posts/${id}/images`).set(OWNER1);
      for (let i = 0; i < 3; i++) more = more.attach("images", PNG, { filename: `b${i}.png`, contentType: "image/png" });
      await more.expect(400);
      expect(await countRows(id)).toBe(3);
      expect(filesOnDisk(id)).toHaveLength(3); // the failed request left no orphan files
    });
    it("two uploads at the same moment cannot exceed 5 (race test)", async () => {
      const send = () => {
        let r = http.post(`/posts/${id}/images`).set(OWNER1);
        for (let i = 0; i < 3; i++) r = r.attach("images", PNG, { filename: `r${i}.png`, contentType: "image/png" });
        return r;
      };
      const results = await Promise.all([send(), send()]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
      expect(await countRows(id)).toBe(3);
      expect(filesOnDisk(id)).toHaveLength(3);
    });
    it("a missing field or no file gives a clear 400", async () => {
      const res = await http.post(`/posts/${id}/images`).set(OWNER1).send().expect(400);
      expect(res.body.message).toMatch(/No image files/);
      await http.post(`/posts/${id}/images`).set(OWNER1).attach("wrongfield", PNG, { filename: "a.png", contentType: "image/png" }).expect(400);
    });
    it("only the author can upload or delete; login required", async () => {
      await http.post(`/posts/${id}/images`).set(OWNER2).attach("images", PNG, { filename: "a.png", contentType: "image/png" }).expect(403);
      await http.post(`/posts/${id}/images`).attach("images", PNG, { filename: "a.png", contentType: "image/png" }).expect(401);
      const up = await http.post(`/posts/${id}/images`).set(OWNER1).attach("images", PNG, { filename: "a.png", contentType: "image/png" }).expect(201);
      await http.delete(`/posts/${id}/images/${up.body[0].id}`).set(OWNER2).expect(403);
      await http.delete(`/posts/${id}/images/${up.body[0].id}`).expect(401);
      expect(await countRows(id)).toBe(1);
    });
    it("deleting an image frees its slot, and its file is removed", async () => {
      let req = http.post(`/posts/${id}/images`).set(OWNER1);
      for (let i = 0; i < 5; i++) req = req.attach("images", PNG, { filename: `p${i}.png`, contentType: "image/png" });
      const up = (await req.expect(201)).body;
      await http.delete(`/posts/${id}/images/${up[2].id}`).set(OWNER1).expect(200);
      expect(filesOnDisk(id)).toHaveLength(4);
      const again = await http.post(`/posts/${id}/images`).set(OWNER1).attach("images", PNG, { filename: "n.png", contentType: "image/png" }).expect(201);
      expect(again.body[0].position).toBe(2); // lowest free slot reused
      await http.delete(`/posts/${id}/images/${up[2].id}`).set(OWNER1).expect(404); // already gone
    });
    it("a closed post cannot get new images (409)", async () => {
      await http.patch(`/posts/${id}/close`).set(OWNER1).send().expect(200);
      await http.post(`/posts/${id}/images`).set(OWNER1).attach("images", PNG, { filename: "a.png", contentType: "image/png" }).expect(409);
    });
    it("a missing post is 404", async () => {
      await http.post(`/posts/99999999-9999-4999-8999-999999999999/images`).set(OWNER1).attach("images", PNG, { filename: "a.png", contentType: "image/png" }).expect(404);
    });
  });

  // ───────────────────────── Admin ─────────────────────────
  describe("admin hide / unhide", () => {
    let id: string;
    beforeEach(async () => { id = (await create(OWNER1, base({ title: "Moderation target" }))).id; });

    it("an ordinary user (any role) and a logged-out user cannot use admin routes", async () => {
      await http.patch(`/admin/posts/${id}/hide`).send().expect(401);
      for (const h of [OWNER1, OWNER2, RENTER1]) {
        await http.patch(`/admin/posts/${id}/hide`).set(h).send().expect(403);
        await http.patch(`/admin/posts/${id}/unhide`).set(h).send().expect(403);
        await http.get("/admin/posts").set(h).expect(403);
      }
      expect((await http.get(`/posts/${id}`)).body.status).toBe("ACTIVE");
    });
    it("hide removes the post from the feed and from public view; the author sees why", async () => {
      const res = await http.patch(`/admin/posts/${id}/hide`).set(ADMIN).send({ reason: "Scam price" }).expect(200);
      expect(res.body).toMatchObject({ status: "HIDDEN", hiddenReason: "Scam price" });
      await http.get(`/posts/${id}`).expect(404);
      const feedIds = (await http.get("/posts?limit=50")).body.items.map((i: any) => i.id);
      expect(feedIds).not.toContain(id);
      const mine = (await http.get("/posts/mine?status=HIDDEN").set(OWNER1)).body.items.find((i: any) => i.id === id);
      expect(mine).toMatchObject({ status: "HIDDEN", hiddenReason: "Scam price" });
    });
    it("the author cannot edit, close or add images to a hidden post", async () => {
      await http.patch(`/admin/posts/${id}/hide`).set(ADMIN).send().expect(200);
      expect((await http.patch(`/posts/${id}`).set(OWNER1).send({ title: "x" }).expect(409)).body.message).toMatch(/hidden by an admin/);
      await http.patch(`/posts/${id}/close`).set(OWNER1).send().expect(409);
      await http.post(`/posts/${id}/images`).set(OWNER1).attach("images", PNG, { filename: "a.png", contentType: "image/png" }).expect(409);
    });
    it("unhide restores an ACTIVE post to ACTIVE and a CLOSED post to CLOSED", async () => {
      await http.patch(`/admin/posts/${id}/hide`).set(ADMIN).send().expect(200);
      expect((await http.patch(`/admin/posts/${id}/unhide`).set(ADMIN).send().expect(200)).body).toMatchObject({ status: "ACTIVE", hiddenReason: null });
      await http.patch(`/posts/${id}/close`).set(OWNER1).send().expect(200);
      await http.patch(`/admin/posts/${id}/hide`).set(ADMIN).send().expect(200);
      expect((await http.patch(`/admin/posts/${id}/unhide`).set(ADMIN).send().expect(200)).body.status).toBe("CLOSED");
    });
    it("hide and unhide are repeat-safe; unknown posts are 404", async () => {
      await http.patch(`/admin/posts/${id}/hide`).set(ADMIN).send({ reason: "first" }).expect(200);
      const again = await http.patch(`/admin/posts/${id}/hide`).set(ADMIN).send({ reason: "second" }).expect(200);
      expect(again.body).toMatchObject({ status: "HIDDEN", hiddenReason: "first" });
      await http.patch(`/admin/posts/${id}/unhide`).set(ADMIN).send().expect(200);
      await http.patch(`/admin/posts/${id}/unhide`).set(ADMIN).send().expect(200);
      await http.patch(`/admin/posts/99999999-9999-4999-8999-999999999999/hide`).set(ADMIN).send().expect(404);
      await http.patch(`/admin/posts/99999999-9999-4999-8999-999999999999/unhide`).set(ADMIN).send().expect(404);
      await http.patch(`/admin/posts/nope/hide`).set(ADMIN).send().expect(400);
    });
    it("hiding does not change the rent status copy", async () => {
      await ds.query(`UPDATE posts SET rent_status='ON_RENT' WHERE id=$1`, [id]);
      await http.patch(`/admin/posts/${id}/hide`).set(ADMIN).send().expect(200);
      expect((await ds.query(`SELECT rent_status FROM posts WHERE id=$1`, [id]))[0].rent_status).toBe("ON_RENT");
    });
    it("reason is limited to 300 characters; unknown fields rejected", async () => {
      await http.patch(`/admin/posts/${id}/hide`).set(ADMIN).send({ reason: "a".repeat(301) }).expect(400);
      await http.patch(`/admin/posts/${id}/hide`).set(ADMIN).send({ status: "ACTIVE" }).expect(400);
    });
    it("admin list can filter by status", async () => {
      await http.patch(`/admin/posts/${id}/hide`).set(ADMIN).send().expect(200);
      const b = (await http.get("/admin/posts?status=HIDDEN").set(ADMIN).expect(200)).body;
      expect(b.items.map((i: any) => i.id)).toContain(id);
      expect(b.items.every((i: any) => i.status === "HIDDEN")).toBe(true);
    });
  });

  // ----- Real login -----
  describe("with a real login token (Sadat's /auth)", () => {
    const REG = (email: string, phone: string, role: string) => ({ fullName: "Real User", email, phone, password: "Passw0rd1", role });
    const tokenFor = async (email: string, phone: string, role: string) => {
      await http.post("/auth/register").send(REG(email, phone, role));
      const res = await http.post("/auth/login").send({ email, password: "Passw0rd1" }).expect(200);
      return res.body.accessToken as string;
    };
    const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

    it("a real token works for POST /posts, and the role comes from the account", async () => {
      const t = await tokenFor("real.owner@test.bd", "01755000001", "OWNER");
      const p = await create(bearer(t), base({ title: "Created with a real token" }));
      expect(p.author.fullName).toBe("Real User");
      await create(bearer(t), base({ postType: "REQUEST" }), 403);
    });
    it("a fake or tampered token is 401", async () => {
      const t = await tokenFor("real.owner2@test.bd", "01755000002", "OWNER");
      await create(bearer("abc.def.ghi"), base(), 401);
      await create(bearer(t.slice(0, -3) + "xyz"), base(), 401);
    });
    it("after logout the old token no longer works", async () => {
      const t = await tokenFor("real.owner3@test.bd", "01755000003", "OWNER");
      await create(bearer(t), base({ title: "before logout" }), 201);
      await http.post("/auth/logout").set(bearer(t)).expect(200);
      await create(bearer(t), base({ title: "after logout" }), 401);
    });
    it("a suspended user's token is rejected on private post routes", async () => {
      const t = await tokenFor("real.owner4@test.bd", "01755000004", "OWNER");
      await ds.query(`UPDATE users SET status='SUSPENDED' WHERE email='real.owner4@test.bd'`);
      const res = await create(bearer(t), base(), 403);
      expect(res.message).toMatch(/suspended/);
      await http.get("/posts/mine").set(bearer(t)).expect(403);
    });
    it("the audit log records a post creation (Sadat's global interceptor, no code needed here)", async () => {
      const t = await tokenFor("real.owner5@test.bd", "01755000005", "OWNER");
      const p = await create(bearer(t), base({ title: "Audited post" }));
      const rows = await ds.query(`SELECT action, entity, status_code FROM audit_logs WHERE entity_id = $1`, [p.id]);
      expect(rows[0]).toMatchObject({ entity: "posts", status_code: 201 });
    });
  });
});
