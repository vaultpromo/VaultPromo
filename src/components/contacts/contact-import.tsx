"use client";

import { useRef, useState } from "react";
import type { ImportResult } from "@/lib/actions/contacts";

interface ContactImportProps {
  listId?: string;
}

type UploadState = "idle" | "uploading" | "done" | "error";

export function ContactImport({ listId }: ContactImportProps) {
  const [file, setFile] = useState<File | null>(null);
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
    if (listId) formData.append("listId", listId);

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
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setState("idle");
            setResult(null);
          }}
          className="block text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-zinc-200 hover:file:bg-zinc-600"
        />
        {file && (
          <button
            onClick={handleUpload}
            disabled={state === "uploading"}
            className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
          >
            {state === "uploading" ? "Importing…" : "Import"}
          </button>
        )}
      </div>

      {file && state === "idle" && (
        <p className="text-xs text-zinc-500">
          {file.name} · {(file.size / 1024).toFixed(1)} KB
        </p>
      )}

      {state === "done" && result && (
        <div className="rounded-lg border border-green-700/40 bg-green-900/10 px-4 py-3 text-sm">
          <p className="font-semibold text-green-400">Import complete</p>
          <ul className="mt-1 space-y-0.5 text-xs text-zinc-400">
            <li>Imported: <span className="text-white">{result.imported}</span></li>
            <li>Skipped (already exist): <span className="text-white">{result.skipped}</span></li>
            <li>Invalid rows: <span className="text-white">{result.errors}</span></li>
            {result.duplicatesInFile > 0 && (
              <li>Duplicates in file: <span className="text-yellow-400">{result.duplicatesInFile}</span></li>
            )}
            {result.message && <li className="text-zinc-500">{result.message}</li>}
          </ul>
        </div>
      )}

      {state === "error" && (
        <p className="text-sm text-red-400">{errorMsg}</p>
      )}
    </div>
  );
}
