/**
 * Simple in-memory rate limiter using a sliding-window counter.
 *
 * Purpose: protect public token-access endpoints from brute-force attempts.
 * Each key (IP address) gets a maximum of `maxRequests` requests per
 * `windowMs` milliseconds.
 *
 * This in-process Map is sufficient for a single-process deployment (Vercel
 * serverless functions are single-instance per invocation but warm instances
 * persist state). For multi-instance deployments, replace with a Redis-backed
 * implementation.
 *
 * Usage:
 *   const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 20 })
 *   if (!limiter.check(ip)) return 429
 */

interface RateLimiterOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Max requests per window per key */
  maxRequests: number;
}

interface RequestRecord {
  count: number;
  windowStart: number;
}

export class RateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly store = new Map<string, RequestRecord>();

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
  }

  /**
   * Check if `key` is within rate limits.
   * Returns true if the request is allowed, false if it should be rejected.
   * Side effect: increments the counter for this key.
   */
  check(key: string): boolean {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record || now - record.windowStart >= this.windowMs) {
      // New window
      this.store.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (record.count >= this.maxRequests) {
      return false;
    }

    record.count++;
    return true;
  }

  /** Return remaining requests in the current window for a key */
  remaining(key: string): number {
    const now = Date.now();
    const record = this.store.get(key);
    if (!record || now - record.windowStart >= this.windowMs) return this.maxRequests;
    return Math.max(0, this.maxRequests - record.count);
  }
}

/** Singleton limiter for the promo token access endpoint */
export const promoTokenLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 20,
});

/** Limiter for stream (audio player) — generous but prevents scraping */
export const promoStreamLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60, // 60 stream requests/min — enough for normal playback
});

/** Limiter for download — strict: feedback required anyway, but cap abuse */
export const promoDownloadLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 20,
});

/** Limiter for feedback submission */
export const promoFeedbackLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
});

/** Limiter for storage upload-url — one presigned URL per track upload */
export const storageUploadLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
});
