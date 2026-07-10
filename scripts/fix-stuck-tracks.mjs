import { config } from "dotenv";
config({ path: ".env.local" });
import pg from "pg";
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// Find all tracks stuck in "processing" that have an original_key in R2
// These were transcoded by Lambda but the callback hit localhost and failed
const { rows: stuckTracks } = await client.query(`
  SELECT t.id, t.title, t.campaign_id, t.original_key, t.processing_status
  FROM tracks t
  WHERE t.processing_status = 'processing'
    AND t.original_key IS NOT NULL
  ORDER BY t.created_at DESC
`);

console.log(`Found ${stuckTracks.length} stuck tracks:`);
stuckTracks.forEach(t => console.log(`  - ${t.title} (${t.id})`));

if (stuckTracks.length === 0) {
  console.log("No stuck tracks found.");
  await client.end();
  process.exit(0);
}

// For each stuck track, derive the expected preview key and mark as ready
// Pattern: campaigns/<campaignId>/tracks/<trackId>/preview.mp3
let fixed = 0;
for (const track of stuckTracks) {
  const previewKey = `campaigns/${track.campaign_id}/tracks/${track.id}/preview.mp3`;

  await client.query(`
    UPDATE tracks
    SET processing_status = 'ready',
        preview_key = $1,
        processing_error = NULL,
        updated_at = NOW()
    WHERE id = $2
  `, [previewKey, track.id]);

  console.log(`✓ Fixed: ${track.title} → ${previewKey}`);
  fixed++;
}

console.log(`\nFixed ${fixed} tracks.`);
await client.end();
