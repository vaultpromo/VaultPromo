import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/db";
import { mailingLists, mailingListContacts, contacts } from "@/db/schema";
import { ContactImport } from "@/components/contacts/contact-import";
import { ContactTable } from "@/components/contacts/contact-table";
import { deleteMailingListAction } from "@/lib/actions/contacts";

export default async function ListDetailPage(props: PageProps<"/dashboard/contacts/[listId]">) {
  const { listId } = await props.params;
  const { userId } = await verifySession();

  const list = await db.query.mailingLists.findFirst({
    where: and(eq(mailingLists.id, listId), eq(mailingLists.userId, userId)),
  });

  if (!list) notFound();

  // Fetch contacts in this list with their data
  const memberRows = await db
    .select({
      id: contacts.id,
      email: contacts.email,
      name: contacts.name,
      alias: contacts.alias,
      city: contacts.city,
      country: contacts.country,
      unsubscribed: contacts.unsubscribed,
    })
    .from(mailingListContacts)
    .innerJoin(contacts, eq(mailingListContacts.contactId, contacts.id))
    .where(eq(mailingListContacts.mailingListId, listId));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/contacts" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← Lists
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-white">{list.name}</h1>
          {list.description && (
            <p className="mt-1 text-sm text-zinc-400">{list.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-zinc-800 px-3 py-1 text-sm text-zinc-300">
            {memberRows.length} contacts
          </span>
          <form
            action={async () => {
              "use server";
              await deleteMailingListAction(listId);
            }}
          >
            <button
              type="submit"
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-red-400 transition hover:border-red-700 hover:bg-red-900/20"
            >
              Delete list
            </button>
          </form>
        </div>
      </div>

      {/* Import */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Import contacts</h2>
        <p className="mb-4 text-xs text-zinc-500">
          Upload a CSV or XLSX file with columns: email (required), name, alias, city, country, notes.
        </p>
        <ContactImport listId={listId} />
      </div>

      {/* Contact table */}
      <ContactTable contacts={memberRows} listId={listId} />
    </div>
  );
}
