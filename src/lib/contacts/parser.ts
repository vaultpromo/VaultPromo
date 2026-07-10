/**
 * Contact import parser.
 *
 * Accepts a CSV or XLSX file buffer and returns a structured result with:
 * - valid rows (ContactRow[])
 * - invalid rows with per-row error messages
 * - duplicate emails within the file
 *
 * Supported CSV column names (case-insensitive, with common aliases):
 *   email       → required
 *   name        → optional
 *   alias       → optional  (also: dj_alias, handle)
 *   city        → optional
 *   country     → optional  (ISO-2, e.g. "ES")
 *   notes       → optional
 *
 * Pure functions — no DB calls, fully unit-testable.
 */

import Papa from "papaparse";
import * as XLSX from "xlsx";
import { z } from "zod";

// ── Row schema ──────────────────────────────────────────────────────────────

const contactRowSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .transform((v) => v.toLowerCase().trim()),
  name: z.string().max(200).trim().optional(),
  alias: z.string().max(100).trim().optional(),
  city: z.string().max(100).trim().optional(),
  country: z
    .string()
    .max(2)
    .trim()
    .toUpperCase()
    .optional(),
  notes: z.string().max(1000).trim().optional(),
});

export type ContactRow = z.infer<typeof contactRowSchema>;

export interface ParsedContact extends ContactRow {
  /** 1-indexed row number in the source file */
  rowNumber: number;
}

export interface InvalidRow {
  rowNumber: number;
  rawEmail: string;
  errors: string[];
}

export interface ParseResult {
  valid: ParsedContact[];
  invalid: InvalidRow[];
  /** Emails that appear more than once within the import file */
  duplicates: string[];
  totalRows: number;
}

// ── Column name normalization ───────────────────────────────────────────────

const COLUMN_ALIASES: Record<string, keyof ContactRow> = {
  email: "email",
  "e-mail": "email",
  "email address": "email",
  correo: "email",
  name: "name",
  nombre: "name",
  "full name": "name",
  fullname: "name",
  alias: "alias",
  dj_alias: "alias",
  "dj alias": "alias",
  handle: "alias",
  city: "city",
  ciudad: "city",
  town: "city",
  country: "country",
  pais: "country",
  país: "country",
  "country code": "country",
  notes: "notes",
  notas: "notes",
  comment: "notes",
  comments: "notes",
};

function normalizeHeader(raw: string): keyof ContactRow | null {
  return COLUMN_ALIASES[raw.toLowerCase().trim()] ?? null;
}

function normalizeRow(
  rawRow: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawRow)) {
    const normalized = normalizeHeader(key);
    if (normalized) out[normalized] = value?.toString().trim() ?? "";
  }
  return out;
}

// ── Parsers ─────────────────────────────────────────────────────────────────

function parseRows(rawRows: Record<string, string>[]): ParseResult {
  const valid: ParsedContact[] = [];
  const invalid: InvalidRow[] = [];
  const seenEmails = new Map<string, number>(); // email → first rowNumber
  const duplicateEmails = new Set<string>();

  rawRows.forEach((raw, idx) => {
    const rowNumber = idx + 2; // header is row 1
    const normalized = normalizeRow(raw);
    const result = contactRowSchema.safeParse(normalized);

    if (!result.success) {
      invalid.push({
        rowNumber,
        rawEmail: normalized.email ?? "",
        errors: result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
      });
      return;
    }

    const { email } = result.data;

    // Track in-file duplicates
    if (seenEmails.has(email)) {
      duplicateEmails.add(email);
    } else {
      seenEmails.set(email, rowNumber);
    }

    valid.push({ ...result.data, rowNumber });
  });

  return {
    valid,
    invalid,
    duplicates: Array.from(duplicateEmails),
    totalRows: rawRows.length,
  };
}

export function parseCsv(csvText: string): ParseResult {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  return parseRows(result.data);
}

export function parseXlsx(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert to array of objects with string values
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  }).map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k, String(v ?? "")]),
    ),
  );

  return parseRows(rawRows);
}

/** Auto-detect format from filename extension */
export function parseContactFile(
  buffer: Buffer,
  filename: string,
): ParseResult {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "csv") {
    return parseCsv(buffer.toString("utf-8"));
  }
  if (ext === "xlsx" || ext === "xls") {
    return parseXlsx(buffer);
  }
  throw new Error(`Unsupported file format: .${ext}`);
}
