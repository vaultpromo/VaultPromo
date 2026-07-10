"use client";

import { useState } from "react";
import { useAudioPlayer } from "./audio-player-context";
import { FeedbackForm } from "./feedback-form";
import type { PlayerTrack } from "./audio-player-context";

export interface PromoTrack {
  id: string;
  title: string;
  artistName: string;
  mixVersion: string | null;
  bpm: number | null;
  musicalKey: string | null;
  position: number;
  previewKey: string;
}

interface TokenGateProps {
  campaignId: string;
  distributionId: string;
  tracks: PromoTrack[];
  initialFeedbackSubmitted: boolean;
  initialHasDownloaded: boolean;
}

/**
 * TokenGate — the interactive core of the promo page.
 *
 * Renders:
 * 1. Track list with play buttons (connected to AudioPlayerContext)
 * 2. Feedback Gate:
 *    - If feedback not submitted → show the FeedbackForm
 *    - If feedback submitted → show the "downloads unlocked" section (Task 11 wires downloads)
 */
export function TokenGate({
  campaignId,
  distributionId,
  tracks,
  initialFeedbackSubmitted,
}: TokenGateProps) {
  const { state: playerState, playTrack } = useAudioPlayer();
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(initialFeedbackSubmitted);

  if (tracks.length === 0) return null;

  function handlePlay(track: PromoTrack) {
    const playerTrack: PlayerTrack = {
      id: track.id,
      title: track.title,
      artistName: track.artistName,
      mixVersion: track.mixVersion,
      campaignId,
      streamUrl: null,
    };
    playTrack(playerTrack);
  }

  const activeTrackId = playerState.currentTrack?.id;
  const isPlaying = playerState.isPlaying;

  return (
    <div className="space-y-8 pb-28">
      {/* ── Track list ──────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-white">
          Tracks
          <span className="ml-2 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
            {tracks.length}
          </span>
        </h2>

        <ol className="space-y-2">
          {tracks.map((track) => {
            const isActive = activeTrackId === track.id;
            const showPause = isActive && isPlaying;

            return (
              <li
                key={track.id}
                className={`flex items-center gap-4 rounded-xl border px-4 py-3 transition ${
                  isActive
                    ? "border-violet-600/60 bg-violet-900/10"
                    : "border-zinc-800 bg-zinc-900"
                }`}
              >
                <span className="w-6 shrink-0 text-center text-sm text-zinc-500">
                  {track.position}
                </span>

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

                {/* Play/Pause button */}
                <button
                  onClick={() => handlePlay(track)}
                  aria-label={showPause ? `Pause ${track.title}` : `Play ${track.title}`}
                  className={`shrink-0 rounded-full p-2 transition ${
                    isActive
                      ? "bg-violet-600 text-white hover:bg-violet-500"
                      : "bg-zinc-800 text-zinc-300 hover:bg-violet-600 hover:text-white"
                  }`}
                >
                  {showPause ? <PauseIcon /> : <PlayIcon />}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* ── Feedback Gate ───────────────────────────────────────────────── */}
      {feedbackSubmitted ? (
        <div className="rounded-xl border border-green-700/40 bg-green-900/10 px-5 py-5">
          <p className="text-base font-semibold text-green-400">
            Feedback submitted — thank you!
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Your download links are now active below.
          </p>
          <DownloadSection tracks={tracks} campaignId={campaignId} />
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-5">
          <h2 className="mb-1 text-base font-semibold text-white">
            Leave feedback to unlock downloads
          </h2>
          <p className="mb-5 text-sm text-zinc-400">
            You can stream the previews above freely. Complete the form below to download
            the full-quality files.
          </p>
          <FeedbackForm
            campaignId={campaignId}
            distributionId={distributionId}
            tracks={tracks}
            onSubmitted={() => setFeedbackSubmitted(true)}
          />
        </div>
      )}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

// ── Download section (shown after feedback) ──────────────────────────────────

function DownloadSection({
  tracks,
  campaignId,
}: {
  tracks: PromoTrack[];
  campaignId: string;
}) {
  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
        Download high-quality files
      </p>
      {tracks.map((track) => (
        <DownloadButton key={track.id} track={track} campaignId={campaignId} />
      ))}
    </div>
  );
}

function DownloadButton({
  track,
  campaignId,
}: {
  track: PromoTrack;
  campaignId: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function handleDownload() {
    setState("loading");
    try {
      const res = await fetch(
        `/api/promo/download/${track.id}?campaignId=${campaignId}`,
      );
      if (!res.ok) throw new Error("Download failed");
      const { url, filename } = (await res.json()) as {
        url: string;
        filename: string;
      };

      // Trigger browser download
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ?? `${track.title}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setState("idle");
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={state === "loading"}
      className="flex w-full items-center justify-between rounded-lg border border-green-700/40 bg-zinc-900 px-4 py-2.5 text-sm transition hover:border-green-600/60 hover:bg-zinc-800 disabled:opacity-60"
    >
      <span className="truncate font-medium text-zinc-200">
        {track.title}
        {track.mixVersion && (
          <span className="ml-2 text-xs text-zinc-500">{track.mixVersion}</span>
        )}
      </span>
      <span className="ml-3 shrink-0 text-xs text-green-400">
        {state === "loading"
          ? "Preparing…"
          : state === "error"
            ? "Error — retry"
            : "↓ WAV"}
      </span>
    </button>
  );
}
