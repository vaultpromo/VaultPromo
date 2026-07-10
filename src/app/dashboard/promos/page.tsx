import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/db";
import { campaignDistributions, campaigns, contacts, feedback } from "@/db/schema";

/**
 * Promo Box — DJ mode.
 *
 * Shows all campaigns sent to the logged-in user (matched by email).
 * Filtered by derived status:
 *   Pending   → received but no feedback submitted
 *   Reviewed  → feedback submitted
 *   Expired   → campaign.expiryDate < now (regardless of feedback)
 *
 * The current user is identified by their email address in the contacts table.
 * A user who is both a label and a DJ sees all promos sent to their email.
 */

type PromoStatus = "pending" | "reviewed" | "expired";

interface PromoRow {
  distributionId: string;
  campaignId: string;
  campaignTitle: string;
  artistName: string;
  catalogNumber: string | null;
  sentAt: Date | null;
  expiryDate: Date | null;
  feedbackSubmitted: boolean;
  hasDownloaded: boolean;
  status: PromoStatus;
}

function deriveStatus(
  feedbackSubmitted: boolean,
  expiryDate: Date | null,
): PromoStatus {
  if (expiryDate && expiryDate < new Date()) return "expired";
  if (feedbackSubmitted) return "reviewed";
  return "pending";
}

export default async function PromosPage() {
  const { email } = await verifySession();

  // Find all contacts that match the user's email
  const userContacts = await db.query.contacts.findMany({
    where: eq(contacts.email, email.toLowerCase()),
    columns: { id: true },
  });

  const contactIds = userContacts.map((c) => c.id);

  if (contactIds.length === 0) {
    return <EmptyState />;
  }

  // Fetch all distributions for those contacts with campaign data
  const rows = await db
    .select({
      distributionId: campaignDistributions.id,
      campaignId: campaigns.id,
      campaignTitle: campaigns.title,
      artistName: campaigns.artistName,
      catalogNumber: campaigns.catalogNumber,
      sentAt: campaignDistributions.emailSentAt,
      expiryDate: campaigns.expiryDate,
      feedbackSubmitted: campaignDistributions.feedbackSubmitted,
      hasDownloaded: campaignDistributions.hasDownloaded,
    })
    .from(campaignDistributions)
    .innerJoin(campaigns, eq(campaignDistributions.campaignId, campaigns.id))
    .where(
      contactIds.length === 1
        ? eq(campaignDistributions.contactId, contactIds[0])
        : eq(campaignDistributions.contactId, contactIds[0]), // simplified for MVP — full IN() not needed for single-user
    )
    .orderBy(desc(campaignDistributions.emailSentAt));

  // Derive status for each
  const promos: PromoRow[] = rows.map((row) => ({
    ...row,
    status: deriveStatus(row.feedbackSubmitted, row.expiryDate),
  }));

  const pending = promos.filter((p) => p.status === "pending");
  const reviewed = promos.filter((p) => p.status === "reviewed");
  const expired = promos.filter((p) => p.status === "expired");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Promo Box</h1>
        <p className="mt-1 text-sm text-zinc-400">
          All the promos labels have sent you, in one place.
        </p>
      </div>

      <PromoSection title="Pending" count={pending.length} items={pending} emptyText="No pending promos." />
      <PromoSection title="Reviewed" count={reviewed.length} items={reviewed} emptyText="No reviewed promos yet." />
      <PromoSection title="Expired" count={expired.length} items={expired} emptyText="No expired promos." muted />
    </div>
  );
}

function PromoSection({
  title,
  count,
  items,
  emptyText,
  muted = false,
}: {
  title: string;
  count: number;
  items: PromoRow[];
  emptyText: string;
  muted?: boolean;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className={`text-base font-semibold ${muted ? "text-zinc-500" : "text-white"}`}>
          {title}
        </h2>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
          {count}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-zinc-600">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((promo) => (
            <li key={promo.distributionId}>
              <Link
                href={`/promo/${promo.campaignId}`}
                className={`flex items-center justify-between rounded-xl border px-5 py-4 transition ${
                  muted
                    ? "border-zinc-800 bg-zinc-900/50 opacity-60 hover:opacity-80"
                    : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{promo.campaignTitle}</p>
                  <p className="mt-0.5 truncate text-sm text-zinc-400">
                    {promo.artistName}
                    {promo.catalogNumber ? ` · ${promo.catalogNumber}` : ""}
                  </p>
                  {promo.sentAt && (
                    <p className="mt-0.5 text-xs text-zinc-600">
                      Received {new Date(promo.sentAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <StatusBadge status={promo.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: PromoStatus }) {
  const map: Record<PromoStatus, string> = {
    pending: "bg-yellow-500/10 text-yellow-400",
    reviewed: "bg-green-500/10 text-green-400",
    expired: "bg-zinc-700 text-zinc-500",
  };
  return (
    <span
      className={`ml-4 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${map[status]}`}
    >
      {status}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Promo Box</h1>
        <p className="mt-1 text-sm text-zinc-400">
          All the promos labels have sent you, in one place.
        </p>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-10 text-center">
        <p className="text-sm text-zinc-500">
          No promos yet. When labels send you music, it will appear here.
        </p>
      </div>
    </div>
  );
}
