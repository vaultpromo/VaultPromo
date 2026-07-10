import { NextRequest } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { verifySession } from "@/lib/dal";
import { storage } from "@/lib/storage";
import { db } from "@/db";
import { campaigns, tracks } from "@/db/schema";
import { originalTrackKey, artworkKey } from "@/lib/storage/keys";
import { storageUploadLimiter } from "@/lib/rate-limiter";

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
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;  // 10 MB

const requestSchema = z.object({
  type: z.enum(["track", "artwork"]),
  campaignId: z.string().uuid("Invalid campaignId"),
  trackId: z.string().uuid("Invalid trackId").optional(),
  contentType: z.string().min(1).max(100),
  fileSizeBytes: z.number().int().positive(),
});

/**
 * POST /api/storage/upload-url
 *
 * Returns a presigned PUT URL for direct browser-to-R2 upload.
 *
 * Security:
 * - Verifies the campaignId belongs to the authenticated user
 * - For tracks, also verifies the trackId belongs to that campaign
 * - Prevents a user from uploading to another user's campaign path
 */
export async function POST(request: NextRequest) {
  const { userId } = await verifySession();

  // Rate limit by IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!storageUploadLimiter.check(ip)) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { type, campaignId, trackId, contentType, fileSizeBytes } = parsed.data;

  // ── Ownership check: campaign must belong to this user ─────────────────
  const campaign = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)),
    columns: { id: true },
  });

  if (!campaign) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // ── Track upload ────────────────────────────────────────────────────────
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

    // Verify the track belongs to this campaign
    const track = await db.query.tracks.findFirst({
      where: and(eq(tracks.id, trackId), eq(tracks.campaignId, campaignId)),
      columns: { id: true },
    });

    if (!track) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const key = originalTrackKey(campaignId, trackId, contentType);
    const url = await storage.getPresignedUploadUrl({
      bucket: "originals",
      key,
      contentType,
      expiresInSeconds: 900,
      maxSizeBytes: MAX_AUDIO_BYTES,
    });

    return Response.json({ url, key });
  }

  // ── Artwork upload ──────────────────────────────────────────────────────
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
    expiresInSeconds: 300,
    maxSizeBytes: MAX_IMAGE_BYTES,
  });

  return Response.json({ url, key });
}
