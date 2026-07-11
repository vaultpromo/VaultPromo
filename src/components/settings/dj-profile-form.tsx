"use client";

import { useActionState, useState } from "react";
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
  const [selectedGenres, setSelectedGenres] = useState<string[]>(currentGenres);

  function toggleGenre(genre: string) {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
  }

  return (
    <form action={action} className="space-y-4">
      <p className="text-xs text-white/25">
        This information helps labels find you in the VaultPromo tastemaker network.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="djAlias" className="block text-xs text-white/40">
            DJ alias / Name
          </label>
          <input
            id="djAlias"
            name="djAlias"
            type="text"
            defaultValue={current.djAlias}
            placeholder="SPCMSK"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/20 focus:border-white/20 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="djType" className="block text-xs text-white/40">
            Type
          </label>
          <select
            id="djType"
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
          <label htmlFor="djCity" className="block text-xs text-white/40">
            City
          </label>
          <input
            id="djCity"
            name="djCity"
            type="text"
            defaultValue={current.djCity}
            placeholder="Barcelona"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/20 focus:border-white/20 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="djCountry" className="block text-xs text-white/40">
            Country (2-letter code)
          </label>
          <input
            id="djCountry"
            name="djCountry"
            type="text"
            defaultValue={current.djCountry}
            placeholder="ES"
            maxLength={2}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/20 focus:border-white/20 focus:outline-none"
          />
        </div>
      </div>

      {/* Genre checkboxes — controlled state, hidden input sends comma-separated value */}
      <div className="space-y-2">
        <p className="text-xs text-white/40">Genres (select all that apply)</p>
        {/* Hidden input that holds the final comma-separated value */}
        <input type="hidden" name="djGenres" value={selectedGenres.join(",")} />
        <div className="flex flex-wrap gap-2">
          {GENRE_OPTIONS.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => toggleGenre(genre)}
              className={`rounded-md border px-2.5 py-1 text-xs transition ${
                selectedGenres.includes(genre)
                  ? "border-white/20 bg-white/[0.07] text-white/80"
                  : "border-white/[0.07] bg-white/[0.02] text-white/40 hover:border-white/[0.14]"
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
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

// Genre selector is now inline in the form above
