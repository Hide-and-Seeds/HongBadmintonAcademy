import { NextResponse, type NextRequest } from "next/server";
import { clearParentSessionCookie } from "@/lib/parent-auth";

export const runtime = "nodejs";

// Clears the parent cookie and bounces to the parent login screen.
async function handle(req: NextRequest) {
  await clearParentSessionCookie();
  return NextResponse.redirect(`${req.nextUrl.origin}/parent-login`);
}

export const GET = handle;
export const POST = handle;
