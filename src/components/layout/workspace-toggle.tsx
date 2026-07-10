"use client";

import { useTransition } from "react";
import { switchWorkspaceAction } from "@/lib/actions/auth";

interface WorkspaceToggleProps {
  activeWorkspace: "label" | "dj";
  labelName?: string | null;
  djAlias?: string | null;
}

/**
 * Workspace switcher — Sello ↔ DJ.
 * Calls a Server Action; no page reload required.
 */
export function WorkspaceToggle({ activeWorkspace, labelName, djAlias }: WorkspaceToggleProps) {
  const [isPending, startTransition] = useTransition();

  function handleSwitch(workspace: "label" | "dj") {
    if (workspace === activeWorkspace || isPending) return;
    startTransition(() => {
      switchWorkspaceAction(workspace);
    });
  }

  return (
    <div
      className="flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 p-1"
      role="group"
      aria-label="Switch workspace"
    >
      <button
        onClick={() => handleSwitch("label")}
        disabled={isPending}
        aria-pressed={activeWorkspace === "label"}
        className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
          activeWorkspace === "label"
            ? "bg-violet-600 text-white"
            : "text-zinc-400 hover:text-white"
        } disabled:cursor-wait`}
      >
        {labelName ?? "Label"}
      </button>
      <button
        onClick={() => handleSwitch("dj")}
        disabled={isPending}
        aria-pressed={activeWorkspace === "dj"}
        className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
          activeWorkspace === "dj"
            ? "bg-violet-600 text-white"
            : "text-zinc-400 hover:text-white"
        } disabled:cursor-wait`}
      >
        {djAlias ?? "DJ"}
      </button>
    </div>
  );
}
