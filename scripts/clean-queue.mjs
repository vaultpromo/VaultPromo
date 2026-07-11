/**
 * Cleans duplicate jobs from the pg-boss queue.
 * Keeps only the most recent job per trackId, deletes the rest.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import pg from "pg";
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// Get all pending jobs grouped by trackId
const { rows: jobs } = await client.query(`
  SELECT id, data->>'trackId' as track_id, created_on
  FROM pgboss.job
  WHERE name = 'audio-transcode'
    AND state IN ('created', 'retry')
  ORDER BY track_id, created_on DESC
`);

// Keep only the newest job per trackId, delete the rest
const seen = new Map();
const toDelete = [];

for (const job of jobs) {
  if (!seen.has(job.track_id)) {
    seen.set(job.track_id, job.id);
  } else {
    toDelete.push(job.id);
  }
}

if (toDelete.length > 0) {
  await client.query(
    `DELETE FROM pgboss.job WHERE id = ANY($1::uuid[])`,
    [toDelete]
  );
  console.log(`✓ Deleted ${toDelete.length} duplicate jobs`);
}

const { rows: remaining } = await client.query(`
  SELECT id, data->>'trackId' as track_id, state
  FROM pgboss.job
  WHERE name = 'audio-transcode' AND state IN ('created','retry')
`);

console.log(`\nRemaining jobs: ${remaining.length}`);
remaining.forEach(j => console.log(`  [${j.state}] trackId=${j.track_id?.slice(0,8)}...`));

await client.end();
