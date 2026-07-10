import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { verifySession, getCurrentProfile } from "@/lib/dal";
import { db } from "@/db";
import { campaigns, mailingLists } from "@/db/schema";

export default async function DashboardPage() {
  await verifySession();
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");

  if (profile.activeWorkspace === "label") {
    return <LabelDashboard userId={profile.userId} labelName={profile.labelName} />;
  }

  return <DjDashboard djAlias={profile.djAlias} />;
}

async function LabelDashboard({
  userId,
  labelName,
}: {
  userId: string;
  labelName: string | null;
}) {
  const [recentCampaigns, lists] = await Promise.all([
    db.query.campaigns.findMany({
      where: eq(campaigns.userId, userId),
      orderBy: [desc(campaigns.createdAt)],
      limit: 3,
    }),
    db.query.mailingLists.findMany({
      where: eq(mailingLists.userId, userId),
      orderBy: [desc(mailingLists.createdAt)],
      limit: 3,
    }),
  ]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-white/30">Label</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">
          {labelName ?? "Dashboard"}
        </h1>
      </div>

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-3">
        <QuickAction
          href="/dashboard/campaigns/new"
          icon="+"
          title="New Campaign"
          desc="Upload tracks and prepare a promo"
        />
        <QuickAction
          href="/dashboard/contacts"
          icon="↑"
          title="Import Contacts"
          desc="Add DJs, radio hosts, press"
        />
        <QuickAction
          href="/dashboard/campaigns"
          icon="→"
          title="View Campaigns"
          desc="Manage and send your promos"
        />
      </div>

      {/* Recent campaigns */}
      <Section
        title="Recent campaigns"
        linkHref="/dashboard/campaigns"
        linkLabel="View all"
        empty={recentCampaigns.length === 0}
        emptyText="No campaigns yet."
      >
        <ul className="divide-y divide-white/[0.04]">
          {recentCampaigns.map((c) => (
            <li key={c.id}>
              <Link
                href={`/dashboard/campaigns/${c.id}`}
                className="flex items-center justify-between py-3 text-sm transition hover:opacity-80"
              >
                <div>
                  <p className="font-medium text-white/90">{c.title}</p>
                  <p className="mt-0.5 text-xs text-white/40">{c.artistName}</p>
                </div>
                <StatusDot status={c.status} />
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* Mailing lists */}
      <Section
        title="Mailing lists"
        linkHref="/dashboard/contacts"
        linkLabel="Manage"
        empty={lists.length === 0}
        emptyText="No lists yet."
      >
        <ul className="divide-y divide-white/[0.04]">
          {lists.map((l) => (
            <li key={l.id}>
              <Link
                href={`/dashboard/contacts/${l.id}`}
                className="flex items-center justify-between py-3 text-sm transition hover:opacity-80"
              >
                <p className="font-medium text-white/90">{l.name}</p>
                {l.description && (
                  <p className="text-xs text-white/30">{l.description}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function DjDashboard({ djAlias }: { djAlias: string | null }) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-white/30">DJ</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">
          {djAlias ? `${djAlias}'s Promo Box` : "Promo Box"}
        </h1>
      </div>

      <QuickAction
        href="/dashboard/promos"
        icon="♪"
        title="View Promos"
        desc="Music sent to you by labels"
      />
    </div>
  );
}

function QuickAction({
  href,
  icon,
  title,
  desc,
}: {
  href: string;
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 transition hover:border-white/[0.14] hover:bg-white/[0.04]"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.05] text-sm text-white/60 group-hover:text-white/90">
        {icon}
      </span>
      <div>
        <p className="text-sm font-medium text-white/80 group-hover:text-white">{title}</p>
        <p className="mt-0.5 text-xs text-white/35">{desc}</p>
      </div>
    </Link>
  );
}

function Section({
  title,
  linkHref,
  linkLabel,
  empty,
  emptyText,
  children,
}: {
  title: string;
  linkHref: string;
  linkLabel: string;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-widest text-white/30">{title}</h2>
        <Link href={linkHref} className="text-xs text-white/40 transition hover:text-white/70">
          {linkLabel} →
        </Link>
      </div>
      {empty ? (
        <p className="py-4 text-sm text-white/20">{emptyText}</p>
      ) : (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4">
          {children}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-white/20",
    scheduled: "bg-blue-400",
    active: "bg-emerald-400",
    expired: "bg-red-400/60",
  };
  return (
    <span className="flex items-center gap-1.5 text-xs text-white/30 capitalize">
      <span className={`h-1.5 w-1.5 rounded-full ${map[status] ?? map.draft}`} />
      {status}
    </span>
  );
}
