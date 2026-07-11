/**
 * Re-enqueues tracks that are marked "ready" but whose MP3 preview
 * doesn't actually exist in R2 (Lambda transcoded but webhook failed).
 *
 * Usage: node scripts/retranscode-tracks.mjs
 *
 * Pass specific track IDs as args to target only those:
 *   node scripts/retranscode-tracks.mjs <trackId1> <trackId2>
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import pg from "pg";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";

const { Client } = pg;

// R2 client to verify if preview MP3 actually exists
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function previewExists(key) {
  try {
    await r2.send(new HeadObjectCommand({
      Bucket: process.env.R2_BUCKET_PREVIEWS,
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const specificIds = process.argv.slice(2);

let tracks;
if (specificIds.length > 0) {
  // Target specific tracks
  const placeholders = specificIds.map((_, i) => `$${i + 1}`).join(",");
  const { rows } = await client.query(
    `SELECT id, title, campaign_id, original_key, preview_key, processing_status
     FROM tracks WHERE id IN (${placeholders})`,
    specificIds
  );
  tracks = rows;
} else {
  // Find all "ready" tracks and check if their preview actually exists
  const { rows } = await client.query(`
    SELECT id, title, campaign_id, original_key, preview_key, processing_status
    FROM tracks
    WHERE processing_status = 'ready'
      AND original_key IS NOT NULL
      AND preview_key IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 50
  `);
  tracks = rows;
}

console.log(`Checking ${tracks.length} tracks...`);

const toRetranscode = [];

for (const track of tracks) {
  const exists = await previewExists(track.preview_key);
  if (!exists) {
    console.log(`✗ Missing preview: ${track.title} (${track.id})`);
    toRetranscode.push(track);
  } else {
    console.log(`✓ Preview OK: ${track.title}`);
  }
}

if (toRetranscode.length === 0) {
  console.log("\nAll previews exist. Nothing to do.");
  await client.end();
  process.exit(0);
}

console.log(`\nResetting ${toRetranscode.length} tracks to 'processing'...`);

for (const track of toRetranscode) {
  await client.query(
    `UPDATE tracks SET processing_status = 'processing', preview_key = NULL, updated_at = NOW() WHERE id = $1`,
    [track.id]
  );
  console.log(`  Reset: ${track.title}`);
}

await client.end();

console.log("\n✓ Done. Now:");
console.log("  1. Go to AWS Lambda → promovault-audio-worker → Test");
console.log("  2. Run the test with {} payload");
console.log("  3. Lambda will pick up the queued jobs and transcode them");
