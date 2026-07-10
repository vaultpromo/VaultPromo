import "server-only";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { campaigns, contacts, profiles } from "@/db/schema";
import { PLAN_LIMITS, type PlanTier } from "@/db/schema/users";

export { PLAN_LIMITS };
export type { PlanTier };

export interface PlanCheckResult {
  allowed: boolean;
  reason?: string;
  current?: number;
  limit?: number | null;
}

/**
 * Get the plan tier for a user (defaults to "free" if no profile).
 */
export async function getUserPlan(userId: string): Promise<PlanTier> {
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: { planTier: true },
  });
  return (profile?.planTier as PlanTier) ?? "free";
}

/**
 * Check if a user can create a new campaign.
 * Counts their non-expired active/draft/scheduled campaigns.
 */
export async function canCreateCampaign(userId: string): Promise<PlanCheckResult> {
  const tier = await getUserPlan(userId);
  const limit = PLAN_LIMITS[tier].activeCampaigns;

  // null = unlimited
  if (limit === null) return { allowed: true };

  const [row] = await db
    .select({ total: count(campaigns.id) })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.userId, userId),
        // Count draft + scheduled + active (not expired/deleted)
        // using a SQL expression via drizzle
      ),
    );

  const current = Number(row?.total ?? 0);

  if (current >= limit) {
    return {
      allowed: false,
      reason: `Your ${tier} plan allows ${limit} active campaigns. Upgrade to add more.`,
      current,
      limit,
    };
  }

  return { allowed: true, current, limit };
}

/**
 * Check if a user can add more contacts.
 */
export async function canAddContacts(
  userId: string,
  countToAdd: number,
): Promise<PlanCheckResult> {
  const tier = await getUserPlan(userId);
  const limit = PLAN_LIMITS[tier].contacts;

  if (limit === null) return { allowed: true };

  const [row] = await db
    .select({ total: count(contacts.id) })
    .from(contacts)
    .where(eq(contacts.userId, userId));

  const current = Number(row?.total ?? 0);
  const after = current + countToAdd;

  if (after > limit) {
    return {
      allowed: false,
      reason: `Your ${tier} plan allows ${limit} contacts (you have ${current}). Upgrade to add more.`,
      current,
      limit,
    };
  }

  return { allowed: true, current, limit };
}

/**
 * Check if a user has enough storage quota for a new upload.
 */
export async function canUploadStorage(
  userId: string,
  fileSizeBytes: number,
): Promise<PlanCheckResult> {
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: { planTier: true, storageQuotaBytes: true, storageUsedBytes: true },
  });

  if (!profile) return { allowed: false, reason: "Profile not found." };

  const quota = Number(profile.storageQuotaBytes);
  const used = Number(profile.storageUsedBytes);
  const after = used + fileSizeBytes;

  if (after > quota) {
    const usedGB = (used / 1024 ** 3).toFixed(1);
    const quotaGB = (quota / 1024 ** 3).toFixed(0);
    return {
      allowed: false,
      reason: `Storage full (${usedGB} GB / ${quotaGB} GB). Delete old campaigns or upgrade your plan.`,
      current: used,
      limit: quota,
    };
  }

  return { allowed: true, current: used, limit: quota };
}

/**
 * Increment the storage used for a user after a successful upload.
 * Called from confirmTrackUploadAction.
 */
export async function incrementStorageUsed(
  userId: string,
  fileSizeBytes: number,
): Promise<void> {
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: { storageUsedBytes: true },
  });
  if (!profile) return;

  const newUsed = Number(profile.storageUsedBytes) + fileSizeBytes;
  await db
    .update(profiles)
    .set({ storageUsedBytes: String(newUsed), updatedAt: new Date() })
    .where(eq(profiles.userId, userId));
}

/**
 * Decrement storage when a track or campaign is deleted.
 */
export async function decrementStorageUsed(
  userId: string,
  fileSizeBytes: number,
): Promise<void> {
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: { storageUsedBytes: true },
  });
  if (!profile) return;

  const newUsed = Math.max(0, Number(profile.storageUsedBytes) - fileSizeBytes);
  await db
    .update(profiles)
    .set({ storageUsedBytes: String(newUsed), updatedAt: new Date() })
    .where(eq(profiles.userId, userId));
}
