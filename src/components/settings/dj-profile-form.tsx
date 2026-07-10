"use client";

import { useActionState } from "react";
import { updateDjProfileAction } from "@/lib/actions/profile";
import type { DjProfileFormState } from "@/lib/actions/profile";

const GENRE_OPTIONS = [
  "Techno", "House", "Minimal", "Industrial", "Ambient", "Drone",
  "EBM", "Dark Electro", "Noise", "Experimental", "Breakbeat",
  "Jungle / DnB", "Hardcore", "HipHop", "Electronic", "Other",
];

const DJ_TYPES = [
  { value: "dj", label: "DJ" },
  { value: "radio", label: "Radio host" },
  { value: "press", label: "Music press / blogger" },
  { value: "producer", label: "Producer" },
  { value: "other", label: "Other" },
];

export function DjProfileForm({
  current,
}: {
  current: {
    djAlias: string;
    djGenres: string;
    djCity: string;
    djCountry: string;
    djType: string;
  };
}) {
  const [state, action, pending] = useActionState<DjProfileFormState, FormData>(
    updateDjProfileAction,
    undefined,
  );

  const currentGenres = current.djGenres.split(",").map((g) => g.trim()).filter(Boolean);

  return (
    <form action={action} className="space-y-4">
      <p className="text-xs text-white/25">
        This information helps labels find you in the PromoVault tastemaker network.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs text-white/40">DJ alias / Name</label>
          <input
            name="djAlias"
            type="text"
            defaultValue={current.djAlias}
            placeholder="SPCMSK"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/20 focus:border-white/20 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs text-white/40">Type</label>
          <select
            name="djType"
            defaultValue={current.djType}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none"
          >
            <option value="">Select type</option>
            {DJ_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs text-white/40">City</label>
          <input
            name="djCity"
            type="text"
            defaultValue={current.djCity}
            placeholder="Barcelona"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/20 focus:border-white/20 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs text-white/40">Country (2-letter code)</label>
          <input
            name="djCountry"
            type="text"
            defaultValue={current.djCountry}
            placeholder="ES"
            maxLength={2}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/20 focus:border-white/20 focus:outline-none"
          />
        </div>
      </div>

      {/* Genre multi-select as checkboxes */}
      <div className="space-y-2">
        <label className="block text-xs text-white/40">Genres (select all that apply)</label>
        {/* Hidden field to send genres as comma-separated string */}
        <GenreSelector genres={GENRE_OPTIONS} defaultSelected={currentGenres} />
      </div>

      {state?.success && <p className="text-xs text-emerald-400">✓ Saved</p>}
      {state?.message && <p className="text-xs text-red-400">{state.message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-white/[0.1] bg-white/[0.06] px-4 py-2 text-xs font-medium text-white/80 transition hover:bg-white/[0.1] hover:text-white disabled:opacity-40"
      >
        {pending ? "Saving…" : "Save DJ profile"}
      </button>
    </form>
  );
}

function GenreSelector({
  genres,
  defaultSelected,
}: {
  genres: string[];
  defaultSelected: string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {genres.map((genre) => (
        <label
          key={genre}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-xs text-white/50 transition has-[:checked]:border-white/20 has-[:checked]:bg-white/[0.07] has-[:checked]:text-white/80"
        >
          <input
            type="checkbox"
            name="djGenres"
            value={genre}
            defaultChecked={defaultSelected.includes(genre)}
            className="sr-only"
          />
          {genre}
        </label>
      ))}
      {/* Convert checkboxes to comma-separated string via JS on submit */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.querySelectorAll('form').forEach(form => {
              form.addEventListener('submit', function() {
                const checked = [...this.querySelectorAll('input[name="djGenres"]:checked')].map(i => i.value);
                const hidden = this.querySelector('input[type="hidden"][name="djGenres"]') || document.createElement('input');
                hidden.type = 'hidden';
                hidden.name = 'djGenres';
                hidden.value = checked.join(',');
                this.appendChild(hidden);
                this.querySelectorAll('input[name="djGenres"]:not([type="hidden"])').forEach(i => i.disabled = true);
              });
            });
          `,
        }}
      />
    </div>
  );
}
