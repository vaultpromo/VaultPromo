import "server-only";
import { getQueue, QUEUES, type TranscodeJobData } from "./index";
import { previewTrackKey } from "@/lib/storage/keys";

/**
 * Enqueue a transcoding job for a newly uploaded WAV.
 *
 * Called by confirmTrackUploadAction after the browser finishes uploading
 * the original file to R2.
 *
 * Returns the pg-boss job ID, or null if the job was a duplicate
 * (pg-boss deduplicates by singletonKey within the same queue).
 */
export async function enqueueTranscode(params: {
  trackId: string;
  campaignId: string;
  originalKey: string;
}): Promise<string | null> {
  const boss = await getQueue();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const callbackUrl = `${appUrl}/api/pipeline/transcode-complete`;

  const previewKey = previewTrackKey(params.campaignId, params.trackId);

  const data: TranscodeJobData = {
    trackId: params.trackId,
    campaignId: params.campaignId,
    originalKey: params.originalKey,
    previewKey,
    callbackUrl,
  };

  const jobId = await boss.send(QUEUES.AUDIO_TRANSCODE, data, {
    // Retry up to 3 times with exponential backoff
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
    // Expire unprocessed jobs after 24 hours
    expireInSeconds: 86400,
    // Deduplicate: only one active transcode per track
    singletonKey: params.trackId,
  });

  return jobId;
}
