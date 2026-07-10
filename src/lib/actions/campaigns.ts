"use server";

import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { db } from "@/db";
import { campaigns, tracks } from "@/db/schema";
import {
  campaignSchema,
  trackSchema,
  updateTrackKeySchema,
  type CampaignFormState,
  type TrackFormState,
} from "@/lib/validations/campaign";

// ── Campaign Actions ────────────────────────────────────────────────────────

/**
 * Create a new campaign (draft status).
 * On success, redirects to the campaign detail page.
 */
export async function createCampaignAction(
  _prevState: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  const { userId } = await verifySession();

  const parsed = campaignSchema.safeParse({
    title: formData.get("title"),
    artistName: formData.get("artistName"),
    catalogNumber: formData.get("catalogNumber") || undefined,
    description: formData.get("description") || undefined,
    releaseDate: formData.get("releaseDate") || undefined,
    expiryDate: formData.get("expiryDate") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { title, artistName, catalogNumber, description, releaseDate, expiryDate } = parsed.data;

  const campaignId = randomUUID();

  await db.insert(campaigns).values({
    id: campaignId,
    userId,
    title,
    artistName,
    catalogNumber: catalogNumber ?? null,
    description: description ?? null,
    releaseDate: releaseDate ? new Date(releaseDate) : null,
    expiryDate: expiryDate ? new Date(expiryDate) : null,
    status: "draft",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  redirect(`/dashboard/campaigns/${campaignId}`);
}

/**
 * Update campaign metadata (title, dates, artwork key, etc.).
 * Does NOT change status — use publishCampaignAction for that.
 */
export async function updateCampaignAction(
  campaignId: string,
  _prevState: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  const { userId } = await verifySession();

  // Ownership check — never trust the client-supplied campaignId alone
  const existing = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)),
  });

  if (!existing) {
    return { message: "Campaign not found or access denied." };
  }

  const parsed = campaignSchema.safeParse({
    title: formData.get("title"),
    artistName: formData.get("artistName"),
    catalogNumber: formData.get("catalogNumber") || undefined,
    description: formData.get("description") || undefined,
    releaseDate: formData.get("releaseDate") || undefined,
    expiryDate: formData.get("expiryDate") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { title, artistName, catalogNumber, description, releaseDate, expiryDate } = parsed.data;

  // Artwork key may be submitted separately after an R2 upload
  const artworkKey = formData.get("artworkKey") as string | null;

  await db
    .update(campaigns)
    .set({
      title,
      artistName,
      catalogNumber: catalogNumber ?? null,
      description: description ?? null,
      releaseDate: releaseDate ? new Date(releaseDate) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      ...(artworkKey ? { artworkUrl: artworkKey } : {}),
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaignId));

  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  return { campaignId };
}

/**
 * Delete a campaign (and all its tracks via cascade).
 * Redirects to the campaigns list on success.
 */
export async function deleteCampaignAction(campaignId: string): Promise<void> {
  const { userId } = await verifySession();

  const existing = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)),
  });

  if (!existing) return;

  await db.delete(campaigns).where(eq(campaigns.id, campaignId));
  revalidatePath("/dashboard/campaigns");
  redirect("/dashboard/campaigns");
}

// ── Track Actions ───────────────────────────────────────────────────────────

/**
 * Add a track to a campaign.
 * Returns the new trackId so the client can immediately request a presigned
 * upload URL for the WAV file.
 */
export async function addTrackAction(
  campaignId: string,
  _prevState: TrackFormState,
  formData: FormData,
): Promise<TrackFormState> {
  const { userId } = await verifySession();

  // Ownership guard
  const campaign = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)),
  });

  if (!campaign) {
    return { message: "Campaign not found or access denied." };
  }

  const parsed = trackSchema.safeParse({
    title: formData.get("title"),
    artistName: formData.get("artistName"),
    mixVersion: formData.get("mixVersion") || undefined,
    isrc: formData.get("isrc") || undefined,
    bpm: formData.get("bpm") || undefined,
    musicalKey: formData.get("musicalKey") || undefined,
    position: formData.get("position") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const trackId = randomUUID();

  await db.insert(tracks).values({
    id: trackId,
    campaignId,
    title: parsed.data.title,
    artistName: parsed.data.artistName,
    mixVersion: parsed.data.mixVersion ?? null,
    isrc: parsed.data.isrc ?? null,
    bpm: parsed.data.bpm ?? null,
    musicalKey: parsed.data.musicalKey ?? null,
    position: parsed.data.position,
    processingStatus: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  return { trackId };
}

/**
 * Update track metadata (title, BPM, key, etc.).
 */
export async function updateTrackAction(
  trackId: string,
  campaignId: string,
  _prevState: TrackFormState,
  formData: FormData,
): Promise<TrackFormState> {
  const { userId } = await verifySession();

  // Verify ownership through the campaign
  const campaign = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)),
  });

  if (!campaign) {
    return { message: "Access denied." };
  }

  const parsed = trackSchema.safeParse({
    title: formData.get("title"),
    artistName: formData.get("artistName"),
    mixVersion: formData.get("mixVersion") || undefined,
    isrc: formData.get("isrc") || undefined,
    bpm: formData.get("bpm") || undefined,
    musicalKey: formData.get("musicalKey") || undefined,
    position: formData.get("position") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  await db
    .update(tracks)
    .set({
      title: parsed.data.title,
      artistName: parsed.data.artistName,
      mixVersion: parsed.data.mixVersion ?? null,
      isrc: parsed.data.isrc ?? null,
      bpm: parsed.data.bpm ?? null,
      musicalKey: parsed.data.musicalKey ?? null,
      position: parsed.data.position,
      updatedAt: new Date(),
    })
    .where(and(eq(tracks.id, trackId), eq(tracks.campaignId, campaignId)));

  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  return { trackId };
}

/**
 * After the browser uploads a WAV to R2, it calls this action to record
 * the R2 key and mark the track as ready for processing.
 */
export async function confirmTrackUploadAction(data: {
  trackId: string;
  campaignId: string;
  originalKey: string;
  fileSizeBytes?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { userId } = await verifySession();

  const parsed = updateTrackKeySchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Invalid data." };
  }

  // Ownership guard
  const campaign = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, data.campaignId), eq(campaigns.userId, userId)),
  });

  if (!campaign) {
    return { success: false, error: "Access denied." };
  }

  await db
    .update(tracks)
    .set({
      originalKey: parsed.data.originalKey,
      fileSizeBytes: parsed.data.fileSizeBytes ?? null,
      processingStatus: "processing",
      updatedAt: new Date(),
    })
    .where(and(eq(tracks.id, parsed.data.trackId), eq(tracks.campaignId, data.campaignId)));

  // Enqueue the Lambda transcoding job
  const { enqueueTranscode } = await import("@/lib/queue/enqueue");
  await enqueueTranscode({
    trackId: parsed.data.trackId,
    campaignId: data.campaignId,
    originalKey: parsed.data.originalKey,
  });

  revalidatePath(`/dashboard/campaigns/${data.campaignId}`);
  return { success: true };
}

/**
 * Delete a single track.
 */
export async function deleteTrackAction(trackId: string, campaignId: string): Promise<void> {
  const { userId } = await verifySession();

  const campaign = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)),
  });

  if (!campaign) return;

  await db.delete(tracks).where(and(eq(tracks.id, trackId), eq(tracks.campaignId, campaignId)));

  revalidatePath(`/dashboard/campaigns/${campaignId}`);
}
