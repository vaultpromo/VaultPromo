"use client";

import { useTransition } from "react";
import { deleteTrackAction } from "@/lib/actions/campaigns";
import type { InferSelectModel } from "drizzle-orm";
import type { tracks } from "@/db/schema";

type Track = InferSelectModel<typeof tracks>;

const STATUS_STYLES: Record<string, string> = {
  pending: "text-zinc-500",
  processing: "text-yellow-400",
  ready: "text-green-400",
  failed: "text-red-400",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending upload",
  processing: "Transcoding…",
  ready: "Ready",
  failed: "Failed",
};

interface TrackListProps {
  tracks: Track[];
  campaignId: string;
}

export function TrackList({ tracks: trackList, campaignId }: TrackListProps) {
  if (trackList.length === 0) {
    return (
      <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-500">
        No tracks yet. Add your first track below.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {trackList.map((track) => (
        <TrackRow key={track.id} track={track} campaignId={campaignId} />
      ))}
    </ol>
  );
}

function TrackRow({ track, campaignId }: { track: Track; campaignId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Delete "${track.title}"?`)) return;
    startTransition(() => {
      deleteTrackAction(track.id, campaignId);
    });
  }

  return (
    <li className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
      {/* Position */}
      <span className="w-6 shrink-0 text-center text-sm text-zinc-500">{track.position}</span>

      {/* Track info */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-white">
          {track.title}
          {track.mixVersion && (
            <span className="ml-2 text-sm text-zinc-400">{track.mixVersion}</span>
          )}
        </p>
        <p className="truncate text-sm text-zinc-400">
          {track.artistName}
          {track.bpm ? ` · ${track.bpm} BPM` : ""}
          {track.musicalKey ? ` · ${track.musicalKey}` : ""}
        </p>
      </div>

      {/* Processing status */}
      <span className={`shrink-0 text-xs font-medium ${STATUS_STYLES[track.processingStatus] ?? STATUS_STYLES.pending}`}>
        {STATUS_LABELS[track.processingStatus] ?? track.processingStatus}
      </span>

      {/* Delete */}
      <button
        onClick={handleDelete}
        disabled={isPending}
        aria-label={`Delete ${track.title}`}
        className="shrink-0 rounded p-1 text-zinc-600 transition hover:text-red-400 disabled:opacity-40"
      >
        ✕
      </button>
    </li>
  );
}
