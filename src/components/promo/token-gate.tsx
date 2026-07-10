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
  artworkUrl?: string | null;
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
  artworkUrl,
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
      artworkUrl: artworkUrl ?? null,
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
    <div className="mt-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/30">
          High-quality files
        </p>
        {tracks.length > 1 && (
          <DownloadAllButton tracks={tracks} campaignId={campaignId} />
        )}
      </div>
      <div className="space-y-1.5">
        {tracks.map((track) => (
          <DownloadButton key={track.id} track={track} campaignId={campaignId} />
        ))}
      </div>
    </div>
  );
}

function DownloadAllButton({
  tracks,
  campaignId,
}: {
  tracks: PromoTrack[];
  campaignId: string;
}) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownloadAll() {
    setDownloading(true);
    // Stagger downloads so the browser doesn't block them
    for (const track of tracks) {
      const url = `/api/promo/download/${track.id}?campaignId=${campaignId}`;
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Small delay between triggers
      await new Promise((r) => setTimeout(r, 600));
    }
    setDownloading(false);
  }

  return (
    <button
      onClick={handleDownloadAll}
      disabled={downloading}
      className="text-xs text-white/40 underline-offset-2 transition hover:text-white/70 hover:underline disabled:opacity-40"
    >
      {downloading ? "Downloading…" : "Download all"}
    </button>
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

  function handleDownload() {
    setState("loading");
    // Direct link to the streaming endpoint — browser downloads without navigating
    const url = `/api/promo/download/${track.id}?campaignId=${campaignId}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = ""; // filename comes from Content-Disposition header
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Reset after a moment (can't truly detect completion from the client)
    setTimeout(() => setState("idle"), 3000);
  }

  return (
    <button
      onClick={handleDownload}
      disabled={state === "loading"}
      className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm transition hover:border-white/[0.12] hover:bg-white/[0.04] disabled:opacity-50"
    >
      <span className="truncate text-left text-white/80">
        {track.title}
        {track.mixVersion && (
          <span className="ml-2 text-xs text-white/30">{track.mixVersion}</span>
        )}
        <span className="ml-2 text-xs text-white/20">{track.artistName}</span>
      </span>
      <span className="ml-3 shrink-0 text-xs text-emerald-400/80">
        {state === "loading" ? "Starting…" : "↓ WAV"}
      </span>
    </button>
  );
}
