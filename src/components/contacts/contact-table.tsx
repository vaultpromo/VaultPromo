"use client";

import { useTransition } from "react";
import { removeContactFromListAction, unsubscribeContactAction } from "@/lib/actions/contacts";

interface Contact {
  id: string;
  email: string;
  name: string | null;
  alias: string | null;
  city: string | null;
  country: string | null;
  unsubscribed: boolean;
}

interface ContactTableProps {
  contacts: Contact[];
  listId: string;
}

export function ContactTable({ contacts: rows, listId }: ContactTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
        <p className="text-sm text-zinc-500">
          No contacts in this list yet. Import a CSV or XLSX file above.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900 text-left text-xs text-zinc-500">
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Name / Alias</th>
            <th className="px-4 py-3 font-medium">Location</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800 bg-zinc-950">
          {rows.map((contact) => (
            <ContactRow key={contact.id} contact={contact} listId={listId} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContactRow({ contact, listId }: { contact: Contact; listId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    if (!confirm(`Remove ${contact.email} from this list?`)) return;
    startTransition(() => removeContactFromListAction(contact.id, listId));
  }

  function handleUnsubscribe() {
    if (!confirm(`Unsubscribe ${contact.email} from all future emails?`)) return;
    startTransition(() => unsubscribeContactAction(contact.id));
  }

  return (
    <tr className={isPending ? "opacity-50" : ""}>
      <td className="px-4 py-3 text-zinc-200">{contact.email}</td>
      <td className="px-4 py-3 text-zinc-400">
        {contact.name ?? contact.alias ?? "—"}
      </td>
      <td className="px-4 py-3 text-zinc-500">
        {[contact.city, contact.country].filter(Boolean).join(", ") || "—"}
      </td>
      <td className="px-4 py-3">
        {contact.unsubscribed ? (
          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
            Unsubscribed
          </span>
        ) : (
          <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
            Active
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 justify-end">
          {!contact.unsubscribed && (
            <button
              onClick={handleUnsubscribe}
              disabled={isPending}
              className="text-xs text-zinc-500 transition hover:text-red-400 disabled:opacity-40"
            >
              Unsubscribe
            </button>
          )}
          <button
            onClick={handleRemove}
            disabled={isPending}
            className="text-xs text-zinc-500 transition hover:text-red-400 disabled:opacity-40"
          >
            Remove
          </button>
        </div>
      </td>
    </tr>
  );
}
