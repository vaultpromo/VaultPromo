import { notFound } from "next/navigation";
import { eq, and, asc } from "drizzle-orm";
import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/db";
import { campaigns, tracks, mailingLists } from "@/db/schema";
import { TrackList } from "@/components/campaigns/track-list";
import { AddTrackForm } from "@/components/campaigns/add-track-form";
import { DistributeForm } from "@/components/distribution/distribute-form";
import { deleteCampaignAction } from "@/lib/actions/campaigns";

export default async function CampaignDetailPage(props: PageProps<"/dashboard/campaigns/[campaignId]">) {
  const { campaignId } = await props.params;
  const { userId } = await verifySession();

  const [campaign, campaignTracks, userLists] = await Promise.all([
    db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)),
    }),
    db.query.tracks.findMany({
      where: eq(tracks.campaignId, campaignId),
      orderBy: [asc(tracks.position)],
    }),
    db.query.mailingLists.findMany({
      where: eq(mailingLists.userId, userId),
      columns: { id: true, name: true, description: true },
    }),
  ]);

  if (!campaign) notFound();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/campaigns"
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              ← Campaigns
            </Link>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-white">{campaign.title}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {campaign.artistName}
            {campaign.catalogNumber ? ` · ${campaign.catalogNumber}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={campaign.status} />
          <Link
            href={`/dashboard/campaigns/${campaignId}/analytics`}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-white"
          >
            Analytics
          </Link>
          <form
            action={async () => {
              "use server";
              await deleteCampaignAction(campaignId);
            }}
          >
            <button
              type="submit"
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-red-400 transition hover:border-red-700 hover:bg-red-900/20"
            >
              Delete
            </button>
          </form>
        </div>
      </div>

      {/* Campaign metadata */}
      {campaign.description && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4">
          <h2 className="mb-1 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
            Press Release
          </h2>
          <p className="whitespace-pre-wrap text-sm text-zinc-300">{campaign.description}</p>
        </div>
      )}

      {/* Tracks section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">
          Tracks
          <span className="ml-2 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
            {campaignTracks.length}
          </span>
        </h2>

        <TrackList tracks={campaignTracks} campaignId={campaignId} />

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h3 className="mb-4 text-sm font-semibold text-zinc-300">Add Track</h3>
          <AddTrackForm campaignId={campaignId} nextPosition={campaignTracks.length + 1} />
        </div>
      </div>
      {/* Distribution section */}
      <DistributeForm campaignId={campaignId} lists={userLists} />

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
