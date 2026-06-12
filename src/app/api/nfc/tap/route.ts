import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { ingestTap } from "@/lib/nfc";

export const runtime = "nodejs";

// NFC reader / bridge posts tap events here.
//   POST /api/nfc/tap   header: x-api-key: <NFC_API_KEY>
//   body: { tag_uid: string, reader_id?, class_id?, session_id?, tap_type? }
// Resolves tag → student → today's session, then records tap-in / tap-out.
export async function POST(req: NextRequest) {
  if (!env.nfcApiKey || req.headers.get("x-api-key") !== env.nfcApiKey) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { tag_uid?: string; reader_id?: string; class_id?: string; session_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const r = await ingestTap({
    tagUid: body.tag_uid ?? "",
    readerId: body.reader_id ?? null,
    classId: body.class_id ?? null,
    sessionId: body.session_id ?? null,
  });

  const { status, ...payload } = r;
  return NextResponse.json(payload, { status });
}
