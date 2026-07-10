import { eq, and, ilike } from "drizzle-orm";
import { verifySession } from "@/lib/dal";
import { db } from "@/db";
import { profiles, users } from "@/db/schema";
import { AddToListButton } from "@/components/discover/add-to-list-button";
import { eq as drizzleEq } from "drizzle-orm";
import { mailingLists } from "@/db/schema";

/**
 * VaultPromo Network directory — Label mode only.
 *
 * Shows all DJs/tastemakers who opted in (discoverable = true).
 * Labels can add them directly to a mailing list.
 *
 * Privacy: only alias, genres, city, country, and type are shown.
 * Email addresses are NEVER exposed in this view.
 */
export default async function DiscoverPage(props: { searchParams: Promise<Record<string, string>> }) {
  const { userId } = await verifySession();
  const searchParams = await props.searchParams;

  const genreFilter = searchParams.genre ?? "";
  const cityFilter = searchParams.city ?? "";
  const typeFilter = searchParams.type ?? "";

  // Fetch tastemakers who opted in
  const rows = await db
    .select({
      profileId: profiles.id,
      userId: profiles.userId,
      djAlias: profiles.djAlias,
      djGenres: profiles.djGenres,
      djCity: profiles.djCity,
      djCountry: profiles.djCountry,
      djType: profiles.djType,
    })
    .from(profiles)
    .where(
      and(
        drizzleEq(profiles.discoverable, true),
        cityFilter
          ? ilike(profiles.djCity, `%${cityFilter}%`)
          : undefined,
        typeFilter && typeFilter !== "all"
          ? drizzleEq(profiles.djType, typeFilter as "dj" | "radio" | "press" | "producer" | "other")
          : undefined,
      ),
    )
    .limit(200);

  // Filter by genre client-side (stored as comma-separated string)
  const filtered = genreFilter
    ? rows.filter((r) =>
        r.djGenres?.toLowerCase().includes(genreFilter.toLowerCase()),
      )
    : rows;

  // Exclude the current user's own profile
  const tastemakers = filtered.filter((r) => r.userId !== userId);

  // Get label's mailing lists for the "Add to list" button
  const lists = await db.query.mailingLists.findMany({
    where: drizzleEq(mailingLists.userId, userId),
    columns: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/30">
            VaultPromo Network
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Discover Tastemakers</h1>
          <p className="mt-1 text-sm text-white/40">
            {tastemakers.length} DJs, radio hosts and press who opted in to receive promos
          </p>
        </div>
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-2" method="get">
        <input
          name="genre"
          type="text"
          defaultValue={genreFilter}
          placeholder="Filter by genre…"
          className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white placeholder-white/20 focus:border-white/20 focus:outline-none"
        />
        <input
          name="city"
          type="text"
          defaultValue={cityFilter}
          placeholder="City…"
          className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white placeholder-white/20 focus:border-white/20 focus:outline-none"
        />
        <select
          name="type"
          defaultValue={typeFilter}
          className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white focus:border-white/20 focus:outline-none"
        >
          <option value="all">All types</option>
          <option value="dj">DJ</option>
          <option value="radio">Radio</option>
          <option value="press">Press</option>
          <option value="producer">Producer</option>
          <option value="other">Other</option>
        </select>
        <button
          type="submit"
          className="rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-1.5 text-xs text-white/70 hover:text-white"
        >
          Filter
        </button>
        {(genreFilter || cityFilter || (typeFilter && typeFilter !== "all")) && (
          <a
            href="/dashboard/discover"
            className="rounded-lg px-3 py-1.5 text-xs text-white/30 hover:text-white/60"
          >
            Clear
          </a>
        )}
      </form>

      {/* Results */}
      {tastemakers.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] p-10 text-center">
          <p className="text-sm text-white/30">No tastemakers found for this filter.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05] bg-white/[0.02] text-left">
                <th className="px-5 py-3 text-xs font-medium text-white/30">Alias</th>
                <th className="hidden px-5 py-3 text-xs font-medium text-white/30 sm:table-cell">Type</th>
                <th className="hidden px-5 py-3 text-xs font-medium text-white/30 md:table-cell">Location</th>
                <th className="px-5 py-3 text-xs font-medium text-white/30">Genres</th>
                {lists.length > 0 && (
                  <th className="px-5 py-3 text-xs font-medium text-white/30">Add</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {tastemakers.map((tm) => (
                <tr key={tm.profileId} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3 font-medium text-white/90">
                    {tm.djAlias ?? "Anonymous"}
                  </td>
                  <td className="hidden px-5 py-3 text-xs capitalize text-white/40 sm:table-cell">
                    {tm.djType ?? "—"}
                  </td>
                  <td className="hidden px-5 py-3 text-xs text-white/40 md:table-cell">
                    {[tm.djCity, tm.djCountry].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {tm.djGenres
                        ? tm.djGenres.split(",").slice(0, 3).map((g) => (
                            <span
                              key={g}
                              className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-white/40"
                            >
                              {g.trim()}
                            </span>
                          ))
                        : <span className="text-xs text-white/20">—</span>}
                    </div>
                  </td>
                  {lists.length > 0 && (
                    <td className="px-5 py-3">
                      <AddToListButton
                        profileId={tm.profileId}
                        djUserId={tm.userId}
                        lists={lists}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lists.length === 0 && (
        <p className="text-xs text-white/25">
          Create a mailing list in{" "}
          <a href="/dashboard/contacts" className="underline hover:text-white/50">
            Contacts
          </a>{" "}
          to add tastemakers to it.
        </p>
      )}
    </div>
  );
}
