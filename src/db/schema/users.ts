import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

/**
 * Core users table — Auth.js will store credentials here via the Drizzle adapter.
 * Each user has a single identity; they switch "workspace" (label vs DJ) via the
 * activeWorkspace field on their profile.
 */
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
 * Extended profile for each user.
 * activeWorkspace: "label" | "dj" — controls which dashboard the user sees.
 */
export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(), // same as users.id
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  // Label / sender info
  labelName: text("label_name"),
  labelWebsite: text("label_website"),
  // DJ / receiver info
  djAlias: text("dj_alias"),
  djGenres: text("dj_genres"), // comma-separated or JSON string
  // Workspace switcher
  activeWorkspace: text("active_workspace", { enum: ["label", "dj"] })
    .notNull()
    .default("label"),
  // Storage quota in bytes (default 5 GB)
  storageQuotaBytes: text("storage_quota_bytes").notNull().default("5368709120"),
  storageUsedBytes: text("storage_used_bytes").notNull().default("0"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Auth.js required tables.
 * Column names must match @auth/drizzle-adapter's DefaultPostgresAccountsTable contract:
 * - snake_case column names: refresh_token, access_token, expires_at, token_type, id_token, session_state
 * - expires_at must be PgInteger (Unix timestamp in seconds)
 * - credentialID must be uppercase "ID" in the JS key
 * - counter must be PgInteger
 */
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
  // Auth.js adapter expects this as an integer (Unix seconds)
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
  // Auth.js adapter expects the JS key to be "credentialID" (capital ID)
  credentialID: text("credential_id").notNull().unique(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  providerAccountId: text("provider_account_id").notNull(),
  credentialPublicKey: text("credential_public_key").notNull(),
  // Must be PgInteger per adapter contract
  counter: integer("counter").notNull(),
  credentialDeviceType: text("credential_device_type").notNull(),
  credentialBackedUp: boolean("credential_backed_up").notNull(),
  transports: text("transports"),
});
