"use client";

import { useActionState } from "react";
import { createMailingListAction } from "@/lib/actions/contacts";
import type { MailingListFormState } from "@/lib/validations/contacts";

export function CreateListForm() {
  const [state, action, pending] = useActionState<MailingListFormState, FormData>(
    createMailingListAction,
    undefined,
  );

  return (
    <form action={action} className="space-y-3">
      {state?.message && (
        <p role="alert" className="rounded bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {state.message}
        </p>
      )}

      <div className="space-y-1">
        <label htmlFor="name" className="block text-xs font-medium text-zinc-400">
          List name *
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="Core DJs — Europe"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
        />
        {state?.errors?.name && (
          <p className="text-xs text-red-400">{state.errors.name[0]}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="description" className="block text-xs font-medium text-zinc-400">
          Description
        </label>
        <input
          id="description"
          name="description"
          type="text"
          placeholder="Optional description"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create list"}
      </button>
    </form>
  );
}
