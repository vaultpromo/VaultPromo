import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { profiles } from "@/db/schema";

/**
 * Data Access Layer — centralises auth verification.
 * All functions are wrapped in React.cache() so they deduplicate
 * calls within a single render pass.
 *
 * Rule: call verifySession() at the top of every Server Action and
 * Route Handler that touches user data.
 */

/** Verified session shape exposed to the rest of the app */
export type VerifiedSession = {
  userId: string;
  email: string;
  name: string | null;
};

/**
 * Verifies the Auth.js session and returns a safe subset.
 * Redirects to /login if unauthenticated.
 */
export const verifySession = cache(async (): Promise<VerifiedSession> => {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return {
    userId: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? null,
  };
});

/**
 * Returns the full profile for the current user.
 * Redirects to /login if unauthenticated.
 */
export const getCurrentProfile = cache(async () => {
  const { userId } = await verifySession();

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  });

  return profile ?? null;
});

/**
 * Switches the active workspace for the current user.
 * Called from the workspace-toggle Server Action.
 */
export async function switchWorkspace(workspace: "label" | "dj"): Promise<void> {
  const { userId } = await verifySession();

  await db.update(profiles).set({ activeWorkspace: workspace, updatedAt: new Date() }).where(eq(profiles.userId, userId));
}
