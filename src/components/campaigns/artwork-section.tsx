"use client";

import { useTransition } from "react";
import { ArtworkUploader } from "./artwork-uploader";
import { saveArtworkKeyAction } from "@/lib/actions/campaigns";

interface ArtworkSectionProps {
  campaignId: string;
  artworkKey: string | null;
  artworkPresignedUrl: string | null; // generated server-side for preview
}

/**
 * Client wrapper that handles:
 * 1. Rendering the ArtworkUploader
 * 2. Calling saveArtworkKeyAction after a successful R2 upload
 */
export function ArtworkSection({
  campaignId,
  artworkKey,
  artworkPresignedUrl,
}: ArtworkSectionProps) {
  const [isPending, startTransition] = useTransition();

  function handleUploaded(key: string) {
    startTransition(async () => {
      await saveArtworkKeyAction(campaignId, key);
    });
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5">
      <ArtworkUploader
        campaignId={campaignId}
        currentArtworkUrl={artworkPresignedUrl}
        onUploaded={handleUploaded}
      />
      {isPending && (
        <p className="mt-2 text-xs text-white/30">Saving…</p>
      )}
    </div>
  );
}
