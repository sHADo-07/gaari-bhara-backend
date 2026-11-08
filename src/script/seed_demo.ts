import * as argon2 from "argon2";
import { DataSource } from "typeorm";
import { dataSourceOptions } from "@/config/.";
import { appConfig } from "@/config/app.config";

/**
 * pnpm seed:demo  - creates the demo accounts for the whole team. Safe to run again.
 *
 * All demo accounts use the password in DEMO_PASSWORD (default: Demo@12345).
 * DEMO ONLY. Never run this against a real production database.
 */
const DEMO_USERS = [
  { role: "ADMIN", fullName: "Admin Gaari", email: "admin@gaaribhara.test", phone: "01711000001" },
  { role: "OWNER", fullName: "Karim Owner", email: "owner1@gaaribhara.test", phone: "01711000011" },
  { role: "OWNER", fullName: "Salma Owner", email: "owner2@gaaribhara.test", phone: "01711000012" },
  { role: "OWNER", fullName: "Jamal Owner", email: "owner3@gaaribhara.test", phone: "01711000013" },
  { role: "RENTER", fullName: "Rahim Renter", email: "renter1@gaaribhara.test", phone: "01711000021" },
  { role: "RENTER", fullName: "Nusrat Renter", email: "renter2@gaaribhara.test", phone: "01711000022" },
  { role: "RENTER", fullName: "Tanvir Renter", email: "renter3@gaaribhara.test", phone: "01711000023" },
];

async function seed() {
  if (appConfig.env.NODE_ENV === "production") throw new Error("seed:demo is not allowed in production");
  const password = process.env.DEMO_PASSWORD || "Demo@12345";
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const ds = new DataSource({ ...dataSourceOptions });
  await ds.initialize();
  try {
    for (const u of DEMO_USERS) {
      await ds.query(
        `INSERT INTO users (role, full_name, email, phone, password_hash)
         VALUES ($1::user_role, $2, $3, $4, $5)
         ON CONFLICT (email) DO NOTHING`,
        [u.role, u.fullName, u.email, u.phone, passwordHash],
      );
    }
    const rows = await ds.query(`SELECT id, role, email FROM users ORDER BY created_at`);
    console.log("Demo users (password: " + password + "):");
    for (const r of rows) console.log(`  ${r.role.padEnd(7)} ${r.email.padEnd(26)} ${r.id}`);
  } finally {
    await ds.destroy();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
