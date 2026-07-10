import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { campaignDistributions, campaigns } from "@/db/schema";

export type TokenVerifyResult =
  | { valid: true; distribution: typeof campaignDistributions.$inferSelect; campaign: typeof campaigns.$inferSelect }
  | { valid: false; reason: "not_found" | "expired" | "wrong_campaign" };

/**
 * Verify a delivery_token against the database.
 *
 * Checks:
 * 1. Token exists in campaign_distributions
 * 2. It belongs to the expected campaign
 * 3. The campaign has not expired
 */
export async function verifyDeliveryToken(
  token: string,
  campaignId: string,
): Promise<TokenVerifyResult> {
  const distribution = await db.query.campaignDistributions.findFirst({
    where: eq(campaignDistributions.deliveryToken, token),
  });

  if (!distribution) {
    return { valid: false, reason: "not_found" };
  }

  if (distribution.campaignId !== campaignId) {
    return { valid: false, reason: "wrong_campaign" };
  }

  // Check campaign expiry
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
  });

  if (!campaign) {
    return { valid: false, reason: "not_found" };
  }

  if (campaign.expiryDate && campaign.expiryDate < new Date()) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, distribution, campaign };
}
