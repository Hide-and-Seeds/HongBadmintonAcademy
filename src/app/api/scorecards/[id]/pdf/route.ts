import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getParentIdFromCookie } from "@/lib/parent-auth";

export const runtime = "nodejs";

// Download a score card PDF, then hand back a short-lived signed URL to the
// private object. Authorization is explicit per role:
//  • admin / coach — read through the RLS client (is_admin / coach_of_student);
//  • parent — no Supabase session, so resolve via the signed cookie and confirm
//    the card belongs to one of their own children before signing.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let pdfUrl: string | null | undefined;
  let found = false;

  if (user) {
    const { data } = await supabase
      .from("scorecards")
      .select("pdf_url")
      .eq("id", id)
      .maybeSingle();
    if (data) {
      found = true;
      pdfUrl = data.pdf_url;
    }
  } else {
    const pid = await getParentIdFromCookie();
    if (pid) {
      const admin = createAdminClient();
      const { data } = await admin
        .from("scorecards")
        .select("pdf_url, students!inner(parent_id)")
        .eq("id", id)
        .eq("students.parent_id", pid)
        .maybeSingle();
      if (data) {
        found = true;
        pdfUrl = (data as { pdf_url: string | null }).pdf_url;
      }
    }
  }

  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!pdfUrl) {
    return NextResponse.json({ error: "PDF not generated yet" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage
    .from("scorecards")
    .createSignedUrl(pdfUrl, 60);

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: "Could not sign URL" }, { status: 500 });
  }
  return NextResponse.redirect(signed.signedUrl);
}
