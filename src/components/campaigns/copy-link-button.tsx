"use client";

import { useState } from "react";

interface CopyLinkButtonProps {
  url: string;
  label?: string;
}

/**
 * One-click copy to clipboard.
 * Shows "Copied!" feedback for 2 seconds.
 */
export function CopyLinkButton({ url, label = "Copy link" }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const el = document.createElement("textarea");
      el.value = url;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`rounded px-2 py-1 text-xs transition ${
        copied
          ? "bg-emerald-500/10 text-emerald-400"
          : "text-white/30 hover:bg-white/[0.05] hover:text-white/70"
      }`}
    >
      {copied ? "✓ Copied!" : label}
    </button>
  );
}
