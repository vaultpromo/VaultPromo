"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifySession } from "@/lib/dal";
import { db } from "@/db";
import { profiles } from "@/db/schema";

const djProfileSchema = z.object({
  djAlias: z.string().min(1).max(80).trim().optional(),
  djGenres: z.string().max(200).trim().optional(),
  djCity: z.string().max(80).trim().optional(),
  djCountry: z.string().length(2).toUpperCase().optional(),
  djType: z.enum(["dj", "radio", "press", "producer", "other"]).optional(),
});

export type DjProfileFormState =
  | { errors?: Record<string, string[]>; message?: string; success?: boolean }
  | undefined;

/** Update DJ profile details (alias, genres, city, country, type) */
export async function updateDjProfileAction(
  _prev: DjProfileFormState,
  formData: FormData,
): Promise<DjProfileFormState> {
  const { userId } = await verifySession();

  const parsed = djProfileSchema.safeParse({
    djAlias: formData.get("djAlias") || undefined,
    djGenres: formData.get("djGenres") || undefined,
    djCity: formData.get("djCity") || undefined,
    djCountry: formData.get("djCountry") || undefined,
    djType: formData.get("djType") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  await db
    .update(profiles)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(profiles.userId, userId));

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { success: true };
}

/**
 * Toggle PromoVault Network opt-in.
 *
 * When discoverable = true the user's DJ profile appears in the tastemaker
 * directory visible to labels on the platform. This is governed by the
 * Terms of Service. The user can opt out at any time.
 */
export async function setDiscoverableAction(discoverable: boolean): Promise<void> {
  const { userId } = await verifySession();

  await db
    .update(profiles)
    .set({
      discoverable,
      discoverableUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, userId));

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}

/** Update label profile (name, website) */
export async function updateLabelProfileAction(
  _prev: DjProfileFormState,
  formData: FormData,
): Promise<DjProfileFormState> {
  const { userId } = await verifySession();

  const labelName = (formData.get("labelName") as string | null)?.trim();
  const labelWebsite = (formData.get("labelWebsite") as string | null)?.trim();

  if (!labelName || labelName.length < 1) {
    return { errors: { labelName: ["Label name is required."] } };
  }

  await db
    .update(profiles)
    .set({ labelName, labelWebsite: labelWebsite ?? null, updatedAt: new Date() })
    .where(eq(profiles.userId, userId));

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { success: true };
}
