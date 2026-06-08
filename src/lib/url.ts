import { headers } from "next/headers";
import { env } from "@/lib/env";

// Resolve the app's public base URL from the incoming request (so Stripe
// redirects + WhatsApp links always use the real deployment domain, regardless
// of NEXT_PUBLIC_APP_URL). Falls back to the env value.
export async function getBaseUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // headers() unavailable (e.g. outside a request) — fall through.
  }
  return env.appUrl;
}
