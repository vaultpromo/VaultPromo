import { NextRequest } from "next/server";
import { z } from "zod";
import { verifySession } from "@/lib/dal";
import { storage } from "@/lib/storage";
import type { BucketName } from "@/lib/storage";

const requestSchema = z.object({
  bucket: z.enum(["originals", "previews"]),
  key: z.string().min(1),
  /** Optional shorter expiry for preview streams (default 3600s) */
  expiresInSeconds: z.number().positive().optional(),
});

/**
 * POST /api/storage/download-url
 *
 * Returns a time-limited presigned GET URL for a private R2 object.
 * Used by the audio player to stream preview MP3s and by the download
 * handler to serve original WAVs after feedback is submitted.
 *
 * Auth: requires a valid session OR a valid delivery token (handled by the
 * calling code — this route only validates that the user is logged in).
 *
 * Note: For the public promo flow (delivery_token), use the dedicated
 * /api/promo/[campaignId]/stream route instead.
 */
export async function POST(request: NextRequest) {
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

  const { bucket, key, expiresInSeconds } = parsed.data;

  const url = await storage.getPresignedUrl({
    bucket: bucket as BucketName,
    key,
    expiresInSeconds: expiresInSeconds ?? 3600,
  });

  return Response.json({ url, expiresAt: new Date(Date.now() + (expiresInSeconds ?? 3600) * 1000).toISOString() });
}
