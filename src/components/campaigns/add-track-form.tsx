"use client";

import { useActionState, useRef } from "react";
import { addTrackAction } from "@/lib/actions/campaigns";
import type { TrackFormState } from "@/lib/validations/campaign";

interface AddTrackFormProps {
  campaignId: string;
  nextPosition: number;
}

/**
 * Saves track metadata only.
 * Audio upload is handled per-row in TrackList once the track exists in the DB.
 */
export function AddTrackForm({ campaignId, nextPosition }: AddTrackFormProps) {
  const [state, action, pending] = useActionState<TrackFormState, FormData>(
    addTrackAction.bind(null, campaignId),
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Auto-reset form after successful save (trackId returned, no errors)
  const justSaved = state?.trackId && !state?.errors;

  return (
    <div className="space-y-4">
      {justSaved && (
        <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400">
          ✓ Track saved — use the <strong>Upload WAV</strong> button in the list above to add the audio.
        </p>
      )}

      <form ref={formRef} action={action} className="space-y-4">
        <input type="hidden" name="position" value={nextPosition} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="title" label="Track title *" placeholder="Sector Zero" error={state?.errors?.title?.[0]} />
          <Field id="artistName" label="Artist *" placeholder="SPCMSK" error={state?.errors?.artistName?.[0]} />
          <Field id="mixVersion" label="Mix / version" placeholder="Original Mix" required={false} />
          <Field id="isrc" label="ISRC" placeholder="GBUM71234567" required={false} error={state?.errors?.isrc?.[0]} />
          <Field id="bpm" label="BPM" type="number" placeholder="148" required={false} />
          <Field id="musicalKey" label="Key" placeholder="Am" required={false} />
        </div>

        {state?.message && (
          <p role="alert" className="text-xs text-red-400">{state.message}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-white/[0.1] bg-white/[0.06] px-4 py-2 text-xs font-medium text-white/80 transition hover:bg-white/[0.1] hover:text-white disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save track"}
        </button>
      </form>
    </div>
  );
}

function Field({
  id,
  label,
  placeholder,
  type = "text",
  required = true,
  error,
}: {
  id: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs text-white/40">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/20 focus:border-white/20 focus:outline-none"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
