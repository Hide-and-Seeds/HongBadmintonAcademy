import "server-only";
import { metaProvider } from "./meta";
import { wwebjsProvider } from "./wwebjs";
import { isWaWorkerConfigured } from "@/lib/env";
import type { WhatsappProvider } from "./types";

// Prefer the whatsapp-web.js worker when it's configured (real auto-send via a
// dedicated number); otherwise fall back to the Meta Cloud API provider, which
// is itself a no-op stub until a token is set.
export function getWhatsappProvider(): WhatsappProvider {
  if (isWaWorkerConfigured()) return wwebjsProvider;
  return metaProvider;
}

export type { SendInput, SendResult, WhatsappProvider } from "./types";
