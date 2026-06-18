"use server";

import { redirect } from "next/navigation";
import { checkPhonePin, setParentSessionCookie, setPin, isValidPin } from "@/lib/parent-auth";

function errorRedirect(next: string | null, message: string): never {
  const url = new URL("/parent-login", "http://x");
  url.searchParams.set("error", message);
  if (next) url.searchParams.set("next", next);
  redirect(`${url.pathname}?${url.searchParams.toString()}`);
}

// Phone + PIN sign-in (edge-case re-auth — see proposal v7 §7.2).
export async function signInWithPin(formData: FormData) {
  const phone = String(formData.get("phone") ?? "");
  const pin = String(formData.get("pin") ?? "");
  const next = (formData.get("next") as string) || null;

  const result = await checkPhonePin(phone, pin);
  if (result.ok) {
    await setParentSessionCookie(result.profileId);
    redirect(next || "/parent");
  }

  if (result.reason === "locked") {
    errorRedirect(next, "Too many wrong attempts. Contact the academy to unlock.");
  }
  if (result.reason === "no-match") {
    errorRedirect(next, "We couldn't find an account with that phone + PIN.");
  }
  const remaining = result.remaining ?? null;
  errorRedirect(
    next,
    remaining != null
      ? `Wrong PIN. ${remaining} attempt${remaining === 1 ? "" : "s"} left before lockout.`
      : "Wrong PIN.",
  );
}

// First-time PIN setup (after token consume). Token consume already issued the
// session cookie, so we just need the profile id, which we read from the cookie.
export async function submitPinSetup(formData: FormData) {
  const pin = String(formData.get("pin") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!isValidPin(pin)) {
    redirect(`/parent-login/setup?error=${encodeURIComponent("PIN must be exactly 4 digits.")}`);
  }
  if (pin !== confirm) {
    redirect(`/parent-login/setup?error=${encodeURIComponent("PINs don't match — try again.")}`);
  }

  const { getParentIdFromCookie } = await import("@/lib/parent-auth");
  const pid = await getParentIdFromCookie();
  if (!pid) redirect("/parent-login");

  const r = await setPin(pid, pin);
  if (!r.ok) redirect(`/parent-login/setup?error=${encodeURIComponent(r.error ?? "Could not save PIN")}`);

  redirect("/parent");
}
