"use client";

import { Search } from "lucide-react";

// Opens the global command palette (which is otherwise ⌘K-only, unreachable on
// a phone) by dispatching an event the palette listens for.
export function SearchButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      aria-label="Search"
      title="Search (⌘K)"
      onClick={() => window.dispatchEvent(new CustomEvent("hba:search"))}
      className={className ?? "rounded-lg border border-slate-300 p-2.5 text-slate-600 transition-colors hover:bg-slate-50"}
    >
      <Search className="h-5 w-5" />
    </button>
  );
}
