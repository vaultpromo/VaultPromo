"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { transcodeAllAction } from "@/lib/actions/campaigns";

interface TranscodeAllButtonProps {
  campaignId: string;
  pendingCount: number;
}

/**
 * Transcode all button with automatic polling.
 *
 * Flow:
 * 1. Click → enqueue all pending tracks + invoke Lambda
 * 2. Poll /api/pipeline/poll every 10s to check R2 for completed previews
 * 3. When a track is ready, the poll updates the DB and the page reflects it
 * 4. Stop polling when all tracks are ready or after 10 minutes
 */
export function TranscodeAllButton({ campaignId, pendingCount }: TranscodeAllButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [queued, setQueued] = useState(0);
  const [readyCount, setReadyCount] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxPollAttempts = 60; // 10 minutes at 10s interval
  const pollAttempts = useRef(0);

  // Start polling after queuing
  function startPolling(totalQueued: number) {
    setIsPolling(true);
    pollAttempts.current = 0;

    pollRef.current = setInterval(async () => {
      pollAttempts.current++;

      try {
        const res = await fetch("/api/pipeline/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId }),
        });

        if (res.ok) {
          const data = await res.json() as { ready: number; readyIds: string[] };
          if (data.ready > 0) {
            setReadyCount((prev) => {
              const next = prev + data.ready;
              if (next >= totalQueued || pollAttempts.current >= maxPollAttempts) {
                stopPolling();
                // Reload the page to show updated track states
                window.location.reload();
              }
              return next;
            });
          }
        }
      } catch {
        // Poll failed — keep trying
      }

      if (pollAttempts.current >= maxPollAttempts) {
        stopPolling();
      }
    }, 10_000); // poll every 10 seconds
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setIsPolling(false);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, []);

  function handleClick() {
    startTransition(async () => {
      const res = await transcodeAllAction(campaignId);
      setQueued(res.queued);
      if (res.queued > 0) {
        startPolling(res.queued);
      }
    });
  }

  // Nothing to show if no pending tracks and not currently processing
  if (pendingCount === 0 && !isPolling && queued === 0) return null;

  if (isPolling || (queued > 0 && readyCount < queued)) {
    return (
      <div className="flex items-center gap-2 text-xs text-white/40">
        <span className="h-3 w-3 animate-spin rounded-full border border-amber-400 border-t-transparent" />
        <span className="text-amber-400">
          Transcoding… {readyCount}/{queued} ready
        </span>
        <span className="text-white/20">checking every 10s</span>
      </div>
    );
  }

  if (queued > 0 && readyCount >= queued) {
    return (
      <p className="text-xs text-emerald-400">
        ✓ All {queued} track{queued !== 1 ? "s" : ""} ready
      </p>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs font-medium text-amber-400 transition hover:border-amber-500/50 hover:bg-amber-500/10 disabled:opacity-50"
    >
      {isPending ? (
        <>
          <span className="h-3 w-3 animate-spin rounded-full border border-amber-400 border-t-transparent" />
          Queueing…
        </>
      ) : (
        <>⚡ Transcode all ({pendingCount})</>
      )}
    </button>
  );
}
