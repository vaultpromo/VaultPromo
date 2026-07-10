"use client";

import { useTransition, useState } from "react";
import { setDiscoverableAction } from "@/lib/actions/profile";

interface NetworkOptInProps {
  discoverable: boolean;
  djAlias?: string | null;
}

/**
 * VaultPromo Network opt-in toggle.
 *
 * Legal basis: explicit opt-in with clear explanation of what it means.
 * Users can opt out at any time.
 */
export function NetworkOptIn({ discoverable: initialValue, djAlias }: NetworkOptInProps) {
  const [enabled, setEnabled] = useState(initialValue);
  const [isPending, startTransition] = useTransition();

  function handleToggle(value: boolean) {
    setEnabled(value);
    startTransition(() => setDiscoverableAction(value));
  }

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-white/90">
            Appear in the tastemaker directory
          </p>
          <p className="text-xs text-white/35">
            Allow labels on VaultPromo to find your DJ profile and add you to their promo lists.
            {djAlias
              ? ` Your profile will be listed as "${djAlias}".`
              : " Complete your DJ profile above to set your alias first."}
          </p>
        </div>

        {/* Toggle */}
        <button
          role="switch"
          aria-checked={enabled}
          onClick={() => handleToggle(!enabled)}
          disabled={isPending}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-wait ${
            enabled ? "bg-violet-600" : "bg-white/[0.1]"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* Terms notice — always visible, not a separate checkbox */}
      <p className="text-[10px] text-white/20 leading-relaxed">
        By enabling this, you agree to VaultPromo&apos;s{" "}
        <a href="/terms" className="underline underline-offset-2 hover:text-white/40">
          Terms of Service
        </a>
        . Your email address is never shared with labels — only your alias, genres, city, and type are visible.
        You can opt out at any time.
      </p>

      {enabled && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <p className="text-xs text-emerald-400">
            ✓ Your profile is visible in the VaultPromo network.
            Labels can find you and add you to their lists.
          </p>
        </div>
      )}
    </div>
  );
}
