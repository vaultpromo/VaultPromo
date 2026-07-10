import { describe, it, expect } from "vitest";
import { parseCsv, parseXlsx } from "@/lib/contacts/parser";
import * as XLSX from "xlsx";

// ── CSV parsing ──────────────────────────────────────────────────────────────

describe("parseCsv", () => {
  it("parses a minimal valid CSV with just email", () => {
    const csv = `email\ndj@techno.com\n`;
    const result = parseCsv(csv);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].email).toBe("dj@techno.com");
    expect(result.invalid).toHaveLength(0);
  });

  it("parses full row with all optional fields", () => {
    const csv = `email,name,alias,city,country,notes\ndj@techno.com,DJ Name,ALIAS,Barcelona,ES,some notes\n`;
    const result = parseCsv(csv);
    expect(result.valid).toHaveLength(1);
    const row = result.valid[0];
    expect(row.name).toBe("DJ Name");
    expect(row.alias).toBe("ALIAS");
    expect(row.city).toBe("Barcelona");
    expect(row.country).toBe("ES");
    expect(row.notes).toBe("some notes");
  });

  it("lowercases emails", () => {
    const csv = `email\nDJ@TECHNO.COM\n`;
    const result = parseCsv(csv);
    expect(result.valid[0].email).toBe("dj@techno.com");
  });

  it("rejects rows with invalid email", () => {
    const csv = `email\nnot-an-email\n`;
    const result = parseCsv(csv);
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].rowNumber).toBe(2);
    expect(result.invalid[0].errors[0]).toMatch(/email/i);
  });

  it("detects in-file duplicate emails", () => {
    const csv = `email\ndj@techno.com\ndj@techno.com\n`;
    const result = parseCsv(csv);
    expect(result.duplicates).toContain("dj@techno.com");
  });

  it("accepts email column alias 'e-mail'", () => {
    const csv = `e-mail\ndj@techno.com\n`;
    const result = parseCsv(csv);
    expect(result.valid).toHaveLength(1);
  });

  it("accepts 'dj_alias' as alias column", () => {
    const csv = `email,dj_alias\ndj@techno.com,SPCMSK\n`;
    const result = parseCsv(csv);
    expect(result.valid[0].alias).toBe("SPCMSK");
  });

  it("accepts 'handle' as alias column", () => {
    const csv = `email,handle\ndj@techno.com,SPCMSK\n`;
    const result = parseCsv(csv);
    expect(result.valid[0].alias).toBe("SPCMSK");
  });

  it("ignores unknown columns", () => {
    const csv = `email,unknown_col\ndj@techno.com,ignored\n`;
    const result = parseCsv(csv);
    expect(result.valid).toHaveLength(1);
  });

  it("skips empty lines", () => {
    const csv = `email\ndj@techno.com\n\n\n`;
    const result = parseCsv(csv);
    expect(result.valid).toHaveLength(1);
  });

  it("tracks totalRows correctly", () => {
    const csv = `email\ndj1@techno.com\nbad-email\ndj2@techno.com\n`;
    const result = parseCsv(csv);
    expect(result.totalRows).toBe(3);
    expect(result.valid).toHaveLength(2);
    expect(result.invalid).toHaveLength(1);
  });

  it("parses multiple valid rows", () => {
    const csv = `email,name\ndj1@a.com,DJ One\ndj2@b.com,DJ Two\ndj3@c.com,DJ Three\n`;
    const result = parseCsv(csv);
    expect(result.valid).toHaveLength(3);
  });

  it("assigns correct rowNumbers (2-indexed, header is row 1)", () => {
    const csv = `email\nbad\ndj@techno.com\n`;
    const result = parseCsv(csv);
    expect(result.invalid[0].rowNumber).toBe(2);
    expect(result.valid[0].rowNumber).toBe(3);
  });

  it("handles case-insensitive column names", () => {
    const csv = `EMAIL,NAME\ndj@techno.com,DJ\n`;
    const result = parseCsv(csv);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].name).toBe("DJ");
  });

  it("trims whitespace from emails", () => {
    const csv = `email\n  dj@techno.com  \n`;
    const result = parseCsv(csv);
    expect(result.valid[0].email).toBe("dj@techno.com");
  });
});

// ── XLSX parsing ─────────────────────────────────────────────────────────────

describe("parseXlsx", () => {
  function makeXlsxBuffer(rows: object[]): Buffer {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  }

  it("parses a simple XLSX with email column", () => {
    const buf = makeXlsxBuffer([{ email: "dj@techno.com" }]);
    const result = parseXlsx(buf);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].email).toBe("dj@techno.com");
  });

  it("parses XLSX with optional columns", () => {
    const buf = makeXlsxBuffer([
      { email: "dj@techno.com", name: "DJ", alias: "SPCMSK", city: "BCN", country: "ES" },
    ]);
    const result = parseXlsx(buf);
    const row = result.valid[0];
    expect(row.alias).toBe("SPCMSK");
    expect(row.country).toBe("ES");
  });

  it("rejects invalid emails from XLSX", () => {
    const buf = makeXlsxBuffer([{ email: "not-valid" }]);
    const result = parseXlsx(buf);
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(1);
  });

  it("detects in-file duplicates in XLSX", () => {
    const buf = makeXlsxBuffer([
      { email: "dj@techno.com" },
      { email: "dj@techno.com" },
    ]);
    const result = parseXlsx(buf);
    expect(result.duplicates).toContain("dj@techno.com");
  });
});
