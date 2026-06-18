"use client";

import { useState } from "react";

export function LoginLinkPanel({ link, wa }: { link: string; wa: string | null }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-4">
      <div className="text-sm font-medium text-green-900">
        Login link ready — valid for 7 days, single use.
      </div>
      <div className="mt-2 break-all rounded-lg border border-green-200 bg-white p-3 font-mono text-xs text-slate-700">
        {link}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700"
        >
          {copied ? "Copied ✓" : "Copy link"}
        </button>
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener"
            className="rounded-lg border border-green-300 bg-white px-3 py-1.5 text-sm font-semibold text-green-800 hover:bg-green-50"
          >
            Send via WhatsApp →
          </a>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        On tap, the parent is signed in for one year and prompted to set a 4-digit PIN.
      </p>
    </div>
  );
}
