"use client";

import { useRef, type ComponentProps } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, Input } from "@/components/ui";

// Auto-applying filter controls. On change they update the URL via a SOFT
// navigation (router.push, scroll preserved) — the server component re-renders
// with the new params but the page does NOT do a full reload/refresh. Existing
// params (tab, month, other filters) are merged, so no hidden inputs needed.

function useUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (name: string, value: string) => {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
}

export function FilterSelect({ name, ...props }: ComponentProps<"select"> & { name: string }) {
  const update = useUpdater();
  return <Select {...props} name={name} onChange={(e) => update(name, e.currentTarget.value)} />;
}

export function FilterSearch({ name, ...props }: ComponentProps<"input"> & { name: string }) {
  const update = useUpdater();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  return (
    <Input
      {...props}
      name={name}
      onChange={(e) => {
        const v = e.currentTarget.value;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => update(name, v), 350);
      }}
    />
  );
}
