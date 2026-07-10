/**
 * Centralised key-generation helpers.
 *
 * All R2 object keys follow a predictable, human-readable structure so that
 * the bucket is browsable and automated cleanup (e.g. removing a campaign's
 * folder) is trivial.
 *
 * Originals bucket  →  campaigns/<campaignId>/tracks/<trackId>/original.<ext>
 * Previews bucket   →  campaigns/<campaignId>/tracks/<trackId>/preview.mp3
 * Artwork           →  campaigns/<campaignId>/artwork.<ext>
 */

/** Derive the file extension from a MIME type */
function extFromMime(contentType: string): string {
  const map: Record<string, string> = {
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
    "audio/aiff": "aiff",
    "audio/x-aiff": "aiff",
    "audio/flac": "flac",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[contentType.toLowerCase()] ?? "bin";
}

export function originalTrackKey(
  campaignId: string,
  trackId: string,
  contentType: string,
): string {
  return `campaigns/${campaignId}/tracks/${trackId}/original.${extFromMime(contentType)}`;
}

export function previewTrackKey(campaignId: string, trackId: string): string {
  return `campaigns/${campaignId}/tracks/${trackId}/preview.mp3`;
}

export function artworkKey(campaignId: string, contentType: string): string {
  return `campaigns/${campaignId}/artwork.${extFromMime(contentType)}`;
}
