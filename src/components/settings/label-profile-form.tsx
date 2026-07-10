"use client";

import { useActionState } from "react";
import { updateLabelProfileAction } from "@/lib/actions/profile";
import type { DjProfileFormState } from "@/lib/actions/profile";

export function LabelProfileForm({
  currentName,
  currentWebsite,
}: {
  currentName: string;
  currentWebsite: string;
}) {
  const [state, action, pending] = useActionState<DjProfileFormState, FormData>(
    updateLabelProfileAction,
    undefined,
  );

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1">
        <label className="block text-xs text-white/40">Label / Artist name</label>
        <input
          name="labelName"
          type="text"
          defaultValue={currentName}
          placeholder="IMPCORE Records"
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/20 focus:border-white/20 focus:outline-none"
        />
        {state?.errors?.labelName && (
          <p className="text-xs text-red-400">{state.errors.labelName[0]}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className="block text-xs text-white/40">Website (optional)</label>
        <input
          name="labelWebsite"
          type="url"
          defaultValue={currentWebsite}
          placeholder="https://yourlabel.com"
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/20 focus:border-white/20 focus:outline-none"
        />
      </div>

      {state?.success && (
        <p className="text-xs text-emerald-400">✓ Saved</p>
      )}
      {state?.message && (
        <p className="text-xs text-red-400">{state.message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-white/[0.1] bg-white/[0.06] px-4 py-2 text-xs font-medium text-white/80 transition hover:bg-white/[0.1] hover:text-white disabled:opacity-40"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
