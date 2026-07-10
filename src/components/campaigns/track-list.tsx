"use client";

import { useRef, useState, useTransition } from "react";
import { deleteTrackAction, confirmTrackUploadAction } from "@/lib/actions/campaigns";
import type { InferSelectModel } from "drizzle-orm";
import type { tracks } from "@/db/schema";

type Track = InferSelectModel<typeof tracks>;
type UploadState = "idle" | "uploading" | "done" | "error";

interface TrackListProps {
  tracks: Track[];
  campaignId: string;
}

export function TrackList({ tracks: trackList, campaignId }: TrackListProps) {
  if (trackList.length === 0) {
    return (
      <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-sm text-white/30">
        No tracks yet. Add your first track below.
      </p>
    );
  }

  return (
    <ol className="divide-y divide-white/[0.04] overflow-hidden rounded-xl border border-white/[0.06]">
      {trackList.map((track) => (
        <TrackRow key={track.id} track={track} campaignId={campaignId} />
      ))}
    </ol>
  );
}

function TrackRow({ track, campaignId }: { track: Track; campaignId: string }) {
  const [isDeletePending, startDelete] = useTransition();
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleDelete() {
    if (!confirm(`Delete "${track.title}"?`)) return;
    startDelete(() => {
      deleteTrackAction(track.id, campaignId);
    });
  }

  async function handleUpload(file: File) {
    setUploadState("uploading");
    setProgress(0);

    try {
      // 1. Get presigned PUT URL
      const res = await fetch("/api/storage/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "track",
          campaignId,
          trackId: track.id,
          contentType: file.type || "audio/wav",
          fileSizeBytes: file.size,
        }),
      });

      if (!res.ok) throw new Error("Failed to get upload URL");
      const { url, key } = (await res.json()) as { url: string; key: string };

      // 2. Upload directly to R2
      await uploadToR2(url, file, setProgress);

      // 3. Confirm upload to DB
      await confirmTrackUploadAction({
        trackId: track.id,
        campaignId,
        originalKey: key,
        fileSizeBytes: String(file.size),
      });

      setUploadState("done");
      setExpanded(false);
    } catch {
      setUploadState("error");
    }
  }

  const canUpload = track.processingStatus === "pending" || track.processingStatus === "failed";
  const hasAudio = track.processingStatus === "processing" || track.processingStatus === "ready";

  return (
    <li className={`bg-white/[0.015] transition ${isDeletePending ? "opacity-40" : ""}`}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Position */}
        <span className="w-5 shrink-0 text-center text-xs text-white/25">{track.position}</span>

        {/* Track info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white/90">
            {track.title}
            {track.mixVersion && (
              <span className="ml-2 text-xs font-normal text-white/35">{track.mixVersion}</span>
            )}
          </p>
          <p className="truncate text-xs text-white/35">
            {track.artistName}
            {track.bpm ? ` · ${track.bpm} BPM` : ""}
            {track.musicalKey ? ` · ${track.musicalKey}` : ""}
          </p>
        </div>

        {/* Status + upload button */}
        <div className="flex shrink-0 items-center gap-2">
          <StatusChip status={track.processingStatus} />

          {/* Upload / Replace button — always visible for pending/failed, replace for done */}
          {canUpload && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="rounded-md border border-white/[0.1] bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-white/60 transition hover:border-white/20 hover:text-white/90"
            >
              Upload WAV
            </button>
          )}

          {hasAudio && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="rounded-md border border-white/[0.06] px-2.5 py-1 text-[11px] text-white/25 transition hover:text-white/50"
            >
              Replace
            </button>
          )}

          {/* Delete */}
          <button
            onClick={handleDelete}
            disabled={isDeletePending}
            aria-label={`Delete ${track.title}`}
            className="text-white/20 transition hover:text-red-400 disabled:opacity-40"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Expanded upload area */}
      {expanded && (
        <div className="border-t border-white/[0.04] bg-white/[0.02] px-4 py-3">
          {uploadState === "idle" && (
            <div className="flex items-center gap-3">
              <label className="flex-1 cursor-pointer rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/40 transition hover:border-white/[0.14] hover:text-white/60">
                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/wav,audio/x-wav,audio/wave,audio/aiff,audio/x-aiff,audio/flac"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                  }}
                />
                Choose WAV / AIFF / FLAC…
              </label>
              <button
                onClick={() => setExpanded(false)}
                className="text-xs text-white/25 hover:text-white/60"
              >
                Cancel
              </button>
            </div>
          )}

          {uploadState === "uploading" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-white/40">
                <span>Uploading to R2…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-violet-500 transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {uploadState === "done" && (
            <p className="text-xs text-emerald-400">
              ✓ Uploaded — transcoding to preview MP3 in background
            </p>
          )}

          {uploadState === "error" && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-red-400">Upload failed. Try again.</p>
              <button
                onClick={() => setUploadState("idle")}
                className="text-xs text-white/30 hover:text-white/60"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:    { label: "Pending upload", cls: "text-white/25" },
    processing: { label: "Transcoding…",  cls: "text-amber-400" },
    ready:      { label: "Ready",          cls: "text-emerald-400" },
    failed:     { label: "Failed",         cls: "text-red-400" },
  };
  const { label, cls } = map[status] ?? map.pending;
  return <span className={`text-xs ${cls}`}>{label}</span>;
}

function uploadToR2(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Status ${xhr.status}`));
    });
    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "audio/wav");
    xhr.send(file);
  });
}
