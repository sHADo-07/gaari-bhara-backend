import { DataSource } from "typeorm";
import { openDb, resetDatabase } from "./helpers/db";
import { CreateUsersAndAuth1730000000001 } from "../src/database/migrations/1730000000001-CreateUsersAndAuth";
import { CreateLookups1730000000002 } from "../src/database/migrations/1730000000002-CreateLookups";
import { CreatePosts1730000000003 } from "../src/database/migrations/1730000000003-CreatePosts";
import { CreateRentsAndReviews1730000000004 } from "../src/database/migrations/1730000000004-CreateRentsAndReviews";
import { CreateChat1730000000005 } from "../src/database/migrations/1730000000005-CreateChat";

/**
 * Database checks from the manual (Part 6). They prove that the RULES live in the database,
 * not only in application code. Every module owner can add checks for their own tables here.
 */
describe("Database rules (migrations from an empty database)", () => {
  let db: DataSource;

  // PostgreSQL error codes
  const UNIQUE = "23505";
  const FOREIGN_KEY = "23503";
  const CHECK = "23514";
  const EXCLUSION = "23P01";

  async function expectDbError(promise: Promise<unknown>, code: string, constraint?: string) {
    try {
      await promise;
    } catch (e: any) {
      expect(e.driverError?.code ?? e.code).toBe(code);
      if (constraint) expect(e.driverError?.constraint ?? e.constraint).toBe(constraint);
      return;
    }
    throw new Error(`Expected database error ${code}${constraint ? " (" + constraint + ")" : ""} but the query succeeded`);
  }

  let n = 0;
  const user = async (role = "RENTER") => {
    n += 1;
    const rows = await db.query(
      `INSERT INTO users (role, full_name, email, phone, password_hash)
       VALUES ($1::user_role, $2, $3, $4, 'x') RETURNING id`,
      [role, `User ${n}`, `user${n}@example.com`, `0171${String(1000000 + n).slice(-7)}`],
    );
    return rows[0].id as string;
  };

  const post = async (authorId: string, over: Record<string, any> = {}) => {
    const rows = await db.query(
      `INSERT INTO posts (author_id, post_type, title, body, category_id, district_id, price_per_day, date_from, date_to)
       VALUES ($1, $2::post_type, $3, 'Body text', 1, 1, $4, $5, $6) RETURNING id`,
      [authorId, over.type ?? "OFFER", over.title ?? "Toyota Noah", over.price ?? 500000, over.from ?? "2026-12-01", over.to ?? "2026-12-31"],
    );
    return rows[0].id as string;
  };

  const rent = (postId: string, owner: string, renter: string, start: string, end: string, status = "PENDING", startedBy?: string) =>
    db.query(
      `INSERT INTO rents (post_id, owner_id, renter_id, started_by, start_date, end_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7::rent_status) RETURNING id`,
      [postId, owner, renter, startedBy ?? renter, start, end, status],
    );

  beforeAll(async () => {
    await resetDatabase();
    db = await openDb();
  });
  afterAll(async () => db.destroy());

  it("creates every agreed table", async () => {
    const rows = await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
    const names = rows.map((r: any) => r.table_name);
    for (const t of [
      "users", "revoked_tokens", "categories", "districts", "posts", "post_images",
      "rents", "rent_status_history", "reviews", "conversations", "messages", "conversation_reads",
    ]) {
      expect(names).toContain(t);
    }
  });

  it("loads the seed data: 64 districts in 8 divisions and 6 categories", async () => {
    expect((await db.query(`SELECT count(*)::int AS n FROM districts`))[0].n).toBe(64);
    expect((await db.query(`SELECT count(DISTINCT division)::int AS n FROM districts`))[0].n).toBe(8);
    expect((await db.query(`SELECT count(*)::int AS n FROM categories`))[0].n).toBe(6);
    const dhaka = await db.query(`SELECT division FROM districts WHERE name = 'Dhaka'`);
    expect(dhaka[0].division).toBe("Dhaka");
  });

  it("can be rolled back and built again (down() works)", async () => {
    const ds = new DataSource({
      type: "postgres",
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 5432),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      migrations: [
        CreateUsersAndAuth1730000000001,
        CreateLookups1730000000002,
        CreatePosts1730000000003,
        CreateRentsAndReviews1730000000004,
        CreateChat1730000000005,
      ],
    });
    await ds.initialize();
    try {
      for (let i = 0; i < 5; i++) await ds.undoLastMigration();
      const left = await ds.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name <> 'migrations'`);
      expect(left).toHaveLength(0);
      const types = await ds.query(`SELECT typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e'`);
      expect(types).toHaveLength(0);
      await ds.runMigrations();
    } finally {
      await ds.destroy();
    }
  });

  describe("users", () => {
    it("rejects the same email or phone twice, upper-case emails and bad phones", async () => {
      await db.query(`INSERT INTO users (role, full_name, email, phone, password_hash) VALUES ('RENTER','A','a@example.com','01711111111','x')`);
      await expectDbError(db.query(`INSERT INTO users (role, full_name, email, phone, password_hash) VALUES ('OWNER','B','a@example.com','01711111112','x')`), UNIQUE, "users_email_key");
      await expectDbError(db.query(`INSERT INTO users (role, full_name, email, phone, password_hash) VALUES ('OWNER','B','b@example.com','01711111111','x')`), UNIQUE, "users_phone_key");
      await expectDbError(db.query(`INSERT INTO users (role, full_name, email, phone, password_hash) VALUES ('OWNER','B','B@Example.com','01711111113','x')`), CHECK, "users_email_lowercase");
      await expectDbError(db.query(`INSERT INTO users (role, full_name, email, phone, password_hash) VALUES ('OWNER','B','c@example.com','12345','x')`), CHECK, "users_phone_format");
      await expectDbError(db.query(`INSERT INTO users (role, full_name, email, phone, password_hash) VALUES ('KING','B','d@example.com','01711111114','x')`), "22P02");
    });

    it("keeps updated_at correct by itself", async () => {
      const id = await user();
      const before = (await db.query(`SELECT updated_at FROM users WHERE id = $1`, [id]))[0].updated_at as Date;
      await new Promise((r) => setTimeout(r, 20));
      await db.query(`UPDATE users SET full_name = 'Changed' WHERE id = $1`, [id]);
      const after = (await db.query(`SELECT updated_at FROM users WHERE id = $1`, [id]))[0].updated_at as Date;
      expect(after.getTime()).toBeGreaterThan(before.getTime());
    });

    it("a user cannot be deleted while posts point to them", async () => {
      const id = await user("OWNER");
      await post(id);
      await expectDbError(db.query(`DELETE FROM users WHERE id = $1`, [id]), FOREIGN_KEY);
    });
  });

  describe("posts", () => {
    it("rejects a negative price and an end date before the start date", async () => {
      const a = await user("OWNER");
      await expectDbError(post(a, { price: -1 }), CHECK, "posts_price_not_negative");
      await expectDbError(post(a, { from: "2026-12-10", to: "2026-12-01" }), CHECK, "posts_dates_order");
      await expectDbError(post(a, { title: "   " }), CHECK, "posts_title_not_empty");
    });

    it("rejects an unknown category or district", async () => {
      const a = await user("OWNER");
      await expectDbError(
        db.query(`INSERT INTO posts (author_id, post_type, title, body, category_id, district_id) VALUES ($1,'OFFER','t','b',999,1)`, [a]),
        FOREIGN_KEY,
      );
    });

    it("starts as ACTIVE and OPEN, and deleting a post deletes its images", async () => {
      const a = await user("OWNER");
      const p = await post(a);
      const row = (await db.query(`SELECT status, rent_status FROM posts WHERE id = $1`, [p]))[0];
      expect(row).toEqual({ status: "ACTIVE", rent_status: "OPEN" });
      await db.query(`INSERT INTO post_images (post_id, file_path) VALUES ($1, '/uploads/a.jpg'), ($1, '/uploads/b.jpg')`, [p]);
      await db.query(`DELETE FROM posts WHERE id = $1`, [p]);
      expect((await db.query(`SELECT count(*)::int AS n FROM post_images WHERE post_id = $1`, [p]))[0].n).toBe(0);
    });
  });

  describe("rents: no double booking", () => {
    let owner: string, renter1: string, renter2: string, postId: string;
    beforeAll(async () => {
      owner = await user("OWNER");
      renter1 = await user();
      renter2 = await user();
      postId = await post(owner);
    });

    it("owner and renter must be different people; dates must be in order", async () => {
      await expectDbError(rent(postId, owner, owner, "2026-12-01", "2026-12-02", "PENDING", owner), CHECK, "rents_different_people");
      await expectDbError(rent(postId, owner, renter1, "2026-12-05", "2026-12-01"), CHECK, "rents_dates_order");
      const stranger = await user();
      await expectDbError(rent(postId, owner, renter1, "2026-12-01", "2026-12-02", "PENDING", stranger), CHECK, "rents_started_by_is_party");
    });

    it("many PENDING rents may overlap (they are only requests)", async () => {
      await rent(postId, owner, renter1, "2026-12-01", "2026-12-05");
      await rent(postId, owner, renter2, "2026-12-03", "2026-12-07");
    });

    it("two CONFIRMED rents of the same post cannot overlap (error 23P01)", async () => {
      await rent(postId, owner, renter1, "2026-12-10", "2026-12-15", "CONFIRMED");
      await expectDbError(rent(postId, owner, renter2, "2026-12-14", "2026-12-18", "CONFIRMED"), EXCLUSION, "rents_no_overlap");
      await expectDbError(rent(postId, owner, renter2, "2026-12-15", "2026-12-15", "ONGOING"), EXCLUSION, "rents_no_overlap");
      await expectDbError(rent(postId, owner, renter2, "2026-12-09", "2026-12-20", "CONFIRMED"), EXCLUSION, "rents_no_overlap");
    });

    it("rents that do not overlap are fine (the day after the end is free)", async () => {
      await rent(postId, owner, renter2, "2026-12-16", "2026-12-20", "CONFIRMED");
      await rent(postId, owner, renter2, "2026-12-06", "2026-12-09", "CONFIRMED");
    });

    it("a different post has its own calendar", async () => {
      const other = await post(owner, { title: "Other car" });
      await rent(other, owner, renter2, "2026-12-10", "2026-12-15", "CONFIRMED");
    });

    it("a CANCELLED rent frees the dates, and a pending one can be confirmed only without a clash", async () => {
      const p = await post(owner, { title: "Third car" });
      const first = (await rent(p, owner, renter1, "2026-12-01", "2026-12-05", "CONFIRMED"))[0].id;
      const second = (await rent(p, owner, renter2, "2026-12-03", "2026-12-04", "PENDING"))[0].id;
      await expectDbError(db.query(`UPDATE rents SET status = 'CONFIRMED' WHERE id = $1`, [second]), EXCLUSION);
      await db.query(`UPDATE rents SET status = 'CANCELLED' WHERE id = $1`, [first]);
      await db.query(`UPDATE rents SET status = 'CONFIRMED' WHERE id = $1`, [second]);
    });

    it("concurrency: 20 people confirm the same dates at the same time, exactly one wins", async () => {
      const p = await post(owner, { title: "Busy car" });
      const renters = await Promise.all(Array.from({ length: 20 }, () => user()));
      const ids = (
        await Promise.all(renters.map((r) => rent(p, owner, r, "2027-01-10", "2027-01-12", "PENDING")))
      ).map((rows) => rows[0].id as string);
      const results = await Promise.allSettled(
        ids.map((id) => db.query(`UPDATE rents SET status = 'CONFIRMED' WHERE id = $1`, [id])),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(19);
      const confirmed = await db.query(`SELECT count(*)::int AS n FROM rents WHERE post_id = $1 AND status = 'CONFIRMED'`, [p]);
      expect(confirmed[0].n).toBe(1);
    });

    it("keeps the status history and deletes it with the rent", async () => {
      const id = (await rent(postId, owner, renter1, "2027-02-01", "2027-02-02"))[0].id;
      await db.query(`INSERT INTO rent_status_history (rent_id, old_status, new_status, changed_by) VALUES ($1, NULL, 'PENDING', $2)`, [id, renter1]);
      await db.query(`INSERT INTO rent_status_history (rent_id, old_status, new_status, changed_by, note) VALUES ($1, 'PENDING', 'CANCELLED', $2, 'Changed my mind')`, [id, renter1]);
      expect((await db.query(`SELECT count(*)::int AS n FROM rent_status_history WHERE rent_id = $1`, [id]))[0].n).toBe(2);
      await db.query(`DELETE FROM rents WHERE id = $1`, [id]);
      expect((await db.query(`SELECT count(*)::int AS n FROM rent_status_history WHERE rent_id = $1`, [id]))[0].n).toBe(0);
    });
  });

  describe("reviews", () => {
    let owner: string, renter: string, rentId: string;
    beforeAll(async () => {
      owner = await user("OWNER");
      renter = await user();
      const p = await post(owner, { title: "Reviewed car" });
      rentId = (await rent(p, owner, renter, "2027-03-01", "2027-03-02", "ENDED"))[0].id;
    });
    const review = (author: string, subject: string, rating: number, comment = "Good rent") =>
      db.query(`INSERT INTO reviews (rent_id, author_id, subject_id, rating, comment) VALUES ($1,$2,$3,$4,$5)`, [rentId, author, subject, rating, comment]);

    it("each side can review once; a second review by the same person is rejected", async () => {
      await review(renter, owner, 5);
      await review(owner, renter, 4);
      await expectDbError(review(renter, owner, 3), UNIQUE, "reviews_one_per_author_per_rent");
    });

    it("rating must be 1 to 5, text must exist, nobody reviews themselves", async () => {
      const x = await user();
      await expectDbError(review(x, owner, 0), CHECK, "reviews_rating_range");
      await expectDbError(review(x, owner, 6), CHECK, "reviews_rating_range");
      await expectDbError(review(x, owner, 3, "   "), CHECK, "reviews_comment_length");
      await expectDbError(review(x, x, 3), CHECK, "reviews_author_not_subject");
    });
  });

  describe("chat", () => {
    let a: string, b: string, postId: string, low: string, high: string, convId: string;
    beforeAll(async () => {
      a = await user("OWNER");
      b = await user();
      postId = await post(a, { title: "Chat post" });
      [low, high] = a < b ? [a, b] : [b, a];
    });

    it("one conversation for each pair of users for each post, saved in a fixed order", async () => {
      await expectDbError(
        db.query(`INSERT INTO conversations (user_low_id, user_high_id, post_id) VALUES ($1,$2,$3)`, [high, low, postId]),
        CHECK, "conversations_user_order",
      );
      await expectDbError(
        db.query(`INSERT INTO conversations (user_low_id, user_high_id, post_id) VALUES ($1,$1,$2)`, [low, postId]),
        CHECK, "conversations_user_order",
      );
      convId = (await db.query(`INSERT INTO conversations (user_low_id, user_high_id, post_id) VALUES ($1,$2,$3) RETURNING id`, [low, high, postId]))[0].id;
      await expectDbError(
        db.query(`INSERT INTO conversations (user_low_id, user_high_id, post_id) VALUES ($1,$2,$3)`, [low, high, postId]),
        UNIQUE, "conversations_one_per_pair_per_post",
      );
    });

    it("a message sent twice with the same browser id is stored once", async () => {
      const cid = "77777777-7777-7777-7777-777777777777";
      await db.query(`INSERT INTO messages (conversation_id, sender_id, body, client_msg_id) VALUES ($1,$2,'Hello',$3)`, [convId, a, cid]);
      await expectDbError(
        db.query(`INSERT INTO messages (conversation_id, sender_id, body, client_msg_id) VALUES ($1,$2,'Hello',$3)`, [convId, a, cid]),
        UNIQUE, "messages_sender_client_id_key",
      );
      // the other person may use the same browser id
      await db.query(`INSERT INTO messages (conversation_id, sender_id, body, client_msg_id) VALUES ($1,$2,'Hi',$3)`, [convId, b, cid]);
    });

    it("rejects empty and too long messages, and message numbers only go up", async () => {
      const send = (body: string) =>
        db.query(`INSERT INTO messages (conversation_id, sender_id, body, client_msg_id) VALUES ($1,$2,$3,gen_random_uuid()) RETURNING id`, [convId, a, body]);
      await expectDbError(send(""), CHECK, "messages_body_length");
      await expectDbError(send("x".repeat(2001)), CHECK, "messages_body_length");
      const m1 = (await send("x".repeat(2000)))[0].id;
      const m2 = (await send("next"))[0].id;
      expect(BigInt(m2)).toBeGreaterThan(BigInt(m1));
    });

    it("keeps one read mark for each person in each conversation", async () => {
      const last = (await db.query(`SELECT max(id) AS id FROM messages WHERE conversation_id = $1`, [convId]))[0].id;
      await db.query(`INSERT INTO conversation_reads (conversation_id, user_id, last_read_message_id) VALUES ($1,$2,$3)`, [convId, a, last]);
      await expectDbError(
        db.query(`INSERT INTO conversation_reads (conversation_id, user_id, last_read_message_id) VALUES ($1,$2,$3)`, [convId, a, last]),
        UNIQUE,
      );
    });
  });
});
