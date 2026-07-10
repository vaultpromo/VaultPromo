import { eq, desc, count } from "drizzle-orm";
import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/db";
import { mailingLists, mailingListContacts } from "@/db/schema";
import { CreateListForm } from "@/components/contacts/create-list-form";
import { QuickImport } from "@/components/contacts/quick-import";

export default async function ContactsPage() {
  const { userId } = await verifySession();

  const lists = await db.query.mailingLists.findMany({
    where: eq(mailingLists.userId, userId),
    orderBy: [desc(mailingLists.createdAt)],
  });

  // Contact counts per list
  const countRows = await db
    .select({
      listId: mailingListContacts.mailingListId,
      total: count(mailingListContacts.contactId),
    })
    .from(mailingListContacts)
    .groupBy(mailingListContacts.mailingListId);

  const countMap = Object.fromEntries(countRows.map((r) => [r.listId, r.total]));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-white/30">Label</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Contacts & Lists</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left col: create list + quick import */}
        <div className="space-y-4 lg:col-span-2">
          {/* Create list */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/30">
              New List
            </h2>
            <CreateListForm />
          </div>

          {/* Quick import — no list required, creates contacts and optionally assigns */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/30">
              Import Contacts
            </h2>
            <p className="mb-4 text-xs text-white/25">
              CSV or XLSX — columns: email, name, alias, city, country
            </p>
            <QuickImport lists={lists.map((l) => ({ id: l.id, name: l.name }))} />
          </div>
        </div>

        {/* Right col: lists */}
        <div className="lg:col-span-3">
          {lists.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/[0.06] py-16 text-center">
              <p className="text-sm text-white/30">No lists yet.</p>
              <p className="text-xs text-white/15">Create a list on the left to organise your contacts.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/[0.06]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.05] bg-white/[0.02]">
                    <th className="px-5 py-3 text-left text-xs font-medium text-white/30">List</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-white/30">Contacts</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-white/30">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {lists.map((list) => (
                    <tr key={list.id} className="group transition hover:bg-white/[0.02]">
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/dashboard/contacts/${list.id}`}
                          className="block"
                        >
                          <p className="font-medium text-white/90 group-hover:text-white">
                            {list.name}
                          </p>
                          {list.description && (
                            <p className="mt-0.5 text-xs text-white/30">{list.description}</p>
                          )}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-white/40">
                        {countMap[list.id] ?? 0}
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-white/25">
                        {new Date(list.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
