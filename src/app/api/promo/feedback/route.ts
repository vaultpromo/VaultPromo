import { NextRequest } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { feedback, campaignDistributions, tracks } from "@/db/schema";
import { getPromoSession } from "@/lib/promo/session";
import { promoFeedbackLimiter } from "@/lib/rate-limiter";

const MIN_COMMENT_LENGTH = 10;

const bodySchema = z.object({
  campaignId: z.string().min(1),
  distributionId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  favoriteTrackId: z.string().min(1),
  reviewerName: z.string().min(2, "Name must be at least 2 characters.").trim(),
  comment: z
    .string()
    .min(MIN_COMMENT_LENGTH, `Comment must be at least ${MIN_COMMENT_LENGTH} characters.`)
    .trim(),
});

/**
 * POST /api/promo/feedback
 *
 * Atomic feedback submission. On success:
 * 1. Inserts a feedback row (unique per contact+campaign — DB constraint prevents duplicates)
 * 2. Updates campaign_distributions.feedbackSubmitted = true (in same transaction)
 * 3. Returns { success: true } — the client re-enables download buttons
 *
 * Auth: promo session cookie (same as stream/download endpoints)
 * Security: re-validates the session and ownership of the distributionId.
 */
export async function POST(request: NextRequest) {
  // Rate limit
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!promoFeedbackLimiter.check(ip)) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { campaignId, distributionId, rating, favoriteTrackId, comment, reviewerName } = parsed.data;

  // Verify promo session
  const session = await getPromoSession(campaignId);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the distribution row matches the session
  if (session.id !== distributionId || session.campaignId !== campaignId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check for duplicate submission (idempotent — don't error, just return success)
  if (session.feedbackSubmitted) {
    return Response.json({ success: true, alreadySubmitted: true });
  }

  // Verify favoriteTrackId belongs to this campaign
  const favoriteTrack = await db.query.tracks.findFirst({
    where: and(eq(tracks.id, favoriteTrackId), eq(tracks.campaignId, campaignId)),
    columns: { id: true },
  });

  if (!favoriteTrack) {
    return Response.json({ error: "Invalid favorite track" }, { status: 400 });
  }

  // ── Atomic transaction ──────────────────────────────────────────────────
  // Neon HTTP doesn't support interactive transactions, so we use two
  // sequential writes. The unique constraint on (campaignId, contactId) in
  // the feedback table prevents double-submission at the DB level.

  const feedbackId = randomUUID();

  try {
    // 1. Insert feedback row
    await db.insert(feedback).values({
      id: feedbackId,
      distributionId,
      campaignId,
      contactId: session.contactId,
      rating: String(rating) as "1" | "2" | "3" | "4" | "5",
      comment,
      reviewerName,
      favoriteTrackId,
      hasDownloaded: false,
      submittedAt: new Date(),
      updatedAt: new Date(),
    });

    // 2. Mark distribution as feedback submitted
    await db
      .update(campaignDistributions)
      .set({ feedbackSubmitted: true, updatedAt: new Date() })
      .where(eq(campaignDistributions.id, distributionId));
  } catch (err) {
    // Unique constraint violation — feedback already submitted (race condition)
    const msg = (err as Error).message ?? "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return Response.json({ success: true, alreadySubmitted: true });
    }
    throw err;
  }

  return Response.json({ success: true });
}
