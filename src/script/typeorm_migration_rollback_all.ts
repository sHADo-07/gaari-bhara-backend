import { dataSourceOptions } from "@/config/.";
import { DataSource } from "typeorm";

/** pnpm migration:rollbackAll  - undoes every migration, one by one, in the right order. */
async function rollbackAll() {
  const ds = new DataSource({ ...dataSourceOptions });
  await ds.initialize();
  try {
    const executed = await ds.query(`SELECT count(*)::int AS n FROM migrations`);
    for (let i = 0; i < executed[0].n; i++) await ds.undoLastMigration();
    console.log("All migrations rolled back");
  } finally {
    await ds.destroy();
  }
}

rollbackAll().catch((err) => {
  console.error("Rollback failed:", err);
  process.exit(1);
});
