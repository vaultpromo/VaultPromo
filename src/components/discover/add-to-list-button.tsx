"use client";

import { useState, useTransition } from "react";
import { addNetworkTastemaker } from "@/lib/actions/discover";

interface ListOption {
  id: string;
  name: string;
}

interface AddToListButtonProps {
  profileId: string;
  djUserId: string;
  lists: ListOption[];
}

/**
 * Adds a network tastemaker to one of the label's mailing lists.
 *
 * Privacy: the Server Action resolves the email from the userId server-side.
 * The email is NEVER sent to or stored in the client.
 */
export function AddToListButton({ profileId, djUserId, lists }: AddToListButtonProps) {
  const [selectedList, setSelectedList] = useState(lists[0]?.id ?? "");
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    if (!selectedList || isPending) return;
    startTransition(async () => {
      const result = await addNetworkTastemaker({ djUserId, listId: selectedList });
      setState(result.success ? "done" : "error");
    });
  }

  if (state === "done") {
    return <span className="text-xs text-emerald-400">✓ Added</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      {lists.length > 1 && (
        <select
          value={selectedList}
          onChange={(e) => setSelectedList(e.target.value)}
          className="rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-xs text-white/60 focus:outline-none"
        >
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      )}
      <button
        onClick={handleAdd}
        disabled={isPending || !selectedList}
        className="rounded px-2 py-1 text-xs text-white/40 transition hover:bg-white/[0.05] hover:text-white/80 disabled:opacity-40"
      >
        {isPending ? "…" : state === "error" ? "Retry" : "+ Add"}
      </button>
    </div>
  );
}
