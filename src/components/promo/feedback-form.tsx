"use client";

import { useState } from "react";

const MIN_COMMENT_LENGTH = 10;

interface FeedbackTrack {
  id: string;
  title: string;
  artistName: string;
  mixVersion: string | null;
}

interface FeedbackFormProps {
  campaignId: string;
  distributionId: string;
  tracks: FeedbackTrack[];
  onSubmitted: () => void;
}

export interface FeedbackData {
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  favoriteTrackId: string;
}

/**
 * The Feedback Gate form.
 *
 * Validation rules (all enforced on the client; re-enforced server-side in Task 11):
 * 1. Star rating: 1–5 (required)
 * 2. Favorite track: must select one from the list (required)
 * 3. Comment: min MIN_COMMENT_LENGTH characters (prevents "ok", ".", etc.)
 *
 * The submit button stays disabled until all three conditions are met.
 * On submit, calls POST /api/promo/feedback (Task 11).
 */
export function FeedbackForm({ campaignId, distributionId, tracks, onSubmitted }: FeedbackFormProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [favoriteTrackId, setFavoriteTrackId] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  // Form is valid when all three fields are filled
  const commentValid = comment.trim().length >= MIN_COMMENT_LENGTH;
  const formValid = rating > 0 && favoriteTrackId !== "" && commentValid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formValid || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/promo/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          distributionId,
          rating,
          favoriteTrackId,
          comment: comment.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? "Submission failed. Please try again.");
        return;
      }

      onSubmitted();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Star rating */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-zinc-200">
          Overall rating <span className="text-red-400">*</span>
        </label>
        <div
          className="flex gap-1"
          role="radiogroup"
          aria-label="Rating"
          onMouseLeave={() => setHoverRating(0)}
        >
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              aria-label={`${star} star${star !== 1 ? "s" : ""}`}
              aria-pressed={rating === star}
              className={`text-2xl transition-transform hover:scale-110 focus:outline-none ${
                (hoverRating || rating) >= star ? "text-amber-400" : "text-zinc-700"
              }`}
            >
              ★
            </button>
          ))}
        </div>
        {rating > 0 && (
          <p className="text-xs text-zinc-500">
            {["", "Not for me", "Below average", "Good", "Really good", "Outstanding"][rating]}
          </p>
        )}
      </div>

      {/* Favorite track */}
      <div className="space-y-2">
        <fieldset>
          <legend className="mb-2 block text-sm font-semibold text-zinc-200">
            Favorite track <span className="text-red-400">*</span>
          </legend>
          <div className="space-y-1.5">
            {tracks.map((track) => (
              <label
                key={track.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition ${
                  favoriteTrackId === track.id
                    ? "border-violet-500 bg-violet-900/20"
                    : "border-zinc-700 bg-zinc-900 hover:border-zinc-600"
                }`}
              >
                <input
                  type="radio"
                  name="favoriteTrack"
                  value={track.id}
                  checked={favoriteTrackId === track.id}
                  onChange={() => setFavoriteTrackId(track.id)}
                  className="accent-violet-500"
                />
                <span className="text-sm text-zinc-200">
                  {track.title}
                  {track.mixVersion && (
                    <span className="ml-1.5 text-xs text-zinc-400">{track.mixVersion}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {/* Comment */}
      <div className="space-y-1.5">
        <label htmlFor="feedback-comment" className="block text-sm font-semibold text-zinc-200">
          Your thoughts <span className="text-red-400">*</span>
          <span className="ml-2 text-xs font-normal text-zinc-500">
            (min {MIN_COMMENT_LENGTH} characters)
          </span>
        </label>
        <textarea
          id="feedback-comment"
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell the label what you think. How does it fit your sets? What mood does it create?"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
        <div className="flex items-center justify-between">
          <p className={`text-xs ${commentValid ? "text-green-400" : "text-zinc-500"}`}>
            {comment.trim().length}/{MIN_COMMENT_LENGTH} minimum characters
            {commentValid && " ✓"}
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {/* Submit — disabled until form is valid */}
      <button
        type="submit"
        disabled={!formValid || submitting}
        aria-disabled={!formValid || submitting}
        className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Submitting…" : "Submit feedback & unlock downloads"}
      </button>

      {!formValid && (
        <p className="text-center text-xs text-zinc-600">
          Complete all fields above to unlock the download button
        </p>
      )}
    </form>
  );
}
