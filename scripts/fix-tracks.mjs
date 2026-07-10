import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const { Client } = pg;

const campaignId = "249fed2e-a98c-49a6-97c8-7a9a8b5652e1";

const trackIds = [
  "862f2718-18d8-413c-92e7-f80b395e6d49",
  "ea815dd1-39b8-4a8e-a2a6-3cc450d1ad6e",
  "6532b660-f523-44b4-b496-fee5ba9cbfe8",
  "f2e22b32-cbe0-48d8-8c6d-c0508ea55785",
  "b7296e34-8e24-48a6-bbe5-bbdb8681ebad",
];

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

for (const trackId of trackIds) {
  const previewKey = `campaigns/${campaignId}/tracks/${trackId}/preview.mp3`;
  await client.query(
    "UPDATE tracks SET processing_status = $1, preview_key = $2, updated_at = NOW() WHERE id = $3",
    ["ready", previewKey, trackId]
  );
  console.log("✓ Ready:", trackId);
}

await client.end();
console.log("All tracks marked as ready.");
