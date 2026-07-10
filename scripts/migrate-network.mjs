import { config } from "dotenv";
config({ path: ".env.local" });
import pg from "pg";
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

await client.query(`
  ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS dj_city text,
    ADD COLUMN IF NOT EXISTS dj_country text,
    ADD COLUMN IF NOT EXISTS dj_type text,
    ADD COLUMN IF NOT EXISTS discoverable boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS discoverable_updated_at timestamp
`);

console.log("✓ PromoVault Network columns added to profiles");
await client.end();
