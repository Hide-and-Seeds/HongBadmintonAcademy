"use client";

import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ role }: { role?: string }) {
  async function signOut() {
    if (role === "parent") {
      // Parents use the custom cookie session, not Supabase auth.
      window.location.assign("/api/parent-sign-out");
      return;
    }
    await createClient().auth.signOut();
    window.location.assign("/login");
  }
  return (
    <button
      onClick={signOut}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
      Sign out
    </button>
  );
}
