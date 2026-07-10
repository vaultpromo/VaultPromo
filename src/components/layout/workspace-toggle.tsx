"use client";

import { useTransition } from "react";
import { switchWorkspaceAction } from "@/lib/actions/auth";

interface WorkspaceToggleProps {
  activeWorkspace: "label" | "dj";
  labelName?: string | null;
  djAlias?: string | null;
}

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
      className="flex items-center rounded-md border border-white/[0.08] bg-white/[0.04] p-0.5"
      role="group"
      aria-label="Switch workspace"
    >
      <Tab
        label={labelName ?? "Label"}
        active={activeWorkspace === "label"}
        pending={isPending}
        onClick={() => handleSwitch("label")}
      />
      <Tab
        label={djAlias ?? "DJ"}
        active={activeWorkspace === "dj"}
        pending={isPending}
        onClick={() => handleSwitch("dj")}
      />
    </div>
  );
}

function Tab({
  label,
  active,
  pending,
  onClick,
}: {
  label: string;
  active: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      aria-pressed={active}
      className={`rounded px-3 py-1 text-xs font-medium transition-all disabled:cursor-wait ${
        active
          ? "bg-white/[0.1] text-white shadow-sm"
          : "text-white/40 hover:text-white/70"
      }`}
    >
      {label}
    </button>
  );
}
