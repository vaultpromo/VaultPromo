import { type NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { tracks, campaignDistributions, campaigns } from "@/db/schema";
import { storage } from "@/lib/storage";
import { getPromoSession } from "@/lib/promo/session";
import { promoStreamLimiter } from "@/lib/rate-limiter";

/**
 * GET /api/promo/stream/[trackId]?campaignId=<id>
 *
 * Returns a short-lived presigned URL to stream the 128kbps MP3 preview.
 * Access is validated via the promo session cookie set in Task 9.
 *
 * This endpoint intentionally does NOT require an Auth.js session —
 * the promo session cookie IS the auth for recipients.
 *
 * Security:
 * - Verifies the promo session cookie for the given campaign
 * - Verifies the track belongs to that campaign
 * - Verifies the track is in "ready" state (has a previewKey)
 * - Presigned URL expires in 1 hour — short enough to limit leakage
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/promo/stream/[trackId]">,
) {
  const { trackId } = await ctx.params;
  const campaignId = request.nextUrl.searchParams.get("campaignId");

  if (!campaignId) {
    return Response.json({ error: "campaignId is required" }, { status: 400 });
  }

  // Rate limit by IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!promoStreamLimiter.check(ip)) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  // Verify promo session
  const session = await getPromoSession(campaignId);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify distribution belongs to this campaign
  if (session.campaignId !== campaignId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify campaign exists and hasn't expired
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
    columns: { expiryDate: true },
  });

  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (campaign.expiryDate && campaign.expiryDate < new Date()) {
    return Response.json({ error: "Campaign expired" }, { status: 410 });
  }

  // Verify track belongs to this campaign and is ready
  const track = await db.query.tracks.findFirst({
    where: and(eq(tracks.id, trackId), eq(tracks.campaignId, campaignId)),
    columns: { previewKey: true, processingStatus: true },
  });

  if (!track || track.processingStatus !== "ready" || !track.previewKey) {
    return Response.json({ error: "Track not available" }, { status: 404 });
  }

  // Generate short-lived presigned URL (1 hour)
  const url = await storage.getPresignedUrl({
    bucket: "previews",
    key: track.previewKey,
    expiresInSeconds: 3600,
  });

  return Response.json({
    url,
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
  });
}
