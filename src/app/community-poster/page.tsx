import QRCode from "qrcode";
import { requireRole } from "@/lib/auth";
import { env } from "@/lib/env";
import { APP_NAME } from "@/lib/constants";
import { PrintButton } from "./print-button";

// Printable front-desk poster: a big QR of the parent WhatsApp group invite.
// Standalone route (NOT under the /admin nav shell) so it prints clean. Admin-
// gated, but the QR only encodes the public invite link — no secrets. Staff open
// this, hit Print, and stick it at the courts. Regenerates from WA_COMMUNITY_LINK
// so it's always current.
export const dynamic = "force-dynamic";

export default async function CommunityPoster() {
  await requireRole("admin");
  const link = env.waCommunityLink;
  const qr = link
    ? await QRCode.toDataURL(link, { width: 900, margin: 2, errorCorrectionLevel: "M" })
    : null;

  if (!qr) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-xl font-bold text-slate-900">QR poster not ready</h1>
        <p className="mt-2 text-slate-600">
          Set <code className="rounded bg-slate-100 px-1">WA_COMMUNITY_LINK</code> in Vercel (your{" "}
          <code className="rounded bg-slate-100 px-1">chat.whatsapp.com/…</code> invite), redeploy, then reload this page.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 p-8 text-center">
      <PrintButton />

      <div className="poster flex w-full flex-col items-center gap-5 rounded-[2rem] border-4 border-emerald-500 bg-white p-10">
        <div className="text-6xl">🏸</div>
        <div>
          <h1 className="text-4xl font-extrabold leading-tight text-slate-900">
            Join our Parent
            <br />
            WhatsApp Group
          </h1>
          <p className="mt-2 text-lg font-medium text-slate-500">{APP_NAME}</p>
        </div>
        <p className="text-lg text-slate-600">Class updates · reminders · announcements</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="WhatsApp group QR code" className="h-72 w-72" />
        <p className="text-2xl font-bold text-emerald-700">Scan with your phone camera</p>
        <p className="text-sm text-slate-500">Open Camera → point at the code → tap the link → Join</p>
      </div>
    </div>
  );
}
