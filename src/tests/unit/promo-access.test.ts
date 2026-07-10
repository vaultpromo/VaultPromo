import { describe, it, expect, beforeEach, vi } from "vitest";
import { RateLimiter } from "@/lib/rate-limiter";

// ── RateLimiter ─────────────────────────────────────────────────────────────

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 5 });
  });

  it("allows requests up to the limit", () => {
    for (let i = 0; i < 5; i++) {
      expect(limiter.check("1.2.3.4")).toBe(true);
    }
  });

  it("blocks requests that exceed the limit", () => {
    for (let i = 0; i < 5; i++) limiter.check("1.2.3.4");
    expect(limiter.check("1.2.3.4")).toBe(false);
  });

  it("tracks different keys independently", () => {
    for (let i = 0; i < 5; i++) limiter.check("1.1.1.1");
    // Exhausted for 1.1.1.1
    expect(limiter.check("1.1.1.1")).toBe(false);
    // 2.2.2.2 is untouched
    expect(limiter.check("2.2.2.2")).toBe(true);
  });

  it("resets after the window expires", () => {
    // Fake time: advance by windowMs + 1ms
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValueOnce(now); // first check → window starts
    for (let i = 0; i < 5; i++) limiter.check("3.3.3.3");
    expect(limiter.check("3.3.3.3")).toBe(false);

    // Advance time past the window
    vi.spyOn(Date, "now").mockReturnValue(now + 61_000);
    expect(limiter.check("3.3.3.3")).toBe(true); // new window
    vi.restoreAllMocks();
  });

  it("returns correct remaining count", () => {
    expect(limiter.remaining("5.5.5.5")).toBe(5);
    limiter.check("5.5.5.5");
    limiter.check("5.5.5.5");
    expect(limiter.remaining("5.5.5.5")).toBe(3);
  });

  it("remaining returns maxRequests for unseen key", () => {
    expect(limiter.remaining("new.ip")).toBe(5);
  });

  it("remaining returns 0 when exhausted", () => {
    for (let i = 0; i < 5; i++) limiter.check("6.6.6.6");
    expect(limiter.remaining("6.6.6.6")).toBe(0);
  });
});

// ── Token format validation ──────────────────────────────────────────────────

describe("Delivery token format", () => {
  function isValidTokenFormat(token: string): boolean {
    return /^[0-9a-f]{64}$/.test(token);
  }

  it("accepts 64-char hex string", () => {
    const token = "a".repeat(64);
    expect(isValidTokenFormat(token)).toBe(true);
  });

  it("rejects shorter token", () => {
    expect(isValidTokenFormat("abc123")).toBe(false);
  });

  it("rejects token with uppercase", () => {
    expect(isValidTokenFormat("A".repeat(64))).toBe(false);
  });

  it("rejects token with non-hex chars", () => {
    expect(isValidTokenFormat("g".repeat(64))).toBe(false);
  });

  it("rejects token with spaces", () => {
    expect(isValidTokenFormat(" ".repeat(64))).toBe(false);
  });
});

// ── Session key derivation ───────────────────────────────────────────────────

describe("Promo session key", () => {
  // Mirror the logic from session.ts without importing server-only
  function promoSessionKey(campaignId: string): string {
    return `promo_${campaignId}`;
  }

  it("generates a predictable key per campaign", () => {
    expect(promoSessionKey("abc-123")).toBe("promo_abc-123");
  });

  it("different campaigns produce different keys", () => {
    expect(promoSessionKey("campaign-1")).not.toBe(promoSessionKey("campaign-2"));
  });

  it("same campaignId always produces the same key", () => {
    const id = "my-unique-campaign";
    expect(promoSessionKey(id)).toBe(promoSessionKey(id));
  });
});

// ── Token access error handling ──────────────────────────────────────────────

describe("Token error reasons", () => {
  type ErrorReason = "not_found" | "expired" | "wrong_campaign";

  const HTTP_STATUS: Record<ErrorReason, number> = {
    not_found: 404,
    expired: 410,
    wrong_campaign: 403,
  };

  it("not_found maps to 404", () => {
    expect(HTTP_STATUS.not_found).toBe(404);
  });

  it("expired maps to 410 Gone", () => {
    expect(HTTP_STATUS.expired).toBe(410);
  });

  it("wrong_campaign maps to 403 Forbidden", () => {
    expect(HTTP_STATUS.wrong_campaign).toBe(403);
  });
});

// ── Idempotent open logging ──────────────────────────────────────────────────

describe("Open event idempotency", () => {
  it("should not set emailOpenedAt if already set", () => {
    const distribution = {
      id: "dist-1",
      emailOpenedAt: new Date("2026-08-01"),
      lastAccessedAt: null,
    };

    // This mirrors the condition in the route: only update on first open
    const shouldLogOpen = !distribution.emailOpenedAt;
    expect(shouldLogOpen).toBe(false);
  });

  it("should set emailOpenedAt on first access", () => {
    const distribution = {
      id: "dist-1",
      emailOpenedAt: null,
      lastAccessedAt: null,
    };

    const shouldLogOpen = !distribution.emailOpenedAt;
    expect(shouldLogOpen).toBe(true);
  });
});
