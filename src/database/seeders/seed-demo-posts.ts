import { copyFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { DataSource } from "typeorm";
import { dataSourceOptions } from "@/config/database.config";

const ASSETS = join(__dirname, "assets");
const UPLOAD_ROOT = join(process.cwd(), "uploads");

const day = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

type Demo = {
  by: "O1" | "O2" | "O3" | "R1" | "R2" | "R3";
  type: "OFFER" | "REQUEST";
  title: string;
  body: string;
  cat: string;
  dist: string;
  area?: string;
  make?: string;
  model?: string;
  year?: number;
  seats?: number;
  trans?: "MANUAL" | "AUTOMATIC";
  fuel?: string;
  driver: boolean;
  taka?: number; // asking price per day in TAKA; stored as poisha
  from?: number;
  to?: number;
  imgs: string[];
  status?: "CLOSED" | "HIDDEN";
};

const DEMOS: Demo[] = [
  { by: "O1", type: "OFFER", title: "Toyota Axio, clean and AC ready", body: "Well maintained 2016 Axio, non-smoking, available for city and highway trips. Fuel is paid by the renter.", cat: "Car", dist: "Chattogram", area: "GEC Circle", make: "Toyota", model: "Axio", year: 2016, seats: 5, trans: "AUTOMATIC", fuel: "OCTANE", driver: false, taka: 4500, from: 2, to: 20, imgs: ["car-1", "car-2"] },
  { by: "O1", type: "OFFER", title: "Toyota Noah microbus with driver for tours", body: "7-seater Noah with experienced driver. Good for family trips to Cox's Bazar or Sylhet. Price depends on distance.", cat: "Microbus", dist: "Dhaka", area: "Uttara", make: "Toyota", model: "Noah", year: 2015, seats: 7, trans: "AUTOMATIC", fuel: "OCTANE", driver: true, taka: 9000, from: 5, to: 40, imgs: ["van-1", "car-1", "car-2"] },
  { by: "O1", type: "OFFER", title: "Honda CB Hornet motorbike daily rent", body: "Fuel efficient bike, two helmets included. Deposit of national ID copy only.", cat: "Motorbike", dist: "Sylhet", make: "Honda", model: "CB Hornet", year: 2020, seats: 2, trans: "MANUAL", fuel: "OCTANE", driver: false, taka: 1200, imgs: ["bike-1"] },
  { by: "O2", type: "OFFER", title: "Mitsubishi Pajero SUV for hill trips", body: "4WD SUV, good for Bandarban and Rangamati roads. Driver available on request.", cat: "SUV", dist: "Cox's Bazar", make: "Mitsubishi", model: "Pajero", year: 2014, seats: 7, trans: "AUTOMATIC", fuel: "DIESEL", driver: true, taka: 12000, from: 1, to: 30, imgs: ["suv-1", "car-2"] },
  { by: "O2", type: "OFFER", title: "Toyota Hilux pickup for goods transport", body: "Open pickup, 1 ton capacity. Available for moving furniture and goods within Rajshahi division.", cat: "Pickup", dist: "Rajshahi", make: "Toyota", model: "Hilux", year: 2013, seats: 3, trans: "MANUAL", fuel: "DIESEL", driver: true, taka: 6500, from: 3, to: 60, imgs: ["pickup-1"] },
  { by: "O2", type: "OFFER", title: "Honda Vezel for wedding decoration", body: "White Vezel, ribbons and flowers can be arranged. Available on weekends only.", cat: "SUV", dist: "Dhaka", area: "Dhanmondi", make: "Honda", model: "Vezel", year: 2017, seats: 5, trans: "AUTOMATIC", fuel: "OCTANE", driver: true, taka: 8000, from: 10, to: 25, imgs: ["suv-1", "car-1"] },
  { by: "O3", type: "OFFER", title: "Yamaha FZS V3 motorbike for rent", body: "Yamaha FZS V3 for rent by the day or week. Weekly discount possible in chat.", cat: "Motorbike", dist: "Khulna", make: "Yamaha", model: "FZS V3", year: 2021, seats: 2, trans: "MANUAL", fuel: "OCTANE", driver: false, taka: 1000, imgs: ["bike-1"] },
  { by: "O3", type: "OFFER", title: "Honda Activa scooter, city rides", body: "Easy to ride scooter, good for Barishal town. Helmet included.", cat: "Scooter", dist: "Barishal", make: "Honda", model: "Activa", year: 2019, seats: 2, trans: "AUTOMATIC", fuel: "OCTANE", driver: false, taka: 700, imgs: ["bike-1"] },
  { by: "O3", type: "OFFER", title: "Toyota Premio, business trips, with driver", body: "Neat Premio with professional driver for office and airport transfers in Dhaka.", cat: "Car", dist: "Dhaka", area: "Gulshan", make: "Toyota", model: "Premio", year: 2018, seats: 5, trans: "AUTOMATIC", fuel: "CNG", driver: true, taka: 7000, from: 0, to: 90, imgs: ["car-2", "car-1"] },
  { by: "O1", type: "OFFER", title: "Hiace microbus 14 seats, group travel", body: "Air conditioned 14-seater, ideal for picnics and wedding guests. Driver included.", cat: "Microbus", dist: "Gazipur", make: "Toyota", model: "Hiace", year: 2012, seats: 14, trans: "MANUAL", fuel: "DIESEL", driver: true, taka: 11000, from: 7, to: 45, imgs: ["van-1"] },
  { by: "O2", type: "OFFER", title: "Mahindra Bolero pickup, Sylhet tea garden roads", body: "Strong pickup for rough roads. Available mid week.", cat: "Pickup", dist: "Sylhet", make: "Mahindra", model: "Bolero", year: 2016, seats: 3, trans: "MANUAL", fuel: "DIESEL", driver: false, taka: 5000, from: 4, to: 35, imgs: ["pickup-1", "suv-1"] },
  { by: "O3", type: "OFFER", title: "Nissan Sunny, cheap daily rent", body: "Budget sedan for daily use. Fuel by renter, one day minimum.", cat: "Car", dist: "Chattogram", area: "Agrabad", make: "Nissan", model: "Sunny", year: 2011, seats: 5, trans: "MANUAL", fuel: "CNG", driver: false, taka: 3000, from: 0, to: 50, imgs: ["car-1"] },

  { by: "R1", type: "REQUEST", title: "Need a car for my wedding day", body: "Looking for a decorated car with driver for one day in Dhaka. Budget is flexible, please message.", cat: "Car", dist: "Dhaka", driver: true, taka: 8000, from: 15, to: 15, imgs: [] },
  { by: "R1", type: "REQUEST", title: "Microbus for family trip to Cox's Bazar", body: "8 people, 4 days, need AC microbus with driver. Leaving from Chattogram.", cat: "Microbus", dist: "Chattogram", driver: true, taka: 10000, from: 12, to: 16, imgs: ["van-1"] },
  { by: "R2", type: "REQUEST", title: "Motorbike for one week in Sylhet", body: "Visiting for work, need a reliable bike for 7 days. Helmet needed.", cat: "Motorbike", dist: "Sylhet", driver: false, taka: 1100, from: 6, to: 13, imgs: [] },
  { by: "R2", type: "REQUEST", title: "Pickup to move house, Rajshahi to Bogura", body: "One day, furniture of a 2 bedroom flat. Need pickup with driver and two helpers if possible.", cat: "Pickup", dist: "Rajshahi", driver: true, taka: 7000, from: 9, to: 9, imgs: [] },
  { by: "R3", type: "REQUEST", title: "SUV with driver for Bandarban hill trip", body: "4WD SUV for 3 days, 5 passengers.", cat: "SUV", dist: "Bandarban", driver: true, taka: 12000, from: 20, to: 22, imgs: ["suv-1"] },
  { by: "R3", type: "REQUEST", title: "Self drive car for a weekend, Khulna", body: "I have a valid license. Looking for a clean sedan, Friday to Sunday.", cat: "Car", dist: "Khulna", driver: false, taka: 4000, from: 8, to: 10, imgs: [] },
  { by: "R1", type: "REQUEST", title: "Scooter for two weeks in Barishal", body: "Short term stay, need a scooter for local travel.", cat: "Scooter", dist: "Barishal", driver: false, taka: 600, from: 3, to: 17, imgs: [] },
  // moderation demo: one closed, one hidden
  { by: "O1", type: "OFFER", title: "Old Corolla, no longer available", body: "This car was rented out for the month, so the post was closed.", cat: "Car", dist: "Dhaka", driver: false, taka: 3500, imgs: ["car-2"], status: "CLOSED" },
  { by: "O3", type: "OFFER", title: "Suspicious cheap offer (hidden by admin demo)", body: "Pay advance to this number and get a car for free.", cat: "Car", dist: "Dhaka", driver: false, taka: 100, imgs: [], status: "HIDDEN" },
];

async function main() {
  const refresh = process.argv.includes("--refresh");
  const ds = new DataSource({ ...(dataSourceOptions as any) });
  await ds.initialize();
  try {
    const owners: { id: string }[] = await ds.query(`SELECT id FROM users WHERE role='OWNER' ORDER BY email LIMIT 3`);
    const renters: { id: string }[] = await ds.query(`SELECT id FROM users WHERE role='RENTER' ORDER BY email LIMIT 3`);
    if (owners.length < 3 || renters.length < 3) {
      throw new Error(
        `Need at least 3 OWNER and 3 RENTER users (found ${owners.length} and ${renters.length}). Run Sadat's demo-user seed first.`,
      );
    }
    const who = { O1: owners[0].id, O2: owners[1].id, O3: owners[2].id, R1: renters[0].id, R2: renters[1].id, R3: renters[2].id };
    const demoUserIds = Object.values(who);

    if (refresh) {
      const old: { id: string }[] = await ds.query(`SELECT id FROM posts WHERE author_id = ANY($1::uuid[])`, [demoUserIds]);
      old.forEach((o) => rmSync(join(UPLOAD_ROOT, "posts", o.id), { recursive: true, force: true })); // no orphan files
      const del = await ds.query(`DELETE FROM posts WHERE author_id = ANY($1::uuid[])`, [demoUserIds]);
      console.log(`Refreshed: removed ${del[1] ?? 0} old demo posts`);
    } else {
      const existing = await ds.query(`SELECT count(*)::int AS c FROM posts WHERE author_id = ANY($1::uuid[])`, [demoUserIds]);
      if (existing[0].c > 0) {
        console.log(`Demo posts already exist (${existing[0].c}). Use --refresh to rebuild them.`);
        return;
      }
    }

    const cats: { id: string; name: string }[] = await ds.query(`SELECT id, name FROM categories`);
    const dists: { id: string; name: string }[] = await ds.query(`SELECT id, name FROM districts`);
    const catId = (n: string) => cats.find((c) => c.name === n)?.id ?? (() => { throw new Error(`category ${n} missing`); })();
    const distId = (n: string) => dists.find((d) => d.name === n)?.id ?? (() => { throw new Error(`district ${n} missing`); })();

    let n = 0;
    for (const [i, d] of DEMOS.entries()) {
      const status = d.status ?? "ACTIVE";
      const rows = await ds.query(
        `INSERT INTO posts (author_id, post_type, title, body, category_id, district_id, area_note, make, model, year, seats,
                    transmission, fuel_type, with_driver, price_per_day, date_from, date_to, status, hidden_from_status, hidden_reason, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20, now() - ($21 || ' minutes')::interval)
         RETURNING id`,
        [
          who[d.by], d.type, d.title, d.body, catId(d.cat), distId(d.dist), d.area ?? null, d.make ?? null, d.model ?? null,
          d.year ?? null, d.seats ?? null, d.trans ?? null, d.fuel ?? null, d.driver,
          d.taka !== undefined ? d.taka * 100 : null, // taka → poisha
          d.from !== undefined ? day(d.from) : null, d.to !== undefined ? day(d.to) : null,
          status, status === "HIDDEN" ? "ACTIVE" : null, status === "HIDDEN" ? "Demo: looks like a scam" : null,
          String((DEMOS.length - i) * 7), // spread over time so the feed order is realistic
        ],
      );
      const postId: string = rows[0].id;
      let pos = 0;
      for (const img of d.imgs) {
        const rel = `posts/${postId}/${randomUUID()}.png`;
        mkdirSync(join(UPLOAD_ROOT, "posts", postId), { recursive: true });
        copyFileSync(join(ASSETS, `${img}.png`), join(UPLOAD_ROOT, rel));
        await ds.query(`INSERT INTO post_images (post_id, file_path, position) VALUES ($1,$2,$3)`, [postId, rel, pos++]);
      }
      n++;
    }
    console.log(`Seeded ${n} demo posts (OFFER and REQUEST) with images.`);
  } finally {
    await ds.destroy();
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
