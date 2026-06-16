import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const BRAND = rgb(0.059, 0.431, 0.337); // #0F6E56 deep teal
const BRAND_LIGHT = rgb(0.882, 0.961, 0.933); // #E1F5EE
const INK = rgb(0.059, 0.09, 0.165); // #0f172a
const MUTED = rgb(0.42, 0.45, 0.5);
const WHITE = rgb(1, 1, 1);

// Per-group accent colours (match the web report).
const GROUP_COLOR: Record<string, ReturnType<typeof rgb>> = {
  physical: rgb(0.216, 0.541, 0.867), // blue
  technical: rgb(0.729, 0.459, 0.09), // amber
  character: rgb(0.114, 0.62, 0.459), // teal
};
const GROUP_TRACK: Record<string, ReturnType<typeof rgb>> = {
  physical: rgb(0.902, 0.945, 0.984),
  technical: rgb(0.98, 0.933, 0.855),
  character: rgb(0.882, 0.961, 0.933),
};

export interface GrowthDimension {
  name: string;
  category: "physical" | "technical" | "character" | null;
  score: number; // 0–100
}

export interface ScorecardPdfData {
  academyName: string;
  studentName: string;
  periodLabel: string;
  growthIndex: number | null;
  stage: string | null;
  groups: { physical: number | null; technical: number | null; character: number | null };
  dimensions: GrowthDimension[];
  attendancePct: number | null;
  sessionsAttended: number;
  sessionsTotal: number;
  rewardPoints: number;
  trend: { year: number; index: number }[];
  comment?: string | null;
  generatedAt: string;
}

const GROUP_ORDER: ("physical" | "technical" | "character")[] = ["physical", "technical", "character"];
const GROUP_LABEL: Record<string, string> = { physical: "Physical", technical: "Technical", character: "Character" };

export async function renderScorecardPdf(data: ScorecardPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  let page = doc.addPage([595.28, 841.89]); // A4 (more pages added if the remark is long)
  const W = page.getWidth();
  const H = page.getHeight();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const M = 48;

  const text = (s: string, x: number, y: number, size: number, f = font, color = INK) =>
    page.drawText(s, { x, y, size, font: f, color });
  const rightText = (s: string, x: number, y: number, size: number, f = font, color = INK) =>
    page.drawText(s, { x: x - f.widthOfTextAtSize(s, size), y, size, font: f, color });

  // ── Header band ──────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: H - 104, width: W, height: 104, color: BRAND });
  text(data.academyName, M, H - 52, 20, bold, WHITE);
  text("Monthly Growth Report", M, H - 76, 12, font, BRAND_LIGHT);
  rightText(data.periodLabel, W - M, H - 76, 12, bold, WHITE);

  // ── Student + stage ──────────────────────────────────────────
  let y = H - 138;
  text("Student", M, y, 9, font, MUTED);
  text(data.studentName, M, y - 19, 19, bold);
  if (data.stage) {
    const label = `Stage: ${data.stage}`;
    const w = bold.widthOfTextAtSize(label, 11) + 20;
    page.drawRectangle({ x: W - M - w, y: y - 17, width: w, height: 22, color: rgb(0.98, 0.933, 0.855) });
    text(label, W - M - w + 10, y - 11, 11, bold, rgb(0.522, 0.31, 0.043));
  }
  y -= 52;

  // ── Growth index hero + trend ────────────────────────────────
  const heroH = 86;
  page.drawRectangle({ x: M, y: y - heroH, width: W - M * 2, height: heroH, color: BRAND_LIGHT });
  text("HBA Growth Index", M + 16, y - 22, 10, font, BRAND);
  text(data.growthIndex != null ? String(data.growthIndex) : "—", M + 16, y - 60, 34, bold, BRAND);
  text("/ 100", M + 16 + bold.widthOfTextAtSize(data.growthIndex != null ? String(data.growthIndex) : "—", 34) + 6, y - 60, 12, font, BRAND);

  if (data.trend.length) {
    text("Growth over time", M + 190, y - 22, 9, font, BRAND);
    let tx = M + 190;
    data.trend.forEach((t, i) => {
      if (i > 0) text("->", tx, y - 52, 11, font, GROUP_COLOR.character);
      tx += i > 0 ? 18 : 0;
      const boxW = 46;
      page.drawRectangle({ x: tx, y: y - 66, width: boxW, height: 30, color: WHITE, borderColor: rgb(0.62, 0.882, 0.796), borderWidth: 1 });
      text(String(t.index), tx + boxW / 2 - font.widthOfTextAtSize(String(t.index), 13) / 2, y - 56, 13, bold, BRAND);
      text(String(t.year), tx + boxW / 2 - font.widthOfTextAtSize(String(t.year), 8) / 2, y - 78, 8, font, MUTED);
      tx += boxW + 12;
    });
  }
  // attendance + rewards line
  rightText(
    `Attendance ${data.attendancePct != null ? data.attendancePct + "%" : "—"} (${data.sessionsAttended}/${data.sessionsTotal})   •   Reward points ${data.rewardPoints}`,
    W - M - 16,
    y - 74,
    9,
    font,
    BRAND,
  );
  y -= heroH + 28;

  // ── Dimension groups ─────────────────────────────────────────
  const barX = W - M - 190;
  const barW = 190;
  for (const key of GROUP_ORDER) {
    const dims = data.dimensions.filter((d) => d.category === key);
    if (!dims.length) continue;
    const groupScore = data.groups[key];
    text(GROUP_LABEL[key], M, y, 12, bold, GROUP_COLOR[key]);
    rightText(groupScore != null ? `${groupScore}/100` : "—", W - M, y, 11, bold, GROUP_COLOR[key]);
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: rgb(0.89, 0.91, 0.93) });
    y -= 18;
    for (const d of dims) {
      const pct = Math.max(0, Math.min(1, d.score / 100));
      text(d.name, M, y, 10.5, font, INK);
      rightText(String(d.score), barX - 8, y, 10, font, MUTED);
      page.drawRectangle({ x: barX, y: y - 2, width: barW, height: 7, color: GROUP_TRACK[key] });
      page.drawRectangle({ x: barX, y: y - 2, width: barW * pct, height: 7, color: GROUP_COLOR[key] });
      y -= 21;
      if (y < 150) break;
    }
    y -= 8;
  }

  // ── Coach observation ────────────────────────────────────────
  // Footer is drawn on each page as we leave it; a long remark now flows onto a
  // fresh page instead of being silently dropped near the page bottom.
  const footer = () => {
    page.drawLine({ start: { x: M, y: 64 }, end: { x: W - M, y: 64 }, thickness: 1, color: rgb(0.89, 0.91, 0.93) });
    text("Explorer  •  Builder  •  Challenger  •  Leader  •  Champion", M, 48, 9, font, MUTED);
    rightText(`Generated ${data.generatedAt}`, W - M, 48, 9, font, MUTED);
  };
  const newPage = () => {
    footer();
    page = doc.addPage([595.28, 841.89]);
    y = H - 60;
  };

  if (data.comment) {
    if (y < 120) newPage(); // not enough room for the heading + a line
    text("Coach observation", M, y, 12, bold);
    y -= 20;
    for (const line of wrap(data.comment, font, 11, W - M * 2)) {
      if (y < 80) newPage();
      text(line, M, y, 11, font, INK);
      y -= 16;
    }
  }

  footer();
  return doc.save();
}

// Greedy word-wrap to a pixel width.
function wrap(s: string, font: any, size: number, maxW: number): string[] {
  const words = s.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 12);
}
