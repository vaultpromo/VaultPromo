import { notFound } from "next/navigation";
import { and, eq, count, sql } from "drizzle-orm";
import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/db";
import { campaigns, campaignDistributions, feedback, contacts } from "@/db/schema";

/**
 * Campaign analytics page — Label mode.
 *
 * Shows funnel metrics per campaign:
 *   Sent      → rows in campaign_distributions
 *   Opened    → emailOpenedAt IS NOT NULL
 *   Feedback  → feedbackSubmitted = true
 *   Downloaded → hasDownloaded = true
 *
 * And a per-contact breakdown table with their status.
 */
export default async function CampaignAnalyticsPage(
  props: PageProps<"/dashboard/campaigns/[campaignId]/analytics">,
) {
  const { campaignId } = await props.params;
  const { userId } = await verifySession();

  const campaign = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)),
    columns: { id: true, title: true, artistName: true, status: true },
  });

  if (!campaign) notFound();

  // ── Aggregate metrics ────────────────────────────────────────────────────
  const [metrics] = await db
    .select({
      total: count(campaignDistributions.id),
      opened: count(
        sql`CASE WHEN ${campaignDistributions.emailOpenedAt} IS NOT NULL THEN 1 END`,
      ),
      feedbackCount: count(
        sql`CASE WHEN ${campaignDistributions.feedbackSubmitted} = true THEN 1 END`,
      ),
      downloaded: count(
        sql`CASE WHEN ${campaignDistributions.hasDownloaded} = true THEN 1 END`,
      ),
    })
    .from(campaignDistributions)
    .where(eq(campaignDistributions.campaignId, campaignId));

  const total = Number(metrics?.total ?? 0);
  const opened = Number(metrics?.opened ?? 0);
  const feedbackCount = Number(metrics?.feedbackCount ?? 0);
  const downloaded = Number(metrics?.downloaded ?? 0);

  // ── Per-contact breakdown ────────────────────────────────────────────────
  const contactRows = await db
    .select({
      email: contacts.email,
      name: contacts.name,
      alias: contacts.alias,
      emailSentAt: campaignDistributions.emailSentAt,
      emailOpenedAt: campaignDistributions.emailOpenedAt,
      feedbackSubmitted: campaignDistributions.feedbackSubmitted,
      hasDownloaded: campaignDistributions.hasDownloaded,
    })
    .from(campaignDistributions)
    .innerJoin(contacts, eq(campaignDistributions.contactId, contacts.id))
    .where(eq(campaignDistributions.campaignId, campaignId))
    .orderBy(campaignDistributions.emailSentAt);

  // ── Feedback comments ────────────────────────────────────────────────────
  const feedbackRows = await db
    .select({
      contactEmail: contacts.email,
      rating: feedback.rating,
      comment: feedback.comment,
      submittedAt: feedback.submittedAt,
    })
    .from(feedback)
    .innerJoin(contacts, eq(feedback.contactId, contacts.id))
    .where(eq(feedback.campaignId, campaignId))
    .orderBy(feedback.submittedAt);

  function pct(n: number, d: number) {
    if (d === 0) return "—";
    return `${Math.round((n / d) * 100)}%`;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link
          href={`/dashboard/campaigns/${campaignId}`}
          className="text-sm text-zinc-500 hover:text-zinc-300"
        >
          ← Back to campaign
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">{campaign.title} — Analytics</h1>
        <p className="mt-1 text-sm text-zinc-400">{campaign.artistName}</p>
      </div>

      {/* Funnel metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Sent" value={total} />
        <MetricCard label="Opened" value={opened} sub={pct(opened, total)} />
        <MetricCard label="Feedback" value={feedbackCount} sub={pct(feedbackCount, opened)} />
        <MetricCard label="Downloaded" value={downloaded} sub={pct(downloaded, feedbackCount)} />
      </div>

      {/* Per-contact table */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Contact breakdown</h2>
        {contactRows.length === 0 ? (
          <p className="text-sm text-zinc-500">No recipients yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900 text-left text-xs text-zinc-500">
                  <th className="px-4 py-3 font-medium">Recipient</th>
                  <th className="px-4 py-3 font-medium">Sent</th>
                  <th className="px-4 py-3 font-medium">Opened</th>
                  <th className="px-4 py-3 font-medium">Feedback</th>
                  <th className="px-4 py-3 font-medium">Downloaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-950">
                {contactRows.map((row, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3">
                      <p className="text-zinc-200">{row.name ?? row.alias ?? row.email}</p>
                      <p className="text-xs text-zinc-500">{row.email}</p>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {row.emailSentAt
                        ? new Date(row.emailSentAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {row.emailOpenedAt ? (
                        <span className="text-green-400">Yes</span>
                      ) : (
                        <span className="text-zinc-600">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.feedbackSubmitted ? (
                        <span className="text-green-400">Yes</span>
                      ) : (
                        <span className="text-zinc-600">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.hasDownloaded ? (
                        <span className="text-green-400">Yes</span>
                      ) : (
                        <span className="text-zinc-600">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Feedback comments */}
      {feedbackRows.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Feedback received</h2>
          <ul className="space-y-3">
            {feedbackRows.map((fb, i) => (
              <li
                key={i}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4"
              >
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-300">{fb.contactEmail}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400">{"★".repeat(Number(fb.rating))}</span>
                    <span className="text-xs text-zinc-600">
                      {new Date(fb.submittedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-zinc-400">{fb.comment}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4">
      <p className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">{label}</p>
      <p className="mt-1 text-3xl font-bold text-white">{value}</p>
      {sub && <p className="mt-0.5 text-sm text-zinc-400">{sub} rate</p>}
    </div>
  );
}
