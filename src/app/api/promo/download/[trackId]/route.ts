import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tracks, campaignDistributions, campaigns, feedback, contacts } from "@/db/schema";
import { storage } from "@/lib/storage";
import { getPromoSession } from "@/lib/promo/session";
import { injectWatermark } from "@/lib/watermark/id3-watermark";
import { promoDownloadLimiter } from "@/lib/rate-limiter";

/**
 * GET /api/promo/download/[trackId]?campaignId=<id>
 *
 * Streams the watermarked WAV directly to the browser with
 * Content-Disposition: attachment so it downloads immediately
 * without opening a new page or navigating away.
 *
 * Flow:
 * 1. Validate promo session + feedback submitted
 * 2. Fetch original WAV from R2 into memory
 * 3. Inject ID3 metadata watermark
 * 4. Stream the buffer directly as the HTTP response body
 * 5. Mark as downloaded
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

  // Rate limit
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!promoDownloadLimiter.check(ip)) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
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
    columns: { expiryDate: true, title: true, artworkUrl: true },
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
    const r2Response = await fetch(originalUrl);
    if (!r2Response.ok) throw new Error(`R2 fetch failed: ${r2Response.status}`);
    originalBuffer = Buffer.from(await r2Response.arrayBuffer());
  } catch (err) {
    console.error("[download] Failed to fetch original from R2:", err);
    return Response.json({ error: "Could not retrieve track" }, { status: 500 });
  }

  // ── Fetch cover art from R2 (if available) ───────────────────────────────
  let artworkBuffer: Buffer | undefined;
  let artworkMime: "image/jpeg" | "image/png" = "image/jpeg";

  if (campaign.artworkUrl) {
    try {
      const artworkUrl = await storage.getPresignedUrl({
        bucket: "originals",
        key: campaign.artworkUrl,
        expiresInSeconds: 60,
      });
      const artworkResponse = await fetch(artworkUrl);
      if (artworkResponse.ok) {
        artworkBuffer = Buffer.from(await artworkResponse.arrayBuffer());
        const ct = artworkResponse.headers.get("content-type") ?? "";
        artworkMime = ct.includes("png") ? "image/png" : "image/jpeg";
      }
    } catch {
      // Non-fatal — download proceeds without cover art
    }
  }

  // ── Inject watermark + cover art ─────────────────────────────────────────
  const watermarkedBuffer = injectWatermark(originalBuffer, {
    recipientEmail,
    distributionId: session.id,
    campaignTitle: campaign.title,
    trackTitle: track.title,
    artistName: track.artistName,
    artworkBuffer,
    artworkMime,
  });

  // ── Mark as downloaded (best-effort, non-blocking) ────────────────────────
  Promise.all([
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
  ]).catch(() => {/* non-fatal */});

  // ── Stream the file directly — no redirect, no new page ─────────────────
  const ext = track.originalKey.split(".").pop() ?? "wav";
  const safeFilename = `${track.artistName} - ${track.title}.${ext}`
    .replace(/[^a-zA-Z0-9 ._-]/g, "_");

  const contentType = ext === "wav" ? "audio/wav" : ext === "flac" ? "audio/flac" : "audio/aiff";

  return new Response(new Uint8Array(watermarkedBuffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // attachment forces the browser to download, never navigate or open
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
      "Content-Length": String(watermarkedBuffer.length),
      // Prevent caching of download links
      "Cache-Control": "no-store",
    },
  });
}
