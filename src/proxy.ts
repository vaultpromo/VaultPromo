import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Next.js 16 uses proxy.ts instead of middleware.ts.
 *
 * Optimistic auth checks only (reads cookie, no DB call).
 * Heavy authorization happens in the DAL close to data.
 */

const PUBLIC_ROUTES = ["/", "/login", "/signup"];
const AUTH_ROUTES = ["/login", "/signup"];
const PROMO_ROUTE_PREFIX = "/promo"; // token-based, no session required
const API_PROMO_PREFIX = "/api/promo"; // public token-access API

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Promo routes are publicly accessible via delivery token — skip auth
  if (pathname.startsWith(PROMO_ROUTE_PREFIX) || pathname.startsWith(API_PROMO_PREFIX)) {
    return NextResponse.next();
  }

  // Skip Next.js internals and static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const session = await auth();
  const isAuthenticated = !!session?.user?.id;

  // Redirect unauthenticated users away from protected routes
  if (!PUBLIC_ROUTES.includes(pathname) && !isAuthenticated) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages to dashboard
  if (AUTH_ROUTES.includes(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
