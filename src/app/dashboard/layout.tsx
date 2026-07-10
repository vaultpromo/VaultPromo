import Link from "next/link";
import { getCurrentProfile, verifySession } from "@/lib/dal";
import { WorkspaceToggle } from "@/components/layout/workspace-toggle";
import { logoutAction } from "@/lib/actions/auth";

/**
 * Shared dashboard layout.
 * All /dashboard/* routes get this nav + workspace toggle.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySession();
  const profile = await getCurrentProfile();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top nav */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/90 px-6 py-3 backdrop-blur">
        <nav className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-sm font-semibold tracking-widest text-violet-400 uppercase"
          >
            PromoVault
          </Link>
          {profile?.activeWorkspace === "label" && (
            <>
              <Link
                href="/dashboard/campaigns"
                className="text-sm text-zinc-400 transition hover:text-white"
              >
                Campaigns
              </Link>
              <Link
                href="/dashboard/contacts"
                className="text-sm text-zinc-400 transition hover:text-white"
              >
                Contacts
              </Link>
            </>
          )}
          {profile?.activeWorkspace === "dj" && (
            <Link
              href="/dashboard/promos"
              className="text-sm text-zinc-400 transition hover:text-white"
            >
              Promo Box
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-4">
          {profile && (
            <WorkspaceToggle
              activeWorkspace={profile.activeWorkspace}
              labelName={profile.labelName}
              djAlias={profile.djAlias}
            />
          )}
          <span className="hidden text-sm text-zinc-500 sm:block">{session.email}</span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-white"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* Page content */}
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">{children}</main>
    </div>
  );
}
