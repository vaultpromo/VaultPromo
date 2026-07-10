import NodeID3 from "node-id3";

// Note: this module should only be called from server-side code (Route Handlers, Server Actions).
// Do not import in Client Components.

/**
 * Metadata watermarking — writes the recipient's email address into the
 * ID3 tags of a WAV/MP3 buffer.
 *
 * Why metadata (not steganography):
 * - Zero CPU overhead vs. audio-spectrum steganography
 * - Fast: ~1ms per file regardless of duration
 * - Sufficient deterrent for the MVP
 * - Tech-savvy users can strip tags, but it handles accidental leaks
 *
 * Fields written:
 *   TXXX (user-defined text) "RecipientEmail" → recipient email
 *   TXXX (user-defined text) "DistributionId" → DB distribution row ID
 *   COMM (comment)           → human-readable notice
 *
 * Note: node-id3 writes ID3v2.3 tags. For WAV files, ID3 tags are embedded
 * in an ID3 chunk at the start — most DAWs read these.
 */

export interface WatermarkOptions {
  recipientEmail: string;
  distributionId: string;
  campaignTitle: string;
  trackTitle: string;
}

/**
 * Inject watermark metadata into an audio buffer.
 * Returns a new Buffer (never mutates the original).
 */
export function injectWatermark(
  audioBuffer: Buffer,
  options: WatermarkOptions,
): Buffer {
  const { recipientEmail, distributionId, campaignTitle, trackTitle } = options;

  const tags: NodeID3.Tags = {
    // Standard comment field — visible in most players
    comment: {
      language: "eng",
      text: `Licensed to: ${recipientEmail}. Redistribution prohibited. DistributionId: ${distributionId}`,
    },
    // User-defined text frames for programmatic extraction
    userDefinedText: [
      {
        description: "RecipientEmail",
        value: recipientEmail,
      },
      {
        description: "DistributionId",
        value: distributionId,
      },
      {
        description: "CampaignTitle",
        value: campaignTitle,
      },
      {
        description: "TrackTitle",
        value: trackTitle,
      },
    ],
  };

  // node-id3 update() preserves existing tags and merges the new ones
  const result = NodeID3.update(tags, audioBuffer);

  // update() returns false on failure or the modified Buffer on success
  if (!result) {
    console.warn("[watermark] Failed to inject metadata — returning original buffer");
    return audioBuffer;
  }

  return result as Buffer;
}

/**
 * Read the watermark from a buffer (for verification/forensics).
 * Returns null if no watermark is present.
 */
export function readWatermark(
  audioBuffer: Buffer,
): { recipientEmail: string; distributionId: string } | null {
  const tags = NodeID3.read(audioBuffer);
  if (!tags?.userDefinedText) return null;

  const emailTag = tags.userDefinedText.find((t) => t.description === "RecipientEmail");
  const distTag = tags.userDefinedText.find((t) => t.description === "DistributionId");

  if (!emailTag?.value || !distTag?.value) return null;

  return {
    recipientEmail: emailTag.value,
    distributionId: distTag.value,
  };
}
