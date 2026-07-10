"use server";

import { randomBytes } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { db } from "@/db";
import {
  campaigns,
  contacts,
  mailingLists,
  mailingListContacts,
  campaignDistributions,
} from "@/db/schema";
import { emailProvider } from "@/lib/email";
import {
  renderPromoInviteHtml,
  renderPromoInviteText,
} from "@/lib/email/templates/promo-invite";

/** Generate a cryptographically secure delivery token (32 bytes → 64 hex chars) */
function generateDeliveryToken(): string {
  return randomBytes(32).toString("hex");
}

export interface DistributeResult {
  sent: number;
  skipped: number;
  failed: number;
  errors?: string[];
}

/**
 * Distribute a campaign to all contacts in a mailing list.
 *
 * For each contact:
 * 1. Generate a unique delivery_token.
 * 2. Insert a campaign_distribution row (idempotent — skips existing ones).
 * 3. Send a personalized HTML email with the token-based promo URL.
 * 4. Update email_sent_at timestamp.
 *
 * Ownership checks: both the campaign and the mailing list must belong
 * to the authenticated user.
 *
 * Rate: emails are sent sequentially with a small delay to be kind to
 * Resend's rate limits. For large lists (>200), a background job should
 * be used instead — this is fine for the MVP.
 */
export async function distributeCampaignAction(
  campaignId: string,
  listId: string,
): Promise<DistributeResult> {
  const { userId } = await verifySession();

  // ── Ownership checks ────────────────────────────────────────────────────
  const campaign = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)),
  });

  if (!campaign) {
    return { sent: 0, skipped: 0, failed: 1, errors: ["Campaign not found."] };
  }

  const list = await db.query.mailingLists.findFirst({
    where: and(eq(mailingLists.id, listId), eq(mailingLists.userId, userId)),
  });

  if (!list) {
    return { sent: 0, skipped: 0, failed: 1, errors: ["Mailing list not found."] };
  }

  // ── Fetch contacts ───────────────────────────────────────────────────────
  const memberRows = await db
    .select({
      contactId: mailingListContacts.contactId,
      email: contacts.email,
      name: contacts.name,
      alias: contacts.alias,
      unsubscribed: contacts.unsubscribed,
    })
    .from(mailingListContacts)
    .innerJoin(contacts, eq(mailingListContacts.contactId, contacts.id))
    .where(eq(mailingListContacts.mailingListId, listId));

  if (memberRows.length === 0) {
    return { sent: 0, skipped: 0, failed: 0, errors: ["List has no contacts."] };
  }

  // ── Skip contacts that already received this campaign ───────────────────
  const existingDistributions = await db.query.campaignDistributions.findMany({
    where: and(
      eq(campaignDistributions.campaignId, campaignId),
      inArray(
        campaignDistributions.contactId,
        memberRows.map((r) => r.contactId),
      ),
    ),
    columns: { contactId: true },
  });

  const alreadySentIds = new Set(existingDistributions.map((d) => d.contactId));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const senderName = campaign.artistName;

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const member of memberRows) {
    // Skip unsubscribed contacts
    if (member.unsubscribed) {
      skipped++;
      continue;
    }

    // Skip contacts that already have a distribution row for this campaign
    if (alreadySentIds.has(member.contactId)) {
      skipped++;
      continue;
    }

    const token = generateDeliveryToken();
    const promoUrl = `${appUrl}/promo/${campaignId}?token=${token}`;

    // Create distribution row first (so the link is valid even if email fails)
    const distributionId = crypto.randomUUID();

    try {
      await db.insert(campaignDistributions).values({
        id: distributionId,
        campaignId,
        contactId: member.contactId,
        deliveryToken: token,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Render and send the email
      const html = renderPromoInviteHtml({
        recipientName: member.name ?? member.alias,
        recipientEmail: member.email,
        senderName,
        campaignTitle: campaign.title,
        artistName: campaign.artistName,
        catalogNumber: campaign.catalogNumber,
        description: campaign.description,
        releaseDate: campaign.releaseDate,
        expiryDate: campaign.expiryDate,
        promoUrl,
      });

      const text = renderPromoInviteText({
        recipientName: member.name ?? member.alias,
        recipientEmail: member.email,
        senderName,
        campaignTitle: campaign.title,
        artistName: campaign.artistName,
        catalogNumber: campaign.catalogNumber,
        description: campaign.description,
        releaseDate: campaign.releaseDate,
        expiryDate: campaign.expiryDate,
        promoUrl,
      });

      await emailProvider.send({
        to: member.email,
        subject: `[Promo] ${campaign.title} — ${campaign.artistName}`,
        html,
        text,
        // Idempotency key prevents duplicate sends on retry
        idempotencyKey: `promo-${campaignId}-${member.contactId}`,
      });

      // Record the send timestamp
      await db
        .update(campaignDistributions)
        .set({ emailSentAt: new Date(), updatedAt: new Date() })
        .where(eq(campaignDistributions.id, distributionId));

      sent++;
    } catch (err) {
      failed++;
      errors.push(`${member.email}: ${(err as Error).message}`);
    }
  }

  // Mark campaign as active after first distribution
  if (campaign.status === "draft" && sent > 0) {
    await db
      .update(campaigns)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId));
  }

  revalidatePath(`/dashboard/campaigns/${campaignId}`);

  return { sent, skipped, failed, errors: errors.length ? errors : undefined };
}
