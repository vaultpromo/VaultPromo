import NodeID3 from "node-id3";

// Note: this module should only be called from server-side code (Route Handlers, Server Actions).
// Do not import in Client Components.

export interface WatermarkOptions {
  recipientEmail: string;
  distributionId: string;
  campaignTitle: string;
  trackTitle: string;
  artistName?: string;
  /** Optional cover art buffer to embed as APIC (attached picture) */
  artworkBuffer?: Buffer;
  /** MIME type of the artwork (image/jpeg | image/png). Defaults to image/jpeg */
  artworkMime?: "image/jpeg" | "image/png";
}

/**
 * Inject watermark metadata + optional cover art into an audio buffer.
 *
 * Tags written:
 *   TIT2 (title)             → trackTitle
 *   TPE1 (artist)            → artistName
 *   TALB (album)             → campaignTitle
 *   COMM (comment)           → license notice with recipient email
 *   TXXX RecipientEmail      → recipient email (machine-readable)
 *   TXXX DistributionId      → distribution row ID
 *   APIC (attached picture)  → cover art (if provided)
 *
 * Returns a new Buffer — never mutates the original.
 */
export function injectWatermark(
  audioBuffer: Buffer,
  options: WatermarkOptions,
): Buffer {
  const {
    recipientEmail,
    distributionId,
    campaignTitle,
    trackTitle,
    artistName,
    artworkBuffer,
    artworkMime = "image/jpeg",
  } = options;

  const tags: NodeID3.Tags = {
    title: trackTitle,
    ...(artistName ? { artist: artistName } : {}),
    album: campaignTitle,
    comment: {
      language: "eng",
      text: `Licensed to: ${recipientEmail}. Redistribution prohibited. DistributionId: ${distributionId}`,
    },
    userDefinedText: [
      { description: "RecipientEmail", value: recipientEmail },
      { description: "DistributionId", value: distributionId },
      { description: "CampaignTitle", value: campaignTitle },
      { description: "TrackTitle", value: trackTitle },
    ],
  };

  // Embed cover art if provided
  if (artworkBuffer && artworkBuffer.length > 0) {
    tags.image = {
      mime: artworkMime,
      type: { id: 3, name: "front cover" }, // APIC type 3 = front cover
      description: "Cover",
      imageBuffer: artworkBuffer,
    };
  }

  const result = NodeID3.update(tags, audioBuffer);

  if (!result) {
    console.warn("[watermark] Failed to inject metadata — returning original buffer");
    return audioBuffer;
  }

  return result as Buffer;
}

/**
 * Read the watermark from a buffer (for verification/forensics).
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
