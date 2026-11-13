declare const process: { env: Record<string, string | undefined> };

import { DataSource } from "typeorm";
import { CreateUsersAndAuth1730000000001 } from "../../src/database/migrations/1730000000001-CreateUsersAndAuth";
import { CreateLookups1730000000002 } from "../../src/database/migrations/1730000000002-CreateLookups";
import { CreatePosts1730000000003 } from "../../src/database/migrations/1730000000003-CreatePosts";
import { CreateRentsAndReviews1730000000004 } from "../../src/database/migrations/1730000000004-CreateRentsAndReviews";
import { CreateChat1730000000005 } from "../../src/database/migrations/1730000000005-CreateChat";
import { CreateAuditLogs1730000000006 } from "../../src/database/migrations/1730000000006-CreateAuditLogs";
import { AddPostModerationAndImageConstraints1730000000007 } from "../../src/database/migrations/1730000000007-AddPostModerationAndImageConstraints";

const connection = (database: string) => ({
  type: "postgres" as const,
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "1234",
  database,
});

/** Creates the "_test" database if it is missing (so nobody has to do it by hand). */
async function ensureTestDatabase() {
  const name = process.env.DB_DATABASE || "car-rent";
  const admin = new DataSource(connection("postgres"));
  await admin.initialize();
  try {
    const found = await admin.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [name]);
    if (!found.length) await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.destroy();
  }
}

/** Wipes the test database and builds every table again from the migrations. */
export async function resetDatabase() {
  await ensureTestDatabase();
  const ds = new DataSource({
    ...connection(process.env.DB_DATABASE || "car-rent"),
    migrations: [
      CreateUsersAndAuth1730000000001,
      CreateLookups1730000000002,
      CreatePosts1730000000003,
      CreateRentsAndReviews1730000000004,
      CreateChat1730000000005,
      CreateAuditLogs1730000000006,
      AddPostModerationAndImageConstraints1730000000007,
    ],
  });
  await ds.initialize();
  try {
    await ds.query(`DROP SCHEMA public CASCADE`);
    await ds.query(`CREATE SCHEMA public`);
    await ds.runMigrations();
  } finally {
    await ds.destroy();
  }
}

export function openDb() {
  return new DataSource(connection(process.env.DB_DATABASE || "car-rent")).initialize();
}
