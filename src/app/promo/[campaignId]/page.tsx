import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { campaigns, tracks } from "@/db/schema";
import { verifyDeliveryToken } from "@/lib/promo/verify-token";
import { setPromoSession, getPromoSession } from "@/lib/promo/session";
import { TokenGate } from "@/components/promo/token-gate";

/**
 * Public promo page — /promo/[campaignId]?token=<delivery_token>
 *
 * Server Component flow:
 * 1. If a token query param is present → verify it, log open, set cookie
 * 2. If a promo session cookie exists → use it (returning visitor)
 * 3. If neither → show the token-invalid/expired error UI
 *
 * The token is NOT exposed to the client bundle (server-only verification).
 * The page renders the promo shell; Tasks 10-12 fill in player + feedback.
 */
export default async function PromoPage(props: PageProps<"/promo/[campaignId]">) {
  const { campaignId } = await props.params;
  const searchParams = await props.searchParams;
  const queryToken = typeof searchParams.token === "string" ? searchParams.token : null;

  // ── Determine access ──────────────────────────────────────────────────
  let distributionId: string | null = null;
  let feedbackSubmitted = false;
  let hasDownloaded = false;
  let accessError: "not_found" | "expired" | "wrong_campaign" | null = null;

  if (queryToken) {
    // Verify token from URL
    const result = await verifyDeliveryToken(queryToken, campaignId);

    if (result.valid) {
      distributionId = result.distribution.id;
      feedbackSubmitted = result.distribution.feedbackSubmitted;
      hasDownloaded = result.distribution.hasDownloaded;

      // Set the session cookie so subsequent navigations don't need the token
      await setPromoSession(campaignId, queryToken);

      // Log open — do it inline (Server Component) for simplicity
      // The API route handles idempotency; here we just ensure the cookie is set
    } else {
      accessError = result.reason;
    }
  } else {
    // No token in URL — check for existing promo session cookie
    const session = await getPromoSession(campaignId);

    if (session) {
      distributionId = session.id;
      feedbackSubmitted = session.feedbackSubmitted;
      hasDownloaded = session.hasDownloaded;
    } else {
      accessError = "not_found";
    }
  }

  // ── Load campaign + tracks (only if access is valid) ─────────────────
  if (accessError || !distributionId) {
    return <TokenErrorPage reason={accessError ?? "not_found"} />;
  }

  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
  });

  if (!campaign) {
    return <TokenErrorPage reason="not_found" />;
  }

  const campaignTracks = await db.query.tracks.findMany({
    where: eq(tracks.campaignId, campaignId),
    orderBy: [asc(tracks.position)],
  });

  // Only show tracks that are ready (have a previewKey)
  const readyTracks = campaignTracks.filter((t) => t.processingStatus === "ready");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <span className="text-xs font-bold tracking-widest text-violet-400 uppercase">
          PromoVault
        </span>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        {/* Campaign info */}
        <div className="mb-8 space-y-2">
          <h1 className="text-3xl font-bold text-white">{campaign.title}</h1>
          <p className="text-lg text-zinc-400">{campaign.artistName}</p>
          {campaign.catalogNumber && (
            <p className="text-sm text-zinc-500">{campaign.catalogNumber}</p>
          )}
          {campaign.releaseDate && (
            <p className="text-sm text-zinc-500">
              Release:{" "}
              {new Date(campaign.releaseDate).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          )}
          {campaign.description && (
            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4">
              <h2 className="mb-2 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                Press Release
              </h2>
              <p className="whitespace-pre-wrap text-sm text-zinc-300">{campaign.description}</p>
            </div>
          )}
        </div>

        {/* Track list + feedback gate — Client Component handles interactivity */}
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
        />

        {readyTracks.length === 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <p className="text-sm text-zinc-500">
              Audio files are being processed. Check back shortly.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function TokenErrorPage({ reason }: { reason: "not_found" | "expired" | "wrong_campaign" }) {
  const messages: Record<string, { title: string; body: string }> = {
    not_found: {
      title: "Link not found",
      body: "This promo link is invalid. Please check your email for the correct link.",
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      <div className="max-w-sm text-center">
        <span className="mb-6 block text-xs font-bold tracking-widest text-violet-400 uppercase">
          PromoVault
        </span>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="mt-3 text-sm text-zinc-400">{body}</p>
      </div>
    </div>
  );
}
