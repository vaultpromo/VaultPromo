import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { campaignDistributions } from "@/db/schema";

/**
 * Promo session — stores the validated delivery_token in an HttpOnly cookie
 * so the DJ stays "logged in" to the promo page without a full Auth.js session.
 *
 * Cookie name: `promo_session_<campaignId>` (scoped per campaign so multiple
 * promos in different tabs don't conflict).
 *
 * This is NOT the same as the Auth.js session. It is a lightweight,
 * campaign-scoped token that expires when the campaign does.
 */

const PROMO_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function promoSessionKey(campaignId: string): string {
  return `promo_${campaignId}`;
}

/** Write the delivery_token into a secure cookie */
export async function setPromoSession(
  campaignId: string,
  deliveryToken: string,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(promoSessionKey(campaignId), deliveryToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: PROMO_SESSION_MAX_AGE,
    path: `/promo/${campaignId}`,
  });
}

/** Read and verify the promo session for a campaign.
 *  Returns the distribution row if valid, null otherwise.
 */
export async function getPromoSession(campaignId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(promoSessionKey(campaignId))?.value;
  if (!token) return null;

  return db.query.campaignDistributions.findFirst({
    where: eq(campaignDistributions.deliveryToken, token),
  });
}
