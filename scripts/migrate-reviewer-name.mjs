import { config } from "dotenv";
config({ path: ".env.local" });
import pg from "pg";
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(`ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "reviewer_name" text`);
console.log("✓ reviewer_name column added to feedback table");
await client.end();
