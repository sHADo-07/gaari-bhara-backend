import { dataSourceOptions } from "@/config/.";
import { DataSource } from "typeorm";

/** pnpm migration:run  - creates / updates all tables (safe to run again). */
async function migrateRun() {
  console.log("Migrating...");
  const ds = new DataSource({ ...dataSourceOptions });
  await ds.initialize();
  try {
    const done = await ds.runMigrations();
    console.log(done.length ? `Migrations run: ${done.map((m) => m.name).join(", ")}` : "Nothing to migrate. Database is up to date.");
  } finally {
    await ds.destroy();
  }
}

migrateRun().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
