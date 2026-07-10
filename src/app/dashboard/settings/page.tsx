import { redirect } from "next/navigation";
import { verifySession, getCurrentProfile } from "@/lib/dal";
import { LabelProfileForm } from "@/components/settings/label-profile-form";
import { DjProfileForm } from "@/components/settings/dj-profile-form";
import { NetworkOptIn } from "@/components/settings/network-opt-in";

export default async function SettingsPage() {
  const session = await verifySession();
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-white/30">Account</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Settings</h1>
        <p className="mt-1 text-sm text-white/40">{session.email}</p>
      </div>

      {/* Label profile */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30">
          Label profile
        </h2>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
          <LabelProfileForm
            currentName={profile.labelName ?? ""}
            currentWebsite={profile.labelWebsite ?? ""}
          />
        </div>
      </section>

      {/* DJ profile */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30">
          DJ / Tastemaker profile
        </h2>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
          <DjProfileForm
            current={{
              djAlias: profile.djAlias ?? "",
              djGenres: profile.djGenres ?? "",
              djCity: profile.djCity ?? "",
              djCountry: profile.djCountry ?? "",
              djType: (profile.djType as string) ?? "",
            }}
          />
        </div>
      </section>

      {/* VaultPromo Network opt-in */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30">
          VaultPromo Network
        </h2>
        <NetworkOptIn
          discoverable={profile.discoverable}
          djAlias={profile.djAlias}
        />
      </section>
    </div>
  );
}
