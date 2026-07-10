"use client";

import { useActionState } from "react";
import { createCampaignAction } from "@/lib/actions/campaigns";
import type { CampaignFormState } from "@/lib/validations/campaign";

/** Create-campaign form. On success the Server Action redirects automatically. */
export function CampaignForm() {
  const [state, action, pending] = useActionState<CampaignFormState, FormData>(
    createCampaignAction,
    undefined,
  );

  return (
    <form action={action} className="space-y-5">
      {state?.message && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {state.message}
        </p>
      )}

      <Field
        id="title"
        label="Campaign title *"
        placeholder="Void Sequence VA001"
        error={state?.errors?.title?.[0]}
      />
      <Field
        id="artistName"
        label="Artist / Various Artists *"
        placeholder="Various Artists"
        error={state?.errors?.artistName?.[0]}
      />
      <Field
        id="catalogNumber"
        label="Catalog number"
        placeholder="IMP001"
        required={false}
        error={state?.errors?.catalogNumber?.[0]}
      />

      <div className="grid grid-cols-2 gap-4">
        <DateField
          id="releaseDate"
          label="Release date"
          error={state?.errors?.releaseDate?.[0]}
        />
        <DateField
          id="expiryDate"
          label="Promo expires"
          error={state?.errors?.expiryDate?.[0]}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="description" className="block text-sm font-medium text-zinc-300">
          Press release / notes
        </label>
        <textarea
          id="description"
          name="description"
          rows={5}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          placeholder="Describe the release, provide context for the DJs…"
        />
        {state?.errors?.description && (
          <p className="text-xs text-red-400">{state.errors.description[0]}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create campaign"}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  placeholder,
  required = true,
  error,
}: {
  id: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-zinc-300">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="text"
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function DateField({ id, label, error }: { id: string; label: string; error?: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-zinc-300">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="date"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
