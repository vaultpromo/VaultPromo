"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import { addTrackAction, confirmTrackUploadAction } from "@/lib/actions/campaigns";
import type { TrackFormState } from "@/lib/validations/campaign";

interface AddTrackFormProps {
  campaignId: string;
  nextPosition: number;
}

type UploadState = "idle" | "uploading" | "done" | "error";

/**
 * Two-step form:
 * 1. Submit track metadata → Server Action creates the DB row, returns trackId.
 * 2. If a WAV file is selected, fetch a presigned PUT URL and upload directly
 *    to R2, then call confirmTrackUploadAction to set processing status.
 */
export function AddTrackForm({ campaignId, nextPosition }: AddTrackFormProps) {
  const [state, action, pending] = useActionState<TrackFormState, FormData>(
    addTrackAction.bind(null, campaignId),
    undefined,
  );

  const [wavFile, setWavFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  // After metadata is saved (state.trackId is populated), upload the WAV
  const trackId = state?.trackId;

  const uploadWav = useCallback(async () => {
    if (!wavFile || !trackId) return;
    setUploadState("uploading");
    setUploadProgress(0);

    try {
      // 1. Get presigned PUT URL from our API
      const res = await fetch("/api/storage/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "track",
          campaignId,
          trackId,
          contentType: wavFile.type || "audio/wav",
          fileSizeBytes: wavFile.size,
        }),
      });

      if (!res.ok) throw new Error("Failed to get upload URL");
      const { url, key } = (await res.json()) as { url: string; key: string };

      // 2. Upload directly to R2 via XHR (for progress events)
      await uploadToR2(url, wavFile, (pct) => setUploadProgress(pct));

      // 3. Confirm to the server: record the key and set status=processing
      await confirmTrackUploadAction({
        trackId,
        campaignId,
        originalKey: key,
        fileSizeBytes: String(wavFile.size),
      });

      setUploadState("done");
      formRef.current?.reset();
      setWavFile(null);
    } catch {
      setUploadState("error");
    }
  }, [wavFile, trackId, campaignId]);

  return (
    <div className="space-y-4">
      <form ref={formRef} action={action} className="space-y-4">
        {/* Hidden fields */}
        <input type="hidden" name="position" value={nextPosition} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="title" label="Track title *" placeholder="Sector Zero" error={state?.errors?.title?.[0]} />
          <Field id="artistName" label="Artist *" placeholder="SPCMSK" error={state?.errors?.artistName?.[0]} />
          <Field id="mixVersion" label="Mix / version" placeholder="Original Mix" required={false} error={state?.errors?.mixVersion?.[0]} />
          <Field id="isrc" label="ISRC" placeholder="GBUM71234567" required={false} error={state?.errors?.isrc?.[0]} />
          <Field id="bpm" label="BPM" type="number" placeholder="148" required={false} error={state?.errors?.bpm?.[0]} />
          <Field id="musicalKey" label="Key" placeholder="Am" required={false} error={state?.errors?.musicalKey?.[0]} />
        </div>

        {/* WAV file selector */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-zinc-300">
            WAV / master file
          </label>
          <input
            type="file"
            accept="audio/wav,audio/x-wav,audio/wave,audio/aiff,audio/x-aiff,audio/flac"
            onChange={(e) => setWavFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-violet-500"
          />
          {wavFile && (
            <p className="text-xs text-zinc-500">
              {wavFile.name} · {(wavFile.size / 1024 / 1024).toFixed(1)} MB
            </p>
          )}
        </div>

        {state?.message && (
          <p role="alert" className="text-sm text-red-400">{state.message}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save track"}
        </button>
      </form>

      {/* Upload WAV step — shown after metadata is saved */}
      {trackId && wavFile && uploadState === "idle" && (
        <div className="rounded-lg border border-violet-700/50 bg-violet-900/10 px-4 py-3">
          <p className="mb-2 text-sm text-violet-300">
            Track saved. Upload the WAV to R2?
          </p>
          <button
            onClick={uploadWav}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
          >
            Upload WAV
          </button>
        </div>
      )}

      {uploadState === "uploading" && (
        <div className="space-y-1">
          <p className="text-sm text-zinc-400">Uploading… {uploadProgress}%</p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-violet-500 transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {uploadState === "done" && (
        <p className="text-sm text-green-400">
          WAV uploaded. Processing pipeline will generate the preview shortly.
        </p>
      )}

      {uploadState === "error" && (
        <p className="text-sm text-red-400">Upload failed. Please try again.</p>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  placeholder,
  type = "text",
  required = true,
  error,
}: {
  id: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-zinc-300">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

/** XHR-based upload with progress tracking */
function uploadToR2(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`R2 upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));

    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "audio/wav");
    xhr.send(file);
  });
}
