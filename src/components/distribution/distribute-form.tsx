"use client";

import { useState, useTransition } from "react";
import { distributeCampaignAction } from "@/lib/actions/distribution/distribute";
import type { DistributeResult } from "@/lib/actions/distribution/distribute";

interface MailingListOption {
  id: string;
  name: string;
  description: string | null;
}

interface DistributeFormProps {
  campaignId: string;
  lists: MailingListOption[];
}

/**
 * Distribution form — lets the label pick a mailing list and dispatch
 * individual personalized emails to all contacts in that list.
 */
export function DistributeForm({ campaignId, lists }: DistributeFormProps) {
  const [selectedList, setSelectedList] = useState<string>("");
  const [result, setResult] = useState<DistributeResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDistribute() {
    if (!selectedList || isPending) return;

    startTransition(async () => {
      const res = await distributeCampaignAction(campaignId, selectedList);
      setResult(res);
    });
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-1 text-sm font-semibold text-zinc-300">Send Campaign</h2>
      <p className="mb-4 text-xs text-zinc-500">
        Select a mailing list to send individual, personalized emails to each contact.
        Each recipient gets a unique private link.
      </p>

      {lists.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No mailing lists yet.{" "}
          <a href="/dashboard/contacts" className="text-violet-400 hover:underline">
            Create one first.
          </a>
        </p>
      ) : (
        <div className="space-y-3">
          <select
            value={selectedList}
            onChange={(e) => {
              setSelectedList(e.target.value);
              setResult(null);
            }}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
          >
            <option value="">— Select a list —</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleDistribute}
            disabled={!selectedList || isPending}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Sending…" : "Send Promo Emails"}
          </button>
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm">
          <p className="font-semibold text-zinc-200">Distribution complete</p>
          <ul className="mt-1 space-y-0.5 text-xs text-zinc-400">
            <li>
              Sent: <span className="text-green-400">{result.sent}</span>
            </li>
            <li>
              Skipped (already sent or unsubscribed):{" "}
              <span className="text-zinc-300">{result.skipped}</span>
            </li>
            {result.failed > 0 && (
              <li>
                Failed: <span className="text-red-400">{result.failed}</span>
              </li>
            )}
          </ul>
          {result.errors && result.errors.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
                Show errors
              </summary>
              <ul className="mt-1 space-y-0.5 text-xs text-red-400">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
