import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Plan definitions (enforced in Server Actions, not just UI):
 *
 * free:  4 active campaigns · 100 contacts · 2 GB storage
 * pro:   20 active campaigns · unlimited contacts · 15 GB storage · $19/mo
 * label: unlimited campaigns · unlimited contacts · 50 GB storage · $49/mo
 *
 * storageQuotaBytes is set per-plan and enforced before every upload.
 * activeCampaignLimit: null = unlimited.
 * contactLimit: null = unlimited.
 */
export const PLAN_LIMITS = {
  free:  { activeCampaigns: 4,    contacts: 100,  storageBytes: 2  * 1024 ** 3 },
  pro:   { activeCampaigns: 20,   contacts: null, storageBytes: 15 * 1024 ** 3 },
  label: { activeCampaigns: null, contacts: null, storageBytes: 50 * 1024 ** 3 },
} as const;

export type PlanTier = keyof typeof PLAN_LIMITS;

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),

  // Label / sender info
  labelName: text("label_name"),
  labelWebsite: text("label_website"),

  // DJ / receiver info
  djAlias: text("dj_alias"),
  djGenres: text("dj_genres"),

  // Workspace switcher
  activeWorkspace: text("active_workspace", { enum: ["label", "dj"] })
    .notNull()
    .default("label"),

  // ── Plan / billing ──────────────────────────────────────────────────────
  // planTier: current subscription tier
  planTier: text("plan_tier", { enum: ["free", "pro", "label"] })
    .notNull()
    .default("free"),

  // Stripe subscription id (null for free)
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeCustomerId: text("stripe_customer_id"),
  // When the current billing period ends (null for free / lifetime)
  planExpiresAt: timestamp("plan_expires_at", { mode: "date" }),

  // ── Storage tracking ─────────────────────────────────────────────────
  // storageQuotaBytes: set from PLAN_LIMITS on plan change
  storageQuotaBytes: text("storage_quota_bytes")
    .notNull()
    .default(String(PLAN_LIMITS.free.storageBytes)),
  storageUsedBytes: text("storage_used_bytes").notNull().default("0"),

  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// ── Auth.js required tables ────────────────────────────────────────────────
export const accounts = pgTable("accounts", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  refresh_token: text("refresh_token"),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  access_token: text("access_token"),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  expires_at: integer("expires_at"),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  token_type: text("token_type"),
  scope: text("scope"),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  id_token: text("id_token"),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  session_state: text("session_state"),
});

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const authenticators = pgTable("authenticators", {
  credentialID: text("credential_id").notNull().unique(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  providerAccountId: text("provider_account_id").notNull(),
  credentialPublicKey: text("credential_public_key").notNull(),
  counter: integer("counter").notNull(),
  credentialDeviceType: text("credential_device_type").notNull(),
  credentialBackedUp: boolean("credential_backed_up").notNull(),
  transports: text("transports"),
});
