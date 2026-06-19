"use client";

import { useEffect, useState } from "react";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform =
  | { kind: "loading" }
  | { kind: "installed" }
  | { kind: "android-chrome"; bip: BIPEvent | null }
  | { kind: "ios-safari" }
  | { kind: "ios-other" }
  | { kind: "desktop-chrome"; bip: BIPEvent | null }
  | { kind: "desktop-other" }
  | { kind: "unknown" };

function detect(ua: string): Platform["kind"] {
  if (typeof window === "undefined") return "loading";
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;
  if (standalone) return "installed";

  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid || /Mobile/i.test(ua);
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  const isChrome = /Chrome|CriOS|Edg/i.test(ua) && !/OPR\//i.test(ua);

  if (isIOS && isSafari) return "ios-safari";
  if (isIOS) return "ios-other";
  if (isAndroid && isChrome) return "android-chrome";
  if (!isMobile && isChrome) return "desktop-chrome";
  if (!isMobile) return "desktop-other";
  return "unknown";
}

export function InstallClient() {
  const [platform, setPlatform] = useState<Platform>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const kind = detect(navigator.userAgent);

    // Register SW so beforeinstallprompt becomes possible.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => null);
    }

    if (kind === "android-chrome" || kind === "desktop-chrome") {
      setPlatform({ kind, bip: null } as Platform);
      const onBIP = (e: Event) => {
        e.preventDefault();
        setPlatform((p) =>
          p.kind === "android-chrome" || p.kind === "desktop-chrome"
            ? ({ kind: p.kind, bip: e as BIPEvent } as Platform)
            : p,
        );
      };
      window.addEventListener("beforeinstallprompt", onBIP);

      // If installed mid-page, switch state.
      const onInstalled = () => setPlatform({ kind: "installed" });
      window.addEventListener("appinstalled", onInstalled);

      return () => {
        window.removeEventListener("beforeinstallprompt", onBIP);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    setPlatform({ kind } as Platform);
  }, []);

  async function install() {
    if (platform.kind !== "android-chrome" && platform.kind !== "desktop-chrome") return;
    const bip = platform.bip;
    if (!bip) {
      setMsg("Install hint not ready yet. Try the browser menu → Install / Add to Home screen.");
      return;
    }
    setBusy(true);
    try {
      await bip.prompt();
      const { outcome } = await bip.userChoice;
      if (outcome === "accepted") setPlatform({ kind: "installed" });
      else setMsg("Cancelled. Tap Install again any time.");
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-green-600 text-5xl text-white shadow-xl">
        🏸
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Hong Badminton Academy
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Add the app to your home screen for one-tap access.
        </p>
      </div>

      <a
        href="/login"
        className="inline-flex w-full max-w-xs items-center justify-center rounded-xl border border-green-600 bg-white px-6 py-3 text-base font-semibold text-green-700 shadow-sm transition-colors hover:bg-green-50"
      >
        Skip — open the website →
      </a>

      {platform.kind === "loading" && (
        <div className="text-sm text-slate-400">Detecting your device…</div>
      )}

      {platform.kind === "installed" && (
        <div className="w-full space-y-3">
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            ✓ Already installed. Open from your home screen.
          </div>
          <a
            href="/"
            className="inline-flex w-full items-center justify-center rounded-xl bg-green-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-green-700"
          >
            Open HBA →
          </a>
        </div>
      )}

      {(platform.kind === "android-chrome" || platform.kind === "desktop-chrome") && (
        <div className="w-full space-y-3">
          <button
            onClick={install}
            disabled={busy}
            className="w-full rounded-xl bg-green-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-green-600/30 transition-all hover:bg-green-700 active:scale-95 disabled:opacity-60"
          >
            {busy ? "Installing…" : platform.bip ? "📲 Install HBA" : "Preparing install…"}
          </button>
          {!platform.bip && (
            <p className="text-xs text-slate-400">
              If nothing happens after a few seconds, tap your browser menu (⋮ / ⋯) and choose
              <strong className="text-slate-600"> Install app</strong> or
              <strong className="text-slate-600"> Add to Home screen</strong>.
            </p>
          )}
        </div>
      )}

      {platform.kind === "ios-safari" && <IOSInstructions />}

      {platform.kind === "ios-other" && (
        <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-900">
          <strong className="block text-base">Open this page in Safari</strong>
          <p className="mt-1">
            Chrome / Firefox on iPhone can&apos;t install apps to the home screen — that&apos;s an
            Apple restriction. Tap the share menu and choose <strong>Open in Safari</strong>, then
            follow the Add-to-Home-Screen steps that appear.
          </p>
        </div>
      )}

      {platform.kind === "desktop-other" && (
        <div className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left text-sm text-slate-600 shadow-sm">
          <strong className="block text-base text-slate-900">Use Chrome or Edge</strong>
          <p className="mt-1">
            Safari and Firefox on desktop don&apos;t support installable web apps. Open this page
            in Chrome / Edge to install. Or just bookmark{" "}
            <a className="text-green-700 underline" href="/">
              this page
            </a>
            .
          </p>
        </div>
      )}

      {platform.kind === "unknown" && (
        <a
          href="/"
          className="inline-flex w-full items-center justify-center rounded-xl bg-green-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-green-700"
        >
          Open HBA →
        </a>
      )}

      {msg && (
        <div className="w-full rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {msg}
        </div>
      )}

    </main>
  );
}

function IOSInstructions() {
  return (
    <div className="w-full space-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm">
      <p className="text-sm font-medium text-slate-900">
        On iPhone, iOS blocks one-tap install. Two steps:
      </p>
      <ol className="space-y-3 text-sm text-slate-700">
        <li className="flex items-start gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white">
            1
          </span>
          <span>
            Tap the <strong>Share</strong> button (the square with the up-arrow{" "}
            <svg
              viewBox="0 0 24 24"
              className="inline h-4 w-4 align-text-bottom text-blue-500"
              fill="currentColor"
            >
              <path d="M12 2 8 6h3v9h2V6h3l-4-4Zm-7 13v6h14v-6h-2v4H7v-4H5Z" />
            </svg>
            ) at the bottom of Safari.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white">
            2
          </span>
          <span>
            Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
          </span>
        </li>
      </ol>
      <p className="text-xs text-slate-400">
        The HBA icon will appear on your home screen. Open it from there to get the full-screen
        app.
      </p>
      <div className="pointer-events-none absolute" />
      <BounceArrow />
    </div>
  );
}

function BounceArrow() {
  return (
    <div className="flex items-center justify-center gap-2 pt-2 text-xs text-slate-400">
      <span>Share button is below</span>
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4 animate-bounce text-slate-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 5v14M5 12l7 7 7-7" />
      </svg>
    </div>
  );
}
