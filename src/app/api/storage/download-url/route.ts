import { NextRequest } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { verifySession } from "@/lib/dal";
import { storage } from "@/lib/storage";
import { db } from "@/db";
import { tracks, campaigns } from "@/db/schema";
import type { BucketName } from "@/lib/storage";

const requestSchema = z.object({
  bucket: z.enum(["originals", "previews"]),
  key: z.string().min(1).max(512),
  expiresInSeconds: z.number().int().min(60).max(3600).optional(),
});

/**
 * POST /api/storage/download-url
 *
 * Returns a time-limited presigned GET URL for a private R2 object.
 * Only usable by the label that owns the campaign the object belongs to.
 *
 * Security: verifies that the requested key belongs to a campaign
 * owned by the authenticated user — prevents IDOR where any
 * authenticated user could request URLs for other users' files.
 *
 * Key format expected: campaigns/<campaignId>/tracks/<trackId>/... OR
 *                      campaigns/<campaignId>/artwork.*
 */
export async function POST(request: NextRequest) {
  const { userId } = await verifySession();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { bucket, key, expiresInSeconds } = parsed.data;

  // ── Ownership check ────────────────────────────────────────────────────
  // Extract campaignId from the key path: campaigns/<campaignId>/...
  const keyParts = key.split("/");
  if (keyParts[0] !== "campaigns" || !keyParts[1]) {
    return Response.json({ error: "Invalid key path" }, { status: 403 });
  }
  const campaignId = keyParts[1];

  // Verify the campaign belongs to this user
  const campaign = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)),
    columns: { id: true },
  });

  if (!campaign) {
    // Return 404 to not leak whether the campaign exists
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const url = await storage.getPresignedUrl({
    bucket: bucket as BucketName,
    key,
    expiresInSeconds: expiresInSeconds ?? 3600,
  });

  return Response.json({
    url,
    expiresAt: new Date(Date.now() + (expiresInSeconds ?? 3600) * 1000).toISOString(),
  });
}
