"use client";

import { useEffect } from "react";

// Zero-render helper: strips one-shot flash flags from the URL after paint, so a
// "Saved."/"Sent." banner (rendered server-side from ?saved=/?sent=) doesn't
// re-appear on refresh, back-nav, or a bookmarked URL. Drop <FlashClear /> on any
// page that shows such a banner — it doesn't touch the banner markup itself.
const FLAGS = ["saved", "sent", "error", "intro", "generated", "notice", "refunded"];

export function FlashClear() {
  useEffect(() => {
    const url = new URL(window.location.href);
    let changed = false;
    for (const f of FLAGS) {
      if (url.searchParams.has(f)) {
        url.searchParams.delete(f);
        changed = true;
      }
    }
    if (changed) window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, []);
  return null;
}
