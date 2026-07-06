"use client";

import { useCallback, useRef, useState } from "react";

type Kind = "error" | "success";

// Lightweight, self-contained toast for optimistic client boards. Returns a
// `flash(text, kind)` to call on a save success/failure and a `node` to render
// once in the component. Auto-dismisses; no animation so it's reduced-motion
// safe by construction. Fills the gap where optimistic updates used to revert
// silently — now a failed save says so.
export function useFlash() {
  const [msg, setMsg] = useState<{ text: string; kind: Kind } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((text: string, kind: Kind = "error") => {
    setMsg({ text, kind });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3200);
  }, []);

  const node = msg ? (
    <div
      role="status"
      aria-live="polite"
      className={
        "fixed inset-x-0 bottom-5 z-[60] mx-auto flex w-fit max-w-[90vw] items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg " +
        (msg.kind === "error" ? "bg-red-600" : "bg-emerald-600")
      }
    >
      {msg.text}
    </div>
  ) : null;

  return { flash, node };
}
