import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Neon serverless HTTP client.
 * Uses the HTTP protocol (not WebSockets) which is optimal for
 * serverless/edge environments — each query is a single HTTP call.
 *
 * The client auto-reconnects; there is no persistent connection to
 * manage. Neon cold-starts transparently (~500ms) without manual
 * reactivation (unlike Supabase).
 */
const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });

export type Database = typeof db;
