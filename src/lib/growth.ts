// Character growth model shared by the scorecard generator, PDF and the
// parent/admin views. Keep dimension names in sync with migration 0011's seed.

export type GroupKey = "physical" | "technical" | "character";

export const GROUP_LABEL: Record<GroupKey, string> = {
  physical: "Physical",
  technical: "Technical",
  character: "Character",
};

// The Character dimensions that make up the HBA Growth Index (equal 20% each).
export const CHARACTER_DIMS = [
  "Discipline",
  "Confidence",
  "Resilience",
  "Teamwork",
  "Leadership",
] as const;

export interface Stage {
  key: string;
  label: string;
  learn: string;
}

// 5-stage character pathway. Boundaries disambiguated so each age maps to one
// stage (e.g. 8 → Builder, 10 → Challenger, 13 → Leader, 16 → Champion).
export const STAGES: { label: string; min: number; learn: string }[] = [
  { label: "Explorer", min: 0, learn: "I dare to start" },
  { label: "Builder", min: 8, learn: "I can persevere" },
  { label: "Challenger", min: 10, learn: "I am not afraid of failure" },
  { label: "Leader", min: 13, learn: "I can influence others" },
  { label: "Champion", min: 16, learn: "I can help others succeed" },
];

export function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const b = new Date(dob);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return age;
}

export function stageForAge(age: number | null): Stage | null {
  if (age == null) return null;
  let chosen = STAGES[0];
  for (const s of STAGES) if (age >= s.min) chosen = s;
  return { key: chosen.label.toLowerCase(), label: chosen.label, learn: chosen.learn };
}

export function stageForDob(dob: string | null | undefined): Stage | null {
  return stageForAge(ageFromDob(dob));
}

// Tone helper for a 0–100 score (shared by web views).
export function scoreTone(score: number | null): "green" | "blue" | "yellow" | "slate" {
  if (score == null) return "slate";
  if (score >= 80) return "green";
  if (score >= 65) return "blue";
  return "yellow";
}
