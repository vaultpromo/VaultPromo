/**
 * Lambda Audio Worker — Entry point
 *
 * This container runs as an AWS Lambda function triggered by pg-boss jobs.
 * It can also be triggered directly via the Lambda API by the Next.js app.
 *
 * Flow:
 *  1. Receive job payload (TranscodeJobData) from pg-boss or Lambda event
 *  2. Download the original WAV from R2
 *  3. Transcode to 128 kbps MP3 with FFmpeg
 *  4. Upload the preview MP3 to R2 previews bucket
 *  5. POST the result to the Next.js webhook (callbackUrl)
 *
 * Environment variables (set in Lambda):
 *  DATABASE_URL            - Neon Postgres (same as the app)
 *  R2_ACCOUNT_ID           - Cloudflare R2
 *  R2_ACCESS_KEY_ID        - Cloudflare R2
 *  R2_SECRET_ACCESS_KEY    - Cloudflare R2
 *  R2_BUCKET_ORIGINALS     - bucket name
 *  R2_BUCKET_PREVIEWS      - bucket name
 *  PIPELINE_WEBHOOK_SECRET - shared secret for the callback
 *  FFMPEG_PATH             - default /opt/bin/ffmpeg
 */

import { PgBoss } from "pg-boss";
import { downloadOriginal, uploadPreview } from "./r2-client";
import { transcodeToMp3 } from "./transcode";

interface TranscodeJobData {
  trackId: string;
  campaignId: string;
  originalKey: string;
  previewKey: string;
  callbackUrl: string;
}

interface LambdaEvent {
  // When invoked directly by Lambda (not via pg-boss polling)
  directInvoke?: TranscodeJobData;
}

/**
 * Process a single transcode job.
 * Extracted so it can be called both from the pg-boss worker loop
 * and from a direct Lambda invocation.
 */
async function processJob(data: TranscodeJobData): Promise<void> {
  const { trackId, campaignId, originalKey, previewKey, callbackUrl } = data;

  console.log(`[worker] Starting transcode: trackId=${trackId} originalKey=${originalKey}`);

  try {
    // 1. Download the original from R2
    const inputStream = await downloadOriginal(originalKey);

    // 2. Transcode
    const { buffer, durationSeconds } = await transcodeToMp3(inputStream);
    console.log(`[worker] Transcoded ${durationSeconds.toFixed(1)}s → ${buffer.length} bytes`);

    // 3. Upload preview to R2
    await uploadPreview(previewKey, buffer);
    console.log(`[worker] Uploaded preview to ${previewKey}`);

    // 4. Notify the Next.js app
    await postCallback(callbackUrl, {
      trackId,
      campaignId,
      success: true,
      previewKey,
      durationSeconds,
    });

    console.log(`[worker] Job complete: trackId=${trackId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[worker] Job failed: trackId=${trackId} error=${message}`);

    await postCallback(callbackUrl, {
      trackId,
      campaignId,
      success: false,
      error: message,
    });

    // Re-throw so pg-boss marks the job as failed and retries
    throw err;
  }
}

async function postCallback(
  url: string,
  body: object,
): Promise<void> {
  const secret = process.env.PIPELINE_WEBHOOK_SECRET!;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Callback failed: ${response.status} ${response.statusText}`);
  }
}

/**
 * Lambda handler.
 *
 * Supports two invocation modes:
 * A) directInvoke: the Next.js app invokes Lambda directly with the job data
 *    (faster, no pg-boss polling needed — good for dev/low-volume).
 * B) pg-boss worker mode: Lambda polls the queue and processes all available
 *    jobs before exiting (cost-effective for batch processing).
 */
export async function handler(event: LambdaEvent): Promise<void> {
  // Mode A: direct invoke
  if (event.directInvoke) {
    await processJob(event.directInvoke);
    return;
  }

  // Mode B: pg-boss worker
  const boss = new PgBoss({
    connectionString: process.env.DATABASE_URL!,
    schema: "pgboss",
    supervise: false,
  });

  await boss.start();

  const QUEUE = "audio:transcode";

  // Fetch and process all available jobs
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
      await boss.complete(QUEUE, job.id);
    } catch {
      await boss.fail(QUEUE, job.id);
    }
  }

  await boss.stop({ graceful: true });
}

// Allow running as a standalone process for local testing
if (require.main === module) {
  handler({}).then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
