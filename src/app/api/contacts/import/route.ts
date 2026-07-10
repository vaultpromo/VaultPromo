import { NextRequest } from "next/server";
import { verifySession } from "@/lib/dal";
import { parseContactFile } from "@/lib/contacts/parser";
import { importContactsAction } from "@/lib/actions/contacts";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = [
  "text/csv",
  "application/csv",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

/**
 * POST /api/contacts/import
 *
 * Accepts a multipart/form-data request with:
 *   file     - CSV or XLSX file
 *   listId   - (optional) mailing list ID to add contacts to
 *
 * Returns a JSON ImportResult.
 */
export async function POST(request: NextRequest) {
  await verifySession();

  const formData = await request.formData();
  const file = formData.get("file");
  const listId = formData.get("listId") as string | null;

  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: "File too large (max 5 MB)." }, { status: 413 });
  }

  const filename = file.name ?? "upload.csv";
  const ext = filename.split(".").pop()?.toLowerCase();

  if (!["csv", "xlsx", "xls"].includes(ext ?? "")) {
    return Response.json(
      { error: "Unsupported format. Upload a .csv or .xlsx file." },
      { status: 415 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let parseResult;
  try {
    parseResult = parseContactFile(buffer, filename);
  } catch (err) {
    return Response.json(
      { error: (err as Error).message },
      { status: 400 },
    );
  }

  const result = await importContactsAction(parseResult, listId ?? undefined);

  return Response.json(result);
}
