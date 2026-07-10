import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/db";
import { mailingLists } from "@/db/schema";
import { CreateListForm } from "@/components/contacts/create-list-form";

export default async function ContactsPage() {
  const { userId } = await verifySession();

  const lists = await db.query.mailingLists.findMany({
    where: eq(mailingLists.userId, userId),
    orderBy: [desc(mailingLists.createdAt)],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Contacts & Lists</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Manage your mailing lists and import contacts.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Create list form */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 lg:col-span-1">
          <h2 className="mb-4 text-sm font-semibold text-zinc-300">New Mailing List</h2>
          <CreateListForm />
        </div>

        {/* Lists */}
        <div className="space-y-3 lg:col-span-2">
          {lists.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
              <p className="text-sm text-zinc-500">
                No lists yet. Create one to start importing contacts.
              </p>
            </div>
          ) : (
            lists.map((list) => (
              <Link
                key={list.id}
                href={`/dashboard/contacts/${list.id}`}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 transition hover:border-zinc-600"
              >
                <div>
                  <p className="font-semibold text-white">{list.name}</p>
                  {list.description && (
                    <p className="mt-0.5 text-sm text-zinc-400">{list.description}</p>
                  )}
                </div>
                <span className="text-xs text-zinc-500">
                  {new Date(list.createdAt).toLocaleDateString()}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
