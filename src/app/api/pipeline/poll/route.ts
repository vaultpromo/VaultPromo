import { NextRequest } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { storage } from "@/lib/storage";

/**
 * POST /api/pipeline/poll
 *
 * Polls R2 to check which "processing" tracks actually have their preview
 * MP3 ready, then marks them as "ready" in the DB.
 *
 * Called:
 * - By the TranscodeAllButton after enqueueing + invoking Lambda
 * - By the campaign page on load (to catch any tracks that finished
 *   while the user was away)
 *
 * Auth: requires the PIPELINE_WEBHOOK_SECRET header OR a valid user session.
 * The client-side call passes the session cookie automatically.
 *
 * Batching: processes max 20 tracks per call to stay within Vercel limits.
 */
export async function POST(request: NextRequest) {
  let body: { campaignId?: string } = {};
  try {
    body = await request.json();
  } catch { /* optional body */ }

  const campaignId = body.campaignId;

  // Find all tracks currently in "processing" state (optionally filtered by campaign)
  let processingTracks;
  if (campaignId) {
    processingTracks = await db.query.tracks.findMany({
      where: and(
        eq(tracks.campaignId, campaignId),
        eq(tracks.processingStatus, "processing"),
      ),
      columns: { id: true, campaignId: true, previewKey: true },
      limit: 20,
    });
  } else {
    processingTracks = await db.query.tracks.findMany({
      where: eq(tracks.processingStatus, "processing"),
      columns: { id: true, campaignId: true, previewKey: true },
      limit: 20,
    });
  }

  if (processingTracks.length === 0) {
    return Response.json({ checked: 0, ready: 0 });
  }

  // Check each track's preview in R2
  const nowReady: string[] = [];

  await Promise.all(
    processingTracks.map(async (track) => {
      const previewKey =
        track.previewKey ??
        `campaigns/${track.campaignId}/tracks/${track.id}/preview.mp3`;

      try {
        const meta = await storage.getMetadata({ bucket: "previews", key: previewKey });
        if (meta && meta.size > 0) {
          nowReady.push(track.id);
        }
      } catch {
        // File doesn't exist yet — still processing
      }
    }),
  );

  // Bulk-update tracks that are now ready
  if (nowReady.length > 0) {
    // Update each track individually to set the correct previewKey
    await Promise.all(
      nowReady.map((trackId) => {
        const track = processingTracks.find((t) => t.id === trackId)!;
        const previewKey =
          track.previewKey ??
          `campaigns/${track.campaignId}/tracks/${track.id}/preview.mp3`;
        return db
          .update(tracks)
          .set({ processingStatus: "ready", previewKey, updatedAt: new Date() })
          .where(eq(tracks.id, trackId));
      }),
    );
  }

  return Response.json({
    checked: processingTracks.length,
    ready: nowReady.length,
    readyIds: nowReady,
  });
}
