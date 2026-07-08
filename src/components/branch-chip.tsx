import { cn } from "@/components/ui";

// Fixed branch palette. Token keys (not hex) so Tailwind JIT keeps the literal
// classes below. Small set — an academy has a handful of branches, not dozens.
export const BRANCH_COLORS = [
  { key: "emerald", label: "Emerald" },
  { key: "blue", label: "Blue" },
  { key: "amber", label: "Amber" },
  { key: "rose", label: "Rose" },
  { key: "violet", label: "Violet" },
  { key: "cyan", label: "Cyan" },
  { key: "orange", label: "Orange" },
  { key: "teal", label: "Teal" },
  { key: "slate", label: "Slate" },
] as const;

export type BranchColor = (typeof BRANCH_COLORS)[number]["key"];

const CHIP: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  rose: "bg-rose-50 text-rose-700 ring-rose-600/20",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
  cyan: "bg-cyan-50 text-cyan-700 ring-cyan-600/20",
  orange: "bg-orange-50 text-orange-700 ring-orange-600/20",
  teal: "bg-teal-50 text-teal-700 ring-teal-600/20",
  slate: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

const DOT: Record<string, string> = {
  emerald: "bg-emerald-500",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  cyan: "bg-cyan-500",
  orange: "bg-orange-500",
  teal: "bg-teal-500",
  slate: "bg-slate-400",
};

export function branchColorKey(color?: string | null): string {
  return color && CHIP[color] ? color : "slate";
}

/** A coloured branch label — dot + name (+ optional code). Renders nothing when
 *  there's no branch name (e.g. a null-branch row). */
export function BranchChip({
  name,
  color,
  code,
  className,
}: {
  name?: string | null;
  color?: string | null;
  code?: string | null;
  className?: string;
}) {
  if (!name) return null;
  const key = branchColorKey(color);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", CHIP[key], className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT[key])} />
      {name}
      {code ? <span className="opacity-60">· {code}</span> : null}
    </span>
  );
}

/** Just the coloured dot — for tight spots (calendar cells, dense rows). */
export function BranchDot({ color, className }: { color?: string | null; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full", DOT[branchColorKey(color)], className)} />;
}

/** Swatch radio group for branch forms. Pure CSS (peer-checked) so it works in a
 *  server-rendered <form> with no client component. */
export function BranchColorPicker({ name = "color", value }: { name?: string; value?: string | null }) {
  const current = branchColorKey(value);
  return (
    <div className="flex flex-wrap gap-2">
      {BRANCH_COLORS.map((c) => (
        <label key={c.key} className="cursor-pointer" title={c.label}>
          <input type="radio" name={name} value={c.key} defaultChecked={current === c.key} className="peer sr-only" />
          <span className={cn("flex h-7 w-7 rounded-full ring-2 ring-transparent ring-offset-1 transition-shadow peer-checked:ring-slate-900", DOT[c.key])} />
        </label>
      ))}
    </div>
  );
}
