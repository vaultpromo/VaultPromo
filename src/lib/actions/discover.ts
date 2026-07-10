"use server";

import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { db } from "@/db";
import { users, profiles, contacts, mailingLists, mailingListContacts } from "@/db/schema";

/**
 * Add a PromoVault Network tastemaker to one of the label's mailing lists.
 *
 * Privacy contract:
 * - The label passes the DJ's userId (opaque identifier), NOT their email
 * - This Server Action resolves the email server-side from the users table
 * - The email is never sent to the client at any point
 * - The DJ must have discoverable = true to be addable
 *
 * If the contact doesn't exist in the label's contact list yet, we create it.
 * If they already exist, we skip creation but still add them to the list.
 */
export async function addNetworkTastemaker({
  djUserId,
  listId,
}: {
  djUserId: string;
  listId: string;
}): Promise<{ success: boolean; error?: string }> {
  const { userId: labelUserId } = await verifySession();

  // Verify list belongs to label
  const list = await db.query.mailingLists.findFirst({
    where: and(eq(mailingLists.id, listId), eq(mailingLists.userId, labelUserId)),
    columns: { id: true },
  });

  if (!list) return { success: false, error: "List not found." };

  // Verify the DJ has opted in to the network
  const djProfile = await db.query.profiles.findFirst({
    where: and(eq(profiles.userId, djUserId), eq(profiles.discoverable, true)),
    columns: { djAlias: true, djCity: true, djCountry: true, djGenres: true },
  });

  if (!djProfile) {
    return { success: false, error: "Tastemaker not found or not discoverable." };
  }

  // Resolve email server-side — never exposed to client
  const djUser = await db.query.users.findFirst({
    where: eq(users.id, djUserId),
    columns: { email: true, name: true },
  });

  if (!djUser?.email) return { success: false, error: "User not found." };

  // Find-or-create contact in the label's contacts
  let contact = await db.query.contacts.findFirst({
    where: and(
      eq(contacts.userId, labelUserId),
      eq(contacts.email, djUser.email.toLowerCase()),
    ),
    columns: { id: true, unsubscribed: true },
  });

  if (!contact) {
    const contactId = randomUUID();
    await db.insert(contacts).values({
      id: contactId,
      userId: labelUserId,
      email: djUser.email.toLowerCase(),
      name: djUser.name ?? null,
      alias: djProfile.djAlias ?? null,
      city: djProfile.djCity ?? null,
      country: djProfile.djCountry ?? null,
      notes: `Added via PromoVault Network. Genres: ${djProfile.djGenres ?? "—"}`,
      unsubscribed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    contact = { id: contactId, unsubscribed: false };
  }

  if (contact.unsubscribed) {
    return { success: false, error: "This contact has unsubscribed." };
  }

  // Add to list (idempotent — skip if already a member)
  const existing = await db.query.mailingListContacts.findFirst({
    where: and(
      eq(mailingListContacts.mailingListId, listId),
      eq(mailingListContacts.contactId, contact.id),
    ),
    columns: { mailingListId: true },
  });

  if (!existing) {
    await db.insert(mailingListContacts).values({
      mailingListId: listId,
      contactId: contact.id,
      createdAt: new Date(),
    });
  }

  revalidatePath("/dashboard/contacts");
  revalidatePath("/dashboard/discover");
  return { success: true };
}
