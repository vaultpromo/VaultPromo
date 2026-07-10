/**
 * Seed script — populates the database with a minimal development dataset.
 * Run with: npx tsx src/db/seed.ts
 *
 * Creates:
 * - 1 label user (IMPCORE Records)
 * - 1 DJ user (SPCMSK)
 * - Profiles for both
 * - 1 campaign with 2 tracks
 * - 1 mailing list with 1 contact
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { randomUUID } from "crypto";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function seed() {
  console.log("🌱 Seeding database...");

  // ── Users ──────────────────────────────────────────────────────────────────
  const labelUserId = randomUUID();
  const djUserId = randomUUID();

  await db
    .insert(schema.users)
    .values([
      {
        id: labelUserId,
        name: "IMPCORE Records",
        email: "label@impcore.dev",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: djUserId,
        name: "SPCMSK",
        email: "dj@spcmsk.dev",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    .onConflictDoNothing();

  // ── Profiles ───────────────────────────────────────────────────────────────
  await db
    .insert(schema.profiles)
    .values([
      {
        id: randomUUID(),
        userId: labelUserId,
        labelName: "IMPCORE Records",
        labelWebsite: "https://impcore.dev",
        activeWorkspace: "label",
        storageQuotaBytes: "5368709120",
        storageUsedBytes: "0",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        userId: djUserId,
        djAlias: "SPCMSK",
        djGenres: "techno,industrial",
        activeWorkspace: "dj",
        storageQuotaBytes: "5368709120",
        storageUsedBytes: "0",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    .onConflictDoNothing();

  // ── Campaign ───────────────────────────────────────────────────────────────
  const campaignId = randomUUID();

  await db
    .insert(schema.campaigns)
    .values({
      id: campaignId,
      userId: labelUserId,
      title: "Void Sequence VA001",
      catalogNumber: "IMP001",
      artistName: "Various Artists",
      description:
        "First VA compilation from IMPCORE Records. Four tracks of dark, industrial techno.",
      releaseDate: new Date("2026-09-01"),
      expiryDate: new Date("2026-08-25"),
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing();

  // ── Tracks ─────────────────────────────────────────────────────────────────
  const track1Id = randomUUID();
  const track2Id = randomUUID();

  await db
    .insert(schema.tracks)
    .values([
      {
        id: track1Id,
        campaignId,
        position: 1,
        title: "Sector Zero",
        artistName: "SPCMSK",
        mixVersion: "Original Mix",
        bpm: 148,
        musicalKey: "Am",
        processingStatus: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: track2Id,
        campaignId,
        position: 2,
        title: "Rust Signal",
        artistName: "SPCMSK",
        mixVersion: "Dub",
        bpm: 145,
        musicalKey: "Dm",
        processingStatus: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    .onConflictDoNothing();

  // ── Mailing List & Contact ─────────────────────────────────────────────────
  const listId = randomUUID();
  const contactId = randomUUID();

  await db
    .insert(schema.mailingLists)
    .values({
      id: listId,
      userId: labelUserId,
      name: "Core DJs — Europe",
      description: "Main promo list for European techno DJs",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing();

  await db
    .insert(schema.contacts)
    .values({
      id: contactId,
      userId: labelUserId,
      email: "dj@spcmsk.dev",
      name: "SPCMSK",
      alias: "SPCMSK",
      city: "Barcelona",
      country: "ES",
      unsubscribed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing();

  await db
    .insert(schema.mailingListContacts)
    .values({
      mailingListId: listId,
      contactId,
      createdAt: new Date(),
    })
    .onConflictDoNothing();

  console.log("✅ Seed complete.");
  console.log(`   Label user: ${labelUserId}`);
  console.log(`   DJ user:    ${djUserId}`);
  console.log(`   Campaign:   ${campaignId}`);
  console.log(`   Tracks:     ${track1Id}, ${track2Id}`);
  console.log(`   List:       ${listId} / Contact: ${contactId}`);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
