"use client";

import { useRef, useCallback } from "react";
import { useAudioPlayer } from "./audio-player-context";

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Persistent audio player — bottom bar.
 *
 * Design goals:
 * - Scrub bar is tall enough to click/tap accurately (h-2 track, large hit area)
 * - Draggable scrub — mousedown + mousemove, not just click
 * - Cover art visible
 * - Skip ±15s buttons for quick navigation
 * - Keyboard accessible (arrow keys on the scrub bar)
 */
export function PersistentAudioBar() {
  const { state, togglePlay, seek, setVolume } = useAudioPlayer();
  const { currentTrack, isPlaying, isLoading, currentTime, duration, volume } = state;
  const scrubRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // ── Scrub helpers ──────────────────────────────────────────────────────
  const seekFromEvent = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      if (!scrubRef.current || !duration) return;
      const rect = scrubRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      seek(ratio * duration);
    },
    [duration, seek],
  );

  function handleMouseDown(e: React.MouseEvent) {
    isDragging.current = true;
    seekFromEvent(e);

    const onMove = (ev: MouseEvent) => {
      if (isDragging.current) seekFromEvent(ev);
    };
    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // Touch support
  function handleTouchMove(e: React.TouchEvent) {
    if (!scrubRef.current || !duration) return;
    const touch = e.touches[0];
    const rect = scrubRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    seek(ratio * duration);
  }

  if (!currentTrack) return null;

  return (
    <div
      role="region"
      aria-label="Audio player"
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#111]/95 backdrop-blur-md"
      style={{ boxShadow: "0 -1px 0 rgba(255,255,255,0.06)" }}
    >
      {/* ── Scrub bar — full width, tall hit area ──────────────────────── */}
      <div
        ref={scrubRef}
        role="slider"
        aria-label="Seek"
        aria-valuenow={Math.round(currentTime)}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        tabIndex={0}
        className="group relative h-7 w-full cursor-pointer select-none"
        onMouseDown={handleMouseDown}
        onTouchMove={handleTouchMove}
        onTouchStart={(e) => handleTouchMove(e)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") seek(Math.min(currentTime + 5, duration));
          if (e.key === "ArrowLeft") seek(Math.max(currentTime - 5, 0));
        }}
      >
        {/* Track background */}
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-white/[0.08] group-hover:h-2 transition-all duration-100">
          {/* Buffered / played */}
          <div
            className="h-full rounded-full bg-violet-500 transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Scrub thumb — appears on hover/drag */}
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100"
          style={{ left: `${progress}%` }}
          aria-hidden
        />

        {/* Time tooltip overlay */}
        <div className="absolute inset-x-0 bottom-full mb-1 flex justify-between px-3 text-[10px] tabular-nums text-white/30 pointer-events-none">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* ── Controls row ──────────────────────────────────────────────── */}
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 pb-3 pt-1">
        {/* Cover art */}
        {currentTrack.artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentTrack.artworkUrl}
            alt="Cover"
            className="h-10 w-10 shrink-0 rounded object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-white/[0.06] text-base text-white/20">
            ♪
          </div>
        )}

        {/* Skip back 15s */}
        <button
          onClick={() => seek(Math.max(0, currentTime - 15))}
          aria-label="Back 15 seconds"
          className="hidden shrink-0 text-white/40 transition hover:text-white sm:block"
        >
          <SkipBackIcon />
        </button>

        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          disabled={isLoading}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/90 disabled:cursor-wait disabled:opacity-50"
        >
          {isLoading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
          ) : isPlaying ? (
            <PauseIcon />
          ) : (
            <PlayIcon />
          )}
        </button>

        {/* Skip forward 15s */}
        <button
          onClick={() => seek(Math.min(duration, currentTime + 15))}
          aria-label="Forward 15 seconds"
          className="hidden shrink-0 text-white/40 transition hover:text-white sm:block"
        >
          <SkipForwardIcon />
        </button>

        {/* Track info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white/90">
            {currentTrack.title}
            {currentTrack.mixVersion && (
              <span className="ml-2 text-xs font-normal text-white/35">
                {currentTrack.mixVersion}
              </span>
            )}
          </p>
          <p className="truncate text-xs text-white/35">{currentTrack.artistName}</p>
        </div>

        {/* Volume */}
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <button
            onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
            aria-label={volume === 0 ? "Unmute" : "Mute"}
            className="text-white/30 transition hover:text-white/70"
          >
            {volume === 0 ? <MuteIcon /> : <VolumeIcon />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="Volume"
            className="h-1 w-20 cursor-pointer accent-white"
          />
        </div>

        {/* Preview badge */}
        <span className="hidden shrink-0 rounded border border-white/[0.07] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-widest text-white/20 sm:block">
          Preview
        </span>
      </div>
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 translate-x-px" aria-hidden>
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

function SkipBackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
      <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
      <text x="7" y="14.5" fontSize="5.5" fontFamily="system-ui" fontWeight="bold" fill="currentColor">15</text>
    </svg>
  );
}

function SkipForwardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
      <path d="M12.01 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
      <text x="7" y="14.5" fontSize="5.5" fontFamily="system-ui" fontWeight="bold" fill="currentColor">15</text>
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
    </svg>
  );
}

function MuteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
    </svg>
  );
}
