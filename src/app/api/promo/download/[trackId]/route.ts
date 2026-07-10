import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tracks, campaignDistributions, campaigns, feedback, contacts } from "@/db/schema";
import { storage } from "@/lib/storage";
import { getPromoSession } from "@/lib/promo/session";
import { injectWatermark } from "@/lib/watermark/id3-watermark";

/**
 * GET /api/promo/download/[trackId]?campaignId=<id>
 *
 * Returns a short-lived presigned URL to download the watermarked WAV.
 *
 * Flow:
 * 1. Validate promo session + feedback submitted
 * 2. Fetch original WAV from R2 into memory
 * 3. Inject ID3 metadata watermark (recipient email + distributionId)
 * 4. Upload watermarked buffer to a temporary key in originals bucket
 * 5. Generate presigned URL (15 min) and return it
 * 6. Mark distribution + feedback as downloaded
 *
 * The watermarked key is scoped per distribution to avoid collisions:
 *   watermarked/<distributionId>/<trackId>.wav
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/promo/download/[trackId]">,
) {
  const { trackId } = await ctx.params;
  const campaignId = request.nextUrl.searchParams.get("campaignId");

  if (!campaignId) {
    return Response.json({ error: "campaignId is required" }, { status: 400 });
  }

  // ── Auth ────────────────────────────────────────────────────────────────
  const session = await getPromoSession(campaignId);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.campaignId !== campaignId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!session.feedbackSubmitted) {
    return Response.json({ error: "Feedback required before downloading" }, { status: 403 });
  }

  // ── Campaign expiry ─────────────────────────────────────────────────────
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
    columns: { expiryDate: true, title: true },
  });
  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }
  if (campaign.expiryDate && campaign.expiryDate < new Date()) {
    return Response.json({ error: "Campaign expired" }, { status: 410 });
  }

  // ── Track lookup ────────────────────────────────────────────────────────
  const track = await db.query.tracks.findFirst({
    where: and(eq(tracks.id, trackId), eq(tracks.campaignId, campaignId)),
    columns: { originalKey: true, title: true, artistName: true },
  });
  if (!track?.originalKey) {
    return Response.json({ error: "Track not available for download" }, { status: 404 });
  }

  // ── Recipient email for watermark ────────────────────────────────────────
  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.id, session.contactId),
    columns: { email: true },
  });
  const recipientEmail = contact?.email ?? "unknown@recipient";

  // ── Download original from R2 ────────────────────────────────────────────
  let originalBuffer: Buffer;
  try {
    const originalUrl = await storage.getPresignedUrl({
      bucket: "originals",
      key: track.originalKey,
      expiresInSeconds: 120,
    });
    const response = await fetch(originalUrl);
    if (!response.ok) throw new Error(`R2 fetch failed: ${response.status}`);
    originalBuffer = Buffer.from(await response.arrayBuffer());
  } catch (err) {
    console.error("[download] Failed to fetch original from R2:", err);
    return Response.json({ error: "Could not retrieve track" }, { status: 500 });
  }

  // ── Inject watermark ─────────────────────────────────────────────────────
  const watermarkedBuffer = injectWatermark(originalBuffer, {
    recipientEmail,
    distributionId: session.id,
    campaignTitle: campaign.title,
    trackTitle: track.title,
  });

  // ── Upload watermarked buffer to R2 ──────────────────────────────────────
  const ext = track.originalKey.split(".").pop() ?? "wav";
  const watermarkedKey = `watermarked/${session.id}/${trackId}.${ext}`;

  try {
    await storage.upload({
      bucket: "originals",
      key: watermarkedKey,
      body: watermarkedBuffer,
      contentType: "audio/wav",
      metadata: {
        "recipient-email": recipientEmail,
        "distribution-id": session.id,
      },
    });
  } catch (err) {
    console.error("[download] Failed to upload watermarked file:", err);
    return Response.json({ error: "Download preparation failed" }, { status: 500 });
  }

  // ── Generate presigned URL (15 min) ──────────────────────────────────────
  const url = await storage.getPresignedUrl({
    bucket: "originals",
    key: watermarkedKey,
    expiresInSeconds: 900,
  });

  // ── Mark as downloaded (best-effort) ─────────────────────────────────────
  try {
    await Promise.all([
      db
        .update(campaignDistributions)
        .set({ hasDownloaded: true, updatedAt: new Date() })
        .where(eq(campaignDistributions.id, session.id)),
      db
        .update(feedback)
        .set({ hasDownloaded: true, updatedAt: new Date() })
        .where(
          and(
            eq(feedback.distributionId, session.id),
            eq(feedback.campaignId, campaignId),
          ),
        ),
    ]);
  } catch {
    // Non-fatal
  }

  const safeFilename = `${track.artistName} - ${track.title}.${ext}`
    .replace(/[^a-zA-Z0-9 ._-]/g, "_");

  return Response.json({
    url,
    filename: safeFilename,
    expiresAt: new Date(Date.now() + 900 * 1000).toISOString(),
  });
}
