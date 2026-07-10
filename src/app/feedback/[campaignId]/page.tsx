import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { campaigns, feedback, tracks } from "@/db/schema";

/**
 * Public feedback page — /feedback/[campaignId]
 *
 * Shareable link for the artist to see all feedback received.
 * Shows: campaign info, track list, each feedback entry (name, rating, comment).
 * Does NOT expose contact emails or analytics data.
 */
export default async function FeedbackPage(props: PageProps<"/feedback/[campaignId]">) {
  const { campaignId } = await props.params;

  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
    columns: { id: true, title: true, artistName: true, catalogNumber: true, releaseDate: true },
  });

  if (!campaign) notFound();

  const campaignTracks = await db.query.tracks.findMany({
    where: eq(tracks.campaignId, campaignId),
    columns: { id: true, title: true, mixVersion: true, position: true },
  });

  const trackMap = Object.fromEntries(campaignTracks.map((t) => [t.id, t]));

  const feedbackRows = await db.query.feedback.findMany({
    where: eq(feedback.campaignId, campaignId),
    columns: {
      id: true,
      rating: true,
      comment: true,
      reviewerName: true,
      favoriteTrackId: true,
      submittedAt: true,
    },
    orderBy: (f, { desc }) => [desc(f.submittedAt)],
  });

  const avgRating =
    feedbackRows.length > 0
      ? feedbackRows.reduce((sum, f) => sum + Number(f.rating), 0) / feedbackRows.length
      : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-white/[0.06] px-6 py-4">
        <span className="text-[11px] font-bold tracking-[0.2em] text-white/40 uppercase">
          PromoVault
        </span>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10 space-y-8">
        {/* Campaign header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-white">{campaign.title}</h1>
          <p className="text-white/40">{campaign.artistName}</p>
          {campaign.catalogNumber && (
            <p className="text-xs text-white/20">{campaign.catalogNumber}</p>
          )}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Responses" value={String(feedbackRows.length)} />
          <StatCard
            label="Avg. Rating"
            value={feedbackRows.length > 0 ? `${avgRating.toFixed(1)} / 5` : "—"}
          />
          <StatCard
            label="Tracks"
            value={String(campaignTracks.length)}
          />
        </div>

        {/* Feedback list */}
        {feedbackRows.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <p className="text-sm text-white/30">No feedback yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-white/25">
              {feedbackRows.length} {feedbackRows.length === 1 ? "response" : "responses"}
            </h2>
            {feedbackRows.map((fb) => {
              const favoriteTrack = fb.favoriteTrackId ? trackMap[fb.favoriteTrackId] : null;
              return (
                <div
                  key={fb.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white/90">
                        {fb.reviewerName ?? "Anonymous"}
                      </p>
                      <p className="text-xs text-white/25">
                        {new Date(fb.submittedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-amber-400">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span
                          key={i}
                          className={i < Number(fb.rating) ? "text-amber-400" : "text-white/10"}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>

                  <p className="text-sm leading-relaxed text-white/60">{fb.comment}</p>

                  {favoriteTrack && (
                    <p className="text-xs text-white/25">
                      Favorite:{" "}
                      <span className="text-white/50">
                        {favoriteTrack.title}
                        {favoriteTrack.mixVersion && ` — ${favoriteTrack.mixVersion}`}
                      </span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <p className="text-xs text-white/25 uppercase tracking-widest">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}
