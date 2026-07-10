import { redirect } from "next/navigation";
import Link from "next/link";
import { verifySession, getCurrentProfile } from "@/lib/dal";

/**
 * Dashboard home — redirects to the correct view based on active workspace.
 */
export default async function DashboardPage() {
  const session = await verifySession();
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");

  return (
    <div className="space-y-4">
      {profile.activeWorkspace === "label" ? (
        <LabelDashboard labelName={profile.labelName} />
      ) : (
        <DjDashboard djAlias={profile.djAlias} />
      )}
    </div>
  );
}

function LabelDashboard({ labelName }: { labelName: string | null }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">
          {labelName ?? "Your Label"} — Label Dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Create campaigns, upload tracks, manage your promo lists.
        </p>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center text-zinc-500">
        <p className="text-sm">Campaigns will appear here once you create them.</p>
        <Link
          href="/dashboard/campaigns/new"
          className="mt-4 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          + New Campaign
        </Link>
      </div>
    </div>
  );
}

function DjDashboard({ djAlias }: { djAlias: string | null }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">
          {djAlias ?? "Your"} Promo Box
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          All the promos labels have sent you, in one place.
        </p>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center text-zinc-500">
        <p className="text-sm">
          No promos yet. When labels send you music, it will appear here.
        </p>
      </div>
    </div>
  );
}
