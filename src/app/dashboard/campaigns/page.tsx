import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/db";
import { campaigns } from "@/db/schema";

/** Campaign list page — Label mode. */
export default async function CampaignsPage() {
  const { userId } = await verifySession();

  const userCampaigns = await db.query.campaigns.findMany({
    where: eq(campaigns.userId, userId),
    orderBy: [desc(campaigns.createdAt)],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="mt-1 text-sm text-zinc-400">All your promo releases.</p>
        </div>
        <Link
          href="/dashboard/campaigns/new"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
        >
          + New Campaign
        </Link>
      </div>

      {userCampaigns.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-10 text-center">
          <p className="text-sm text-zinc-500">No campaigns yet.</p>
          <Link
            href="/dashboard/campaigns/new"
            className="mt-4 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
          >
            Create your first campaign
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {userCampaigns.map((campaign) => (
            <li key={campaign.id}>
              <Link
                href={`/dashboard/campaigns/${campaign.id}`}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 transition hover:border-zinc-600"
              >
                <div>
                  <p className="font-semibold text-white">{campaign.title}</p>
                  <p className="mt-0.5 text-sm text-zinc-400">
                    {campaign.artistName}
                    {campaign.catalogNumber ? ` · ${campaign.catalogNumber}` : ""}
                  </p>
                </div>
                <StatusBadge status={campaign.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-zinc-700 text-zinc-300",
    scheduled: "bg-blue-500/20 text-blue-300",
    active: "bg-green-500/20 text-green-300",
    expired: "bg-red-500/20 text-red-400",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${map[status] ?? map.draft}`}
    >
      {status}
    </span>
  );
}
