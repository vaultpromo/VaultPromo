import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { campaignDistributions } from "@/db/schema";
import { verifyDeliveryToken } from "@/lib/promo/verify-token";
import { promoSessionKey } from "@/lib/promo/session";
import { promoTokenLimiter } from "@/lib/rate-limiter";

const PROMO_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * GET /api/promo/enter?token=<token>&campaign=<campaignId>
 *
 * Entry point for promo links from email.
 * This Route Handler (not a Server Component) can set cookies.
 *
 * Flow:
 * 1. Rate-limit by IP
 * 2. Verify token
 * 3. Log email_opened_at (idempotent)
 * 4. Set HttpOnly session cookie
 * 5. Redirect to /promo/[campaignId]
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get("token");
  const campaignId = searchParams.get("campaign");

  if (!token || !campaignId) {
    return NextResponse.redirect(new URL("/promo/invalid", request.nextUrl.origin));
  }

  // Rate limit by IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (!promoTokenLimiter.check(ip)) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  // Verify token
  const result = await verifyDeliveryToken(token, campaignId);

  if (!result.valid) {
    // Redirect to promo page with error — it will show the error UI
    return NextResponse.redirect(
      new URL(`/promo/${campaignId}?error=${result.reason}`, request.nextUrl.origin),
    );
  }

  const { distribution } = result;

  // Log email_opened_at idempotently
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
    await db
      .update(campaignDistributions)
      .set({ lastAccessedAt: new Date(), updatedAt: new Date() })
      .where(eq(campaignDistributions.id, distribution.id));
  }

  // Set cookie and redirect to promo page — using 303 See Other so the
  // token URL is NOT stored in browser history (back button won't reveal it)
  const response = NextResponse.redirect(
    new URL(`/promo/${campaignId}`, request.nextUrl.origin),
    { status: 303 },
  );

  response.cookies.set(promoSessionKey(campaignId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: PROMO_SESSION_MAX_AGE,
    // Scope to promo routes + api/promo only — not the whole app
    path: "/",
  });

  return response;
}
