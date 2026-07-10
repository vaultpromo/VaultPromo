"use client";

import { useRef, useState } from "react";

interface ArtworkUploaderProps {
  campaignId: string;
  currentArtworkUrl?: string | null; // presigned URL for display, if already set
  onUploaded: (key: string) => void;
}

type UploadState = "idle" | "validating" | "uploading" | "done" | "error";

const MIN_DIMENSION = 1400;
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Artwork uploader for campaigns.
 *
 * Validation before upload:
 * - Square format required (width === height)
 * - Minimum 1400×1400 px
 * - Max 10 MB
 * - JPEG, PNG, or WebP only
 *
 * Uploads directly to R2 via presigned URL (same pattern as WAV upload).
 * Calls onUploaded(key) when done so the parent can save the key to the DB.
 */
export function ArtworkUploader({ campaignId, currentArtworkUrl, onUploaded }: ArtworkUploaderProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [preview, setPreview] = useState<string | null>(currentArtworkUrl ?? null);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setState("validating");
    setErrorMsg("");

    // Type check
    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrorMsg("Only JPEG, PNG or WebP images are accepted.");
      setState("error");
      return;
    }

    // Size check
    if (file.size > MAX_SIZE_BYTES) {
      setErrorMsg("Image must be under 10 MB.");
      setState("error");
      return;
    }

    // Dimension + square check (reads the image in the browser)
    const dimensions = await getImageDimensions(file);
    if (!dimensions) {
      setErrorMsg("Could not read image dimensions.");
      setState("error");
      return;
    }

    if (dimensions.width !== dimensions.height) {
      setErrorMsg(`Image must be square. Got ${dimensions.width}×${dimensions.height}px.`);
      setState("error");
      return;
    }

    if (dimensions.width < MIN_DIMENSION) {
      setErrorMsg(
        `Minimum size is ${MIN_DIMENSION}×${MIN_DIMENSION}px. Got ${dimensions.width}×${dimensions.height}px.`,
      );
      setState("error");
      return;
    }

    // Generate a local preview
    setPreview(URL.createObjectURL(file));
    setState("uploading");
    setProgress(0);

    try {
      // 1. Get presigned PUT URL
      const res = await fetch("/api/storage/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "artwork",
          campaignId,
          contentType: file.type,
          fileSizeBytes: file.size,
        }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to get upload URL");
      }

      const { url, key } = (await res.json()) as { url: string; key: string };

      // 2. Upload directly to R2 with progress
      await uploadToR2(url, file, setProgress, file.type);

      setState("done");
      onUploaded(key);
    } catch (err) {
      setErrorMsg((err as Error).message ?? "Upload failed. Please try again.");
      setState("error");
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-white/40">
        Cover artwork
        <span className="ml-2 text-white/20">Min. 1400×1400 px · Square · JPEG/PNG/WebP</span>
      </label>

      <div className="flex items-start gap-4">
        {/* Preview square */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.03] transition hover:border-white/[0.16]"
          aria-label="Upload cover artwork"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Cover artwork"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-white/20">
              <span className="text-2xl">🖼</span>
              <span className="text-[10px]">Click to add</span>
            </div>
          )}

          {/* Progress overlay */}
          {state === "uploading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60">
              <span className="text-xs font-medium text-white">{progress}%</span>
              <div className="h-1 w-14 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Done checkmark */}
          {state === "done" && (
            <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white">
              ✓
            </div>
          )}
        </button>

        {/* Drag/drop area */}
        <label
          className="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-5 text-center transition hover:border-white/[0.16] hover:bg-white/[0.04]"
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          onDragOver={(e) => e.preventDefault()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <span className="text-sm text-white/40">
            {state === "validating"
              ? "Checking dimensions…"
              : state === "uploading"
                ? "Uploading…"
                : state === "done"
                  ? "✓ Artwork saved"
                  : preview
                    ? "Click or drop to replace"
                    : "Drop image here or click to browse"}
          </span>
          {state === "idle" && !preview && (
            <span className="mt-1 text-xs text-white/20">
              Square · min 1400×1400 px · max 10 MB
            </span>
          )}
        </label>
      </div>

      {/* Error */}
      {state === "error" && errorMsg && (
        <p className="text-xs text-red-400">{errorMsg}</p>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function uploadToR2(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
  contentType: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed: ${xhr.status}`));
    });
    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.send(file);
  });
}
