import Link from "next/link";
import { getCurrentProfile, verifySession } from "@/lib/dal";
import { WorkspaceToggle } from "@/components/layout/workspace-toggle";
import { PlanBadge } from "@/components/layout/plan-badge";
import { logoutAction } from "@/lib/actions/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySession();
  const profile = await getCurrentProfile();

  const isLabel = profile?.activeWorkspace === "label";

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0a]">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0a0a0a]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5">
          {/* Left: logo + links */}
          <div className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="text-[11px] font-bold tracking-[0.2em] text-white/90 uppercase"
            >
              PromoVault
            </Link>

            <nav className="hidden items-center gap-1 sm:flex">
              {isLabel ? (
                <>
                  <NavLink href="/dashboard/campaigns">Campaigns</NavLink>
                  <NavLink href="/dashboard/contacts">Contacts</NavLink>
                </>
              ) : (
                <NavLink href="/dashboard/promos">Promo Box</NavLink>
              )}
            </nav>
          </div>

          {/* Right: workspace toggle + user */}
          <div className="flex items-center gap-3">
            {profile && (
              <WorkspaceToggle
                activeWorkspace={profile.activeWorkspace}
                labelName={profile.labelName}
                djAlias={profile.djAlias}
              />
            )}

            {profile && (
              <PlanBadge
                planTier={profile.planTier as "free" | "pro" | "label"}
                storageUsedBytes={profile.storageUsedBytes}
                storageQuotaBytes={profile.storageQuotaBytes}
              />
            )}

            <div className="hidden h-4 w-px bg-white/10 sm:block" />

            <span className="hidden max-w-[160px] truncate text-xs text-white/40 sm:block">
              {session.email}
            </span>

            <form action={logoutAction}>
              <button
                type="submit"
                className="text-xs text-white/40 transition hover:text-white/80"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8">
        {children}
      </main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-sm text-white/50 transition hover:bg-white/[0.05] hover:text-white/90"
    >
      {children}
    </Link>
  );
}
