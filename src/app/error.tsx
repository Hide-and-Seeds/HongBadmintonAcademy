"use client";

import { buttonClass } from "@/components/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 p-6 text-center">
      <div className="text-5xl">⚠️</div>
      <h1 className="text-2xl font-semibold text-slate-900">Something went wrong</h1>
      <p className="max-w-md text-sm text-slate-500">
        {error.message || "An unexpected error occurred."}
      </p>
      <button onClick={reset} className={buttonClass("primary")}>Try again</button>
    </main>
  );
}
