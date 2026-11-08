import { dataSourceOptions } from "@/config/.";
import { DataSource } from "typeorm";

/** pnpm migration:rollback  - undoes the LAST migration. */
async function rollback() {
  const ds = new DataSource({ ...dataSourceOptions });
  await ds.initialize();
  try {
    await ds.undoLastMigration();
    console.log("Last migration rolled back");
  } finally {
    await ds.destroy();
  }
}

rollback().catch((err) => {
  console.error("Rollback failed:", err);
  process.exit(1);
});
