import "server-only";
import { PgBoss } from "pg-boss";

/**
 * Singleton pg-boss instance.
 *
 * pg-boss uses Neon Postgres as its backing store — no extra infra needed.
 * The schema is created automatically on first start().
 *
 * In Next.js server-side code (Route Handlers, Server Actions), we call
 * getQueue() to get the shared instance. We do NOT .start() a worker
 * inside Next.js — that lives in the Lambda container.
 *
 * Lazy singleton pattern to avoid reconnecting on every hot-reload in dev.
 */

declare global {
  // eslint-disable-next-line no-var
  var __pgBoss: PgBoss | undefined;
}

let bossPromise: Promise<PgBoss> | null = null;

export async function getQueue(): Promise<PgBoss> {
  if (global.__pgBoss) return global.__pgBoss;

  if (!bossPromise) {
    bossPromise = (async () => {
      const boss = new PgBoss({
        connectionString: process.env.DATABASE_URL!,
        // Keep schema separate from app tables
        schema: "pgboss",
        // Maintenance runs in the Lambda, not Next.js
        supervise: false,
      });

      await boss.start();
      global.__pgBoss = boss;
      return boss;
    })();
  }

  return bossPromise;
}

/** Queue name constants — single source of truth */
export const QUEUES = {
  AUDIO_TRANSCODE: "audio-transcode",
} as const;

/** Job payload shape */
export interface TranscodeJobData {
  trackId: string;
  campaignId: string;
  originalKey: string;        // R2 key in the originals bucket
  previewKey: string;         // R2 key destination in the previews bucket
  callbackUrl: string;        // Webhook URL Lambda calls when done
}

export interface TranscodeJobResult {
  success: boolean;
  previewKey?: string;
  durationSeconds?: number;
  error?: string;
}
