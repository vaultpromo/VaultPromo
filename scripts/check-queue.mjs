import { config } from "dotenv";
config({ path: ".env.local" });
import pg from "pg";
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// Check pg-boss queue
const { rows: jobs } = await client.query(`
  SELECT id, name, state, data->>'trackId' as track_id, created_on, started_on, retry_count
  FROM pgboss.job
  WHERE name = 'audio-transcode'
  ORDER BY created_on DESC
  LIMIT 20
`);

console.log(`Jobs in queue: ${jobs.length}`);
for (const j of jobs) {
  console.log(`  [${j.state}] trackId=${j.track_id?.slice(0,8)}... retries=${j.retry_count} created=${j.created_on?.toISOString().slice(0,16)}`);
}

// Check stuck processing tracks
const { rows: tracks } = await client.query(`
  SELECT id, title, processing_status, original_key IS NOT NULL as has_wav
  FROM tracks WHERE processing_status = 'processing'
`);

console.log(`\nTracks in 'processing': ${tracks.length}`);
for (const t of tracks) {
  console.log(`  ${t.title} | has_wav=${t.has_wav}`);
}

await client.end();
