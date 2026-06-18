"use client";

import { useEffect, useState } from "react";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "hba-pwa-dismissed";

// Registers the service worker and (when the browser raises beforeinstallprompt)
// shows a small "Install" toast so users can pin the app to their home screen.
// On iOS Safari there is no install prompt — users must use Share → Add to Home
// Screen manually; that lives in the iOS install hint below.
export function PWARegister() {
  const [bip, setBip] = useState<BIPEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      const onLoad = () => {
        navigator.serviceWorker.register("/sw.js").catch(() => null);
      };
      if (document.readyState === "complete") onLoad();
      else window.addEventListener("load", onLoad, { once: true });
    }

    const onBIP = (e: Event) => {
      e.preventDefault();
      setBip(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
    } catch {
      // ignore — private mode
    }

    // iOS Safari: no beforeinstallprompt; detect standalone vs Safari.
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
    if (isIOS && isSafari && !isStandalone) setIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  async function install() {
    if (!bip) return;
    await bip.prompt();
    const { outcome } = await bip.userChoice;
    if (outcome === "accepted") setBip(null);
  }

  function dismiss() {
    setBip(null);
    setIosHint(false);
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  }

  if (dismissed) return null;

  if (bip) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg md:bottom-6 md:left-auto md:right-6">
        <span className="text-2xl" aria-hidden>🏸</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900">Install Hong Badminton Academy</div>
          <div className="text-xs text-slate-500">Add to home screen for one-tap access.</div>
        </div>
        <button
          type="button"
          onClick={install}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-green-700"
        >
          Install
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="rounded-lg px-2 py-1.5 text-slate-400 hover:bg-slate-100"
        >
          ✕
        </button>
      </div>
    );
  }

  if (iosHint) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg md:bottom-6 md:left-auto md:right-6">
        <span className="text-2xl" aria-hidden>🏸</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900">Add HBA to your home screen</div>
          <div className="text-xs text-slate-500">
            Tap <strong>Share</strong> ⬆️ then <strong>Add to Home Screen</strong>.
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install hint"
          className="rounded-lg px-2 py-1.5 text-slate-400 hover:bg-slate-100"
        >
          ✕
        </button>
      </div>
    );
  }

  return null;
}
