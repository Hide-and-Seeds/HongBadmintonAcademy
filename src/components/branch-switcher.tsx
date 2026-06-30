"use client";

import { useRef } from "react";
import { Building2 } from "lucide-react";

// Super-admin branch focus. Auto-submits on change; the server action sets a
// cookie and revalidates the admin layout so every list re-reads.
export function BranchSwitcher({
  branches,
  current,
  action,
}: {
  branches: { id: string; name: string }[];
  current: string | null;
  action: (formData: FormData) => void;
}) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={action} className="flex items-center gap-2">
      <Building2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      <select
        name="branch_id"
        defaultValue={current ?? "all"}
        onChange={() => ref.current?.requestSubmit()}
        aria-label="Viewing branch"
        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
      >
        <option value="all">All branches</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
    </form>
  );
}
