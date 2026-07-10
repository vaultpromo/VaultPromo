import { describe, it, expect } from "vitest";
import { injectWatermark, readWatermark } from "@/lib/watermark/id3-watermark";

/**
 * Watermark tests.
 *
 * node-id3 writes/reads ID3v2.3 tags. We test with a minimal
 * synthesized buffer that already has an ID3 header, or let
 * node-id3 create one fresh if the buffer has no tags.
 */

const OPTIONS = {
  recipientEmail: "dj@techno.com",
  distributionId: "dist-abc-123",
  campaignTitle: "Void Sequence VA001",
  trackTitle: "Sector Zero",
};

describe("injectWatermark", () => {
  it("returns a Buffer", () => {
    const input = Buffer.from("RIFF fake wav data");
    const result = injectWatermark(input, OPTIONS);
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it("returns a non-empty buffer", () => {
    const input = Buffer.from("RIFF fake wav data");
    const result = injectWatermark(input, OPTIONS);
    expect(result.length).toBeGreaterThan(0);
  });

  it("does not mutate the original buffer", () => {
    const input = Buffer.from("RIFF original data");
    const originalCopy = Buffer.from(input);
    injectWatermark(input, OPTIONS);
    expect(input.equals(originalCopy)).toBe(true);
  });

  it("produces a different buffer than the input", () => {
    const input = Buffer.from("RIFF fake wav data");
    const result = injectWatermark(input, OPTIONS);
    // The watermarked buffer will have ID3 tags prepended — different from input
    expect(result.equals(input)).toBe(false);
  });
});

describe("readWatermark", () => {
  it("reads back the injected email and distributionId", () => {
    const input = Buffer.from("RIFF fake wav data");
    const watermarked = injectWatermark(input, OPTIONS);
    const read = readWatermark(watermarked);

    expect(read).not.toBeNull();
    expect(read?.recipientEmail).toBe("dj@techno.com");
    expect(read?.distributionId).toBe("dist-abc-123");
  });

  it("returns null for a buffer with no watermark tags", () => {
    const plain = Buffer.from("RIFF some audio data without any tags");
    const result = readWatermark(plain);
    expect(result).toBeNull();
  });

  it("round-trips correctly with different email addresses", () => {
    const emails = ["label@impcore.dev", "user+test@sub.domain.com", "dj@techno.com"];
    for (const email of emails) {
      const input = Buffer.from("RIFF data");
      const watermarked = injectWatermark(input, { ...OPTIONS, recipientEmail: email });
      const read = readWatermark(watermarked);
      expect(read?.recipientEmail).toBe(email);
    }
  });
});

describe("Promo status derivation", () => {
  type Status = "pending" | "reviewed" | "expired";

  function deriveStatus(feedbackSubmitted: boolean, expiryDate: Date | null): Status {
    if (expiryDate && expiryDate < new Date()) return "expired";
    if (feedbackSubmitted) return "reviewed";
    return "pending";
  }

  it("returns pending when no feedback and not expired", () => {
    expect(deriveStatus(false, null)).toBe("pending");
  });

  it("returns reviewed when feedback submitted and not expired", () => {
    expect(deriveStatus(true, null)).toBe("reviewed");
  });

  it("returns expired when past expiry date regardless of feedback", () => {
    const pastDate = new Date("2020-01-01");
    expect(deriveStatus(false, pastDate)).toBe("expired");
    expect(deriveStatus(true, pastDate)).toBe("expired");
  });

  it("returns pending for future expiry with no feedback", () => {
    const futureDate = new Date("2099-01-01");
    expect(deriveStatus(false, futureDate)).toBe("pending");
  });

  it("returns reviewed for future expiry with feedback", () => {
    const futureDate = new Date("2099-01-01");
    expect(deriveStatus(true, futureDate)).toBe("reviewed");
  });
});

describe("Funnel metric percentages", () => {
  function pct(n: number, d: number): string {
    if (d === 0) return "—";
    return `${Math.round((n / d) * 100)}%`;
  }

  it("returns em-dash when denominator is 0", () => {
    expect(pct(0, 0)).toBe("—");
    expect(pct(5, 0)).toBe("—");
  });

  it("calculates 50%", () => {
    expect(pct(10, 20)).toBe("50%");
  });

  it("rounds correctly", () => {
    expect(pct(1, 3)).toBe("33%");
    expect(pct(2, 3)).toBe("67%");
  });

  it("returns 100% when all converted", () => {
    expect(pct(100, 100)).toBe("100%");
  });
});
