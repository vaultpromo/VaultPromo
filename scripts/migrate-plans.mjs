import { config } from "dotenv";
config({ path: ".env.local" });
import pg from "pg";
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// Add plan columns to profiles
await client.query(`
  ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'free',
    ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
    ADD COLUMN IF NOT EXISTS stripe_customer_id text,
    ADD COLUMN IF NOT EXISTS plan_expires_at timestamp
`);

// Update storage quotas to match free plan (2GB)
await client.query(`
  UPDATE profiles
  SET storage_quota_bytes = '2147483648'
  WHERE plan_tier = 'free'
    AND storage_quota_bytes = '5368709120'
`);

console.log("✓ Plan columns added to profiles");
console.log("✓ Free plan storage quota updated to 2GB");

await client.end();
