/**
 * Lambda Audio Worker — ESM entry point
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

  console.log(`[worker] Starting transcode: trackId=${trackId} originalKey=${originalKey}`);

  try {
    const inputStream = await downloadOriginal(originalKey);
    const { buffer, durationSeconds } = await transcodeToMp3(inputStream);
    console.log(`[worker] Transcoded ${durationSeconds.toFixed(1)}s → ${buffer.length} bytes`);

    await uploadPreview(previewKey, buffer);
    console.log(`[worker] Uploaded preview to ${previewKey}`);

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

    throw err;
  }
}

async function postCallback(url: string, body: object): Promise<void> {
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

export async function handler(event: LambdaEvent): Promise<void> {
  // Mode A: direct invoke
  if (event.directInvoke) {
    await processJob(event.directInvoke);
    return;
  }

  // Mode B: pg-boss worker polling
  const boss = new PgBoss({
    connectionString: process.env.DATABASE_URL!,
    schema: "pgboss",
    supervise: false,
  });

  await boss.start();

  const QUEUE = "audio-transcode";

  // pg-boss 12 requires the queue to exist before fetch().
  // createQueue() is idempotent — safe to call on every invocation.
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
      await boss.complete(QUEUE, job.id);
    } catch {
      await boss.fail(QUEUE, job.id);
    }
  }

  await boss.stop({ graceful: true });
}
