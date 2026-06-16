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
// because Badge supports only a fixed tone set + capitalizes). Elite is purple
// (not red) so red stays reserved for the "canceled" session status — keeping
// rank colour and status colour from clashing on the calendar.
export const RANK_BADGE: Record<string, string> = {
  Beginner: "bg-green-100 text-green-700",
  Intermediate: "bg-blue-100 text-blue-700",
  Advanced: "bg-amber-100 text-amber-700",
  Elite: "bg-purple-100 text-purple-700",
};

// Softer card-fill variant (border + bg + text) used to tint calendar tiles.
export const RANK_CARD: Record<string, string> = {
  Beginner: "border-green-200 bg-green-50 text-green-800",
  Intermediate: "border-blue-200 bg-blue-50 text-blue-800",
  Advanced: "border-amber-200 bg-amber-50 text-amber-800",
  Elite: "border-purple-200 bg-purple-50 text-purple-800",
};

export function rankBadgeClass(rank: string | null | undefined): string {
  return (rank && RANK_BADGE[rank]) || "bg-slate-100 text-slate-500";
}

export function rankCardClass(rank: string | null | undefined): string {
  return (rank && RANK_CARD[rank]) || "border-slate-200 bg-slate-50 text-slate-700";
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

// A student's EFFECTIVE rank: their own coach-assigned rank if set + valid,
// otherwise the highest rank of the classes they're enrolled in.
export function studentRank(
  ownRank: string | null | undefined,
  classLevels: (string | null | undefined)[],
): string | null {
  if (ownRank && RANK_ORDER[ownRank]) return ownRank;
  return bestRank(classLevels);
}

// The next tier up from `rank` (for "Promote"). Unset/unknown → Beginner; Elite
// (top) → null (already maxed).
export function nextRank(rank: string | null | undefined): string | null {
  const order = rank ? RANK_ORDER[rank] : 0;
  if (!order) return CLASS_RANKS[0];
  if (order >= CLASS_RANKS.length) return null;
  return CLASS_RANKS[order];
}
