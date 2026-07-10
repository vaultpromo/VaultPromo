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
        <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          {state.message}
        </p>
      )}

      <div className="space-y-1">
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="List name"
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/20 focus:border-white/20 focus:outline-none"
        />
        {state?.errors?.name && (
          <p className="text-xs text-red-400">{state.errors.name[0]}</p>
        )}
      </div>

      <input
        id="description"
        name="description"
        type="text"
        placeholder="Description (optional)"
        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/20 focus:border-white/20 focus:outline-none"
      />

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg border border-white/[0.1] bg-white/[0.06] py-2 text-xs font-medium text-white/80 transition hover:bg-white/[0.1] hover:text-white disabled:opacity-40"
      >
        {pending ? "Creating…" : "Create list"}
      </button>
    </form>
  );
}
