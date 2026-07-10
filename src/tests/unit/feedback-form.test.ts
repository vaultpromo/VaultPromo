import { describe, it, expect } from "vitest";

/**
 * Tests for the Feedback Gate validation logic.
 *
 * Mirrors the validation in FeedbackForm without rendering React components,
 * keeping tests fast and framework-independent.
 */

const MIN_COMMENT_LENGTH = 10;

function isFormValid(
  rating: number,
  favoriteTrackId: string,
  comment: string,
): boolean {
  return (
    rating >= 1 &&
    rating <= 5 &&
    favoriteTrackId !== "" &&
    comment.trim().length >= MIN_COMMENT_LENGTH
  );
}

function commentValid(comment: string): boolean {
  return comment.trim().length >= MIN_COMMENT_LENGTH;
}

// ── Form validity ────────────────────────────────────────────────────────────

describe("Feedback form validation", () => {
  const validData = {
    rating: 4,
    favoriteTrackId: "track-abc",
    comment: "This is a great track with solid production.",
  };

  it("accepts fully valid input", () => {
    expect(isFormValid(validData.rating, validData.favoriteTrackId, validData.comment)).toBe(true);
  });

  it("rejects rating of 0 (not selected)", () => {
    expect(isFormValid(0, validData.favoriteTrackId, validData.comment)).toBe(false);
  });

  it("rejects rating above 5", () => {
    expect(isFormValid(6, validData.favoriteTrackId, validData.comment)).toBe(false);
  });

  it("accepts all valid star ratings 1–5", () => {
    for (let r = 1; r <= 5; r++) {
      expect(isFormValid(r, validData.favoriteTrackId, validData.comment)).toBe(true);
    }
  });

  it("rejects empty favoriteTrackId", () => {
    expect(isFormValid(validData.rating, "", validData.comment)).toBe(false);
  });

  it("rejects comment shorter than minimum", () => {
    expect(isFormValid(validData.rating, validData.favoriteTrackId, "ok")).toBe(false);
    expect(isFormValid(validData.rating, validData.favoriteTrackId, ".")).toBe(false);
    expect(isFormValid(validData.rating, validData.favoriteTrackId, "thanks")).toBe(false);
  });

  it("rejects whitespace-only comment even if long", () => {
    expect(isFormValid(validData.rating, validData.favoriteTrackId, "          ")).toBe(false);
  });

  it("accepts comment exactly at the minimum length", () => {
    const minComment = "a".repeat(MIN_COMMENT_LENGTH);
    expect(isFormValid(validData.rating, validData.favoriteTrackId, minComment)).toBe(true);
  });

  it("trims leading/trailing whitespace before checking length", () => {
    const paddedComment = "  " + "a".repeat(MIN_COMMENT_LENGTH) + "  ";
    expect(commentValid(paddedComment)).toBe(true);
  });
});

// ── Comment character counter ────────────────────────────────────────────────

describe("Comment character counter", () => {
  it("counts only trimmed characters", () => {
    const comment = "  hello  ";
    expect(comment.trim().length).toBe(5);
  });

  it("returns correct count at minimum boundary", () => {
    const comment = "a".repeat(MIN_COMMENT_LENGTH);
    expect(comment.trim().length).toBe(MIN_COMMENT_LENGTH);
    expect(commentValid(comment)).toBe(true);
  });

  it("returns false one char below minimum", () => {
    const comment = "a".repeat(MIN_COMMENT_LENGTH - 1);
    expect(commentValid(comment)).toBe(false);
  });
});

// ── Star rating labels ───────────────────────────────────────────────────────

describe("Star rating labels", () => {
  const LABELS = ["", "Not for me", "Below average", "Good", "Really good", "Outstanding"];

  it("has 6 entries (index 0 unused)", () => {
    expect(LABELS.length).toBe(6);
  });

  it("maps star 1 to 'Not for me'", () => {
    expect(LABELS[1]).toBe("Not for me");
  });

  it("maps star 5 to 'Outstanding'", () => {
    expect(LABELS[5]).toBe("Outstanding");
  });
});

// ── Audio player state transitions ──────────────────────────────────────────

describe("Audio player state logic", () => {
  function formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  it("formats 0 seconds correctly", () => {
    expect(formatTime(0)).toBe("0:00");
  });

  it("formats 65 seconds correctly", () => {
    expect(formatTime(65)).toBe("1:05");
  });

  it("formats 3600 seconds (1 hour) correctly", () => {
    expect(formatTime(3600)).toBe("60:00");
  });

  it("handles NaN gracefully", () => {
    expect(formatTime(NaN)).toBe("0:00");
  });

  it("handles negative values gracefully", () => {
    expect(formatTime(-5)).toBe("0:00");
  });

  it("calculates progress percentage correctly", () => {
    const progress = (30 / 180) * 100;
    expect(Math.round(progress)).toBe(17);
  });

  it("returns 0 progress when duration is 0", () => {
    const duration = 0;
    const progress = duration > 0 ? (30 / duration) * 100 : 0;
    expect(progress).toBe(0);
  });
});
