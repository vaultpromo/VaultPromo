import { describe, it, expect } from "vitest";
import { campaignSchema, trackSchema } from "@/lib/validations/campaign";

describe("campaignSchema", () => {
  const valid = {
    title: "Void Sequence VA001",
    artistName: "Various Artists",
  };

  it("accepts minimal valid input", () => {
    expect(campaignSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts full valid input with optional fields", () => {
    const result = campaignSchema.safeParse({
      ...valid,
      catalogNumber: "IMP001",
      description: "Dark techno compilation",
      releaseDate: "2026-09-01",
      expiryDate: "2026-08-25",
    });
    expect(result.success).toBe(true);
  });

  it("rejects title shorter than 2 chars", () => {
    const result = campaignSchema.safeParse({ ...valid, title: "X" });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.flatten().fieldErrors.title?.[0]).toMatch(/2 characters/);
  });

  it("rejects empty artistName", () => {
    const result = campaignSchema.safeParse({ ...valid, artistName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid release date string", () => {
    const result = campaignSchema.safeParse({ ...valid, releaseDate: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("accepts undefined optional dates", () => {
    const result = campaignSchema.safeParse({ ...valid, releaseDate: undefined });
    expect(result.success).toBe(true);
  });
});

describe("trackSchema", () => {
  const valid = {
    title: "Sector Zero",
    artistName: "SPCMSK",
    position: 1,
  };

  it("accepts minimal valid track", () => {
    expect(trackSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts full track with optional fields", () => {
    const result = trackSchema.safeParse({
      ...valid,
      mixVersion: "Original Mix",
      isrc: "GBUM71234567",
      bpm: 148,
      musicalKey: "Am",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty track title", () => {
    const result = trackSchema.safeParse({ ...valid, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects BPM below 40", () => {
    const result = trackSchema.safeParse({ ...valid, bpm: 10 });
    expect(result.success).toBe(false);
  });

  it("rejects BPM above 300", () => {
    const result = trackSchema.safeParse({ ...valid, bpm: 400 });
    expect(result.success).toBe(false);
  });

  it("accepts BPM at boundaries (40 and 300)", () => {
    expect(trackSchema.safeParse({ ...valid, bpm: 40 }).success).toBe(true);
    expect(trackSchema.safeParse({ ...valid, bpm: 300 }).success).toBe(true);
  });

  it("rejects malformed ISRC", () => {
    const result = trackSchema.safeParse({ ...valid, isrc: "INVALID" });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.flatten().fieldErrors.isrc?.[0]).toMatch(/ISRC/);
  });

  it("accepts valid ISRC format", () => {
    // Format: 2 letters + 3 alphanumeric + 7 digits = 12 chars
    const result = trackSchema.safeParse({ ...valid, isrc: "GBUM71234567" });
    expect(result.success).toBe(true);
  });

  it("coerces string BPM to number", () => {
    const result = trackSchema.safeParse({ ...valid, bpm: "148" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.bpm).toBe(148);
  });

  it("defaults position to 1 if omitted", () => {
    const result = trackSchema.safeParse({ title: "Test", artistName: "DJ" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.position).toBe(1);
  });
});
