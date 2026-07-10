import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { campaignDistributions } from "@/db/schema";
import { verifyDeliveryToken } from "@/lib/promo/verify-token";
import { setPromoSession } from "@/lib/promo/session";
import { promoTokenLimiter } from "@/lib/rate-limiter";

const bodySchema = z.object({
  token: z.string().length(64, "Invalid token format"),
  campaignId: z.string().min(1),
});

/**
 * POST /api/promo/access
 *
 * Passwordless access endpoint. Called by the promo page when it detects
 * a token in the URL query string.
 *
 * Flow:
 * 1. Rate-limit by IP (20 req/min)
 * 2. Validate token format (64 hex chars)
 * 3. Verify token against DB + campaign expiry
 * 4. Log `email_opened_at` (idempotent — only on first open)
 * 5. Set promo session cookie
 * 6. Return campaign+distribution data for the page to render
 *
 * This endpoint is intentionally NOT behind verifySession() — it IS the
 * passwordless auth mechanism for recipients.
 */
export async function POST(request: NextRequest) {
  // ── Rate limiting ──────────────────────────────────────────────────────
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (!promoTokenLimiter.check(ip)) {
    return Response.json(
      { error: "Too many requests. Please wait a minute." },
      {
        status: 429,
        headers: { "Retry-After": "60" },
      },
    );
  }

  // ── Parse + validate request ────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { token, campaignId } = parsed.data;

  // ── Verify token ────────────────────────────────────────────────────────
  const result = await verifyDeliveryToken(token, campaignId);

  if (!result.valid) {
    const statusMap = {
      not_found: 404,
      expired: 410,
      wrong_campaign: 403,
    } as const;

    return Response.json(
      { error: result.reason },
      { status: statusMap[result.reason] },
    );
  }

  const { distribution, campaign } = result;

  // ── Log opened_email (idempotent — only update on first access) ─────────
  if (!distribution.emailOpenedAt) {
    await db
      .update(campaignDistributions)
      .set({
        emailOpenedAt: new Date(),
        lastAccessedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(campaignDistributions.id, distribution.id));
  } else {
    // Update lastAccessedAt on every visit
    await db
      .update(campaignDistributions)
      .set({ lastAccessedAt: new Date(), updatedAt: new Date() })
      .where(eq(campaignDistributions.id, distribution.id));
  }

  // ── Set promo session cookie ────────────────────────────────────────────
  await setPromoSession(campaignId, token);

  // Return only safe, non-sensitive data needed by the promo page
  return Response.json({
    distribution: {
      id: distribution.id,
      feedbackSubmitted: distribution.feedbackSubmitted,
      hasDownloaded: distribution.hasDownloaded,
    },
    campaign: {
      id: campaign.id,
      title: campaign.title,
      artistName: campaign.artistName,
      catalogNumber: campaign.catalogNumber,
      description: campaign.description,
      releaseDate: campaign.releaseDate,
      expiryDate: campaign.expiryDate,
      status: campaign.status,
    },
  });
}
