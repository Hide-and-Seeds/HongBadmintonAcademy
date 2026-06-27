// HBA Training System v2 — the canonical 6-level ladder, per-level curriculum,
// promotion-exam rubrics, pass bands and the exam cycle. Source of truth for the
// coach grading flow, the admin syllabus reference and the parent level card.
// Mirrors the boss-approved HBA_TRAINING_SYSTEM_v2 document.

// ─── Exam cycle ─────────────────────────────────────────────────────────────
// Exams run 3×/year, every 4 months: April, August, December.
export const EXAM_MONTHS = [4, 8, 12] as const; // 1-based months
const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Malaysia is UTC+8 (no DST) — derive the wall-clock "now" the rest of the app uses.
function mytNow(): Date {
  return new Date(Date.now() + 8 * 3600 * 1000);
}

export function examWindowLabel(d: Date = mytNow()): string {
  return `${MONTH_ABBR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// The next exam window on/after `from` (label + ISO date of the 1st of that month).
export function nextExamWindow(from: Date = mytNow()): { label: string; date: string } {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth() + 1; // 1-based
  for (const em of EXAM_MONTHS) {
    if (em >= m) return { label: `${MONTH_ABBR[em - 1]} ${y}`, date: `${y}-${String(em).padStart(2, "0")}-01` };
  }
  // Past December — first window of next year.
  const em = EXAM_MONTHS[0];
  return { label: `${MONTH_ABBR[em - 1]} ${y + 1}`, date: `${y + 1}-${String(em).padStart(2, "0")}-01` };
}

export function isExamMonth(d: Date = mytNow()): boolean {
  return (EXAM_MONTHS as readonly number[]).includes(d.getUTCMonth() + 1);
}

// ─── Levels & curriculum ────────────────────────────────────────────────────
export interface CurriculumGroup {
  label: string;
  items: string[];
}
export interface TrainingLevel {
  level: number;       // 1–6
  name: string;        // "Starter", "Beginner", …
  objective: string;   // short Chinese goal from the doc
  groups: CurriculumGroup[];
}

export const TRAINING_LEVELS: TrainingLevel[] = [
  {
    level: 1, name: "Starter", objective: "Love the game + basic coordination",
    groups: [
      { label: "Technical", items: ["Lobbing (straight)", "Lift (straight / cross)", "High serve"] },
      { label: "Footwork", items: ["Front & back movement", "Four corner (front & back)"] },
      { label: "Physical / Coordination", items: ["Basic agility games", "Balance exercises", "Hand–eye coordination", "Reaction games"] },
      { label: "Game Understanding", items: ["Basic rules of badminton", "How to hold racket", "Court awareness"] },
    ],
  },
  {
    level: 2, name: "Beginner", objective: "Build steady fundamental technique",
    groups: [
      { label: "Technical", items: ["Drop (straight / cross)", "Net shot (straight / cross)", "Low serve"] },
      { label: "Footwork", items: ["Six corner movement"] },
      { label: "Physical", items: ["Agility ladder", "Basic speed drills", "Reaction training"] },
      { label: "Game Understanding", items: ["Simple rally practice", "Basic singles positioning", "Introduction to doubles"] },
    ],
  },
  {
    level: 3, name: "Intermediate", objective: "Match-ready ability",
    groups: [
      { label: "Technical", items: ["Smash", "Tap / net kill", "Cross net shot", "Clear consistency"] },
      { label: "Footwork", items: ["Six corner with speed", "Recovery movement", "Shadow footwork"] },
      { label: "Physical", items: ["Speed & agility", "Jump training", "Core stability"] },
      { label: "Game Understanding", items: ["Basic singles tactics", "Basic doubles rotation", "Rally control"] },
    ],
  },
  {
    level: 4, name: "Advanced", objective: "Complete technique + tactical awareness",
    groups: [
      { label: "Technical", items: ["Jump smash", "Half smash", "Drive (FH/BH)", "Backhand clear", "Net kill"] },
      { label: "Footwork", items: ["Advanced six corner", "Attack footwork", "Recovery speed drills"] },
      { label: "Physical", items: ["Speed endurance", "Agility reaction", "Core strength"] },
      { label: "Tactical", items: ["Singles attack vs defense", "Doubles rotation", "Shot selection"] },
    ],
  },
  {
    level: 5, name: "Competition Team", objective: "Competition training",
    groups: [
      { label: "Technical", items: ["Smash variation", "Deception drop", "Fast drive rally", "Net spinning"] },
      { label: "Tactical — Singles", items: ["Rally building", "Court control"] },
      { label: "Tactical — Doubles", items: ["Front court interception", "Defensive formation"] },
      { label: "Footwork", items: ["Multi shuttle footwork", "Explosive movement"] },
      { label: "Physical", items: ["Interval training", "Jump power", "Speed endurance"] },
      { label: "Mental", items: ["Match discipline", "Pressure handling"] },
    ],
  },
  {
    level: 6, name: "Elite Team", objective: "High-performance athlete",
    groups: [
      { label: "Technical", items: ["Advanced deception", "Reverse slice drop", "Backhand smash", "Net tumbling control"] },
      { label: "Tactical — Singles", items: ["Tempo control", "Opponent reading"] },
      { label: "Tactical — Doubles", items: ["High speed attacking system", "Tactical variation"] },
      { label: "Footwork", items: ["Random multi shuttle", "High speed recovery"] },
      { label: "Physical", items: ["Strength training", "Advanced agility", "Endurance conditioning"] },
    ],
  },
];

// Per-level color ramp — one distinct tone per level so the LevelLadder, parent
// level card, syllabus headers and exam history all read at a glance. The
// coarse 4-rank palette in src/lib/ranks.ts stays put for the leaderboard.
export const LEVEL_BADGE: Record<number, string> = {
  1: "bg-emerald-100 text-emerald-700",
  2: "bg-teal-100 text-teal-700",
  3: "bg-blue-100 text-blue-700",
  4: "bg-amber-100 text-amber-700",
  5: "bg-rose-100 text-rose-700",
  6: "bg-purple-100 text-purple-700",
};
export const LEVEL_CARD: Record<number, string> = {
  1: "border-emerald-200 bg-emerald-50 text-emerald-800",
  2: "border-teal-200 bg-teal-50 text-teal-800",
  3: "border-blue-200 bg-blue-50 text-blue-800",
  4: "border-amber-200 bg-amber-50 text-amber-800",
  5: "border-rose-200 bg-rose-50 text-rose-800",
  6: "border-purple-200 bg-purple-50 text-purple-800",
};
// Bg + text class for the active ladder node (solid pill, white text).
export const LEVEL_ACTIVE: Record<number, string> = {
  1: "bg-emerald-600 text-white ring-4 ring-emerald-100",
  2: "bg-teal-600 text-white ring-4 ring-teal-100",
  3: "bg-blue-600 text-white ring-4 ring-blue-100",
  4: "bg-amber-600 text-white ring-4 ring-amber-100",
  5: "bg-rose-600 text-white ring-4 ring-rose-100",
  6: "bg-purple-600 text-white ring-4 ring-purple-100",
};
// Text-only accent (for "Level X · Name" headings).
export const LEVEL_INK: Record<number, string> = {
  1: "text-emerald-700", 2: "text-teal-700", 3: "text-blue-700",
  4: "text-amber-700", 5: "text-rose-700", 6: "text-purple-700",
};

export function levelBadgeClass(level: number | null | undefined): string {
  return (level && LEVEL_BADGE[level]) || "bg-slate-100 text-slate-500";
}
export function levelCardClass(level: number | null | undefined): string {
  return (level && LEVEL_CARD[level]) || "border-slate-200 bg-slate-50 text-slate-700";
}
export function levelActiveClass(level: number | null | undefined): string {
  return (level && LEVEL_ACTIVE[level]) || "bg-slate-600 text-white";
}
export function levelInkClass(level: number | null | undefined): string {
  return (level && LEVEL_INK[level]) || "text-slate-700";
}

export function levelInfo(level: number | null | undefined): TrainingLevel | null {
  if (!level) return null;
  return TRAINING_LEVELS.find((l) => l.level === level) ?? null;
}

export function levelName(level: number | null | undefined): string {
  return levelInfo(level)?.name ?? "—";
}

// The 6 level names, in order — the single tier vocabulary used app-wide for
// student standing AND class / fee-plan tiers (Option C: the old 4-tier rank
// was retired). The legacy 4 tiers (Beginner/Intermediate/Advanced/Elite) are a
// subset of these names, so old class/fee data keeps resolving.
export const LEVEL_NAMES = TRAINING_LEVELS.map((l) => l.name);

// Name → level number. Tolerates the legacy "Elite" label (→ Elite Team / 6).
export function levelFromName(name: string | null | undefined): number | null {
  if (!name) return null;
  const exact = TRAINING_LEVELS.find((l) => l.name === name);
  if (exact) return exact.level;
  if (name === "Elite") return 6; // legacy 4-tier label
  return null;
}

// Colour a tier expressed as a level NAME (class.level, fee_plan.rank).
export function levelNameBadgeClass(name: string | null | undefined): string {
  return levelBadgeClass(levelFromName(name));
}
export function levelNameCardClass(name: string | null | undefined): string {
  return levelCardClass(levelFromName(name));
}

// Coarse 4-tier rank derived from the fine 6-level (keeps the existing leaderboard
// / badge / fee-tier plumbing in sync with the training ladder — one ladder, two
// granularities). See src/lib/ranks.ts CLASS_RANKS.
export function levelToRank(level: number | null | undefined): string | null {
  if (!level) return null;
  if (level <= 2) return "Beginner";
  if (level === 3) return "Intermediate";
  if (level === 4) return "Advanced";
  return "Elite"; // 5–6
}

// ─── Exam rubric ────────────────────────────────────────────────────────────
export type SectionKey = "technical" | "footwork" | "tactical" | "physical";

export interface ExamItem {
  label: string;
  max: number;
}
export interface ExamSection {
  key: SectionKey;
  label: string; // faithful per-level label (Game vs Tactical, Attitude vs Mental)
  max: number;   // section cap (40 / 25 / 20 / 15)
  items: ExamItem[];
}
export interface ExamSpec {
  fromLevel: number;
  toLevel: number;      // fromLevel + 1, except L6 review (7 = "stay Elite")
  title: string;        // e.g. "Starter Assessment"
  review?: boolean;     // L6 = Elite review, not a promotion
  sections: ExamSection[];
}

// Section maxes are fixed across every level: 40 / 25 / 20 / 15 = 100.
export const SECTION_MAX: Record<SectionKey, number> = {
  technical: 40, footwork: 25, tactical: 20, physical: 15,
};

export const EXAM_SPECS: ExamSpec[] = [
  {
    fromLevel: 1, toLevel: 2, title: "Starter Assessment",
    sections: [
      { key: "technical", label: "Technical", max: 40, items: [
        { label: "Lobbing straight consistency", max: 15 },
        { label: "Lift (straight / cross)", max: 15 },
        { label: "High serve", max: 10 },
      ]},
      { key: "footwork", label: "Footwork", max: 25, items: [
        { label: "Front & back movement", max: 10 },
        { label: "Four corner movement", max: 15 },
      ]},
      { key: "tactical", label: "Game Understanding", max: 20, items: [
        { label: "Grip", max: 10 },
        { label: "Basic rally / court awareness", max: 10 },
      ]},
      { key: "physical", label: "Physical / Attitude", max: 15, items: [
        { label: "Coordination", max: 5 },
        { label: "Focus", max: 5 },
        { label: "Effort", max: 5 },
      ]},
    ],
  },
  {
    fromLevel: 2, toLevel: 3, title: "Beginner Assessment",
    sections: [
      { key: "technical", label: "Technical", max: 40, items: [
        { label: "Drop shot accuracy", max: 15 },
        { label: "Net shot control", max: 15 },
        { label: "Low serve", max: 10 },
      ]},
      { key: "footwork", label: "Footwork", max: 25, items: [
        { label: "Six corner movement", max: 15 },
        { label: "Recovery speed", max: 10 },
      ]},
      { key: "tactical", label: "Game Understanding", max: 20, items: [
        { label: "Basic rally", max: 10 },
        { label: "Court positioning", max: 10 },
      ]},
      { key: "physical", label: "Physical / Attitude", max: 15, items: [
        { label: "Agility", max: 5 },
        { label: "Focus", max: 5 },
        { label: "Effort", max: 5 },
      ]},
    ],
  },
  {
    fromLevel: 3, toLevel: 4, title: "Intermediate Assessment",
    sections: [
      { key: "technical", label: "Technical", max: 40, items: [
        { label: "Smash technique", max: 15 },
        { label: "Cross net shot", max: 15 },
        { label: "Tap / net kill", max: 10 },
      ]},
      { key: "footwork", label: "Footwork", max: 25, items: [
        { label: "Six corner speed", max: 15 },
        { label: "Shadow movement", max: 10 },
      ]},
      { key: "tactical", label: "Game Understanding", max: 20, items: [
        { label: "Singles positioning", max: 10 },
        { label: "Rally control", max: 10 },
      ]},
      { key: "physical", label: "Physical / Attitude", max: 15, items: [
        { label: "Speed", max: 5 },
        { label: "Jump", max: 5 },
        { label: "Effort", max: 5 },
      ]},
    ],
  },
  {
    fromLevel: 4, toLevel: 5, title: "Advanced Assessment",
    sections: [
      { key: "technical", label: "Technical", max: 40, items: [
        { label: "Jump smash", max: 10 },
        { label: "Drive control (FH/BH)", max: 10 },
        { label: "Net kill", max: 10 },
        { label: "Backhand clear", max: 10 },
      ]},
      { key: "footwork", label: "Footwork", max: 25, items: [
        { label: "Advanced six corner", max: 15 },
        { label: "Attack recovery", max: 10 },
      ]},
      { key: "tactical", label: "Tactical Understanding", max: 20, items: [
        { label: "Singles attack / defense", max: 10 },
        { label: "Doubles rotation", max: 10 },
      ]},
      { key: "physical", label: "Physical / Attitude", max: 15, items: [
        { label: "Speed endurance", max: 5 },
        { label: "Agility", max: 5 },
        { label: "Attitude / discipline", max: 5 },
      ]},
    ],
  },
  {
    fromLevel: 5, toLevel: 6, title: "Competition Team Assessment",
    sections: [
      { key: "technical", label: "Technical", max: 40, items: [
        { label: "Smash variation", max: 10 },
        { label: "Deception drop", max: 10 },
        { label: "Net spinning", max: 10 },
        { label: "Fast drive rally", max: 10 },
      ]},
      { key: "footwork", label: "Footwork", max: 25, items: [
        { label: "Explosive six corner", max: 15 },
        { label: "Multi shuttle movement", max: 10 },
      ]},
      { key: "tactical", label: "Tactical Understanding", max: 20, items: [
        { label: "Match strategy", max: 10 },
        { label: "Court control", max: 10 },
      ]},
      { key: "physical", label: "Physical / Mental", max: 15, items: [
        { label: "Power", max: 5 },
        { label: "Endurance", max: 5 },
        { label: "Mental discipline", max: 5 },
      ]},
    ],
  },
  {
    fromLevel: 6, toLevel: 7, title: "Elite Assessment", review: true,
    sections: [
      { key: "technical", label: "Technical", max: 40, items: [
        { label: "Advanced deception", max: 10 },
        { label: "Reverse slice / variation shot", max: 10 },
        { label: "Backhand smash / advanced attack", max: 10 },
        { label: "Net tumbling control", max: 10 },
      ]},
      { key: "footwork", label: "Footwork", max: 25, items: [
        { label: "Random multi shuttle", max: 15 },
        { label: "High speed recovery", max: 10 },
      ]},
      { key: "tactical", label: "Tactical Understanding", max: 20, items: [
        { label: "Rally construction / tempo control", max: 10 },
        { label: "Opponent reading / match decision", max: 10 },
      ]},
      { key: "physical", label: "Physical / Mental", max: 15, items: [
        { label: "Strength", max: 5 },
        { label: "Endurance", max: 5 },
        { label: "Match discipline / composure", max: 5 },
      ]},
    ],
  },
];

export function examSpecFor(fromLevel: number): ExamSpec | null {
  return EXAM_SPECS.find((e) => e.fromLevel === fromLevel) ?? null;
}

// ─── Pass bands ─────────────────────────────────────────────────────────────
export const PROMOTE_MIN = 70; // ≥70 → eligible to promote

export type BandKey = "excellent" | "pass" | "borderline" | "fail";
export interface Band {
  key: BandKey;
  label: string;
  tone: "green" | "blue" | "yellow" | "red";
  note: string;
}
const BANDS: { min: number; band: Band }[] = [
  { min: 80, band: { key: "excellent", label: "Excellent", tone: "green", note: "Technically stable — ready to level up." } },
  { min: 70, band: { key: "pass", label: "Pass", tone: "blue", note: "Meets the standard — promote, keep working on weak areas." } },
  { min: 60, band: { key: "borderline", label: "Borderline", tone: "yellow", note: "Close — hold level, retest in 1–2 months." } },
  { min: 0,  band: { key: "fail", label: "Fail", tone: "red", note: "Below standard — stay at level, rebuild basics." } },
];

export function bandFor(total: number): Band {
  for (const b of BANDS) if (total >= b.min) return b.band;
  return BANDS[BANDS.length - 1].band;
}

// ─── Exam eligibility ───────────────────────────────────────────────────────
// A student needs >=70% attendance over the recent window to sit a promotion
// exam. Catches sit-the-exam-cold cases the syllabus warns about; admin override
// not exposed yet — coach can ask the admin to bump the level directly if a
// genuine edge case comes up.
export const EXAM_ATTENDANCE_MIN_PCT = 70;
export const EXAM_ATTENDANCE_WINDOW_DAYS = 90;
export const EXAM_ATTENDANCE_MIN_SESSIONS = 4; // need at least this many to judge

export interface ExamEligibility {
  eligible: boolean;
  attendedPct: number | null; // null = too few sessions to judge yet
  attended: number;
  total: number;
  reason: string | null; // human-readable why-not (null = eligible)
}

export async function getExamEligibility(
  supabase: any,
  studentId: string,
): Promise<ExamEligibility> {
  const since = new Date(Date.now() - EXAM_ATTENDANCE_WINDOW_DAYS * 86_400_000)
    .toISOString().slice(0, 10);
  const { data } = await supabase
    .from("attendance")
    .select("status, sessions!inner(session_date)")
    .eq("student_id", studentId)
    .gte("sessions.session_date", since);
  const rows = (data ?? []) as { status: string }[];
  const total = rows.length;
  const attended = rows.filter((r) => r.status === "present" || r.status === "late").length;

  if (total < EXAM_ATTENDANCE_MIN_SESSIONS) {
    return {
      eligible: false, attendedPct: null, attended, total,
      reason: `Needs at least ${EXAM_ATTENDANCE_MIN_SESSIONS} sessions in the last ${EXAM_ATTENDANCE_WINDOW_DAYS} days (has ${total}).`,
    };
  }
  const pct = Math.round((attended / total) * 100);
  if (pct < EXAM_ATTENDANCE_MIN_PCT) {
    return {
      eligible: false, attendedPct: pct, attended, total,
      reason: `Attendance ${pct}% is below the ${EXAM_ATTENDANCE_MIN_PCT}% required for a promotion exam.`,
    };
  }
  return { eligible: true, attendedPct: pct, attended, total, reason: null };
}

export type Decision = "promote" | "maintain" | "reassess";
export const DECISION_LABEL: Record<Decision, string> = {
  promote: "Promote",
  maintain: "Maintain current level",
  reassess: "Reassess next cycle",
};

// Default promotion decision from the score + whether this is the L6 review.
export function defaultDecision(total: number, review: boolean): Decision {
  if (review) return total >= PROMOTE_MIN ? "maintain" : "reassess"; // L6: stay-Elite vs review
  if (total >= PROMOTE_MIN) return "promote";
  if (total >= 60) return "reassess";
  return "maintain";
}
