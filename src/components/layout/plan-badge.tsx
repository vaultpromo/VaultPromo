import Link from "next/link";
import type { PlanTier } from "@/db/schema/users";
import { PLAN_LIMITS } from "@/db/schema/users";

interface PlanBadgeProps {
  planTier: PlanTier;
  storageUsedBytes: string;
  storageQuotaBytes: string;
}

export function PlanBadge({ planTier, storageUsedBytes, storageQuotaBytes }: PlanBadgeProps) {
  const used = Number(storageUsedBytes);
  const quota = Number(storageQuotaBytes);
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  const usedGB = (used / 1024 ** 3).toFixed(1);
  const quotaGB = (quota / 1024 ** 3).toFixed(0);

  const isFree = planTier === "free";
  const isWarning = pct >= 80;

  return (
    <div className="flex items-center gap-2">
      {/* Plan badge */}
      <Link
        href="/pricing"
        className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest transition ${
          isFree
            ? "border border-white/[0.08] bg-white/[0.03] text-white/30 hover:text-white/50"
            : "border border-violet-500/30 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20"
        }`}
      >
        {planTier}
      </Link>

      {/* Storage indicator */}
      <div className="hidden items-center gap-1.5 sm:flex">
        <div className="h-1 w-16 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full rounded-full transition-all ${
              isWarning ? "bg-amber-400" : "bg-white/20"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`text-[10px] ${isWarning ? "text-amber-400" : "text-white/20"}`}>
          {usedGB}/{quotaGB}GB
        </span>
        {isFree && isWarning && (
          <Link href="/pricing" className="text-[10px] text-amber-400 hover:underline">
            Upgrade
          </Link>
        )}
      </div>
    </div>
  );
}
