import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { campaigns, tracks } from "@/db/schema";
import { storage } from "@/lib/storage";
import { getPromoSession } from "@/lib/promo/session";
import { TokenGate } from "@/components/promo/token-gate";

/**
 * Public promo page — /promo/[campaignId]
 *
 * Access is established via the /api/promo/enter Route Handler which:
 * 1. Verifies the delivery_token from the email link
 * 2. Sets an HttpOnly session cookie
 * 3. Redirects here
 *
 * This Server Component only READS the cookie — never writes it.
 * That avoids the Next.js 16 restriction that cookies can only be
 * set in Route Handlers or Server Actions.
 */
export default async function PromoPage(props: PageProps<"/promo/[campaignId]">) {
  const { campaignId } = await props.params;
  const searchParams = await props.searchParams;

  // If the user arrived with an error param from the enter handler
  const errorParam = typeof searchParams.error === "string" ? searchParams.error : null;
  if (errorParam) {
    return <TokenErrorPage reason={errorParam as "not_found" | "expired" | "wrong_campaign"} />;
  }

  // Read session cookie (set by /api/promo/enter)
  const session = await getPromoSession(campaignId);

  if (!session) {
    // No valid session — user needs to use the email link
    return <TokenErrorPage reason="not_found" />;
  }

  const { feedbackSubmitted, hasDownloaded, id: distributionId } = session;

  // Load campaign
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
  });

  if (!campaign) {
    return <TokenErrorPage reason="not_found" />;
  }

  // Check expiry
  if (campaign.expiryDate && campaign.expiryDate < new Date()) {
    return <TokenErrorPage reason="expired" />;
  }

  // Load ready tracks
  const campaignTracks = await db.query.tracks.findMany({
    where: eq(tracks.campaignId, campaignId),
    orderBy: [asc(tracks.position)],
  });

  const readyTracks = campaignTracks.filter((t) => t.processingStatus === "ready");

  // Generate presigned URL for artwork if campaign has one
  let artworkUrl: string | null = null;
  if (campaign.artworkUrl) {
    try {
      artworkUrl = await storage.getPresignedUrl({
        bucket: "originals",
        key: campaign.artworkUrl,
        expiresInSeconds: 3600,
      });
    } catch {
      // Non-fatal
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      {/* Header */}
      <header className="border-b border-white/[0.06] px-6 py-4">
        <span className="text-[11px] font-bold tracking-[0.2em] text-white/60 uppercase">
          PromoVault
        </span>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10">
        {/* Campaign info — portada + metadatos */}
        <div className="mb-8">
          <div className="flex gap-5">
            {/* Cover art */}
            {artworkUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={artworkUrl}
                alt={`${campaign.title} artwork`}
                className="h-28 w-28 shrink-0 rounded-lg object-cover shadow-lg shadow-black/40 sm:h-36 sm:w-36"
              />
            ) : (
              <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-3xl text-white/10 sm:h-36 sm:w-36">
                ♪
              </div>
            )}

            {/* Text metadata */}
            <div className="min-w-0 space-y-1">
              <h1 className="text-xl font-semibold text-white sm:text-2xl">{campaign.title}</h1>
              <p className="text-white/50">{campaign.artistName}</p>
              {campaign.catalogNumber && (
                <p className="text-xs text-white/25">{campaign.catalogNumber}</p>
              )}
              {campaign.releaseDate && (
                <p className="text-xs text-white/25">
                  Release:{" "}
                  {new Date(campaign.releaseDate).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              )}
            </div>
          </div>

          {campaign.description && (
            <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">
                Press Release
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/60">
                {campaign.description}
              </p>
            </div>
          )}
        </div>

        {readyTracks.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <p className="text-sm text-white/30">
              Audio files are being processed. Check back shortly.
            </p>
          </div>
        ) : (
          <TokenGate
            campaignId={campaignId}
            distributionId={distributionId}
            tracks={readyTracks.map((t) => ({
              id: t.id,
              title: t.title,
              artistName: t.artistName,
              mixVersion: t.mixVersion,
              bpm: t.bpm,
              musicalKey: t.musicalKey,
              position: t.position,
              previewKey: t.previewKey!,
            }))}
            initialFeedbackSubmitted={feedbackSubmitted}
            initialHasDownloaded={hasDownloaded}
            artworkUrl={artworkUrl}
          />
        )}
      </main>
    </div>
  );
}

function TokenErrorPage({
  reason,
}: {
  reason: "not_found" | "expired" | "wrong_campaign";
}) {
  const messages = {
    not_found: {
      title: "Link not found",
      body: "This promo link is invalid or has already been used. Check your email for the correct link.",
    },
    expired: {
      title: "Promo expired",
      body: "This promo link has expired. The release period has ended.",
    },
    wrong_campaign: {
      title: "Invalid link",
      body: "This link doesn't match the campaign. Please use the link from your email.",
    },
  };

  const { title, body } = messages[reason] ?? messages.not_found;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-4">
      <div className="max-w-sm text-center">
        <span className="mb-6 block text-[11px] font-bold tracking-[0.2em] text-white/30 uppercase">
          PromoVault
        </span>
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        <p className="mt-3 text-sm text-white/40">{body}</p>
      </div>
    </div>
  );
}
