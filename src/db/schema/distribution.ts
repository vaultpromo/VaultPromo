import { pgTable, text, timestamp, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";
import { campaigns } from "./campaigns";
import { contacts } from "./contacts";

/**
 * Campaign_Distribution — the junction between a Campaign and a Contact.
 *
 * Each row represents ONE delivery of a campaign to ONE contact.
 * The delivery_token is a cryptographically random string that acts as
 * a passwordless auth mechanism for the recipient.
 *
 * URL pattern: /promo/[campaignId]?token=[deliveryToken]
 */
export const campaignDistributions = pgTable(
  "campaign_distributions",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    // Unique per row — used as the passwordless link token
    deliveryToken: text("delivery_token").notNull(),
    // Tracking timestamps
    emailSentAt: timestamp("email_sent_at", { mode: "date" }),
    emailOpenedAt: timestamp("email_opened_at", { mode: "date" }),
    lastAccessedAt: timestamp("last_accessed_at", { mode: "date" }),
    // Has the contact submitted feedback?
    feedbackSubmitted: boolean("feedback_submitted").notNull().default(false),
    // Has the contact downloaded at least one file?
    hasDownloaded: boolean("has_downloaded").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    // Token lookups must be fast and unique
    uniqueIndex("campaign_distributions_token_idx").on(table.deliveryToken),
    // One contact can only be in a campaign once
    uniqueIndex("campaign_distributions_campaign_contact_idx").on(
      table.campaignId,
      table.contactId,
    ),
    // Fast lookups by campaign
    index("campaign_distributions_campaign_idx").on(table.campaignId),
  ],
);

/**
 * Feedback — one row per contact per campaign.
 * The "Feedback Gate": submitted feedback unlocks downloads.
 *
 * minCommentLength is enforced at the application layer (default 10 chars)
 * to prevent placeholder submissions.
 */
export const feedback = pgTable(
  "feedback",
  {
    id: text("id").primaryKey(),
    distributionId: text("distribution_id")
      .notNull()
      .references(() => campaignDistributions.id, { onDelete: "cascade" }),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    // Quantitative: 1–5 stars
    rating: text("rating", { enum: ["1", "2", "3", "4", "5"] }).notNull(),
    // Qualitative: free-text comment (min length enforced in app)
    comment: text("comment").notNull(),
    // Which track was the favourite of the release
    favoriteTrackId: text("favorite_track_id"),
    // Engagement flags (updated server-side, not from form)
    hasDownloaded: boolean("has_downloaded").notNull().default(false),
    submittedAt: timestamp("submitted_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    // One feedback submission per contact per campaign
    uniqueIndex("feedback_campaign_contact_idx").on(table.campaignId, table.contactId),
    index("feedback_campaign_idx").on(table.campaignId),
  ],
);
