import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * A Campaign (Promo) is the meta-container for a release.
 * One campaign belongs to one label user and contains many tracks.
 */
export const campaigns = pgTable("campaigns", {
  id: text("id").primaryKey(),
  // The label user who created this campaign
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  catalogNumber: text("catalog_number"),
  artistName: text("artist_name").notNull(),
  artworkUrl: text("artwork_url"), // R2 object key, NOT a public URL
  description: text("description"), // press release / notes
  releaseDate: timestamp("release_date", { mode: "date" }),
  expiryDate: timestamp("expiry_date", { mode: "date" }),
  // "draft" | "scheduled" | "active" | "expired"
  status: text("status", { enum: ["draft", "scheduled", "active", "expired"] })
    .notNull()
    .default("draft"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Individual tracks belonging to a campaign.
 * originalKey: R2 key of the source WAV (private bucket)
 * previewKey:  R2 key of the 128kbps MP3 (private bucket, stream-only)
 */
export const tracks = pgTable("tracks", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  // Display order within the campaign (1-indexed)
  position: integer("position").notNull().default(1),
  title: text("title").notNull(),
  artistName: text("artist_name").notNull(),
  mixVersion: text("mix_version"), // e.g. "Original Mix", "Dub"
  isrc: text("isrc"),
  bpm: integer("bpm"),
  musicalKey: text("musical_key"), // e.g. "Am", "F#"
  // Storage keys (never public URLs)
  originalKey: text("original_key"), // WAV in private bucket
  previewKey: text("preview_key"), // 128k MP3 in previews bucket
  fileSizeBytes: text("file_size_bytes"),
  // "pending" | "processing" | "ready" | "failed"
  processingStatus: text("processing_status", {
    enum: ["pending", "processing", "ready", "failed"],
  })
    .notNull()
    .default("pending"),
  processingError: text("processing_error"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
