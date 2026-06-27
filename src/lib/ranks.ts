// Class + fee-plan TIER vocabulary. Option C retired the old 4-tier rank
// (Beginner/Intermediate/Advanced/Elite) — a student's standing now lives in
// `students.level` (1–6, see src/lib/training.ts). What remains here is the tier
// LABEL a class or fee plan carries, drawn from the same 6 level names so the
// whole app speaks one vocabulary. Colours delegate to the per-level ramp.

import {
  LEVEL_NAMES, TRAINING_LEVELS,
  levelNameBadgeClass, levelNameCardClass,
} from "@/lib/training";

// The six tier names, low → high. (Legacy "Elite" still resolves via
// levelFromName in training.ts.)
export const CLASS_RANKS = LEVEL_NAMES as readonly string[];
export type ClassRank = string;

// Name → ordinal (1–6). Used for sorting class/fee tiers.
export const RANK_ORDER: Record<string, number> = Object.fromEntries(
  TRAINING_LEVELS.map((l) => [l.name, l.level]),
);

// Tailwind chip classes for a tier label (badge + softer card variant).
export function rankBadgeClass(rank: string | null | undefined): string {
  return levelNameBadgeClass(rank);
}
export function rankCardClass(rank: string | null | undefined): string {
  return levelNameCardClass(rank);
}
