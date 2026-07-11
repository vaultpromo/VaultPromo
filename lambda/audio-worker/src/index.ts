/**
 * Lambda Audio Worker — ESM entry point
 *
 * Strategy: transcode + upload to R2 are the critical operations.
 * The webhook callback is best-effort — if it fails, the Vercel poller
 * will detect the preview file in R2 and mark the track ready.
 */

import { PgBoss } from "pg-boss";
import { downloadOriginal, uploadPreview } from "./r2-client.js";
import { transcodeToMp3 } from "./transcode.js";

interface TranscodeJobData {
  trackId: string;
  campaignId: string;
  originalKey: string;
  previewKey: string;
  callbackUrl: string;
}

interface LambdaEvent {
  directInvoke?: TranscodeJobData;
}

async function processJob(data: TranscodeJobData): Promise<void> {
  const { trackId, campaignId, originalKey, previewKey, callbackUrl } = data;

  console.log(`[worker] Starting transcode: trackId=${trackId}`);

  // 1. Download original WAV from R2
  const inputStream = await downloadOriginal(originalKey);

  // 2. Transcode to 128kbps MP3
  const { buffer, durationSeconds } = await transcodeToMp3(inputStream);
  console.log(`[worker] Transcoded ${durationSeconds.toFixed(1)}s → ${buffer.length} bytes`);

  // 3. Upload preview MP3 to R2 — this is the critical operation
  await uploadPreview(previewKey, buffer);
  console.log(`[worker] Uploaded preview: ${previewKey}`);

  // 4. Notify Vercel via webhook — best-effort, non-fatal
  // If this fails, the /api/pipeline/poll endpoint will detect the file
  // in R2 and mark the track ready on the next poll cycle.
  try {
    const secret = process.env.PIPELINE_WEBHOOK_SECRET ?? "";
    const res = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        trackId,
        campaignId,
        success: true,
        previewKey,
        durationSeconds,
      }),
      signal: AbortSignal.timeout(10_000), // 10s timeout
    });
    if (res.ok) {
      console.log(`[worker] Webhook OK: trackId=${trackId}`);
    } else {
      console.warn(`[worker] Webhook HTTP ${res.status} — poller will pick up`);
    }
  } catch (err) {
    console.warn(`[worker] Webhook failed (${(err as Error).message}) — poller will pick up`);
  }

  console.log(`[worker] Job done: trackId=${trackId}`);
}

export async function handler(event: LambdaEvent): Promise<void> {
  // Mode A: direct invoke with explicit job data
  if (event.directInvoke) {
    await processJob(event.directInvoke);
    return;
  }

  // Mode B: pg-boss worker — poll queue and process in batches of 5
  const boss = new PgBoss({
    connectionString: process.env.DATABASE_URL!,
    schema: "pgboss",
    supervise: false,
  });

  await boss.start();

  const QUEUE = "audio-transcode";
  await boss.createQueue(QUEUE);

  const jobs = await boss.fetch<TranscodeJobData>(QUEUE, { batchSize: 5 });

  if (!jobs || jobs.length === 0) {
    console.log("[worker] No jobs in queue.");
    await boss.stop({ graceful: true });
    return;
  }

  console.log(`[worker] Processing ${jobs.length} job(s)`);

  for (const job of jobs) {
    try {
      await processJob(job.data);
      // Mark complete whether or not the webhook succeeded —
      // the preview file is in R2 and the poller will handle the DB update
      await boss.complete(QUEUE, job.id);
    } catch (err) {
      // Only fail the job if the transcode/upload itself failed, not the webhook
      console.error(`[worker] Transcode failed: ${(err as Error).message}`);
      await boss.fail(QUEUE, job.id);
    }
  }

  await boss.stop({ graceful: true });
}
