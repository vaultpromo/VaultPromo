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

export function FeedbackForm({ campaignId, distributionId, tracks, onSubmitted }: FeedbackFormProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [favoriteTrackId, setFavoriteTrackId] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const [reviewerName, setReviewerName] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  const commentValid = comment.trim().length >= MIN_COMMENT_LENGTH;
  const nameValid = reviewerName.trim().length >= 2;
  const formValid = rating > 0 && favoriteTrackId !== "" && commentValid && nameValid;

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
          reviewerName: reviewerName.trim(),
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

  const RATING_LABELS = ["", "Not for me", "Below average", "Good", "Really good", "Outstanding"];

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>

      {/* Name */}
      <div className="space-y-1.5">
        <label htmlFor="reviewer-name" className="block text-sm font-semibold text-white/80">
          Your name or alias <span className="text-red-400">*</span>
        </label>
        <input
          id="reviewer-name"
          type="text"
          value={reviewerName}
          onChange={(e) => setReviewerName(e.target.value)}
          placeholder="DJ Alias / Full Name"
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/20 focus:border-white/20 focus:outline-none"
        />
        {reviewerName.length > 0 && !nameValid && (
          <p className="text-xs text-red-400">At least 2 characters required</p>
        )}
      </div>

      {/* Star rating */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-white/80">
          Overall rating <span className="text-red-400">*</span>
        </label>
        <div
          className="flex gap-1.5"
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
                (hoverRating || rating) >= star ? "text-amber-400" : "text-white/10"
              }`}
            >
              ★
            </button>
          ))}
        </div>
        {rating > 0 && (
          <p className="text-xs text-white/30">{RATING_LABELS[rating]}</p>
        )}
      </div>

      {/* Favorite track */}
      <div className="space-y-2">
        <fieldset>
          <legend className="mb-2 block text-sm font-semibold text-white/80">
            Favorite track <span className="text-red-400">*</span>
          </legend>
          <div className="space-y-1.5">
            {tracks.map((track) => (
              <label
                key={track.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                  favoriteTrackId === track.id
                    ? "border-white/20 bg-white/[0.06]"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]"
                }`}
              >
                <input
                  type="radio"
                  name="favoriteTrack"
                  value={track.id}
                  checked={favoriteTrackId === track.id}
                  onChange={() => setFavoriteTrackId(track.id)}
                  className="accent-white"
                />
                <span className="text-sm text-white/80">
                  {track.title}
                  {track.mixVersion && (
                    <span className="ml-1.5 text-xs text-white/30">{track.mixVersion}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {/* Comment */}
      <div className="space-y-1.5">
        <label htmlFor="feedback-comment" className="block text-sm font-semibold text-white/80">
          Your thoughts <span className="text-red-400">*</span>
          <span className="ml-2 text-xs font-normal text-white/25">
            min {MIN_COMMENT_LENGTH} characters
          </span>
        </label>
        <textarea
          id="feedback-comment"
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="How does it fit your sets? What's the energy? Where would you play it?"
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/90 placeholder-white/15 focus:border-white/20 focus:outline-none"
        />
        <p className={`text-xs ${commentValid ? "text-emerald-400" : "text-white/20"}`}>
          {comment.trim().length}/{MIN_COMMENT_LENGTH}
          {commentValid && " ✓"}
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!formValid || submitting}
        className="w-full rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-30"
      >
        {submitting ? "Submitting…" : "Submit & unlock downloads"}
      </button>

      {!formValid && (
        <p className="text-center text-xs text-white/15">
          Fill in all fields above to unlock downloads
        </p>
      )}
    </form>
  );
}
