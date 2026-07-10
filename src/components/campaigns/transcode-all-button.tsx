"use client";

import { useState, useTransition } from "react";
import { transcodeAllAction } from "@/lib/actions/campaigns";

interface TranscodeAllButtonProps {
  campaignId: string;
  pendingCount: number;
}

/**
 * One-click button to enqueue and invoke Lambda for all pending tracks.
 * Shows only when there are tracks with audio uploaded but not yet transcoded.
 */
export function TranscodeAllButton({ campaignId, pendingCount }: TranscodeAllButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ queued: number } | null>(null);

  if (pendingCount === 0) return null;

  function handleClick() {
    startTransition(async () => {
      const res = await transcodeAllAction(campaignId);
      setResult(res);
    });
  }

  return (
    <div className="flex items-center gap-3">
      {result ? (
        <p className="text-xs text-emerald-400">
          ✓ {result.queued} track{result.queued !== 1 ? "s" : ""} queued — transcoding in background
        </p>
      ) : (
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
            <>
              ⚡ Transcode all ({pendingCount})
            </>
          )}
        </button>
      )}
    </div>
  );
}
