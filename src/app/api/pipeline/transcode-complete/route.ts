import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tracks } from "@/db/schema";

/**
 * POST /api/pipeline/transcode-complete
 *
 * Called by the Lambda audio worker when transcoding finishes (success or failure).
 * Secured by a shared secret in the Authorization header (Bearer token).
 *
 * This route is intentionally NOT behind verifySession() — it is machine-to-machine.
 * Instead it validates a PIPELINE_WEBHOOK_SECRET from env vars.
 */

const bodySchema = z.object({
  trackId: z.string().min(1),
  campaignId: z.string().min(1),
  success: z.boolean(),
  previewKey: z.string().optional(),
  durationSeconds: z.number().optional(),
  error: z.string().optional(),
});

export async function POST(request: NextRequest) {
  // ── Auth: shared webhook secret ─────────────────────────────────────────
  const secret = process.env.PIPELINE_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ──────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const { trackId, success, previewKey, durationSeconds, error } = parsed.data;

  // ── Update track status ─────────────────────────────────────────────────
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
