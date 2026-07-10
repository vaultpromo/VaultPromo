import { NextRequest } from "next/server";
import { z } from "zod";
import { verifySession } from "@/lib/dal";
import { storage } from "@/lib/storage";
import { originalTrackKey, artworkKey } from "@/lib/storage/keys";

const ALLOWED_AUDIO_TYPES = [
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/aiff",
  "audio/x-aiff",
  "audio/flac",
];

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const MAX_AUDIO_BYTES = 500 * 1024 * 1024; // 500 MB
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

const requestSchema = z.object({
  type: z.enum(["track", "artwork"]),
  campaignId: z.string().min(1),
  trackId: z.string().min(1).optional(),
  contentType: z.string().min(1),
  fileSizeBytes: z.number().positive(),
});

/**
 * POST /api/storage/upload-url
 *
 * Returns a presigned PUT URL that allows the browser to upload directly
 * to Cloudflare R2 without routing binary data through the Next.js process.
 *
 * Auth: requires a valid session (label workspace implied — checked in actions).
 */
export async function POST(request: NextRequest) {
  // Verify the user is authenticated
  await verifySession();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { type, campaignId, trackId, contentType, fileSizeBytes } = parsed.data;

  // Validate by asset type
  if (type === "track") {
    if (!trackId) {
      return Response.json({ error: "trackId is required for track uploads" }, { status: 400 });
    }
    if (!ALLOWED_AUDIO_TYPES.includes(contentType)) {
      return Response.json({ error: "Unsupported audio format" }, { status: 415 });
    }
    if (fileSizeBytes > MAX_AUDIO_BYTES) {
      return Response.json({ error: "File too large (max 500 MB)" }, { status: 413 });
    }

    const key = originalTrackKey(campaignId, trackId, contentType);
    const url = await storage.getPresignedUploadUrl({
      bucket: "originals",
      key,
      contentType,
      expiresInSeconds: 900, // 15 min
      maxSizeBytes: MAX_AUDIO_BYTES,
    });

    return Response.json({ url, key });
  }

  // artwork
  if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
    return Response.json({ error: "Unsupported image format" }, { status: 415 });
  }
  if (fileSizeBytes > MAX_IMAGE_BYTES) {
    return Response.json({ error: "Image too large (max 10 MB)" }, { status: 413 });
  }

  const key = artworkKey(campaignId, contentType);
  const url = await storage.getPresignedUploadUrl({
    bucket: "originals",
    key,
    contentType,
    expiresInSeconds: 300, // 5 min
    maxSizeBytes: MAX_IMAGE_BYTES,
  });

  return Response.json({ url, key });
}
