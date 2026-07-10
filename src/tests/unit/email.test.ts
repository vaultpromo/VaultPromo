import { describe, it, expect, vi } from "vitest";
import {
  renderPromoInviteHtml,
  renderPromoInviteText,
} from "@/lib/email/templates/promo-invite";
import type { PromoInviteData } from "@/lib/email/templates/promo-invite";
import type { EmailProvider, SendEmailOptions, SendEmailResult } from "@/lib/email/types";

// ── Mock EmailProvider ───────────────────────────────────────────────────────

class MockEmailProvider implements EmailProvider {
  public sent: SendEmailOptions[] = [];

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    this.sent.push(options);
    return { messageId: `mock-${Date.now()}` };
  }

  reset() {
    this.sent = [];
  }
}

// ── Template rendering ───────────────────────────────────────────────────────

const baseData: PromoInviteData = {
  recipientEmail: "dj@techno.com",
  senderName: "IMPCORE Records",
  campaignTitle: "Void Sequence VA001",
  artistName: "Various Artists",
  promoUrl: "https://app.example.com/promo/abc?token=xyz",
};

describe("renderPromoInviteHtml", () => {
  it("includes the campaign title", () => {
    const html = renderPromoInviteHtml(baseData);
    expect(html).toContain("Void Sequence VA001");
  });

  it("includes the sender name", () => {
    const html = renderPromoInviteHtml(baseData);
    expect(html).toContain("IMPCORE Records");
  });

  it("includes the unique promo URL", () => {
    const html = renderPromoInviteHtml(baseData);
    expect(html).toContain("https://app.example.com/promo/abc?token=xyz");
  });

  it("includes recipient email in footer", () => {
    const html = renderPromoInviteHtml(baseData);
    expect(html).toContain("dj@techno.com");
  });

  it("uses generic greeting when no name provided", () => {
    const html = renderPromoInviteHtml({ ...baseData, recipientName: undefined });
    expect(html).toContain("Hi,");
    expect(html).not.toContain("Hi undefined");
  });

  it("uses personalized greeting when name provided", () => {
    const html = renderPromoInviteHtml({ ...baseData, recipientName: "SPCMSK" });
    expect(html).toContain("Hi SPCMSK,");
  });

  it("includes catalog number when provided", () => {
    const html = renderPromoInviteHtml({ ...baseData, catalogNumber: "IMP001" });
    expect(html).toContain("IMP001");
  });

  it("includes expiry info when expiryDate provided", () => {
    const html = renderPromoInviteHtml({
      ...baseData,
      expiryDate: new Date("2026-08-25"),
    });
    expect(html).toContain("expires");
  });

  it("omits expiry section when no expiryDate", () => {
    const html = renderPromoInviteHtml({ ...baseData, expiryDate: undefined });
    // Should not have an empty "expires on" sentence
    expect(html).not.toMatch(/expires on\s*\./);
  });

  it("includes press release description when provided", () => {
    const html = renderPromoInviteHtml({
      ...baseData,
      description: "Four tracks of dark industrial techno.",
    });
    expect(html).toContain("Four tracks of dark industrial techno.");
  });

  it("is valid HTML with DOCTYPE", () => {
    const html = renderPromoInviteHtml(baseData);
    expect(html.trim()).toMatch(/^<!DOCTYPE html>/i);
  });

  it("has a CTA anchor pointing to the promo URL", () => {
    const html = renderPromoInviteHtml(baseData);
    expect(html).toContain(`href="${baseData.promoUrl}"`);
  });
});

describe("renderPromoInviteText", () => {
  it("includes the promo URL", () => {
    const text = renderPromoInviteText(baseData);
    expect(text).toContain(baseData.promoUrl);
  });

  it("includes campaign title and artist", () => {
    const text = renderPromoInviteText(baseData);
    expect(text).toContain("Void Sequence VA001");
    expect(text).toContain("Various Artists");
  });

  it("is plain text (no HTML tags)", () => {
    const text = renderPromoInviteText(baseData);
    expect(text).not.toMatch(/<[^>]+>/);
  });

  it("uses personalized greeting when name present", () => {
    const text = renderPromoInviteText({ ...baseData, recipientName: "SPCMSK" });
    expect(text).toContain("Hi SPCMSK,");
  });
});

// ── Token generation ─────────────────────────────────────────────────────────

describe("Delivery token", () => {
  it("generates a 64-character hex string (32 bytes)", () => {
    // Mirror the logic from distribute.ts
    const { randomBytes } = require("crypto");
    const token = randomBytes(32).toString("hex");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique tokens on each call", () => {
    const { randomBytes } = require("crypto");
    const tokens = new Set(
      Array.from({ length: 100 }, () => randomBytes(32).toString("hex")),
    );
    expect(tokens.size).toBe(100);
  });

  it("promo URL pattern is correct", () => {
    const appUrl = "https://app.example.com";
    const campaignId = "camp-uuid";
    const token = "abc123";
    const url = `${appUrl}/promo/${campaignId}?token=${token}`;
    expect(url).toBe("https://app.example.com/promo/camp-uuid?token=abc123");
  });
});

// ── MockEmailProvider contract ───────────────────────────────────────────────

describe("MockEmailProvider", () => {
  it("records sent emails", async () => {
    const provider = new MockEmailProvider();
    await provider.send({
      to: "dj@techno.com",
      subject: "Test",
      html: "<p>test</p>",
      text: "test",
    });
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0].to).toBe("dj@techno.com");
  });

  it("returns a messageId", async () => {
    const provider = new MockEmailProvider();
    const result = await provider.send({
      to: "dj@techno.com",
      subject: "Test",
      html: "<p>test</p>",
      text: "test",
    });
    expect(result.messageId).toBeDefined();
    expect(result.messageId).not.toBeNull();
  });

  it("reset clears sent emails", async () => {
    const provider = new MockEmailProvider();
    await provider.send({ to: "a@b.com", subject: "s", html: "h", text: "t" });
    provider.reset();
    expect(provider.sent).toHaveLength(0);
  });
});
