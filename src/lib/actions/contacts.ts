"use server";

import { randomUUID } from "crypto";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { db } from "@/db";
import { contacts, mailingLists, mailingListContacts } from "@/db/schema";
import { mailingListSchema, type MailingListFormState } from "@/lib/validations/contacts";
import type { ParseResult } from "@/lib/contacts/parser";

// ── Mailing List Actions ─────────────────────────────────────────────────────

export async function createMailingListAction(
  _prevState: MailingListFormState,
  formData: FormData,
): Promise<MailingListFormState> {
  const { userId } = await verifySession();

  const parsed = mailingListSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const listId = randomUUID();

  await db.insert(mailingLists).values({
    id: listId,
    userId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  revalidatePath("/dashboard/contacts");
  return { listId };
}

export async function deleteMailingListAction(listId: string): Promise<void> {
  const { userId } = await verifySession();

  await db
    .delete(mailingLists)
    .where(and(eq(mailingLists.id, listId), eq(mailingLists.userId, userId)));

  revalidatePath("/dashboard/contacts");
}

// ── Contact Import Action ─────────────────────────────────────────────────────

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  duplicatesInFile: number;
  message?: string;
}

/**
 * Import contacts from a parsed file result.
 * - Deduplicates against existing contacts for this user (by email).
 * - Skips contacts that are unsubscribed.
 * - Optionally adds all imported contacts to a mailing list.
 *
 * Returns a summary of what happened.
 */
export async function importContactsAction(
  parseResult: ParseResult,
  listId?: string,
): Promise<ImportResult> {
  const { userId } = await verifySession();

  if (parseResult.valid.length === 0) {
    return {
      imported: 0,
      skipped: 0,
      errors: parseResult.invalid.length,
      duplicatesInFile: parseResult.duplicates.length,
      message: "No valid rows found in file.",
    };
  }

  // ── Plan check: contact limit ─────────────────────────────────────────
  const { canAddContacts } = await import("@/lib/plans");
  const planCheck = await canAddContacts(userId, parseResult.valid.length);
  if (!planCheck.allowed) {
    return {
      imported: 0,
      skipped: 0,
      errors: 0,
      duplicatesInFile: 0,
      message: planCheck.reason,
    };
  }

  // Verify list ownership if provided
  if (listId) {
    const list = await db.query.mailingLists.findFirst({
      where: and(eq(mailingLists.id, listId), eq(mailingLists.userId, userId)),
    });
    if (!list) {
      return {
        imported: 0,
        skipped: 0,
        errors: 1,
        duplicatesInFile: 0,
        message: "Mailing list not found.",
      };
    }
  }

  // De-duplicate the valid rows (keep first occurrence per email in this import)
  const uniqueByEmail = new Map<string, (typeof parseResult.valid)[0]>();
  for (const row of parseResult.valid) {
    if (!uniqueByEmail.has(row.email)) {
      uniqueByEmail.set(row.email, row);
    }
  }

  const uniqueRows = Array.from(uniqueByEmail.values());
  const emails = uniqueRows.map((r) => r.email);

  // Find existing contacts for this user with these emails
  const existing = await db.query.contacts.findMany({
    where: and(
      eq(contacts.userId, userId),
      inArray(contacts.email, emails),
    ),
    columns: { email: true, id: true, unsubscribed: true },
  });

  const existingEmails = new Set(existing.map((c) => c.email));

  // Only insert truly new contacts
  const toInsert = uniqueRows.filter((r) => !existingEmails.has(r.email));
  const skipped = uniqueRows.length - toInsert.length;

  const newContactIds: string[] = [];

  if (toInsert.length > 0) {
    const rows = toInsert.map((r) => ({
      id: randomUUID(),
      userId,
      email: r.email,
      name: r.name ?? null,
      alias: r.alias ?? null,
      city: r.city ?? null,
      country: r.country ?? null,
      notes: r.notes ?? null,
      unsubscribed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await db.insert(contacts).values(rows);
    newContactIds.push(...rows.map((r) => r.id));
  }

  // Add to mailing list — both newly created and already-existing contacts
  if (listId) {
    const existingNonUnsub = existing
      .filter((c) => !c.unsubscribed)
      .map((c) => c.id);

    const allIdsForList = [...newContactIds, ...existingNonUnsub];

    if (allIdsForList.length > 0) {
      // Get already-members to avoid FK conflicts
      const alreadyMember = await db.query.mailingListContacts.findMany({
        where: and(
          eq(mailingListContacts.mailingListId, listId),
          inArray(mailingListContacts.contactId, allIdsForList),
        ),
        columns: { contactId: true },
      });
      const alreadyMemberIds = new Set(alreadyMember.map((m) => m.contactId));
      const toAddToList = allIdsForList.filter((id) => !alreadyMemberIds.has(id));

      if (toAddToList.length > 0) {
        await db.insert(mailingListContacts).values(
          toAddToList.map((contactId) => ({
            mailingListId: listId,
            contactId,
            createdAt: new Date(),
          })),
        );
      }
    }
  }

  revalidatePath("/dashboard/contacts");

  return {
    imported: toInsert.length,
    skipped,
    errors: parseResult.invalid.length,
    duplicatesInFile: parseResult.duplicates.length,
  };
}

/** Remove a contact from a mailing list (does not delete the contact itself). */
export async function removeContactFromListAction(
  contactId: string,
  listId: string,
): Promise<void> {
  const { userId } = await verifySession();

  // Ownership guard via the list
  const list = await db.query.mailingLists.findFirst({
    where: and(eq(mailingLists.id, listId), eq(mailingLists.userId, userId)),
  });

  if (!list) return;

  await db
    .delete(mailingListContacts)
    .where(
      and(
        eq(mailingListContacts.contactId, contactId),
        eq(mailingListContacts.mailingListId, listId),
      ),
    );

  revalidatePath("/dashboard/contacts");
}

/** Mark a contact as unsubscribed. Hard-stops future email sends. */
export async function unsubscribeContactAction(contactId: string): Promise<void> {
  const { userId } = await verifySession();

  await db
    .update(contacts)
    .set({ unsubscribed: true, updatedAt: new Date() })
    .where(and(eq(contacts.id, contactId), eq(contacts.userId, userId)));

  revalidatePath("/dashboard/contacts");
}
