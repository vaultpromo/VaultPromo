"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { signIn, signOut } from "@/lib/auth";
import { db } from "@/db";
import { users, accounts, profiles } from "@/db/schema";
import { signupSchema, type AuthFormState } from "@/lib/validations/auth";

/**
 * Sign up a new user with email + password.
 * Creates: user row, hashed-password account row, default profile.
 */
export async function signUpAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { name, email, password } = parsed.data;

  // Check for existing user
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existing) {
    return { errors: { email: ["An account with this email already exists."] } };
  }

  const userId = randomUUID();
  const hashedPassword = await bcrypt.hash(password, 12);

  // Insert user
  await db.insert(users).values({
    id: userId,
    name,
    email,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Store hashed password in the accounts table using access_token field
  // (credentials provider doesn't have a real OAuth token — we reuse this field)
  await db.insert(accounts).values({
    userId,
    type: "credentials",
    provider: "credentials",
    providerAccountId: userId,
    access_token: hashedPassword,
  });

  // Create default profile (label workspace by default)
  await db.insert(profiles).values({
    id: randomUUID(),
    userId,
    activeWorkspace: "label",
    storageQuotaBytes: "5368709120", // 5 GB
    storageUsedBytes: "0",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Sign the user in immediately after registration
  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
}

/**
 * Sign in with email + password.
 * Auth.js handles the session creation.
 */
export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    // Auth.js throws a redirect on success — re-throw it
    if ((error as Error).message?.includes("NEXT_REDIRECT")) throw error;
    return { message: "Invalid email or password." };
  }
}

/**
 * Sign the current user out and redirect to home.
 */
export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}

/**
 * Switch the active workspace for the current user.
 * Accepts 'label' or 'dj'.
 */
export async function switchWorkspaceAction(workspace: "label" | "dj"): Promise<void> {
  const { switchWorkspace } = await import("@/lib/dal");
  await switchWorkspace(workspace);
  redirect("/dashboard");
}
