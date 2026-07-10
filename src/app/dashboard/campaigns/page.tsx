import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/db";
import { campaigns } from "@/db/schema";

export default async function CampaignsPage() {
  const { userId } = await verifySession();

  const userCampaigns = await db.query.campaigns.findMany({
    where: eq(campaigns.userId, userId),
    orderBy: [desc(campaigns.createdAt)],
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-white/30">Label</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Campaigns</h1>
        </div>
        <Link
          href="/dashboard/campaigns/new"
          className="flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-xs font-semibold text-black transition hover:bg-white/90"
        >
          <span className="text-sm leading-none">+</span>
          New Campaign
        </Link>
      </div>

      {userCampaigns.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05] bg-white/[0.02]">
                <th className="px-5 py-3 text-left text-xs font-medium text-white/30">Title</th>
                <th className="hidden px-5 py-3 text-left text-xs font-medium text-white/30 md:table-cell">Artist</th>
                <th className="hidden px-5 py-3 text-left text-xs font-medium text-white/30 sm:table-cell">Catalog</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-white/30">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {userCampaigns.map((campaign) => (
                <tr
                  key={campaign.id}
                  className="group transition hover:bg-white/[0.02]"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/dashboard/campaigns/${campaign.id}`}
                      className="block font-medium text-white/90 group-hover:text-white"
                    >
                      {campaign.title}
                    </Link>
                  </td>
                  <td className="hidden px-5 py-3.5 text-white/40 md:table-cell">
                    {campaign.artistName}
                  </td>
                  <td className="hidden px-5 py-3.5 text-white/30 sm:table-cell">
                    {campaign.catalogNumber ?? "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <StatusBadge status={campaign.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-white/[0.08] py-20">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-xl text-white/30">
        ♪
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-white/60">No campaigns yet</p>
        <p className="mt-1 text-xs text-white/25">Create your first promo release to get started</p>
      </div>
      <Link
        href="/dashboard/campaigns/new"
        className="mt-1 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-white/90"
      >
        Create campaign
      </Link>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft:     "text-white/30",
    scheduled: "text-blue-400",
    active:    "text-emerald-400",
    expired:   "text-red-400/60",
  };
  const dots: Record<string, string> = {
    draft:     "bg-white/20",
    scheduled: "bg-blue-400",
    active:    "bg-emerald-400",
    expired:   "bg-red-400/60",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs capitalize ${styles[status] ?? styles.draft}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dots[status] ?? dots.draft}`} />
      {status}
    </span>
  );
}
