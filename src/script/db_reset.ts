import { dataSourceOptions } from "@/config/.";
import { appConfig } from "@/config/app.config";
import { DataSource } from "typeorm";

/** pnpm db:reset  - DEVELOPMENT ONLY. Drops everything, then builds all tables again. */
async function reset() {
  if (appConfig.env.NODE_ENV === "production") throw new Error("db:reset is not allowed in production");
  const ds = new DataSource({ ...dataSourceOptions });
  await ds.initialize();
  try {
    await ds.query(`DROP SCHEMA public CASCADE`);
    await ds.query(`CREATE SCHEMA public`);
    const done = await ds.runMigrations();
    console.log(`Database reset. Migrations run: ${done.length}`);
  } finally {
    await ds.destroy();
  }
}

reset().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
