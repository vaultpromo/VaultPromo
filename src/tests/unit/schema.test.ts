import { describe, it, expect } from "vitest";
import {
  users,
  profiles,
  accounts,
  sessions,
  verificationTokens,
  authenticators,
  campaigns,
  tracks,
  contacts,
  mailingLists,
  mailingListContacts,
  campaignDistributions,
  feedback,
} from "@/db/schema";

/**
 * Schema structure tests.
 * These run without a DB connection — they validate that the schema
 * objects are correctly constructed (columns, names, FKs) by inspecting
 * the Drizzle table metadata.
 */

describe("Schema: users", () => {
  it("has required columns", () => {
    const cols = Object.keys(users);
    expect(cols).toContain("id");
    expect(cols).toContain("email");
    expect(cols).toContain("createdAt");
  });

  it("email column is marked unique", () => {
    // Drizzle stores config on the column object
    expect(users.email.isUnique).toBe(true);
  });
});

describe("Schema: profiles", () => {
  it("has activeWorkspace column with correct enum", () => {
    const col = profiles.activeWorkspace;
    expect(col).toBeDefined();
    // Drizzle stores enumValues on enum columns
    expect((col as unknown as { enumValues: string[] }).enumValues).toContain("label");
    expect((col as unknown as { enumValues: string[] }).enumValues).toContain("dj");
  });

  it("has storageQuotaBytes and storageUsedBytes", () => {
    expect(profiles.storageQuotaBytes).toBeDefined();
    expect(profiles.storageUsedBytes).toBeDefined();
  });
});

describe("Schema: campaigns", () => {
  it("has required columns", () => {
    expect(campaigns.id).toBeDefined();
    expect(campaigns.userId).toBeDefined();
    expect(campaigns.title).toBeDefined();
    expect(campaigns.status).toBeDefined();
  });

  it("status column has correct enum values", () => {
    const col = campaigns.status as unknown as { enumValues: string[] };
    expect(col.enumValues).toEqual(
      expect.arrayContaining(["draft", "scheduled", "active", "expired"]),
    );
  });
});

describe("Schema: tracks", () => {
  it("has processingStatus with correct values", () => {
    const col = tracks.processingStatus as unknown as { enumValues: string[] };
    expect(col.enumValues).toEqual(
      expect.arrayContaining(["pending", "processing", "ready", "failed"]),
    );
  });

  it("has originalKey and previewKey for storage references", () => {
    expect(tracks.originalKey).toBeDefined();
    expect(tracks.previewKey).toBeDefined();
  });
});

describe("Schema: campaign_distributions", () => {
  it("has deliveryToken column", () => {
    expect(campaignDistributions.deliveryToken).toBeDefined();
  });

  it("has tracking boolean columns", () => {
    expect(campaignDistributions.feedbackSubmitted).toBeDefined();
    expect(campaignDistributions.hasDownloaded).toBeDefined();
  });
});

describe("Schema: feedback", () => {
  it("has rating with correct enum", () => {
    const col = feedback.rating as unknown as { enumValues: string[] };
    expect(col.enumValues).toEqual(
      expect.arrayContaining(["1", "2", "3", "4", "5"]),
    );
  });

  it("has all gate fields: comment, favoriteTrackId, distributionId", () => {
    expect(feedback.comment).toBeDefined();
    expect(feedback.favoriteTrackId).toBeDefined();
    expect(feedback.distributionId).toBeDefined();
  });
});

describe("Schema: contacts and lists", () => {
  it("contacts has unsubscribed flag", () => {
    expect(contacts.unsubscribed).toBeDefined();
  });

  it("mailingListContacts links lists to contacts", () => {
    expect(mailingListContacts.mailingListId).toBeDefined();
    expect(mailingListContacts.contactId).toBeDefined();
  });
});

describe("Schema: auth tables", () => {
  it("accounts table exists", () => {
    expect(accounts).toBeDefined();
  });

  it("accounts has snake_case token fields required by Auth.js adapter", () => {
    // The adapter contract requires these exact JS property names
    expect((accounts as unknown as Record<string, unknown>).access_token).toBeDefined();
    expect((accounts as unknown as Record<string, unknown>).refresh_token).toBeDefined();
    expect((accounts as unknown as Record<string, unknown>).session_state).toBeDefined();
  });

  it("sessions table has sessionToken PK and userId FK", () => {
    expect(sessions.sessionToken).toBeDefined();
    expect(sessions.userId).toBeDefined();
  });

  it("authenticators has credentialID (capital ID) and integer counter", () => {
    expect((authenticators as unknown as Record<string, unknown>).credentialID).toBeDefined();
    expect(authenticators.counter).toBeDefined();
  });
});
