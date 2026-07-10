import { NextRequest } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { timingSafeEqual } from "crypto";
import { db } from "@/db";
import { tracks } from "@/db/schema";

/**
 * POST /api/pipeline/transcode-complete
 *
 * Machine-to-machine webhook called by Lambda when transcoding finishes.
 *
 * Security:
 * - Uses timingSafeEqual to prevent timing attacks on the secret comparison
 * - Verifies campaignId matches the track's actual campaignId before updating
 *   (prevents a valid secret holder from setting previewKey on arbitrary tracks)
 * - previewKey is sanitized to only allow expected path patterns
 */

const bodySchema = z.object({
  trackId: z.string().uuid(),
  campaignId: z.string().uuid(),
  success: z.boolean(),
  // previewKey must match the expected pattern: campaigns/<uuid>/tracks/<uuid>/preview.mp3
  previewKey: z
    .string()
    .regex(
      /^campaigns\/[0-9a-f-]{36}\/tracks\/[0-9a-f-]{36}\/preview\.mp3$/,
      "Invalid previewKey format",
    )
    .optional(),
  durationSeconds: z.number().nonnegative().optional(),
  error: z.string().max(500).optional(),
});

function timingSafeStringEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) {
      // Still do a comparison to avoid length-based timing leak
      timingSafeEqual(bufA, bufA);
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // ── Auth: timing-safe secret comparison ─────────────────────────────────
  const secret = process.env.PIPELINE_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const providedSecret = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!timingSafeStringEqual(providedSecret, secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { trackId, campaignId, success, previewKey, error } = parsed.data;

  // ── Ownership verification ───────────────────────────────────────────────
  // Verify the track actually belongs to the claimed campaign.
  // Prevents a valid-secret caller from updating tracks across campaigns.
  const track = await db.query.tracks.findFirst({
    where: and(eq(tracks.id, trackId), eq(tracks.campaignId, campaignId)),
    columns: { id: true },
  });

  if (!track) {
    // Return 200 to avoid information leakage about track existence
    return Response.json({ ok: true });
  }

  if (success && previewKey) {
    await db
      .update(tracks)
      .set({
        previewKey,
        processingStatus: "ready",
        processingError: null,
        updatedAt: new Date(),
      })
      .where(eq(tracks.id, trackId));
  } else {
    await db
      .update(tracks)
      .set({
        processingStatus: "failed",
        processingError: error ?? "Unknown transcoding error",
        updatedAt: new Date(),
      })
      .where(eq(tracks.id, trackId));
  }

  return Response.json({ ok: true });
}
