// Class rank — the academy's skill tiers. Stored in the existing free-text
// `classes.level` column (no migration), but constrained to this fixed,
// ordered set so every class + the leaderboard render a consistent, colour-coded
// badge. Each tier has its own colour ramp (green → blue → amber → red).

export const CLASS_RANKS = ["Beginner", "Intermediate", "Advanced", "Elite"] as const;
export type ClassRank = (typeof CLASS_RANKS)[number];

// Low → high. Used for sorting and for picking a student's "best" (highest) rank
// when they're enrolled in more than one class.
export const RANK_ORDER: Record<string, number> = {
  Beginner: 1,
  Intermediate: 2,
  Advanced: 3,
  Elite: 4,
};

// Tailwind badge classes per rank (rendered as a plain <span>, not <Badge>,
// because Badge supports only a fixed tone set + capitalizes).
export const RANK_BADGE: Record<string, string> = {
  Beginner: "bg-green-100 text-green-700",
  Intermediate: "bg-blue-100 text-blue-700",
  Advanced: "bg-amber-100 text-amber-700",
  Elite: "bg-red-100 text-red-700",
};

export function rankBadgeClass(rank: string | null | undefined): string {
  return (rank && RANK_BADGE[rank]) || "bg-slate-100 text-slate-500";
}

// Highest-ranked of several class levels (e.g. a student in multiple classes).
// Ignores unknown/empty values. Returns null when none are recognized.
export function bestRank(levels: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  let bestOrder = 0;
  for (const lvl of levels) {
    const order = lvl ? RANK_ORDER[lvl] : undefined;
    if (order && order > bestOrder) {
      bestOrder = order;
      best = lvl!;
    }
  }
  return best;
}
