"use client";

import { useRef, useState } from "react";
import type { ImportResult } from "@/lib/actions/contacts";

interface ListOption {
  id: string;
  name: string;
}

interface QuickImportProps {
  lists: ListOption[];
}

type UploadState = "idle" | "uploading" | "done" | "error";

/**
 * Quick import — available directly from the contacts page.
 * Optionally assigns imported contacts to a list.
 */
export function QuickImport({ lists }: QuickImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [selectedList, setSelectedList] = useState<string>("");
  const [state, setState] = useState<UploadState>("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) return;
    setState("uploading");
    setResult(null);
    setErrorMsg("");

    const formData = new FormData();
    formData.append("file", file);
    if (selectedList) formData.append("listId", selectedList);

    try {
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? "Import failed.");
        setState("error");
        return;
      }

      setResult(data as ImportResult);
      setState("done");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      setErrorMsg("Network error. Please try again.");
      setState("error");
    }
  }

  return (
    <div className="space-y-3">
      {/* File picker */}
      <div className="flex items-center gap-2">
        <label className="flex-1 cursor-pointer rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/40 transition hover:border-white/[0.14] hover:text-white/60">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="sr-only"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setState("idle");
              setResult(null);
            }}
          />
          {file ? (
            <span className="text-white/70">{file.name}</span>
          ) : (
            "Choose CSV or XLSX…"
          )}
        </label>
      </div>

      {/* Optional list assignment */}
      {lists.length > 0 && (
        <select
          value={selectedList}
          onChange={(e) => setSelectedList(e.target.value)}
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/50 focus:border-white/20 focus:outline-none"
        >
          <option value="">Add to list (optional)</option>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      )}

      {/* Import button */}
      {file && (
        <button
          onClick={handleUpload}
          disabled={state === "uploading"}
          className="w-full rounded-lg border border-white/[0.1] bg-white/[0.06] py-2 text-xs font-medium text-white/80 transition hover:bg-white/[0.1] hover:text-white disabled:opacity-40"
        >
          {state === "uploading" ? "Importing…" : "Import contacts"}
        </button>
      )}

      {/* Result */}
      {state === "done" && result && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-xs">
          <p className="font-medium text-emerald-400">Import complete</p>
          <div className="mt-1.5 space-y-0.5 text-white/40">
            <p>Imported: <span className="text-white/70">{result.imported}</span></p>
            {result.skipped > 0 && (
              <p>Already existed: <span className="text-white/70">{result.skipped}</span></p>
            )}
            {result.errors > 0 && (
              <p>Invalid rows: <span className="text-red-400/70">{result.errors}</span></p>
            )}
          </div>
        </div>
      )}

      {state === "error" && (
        <p className="text-xs text-red-400">{errorMsg}</p>
      )}
    </div>
  );
}
