import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Next.js 16 proxy (middleware).
 * Optimistic auth checks only — heavy authorization happens in the DAL.
 */

const PUBLIC_ROUTES = new Set(["/", "/login", "/signup", "/pricing"]);
const AUTH_ROUTES = new Set(["/login", "/signup"]);
const PROMO_ROUTE_PREFIX = "/promo";
const API_PROMO_PREFIX = "/api/promo";
const FEEDBACK_PREFIX = "/feedback";

/** Only allow redirects to internal paths — prevents open redirect */
function isSafeCallbackUrl(url: string): boolean {
  // Must be a relative path starting with / and not //
  return url.startsWith("/") && !url.startsWith("//") && !url.includes("://");
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Promo and feedback routes are publicly accessible
  if (
    pathname.startsWith(PROMO_ROUTE_PREFIX) ||
    pathname.startsWith(API_PROMO_PREFIX) ||
    pathname.startsWith(FEEDBACK_PREFIX)
  ) {
    return NextResponse.next();
  }

  // Skip Next.js internals, API routes (protected by their own auth), static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const session = await auth();
  const isAuthenticated = !!session?.user?.id;

  // Redirect unauthenticated users to login with a validated callbackUrl
  if (!PUBLIC_ROUTES.has(pathname) && !isAuthenticated) {
    const loginUrl = new URL("/login", req.nextUrl);
    // Only set callbackUrl if it's a safe internal path
    if (isSafeCallbackUrl(pathname)) {
      loginUrl.searchParams.set("callbackUrl", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages
  if (AUTH_ROUTES.has(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
