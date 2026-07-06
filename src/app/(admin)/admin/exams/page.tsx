import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  PageHeader, Section, Table, Th, Td, EmptyState, Badge, StatCard, LinkButton,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { formatDate } from "@/lib/format";
import {
  nextExamWindow, isExamMonth, DECISION_LABEL, EXAM_ATTENDANCE_MIN_PCT, type Decision,
} from "@/lib/training";
import { loadSyllabus } from "@/lib/syllabus";
import { promoteFromExam, promoteAllRecommended } from "./actions";

export const dynamic = "force-dynamic";

const BAND_TONE: Record<string, "green" | "blue" | "yellow" | "red" | "slate"> = {
  excellent: "green", pass: "blue", borderline: "yellow", fail: "red",
};

export default async function AdminExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ promoted?: string; error?: string; n?: string }>;
}) {
  await requireRole("admin");
  const { promoted, error, n } = await searchParams;
  const supabase = await createClient();
  const win = nextExamWindow();
  const examMonth = isExamMonth();

  const [{ data: exams }, { data: students }, { levels: syl }] = await Promise.all([
    supabase
      .from("level_exams")
      .select("id, exam_date, window_label, from_level, to_level, total, band, decision, students(full_name, level), coach:profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("students").select("id, full_name, level").eq("status", "active"),
    loadSyllabus(),
  ]);
  const nameByLevel = new Map(syl.map((l) => [l.level, l.name]));
  const levelName = (nn: number) => nameByLevel.get(nn) ?? "—";

  // ── Grading day: who's eligible but not yet assessed this window ──────────
  const activeStudents = (students ?? []) as any[];
  const sIds = activeStudents.map((s) => s.id);
  const since90 = new Date(Date.now() + 8 * 3600 * 1000 - 90 * 86400000).toISOString().slice(0, 10);
  const [{ data: att90 }, { data: assessedRows }] = await Promise.all([
    sIds.length
      ? supabase.from("attendance").select("student_id, status, sessions(session_date)").in("student_id", sIds).limit(20000)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from("level_exams").select("student_id").eq("window_label", win.label),
  ]);
  const tally = new Map<string, { marked: number; att: number }>();
  for (const a of (att90 ?? []) as any[]) {
    const d = a.sessions?.session_date as string | undefined;
    if (!d || d < since90) continue;
    const t = tally.get(a.student_id) ?? { marked: 0, att: 0 };
    t.marked++;
    if (a.status === "present" || a.status === "late") t.att++;
    tally.set(a.student_id, t);
  }
  const assessedThisWindow = new Set((assessedRows ?? []).map((r: any) => r.student_id));
  const toAssess = activeStudents
    .filter((s) => !assessedThisWindow.has(s.id))
    .map((s) => {
      const t = tally.get(s.id);
      const pct = t && t.marked ? Math.round((t.att / t.marked) * 100) : 0;
      const eligible = !!t && t.marked >= 4 && pct >= EXAM_ATTENDANCE_MIN_PCT;
      return { ...s, pct, eligible };
    })
    .filter((s) => s.eligible)
    .sort((a, b) => (a.level ?? 1) - (b.level ?? 1) || a.full_name.localeCompare(b.full_name));
  const recommendedNow = (exams ?? []).filter((e: any) =>
    e.window_label === win.label && e.decision === "promote" && Number(e.to_level) <= 6 && Number(e.students?.level ?? 1) < Number(e.to_level),
  );

  // Level distribution across active students (null = not yet leveled → Level 1).
  const dist = new Map<number, number>();
  for (const s of (students ?? []) as any[]) {
    const lv = s.level ?? 1;
    dist.set(lv, (dist.get(lv) ?? 0) + 1);
  }
  const totalStudents = (students ?? []).length;
  const passes = (exams ?? []).filter((e: any) => e.decision === "promote").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Level exams"
        description="Coaches mark assessments; you approve promotions here. Exams run quarterly — January, April, July, October."
        action={<LinkButton href="/admin/training" variant="secondary">Syllabus</LinkButton>}
      />

      {promoted && (
        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {promoted === "already"
            ? "That student is already at (or above) that level."
            : promoted === "batch"
            ? `Promoted ${n ?? "0"} student${n === "1" ? "" : "s"} — parents notified.`
            : "Promoted — the parent has been notified."}
        </p>
      )}
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border p-3 text-sm shadow-sm ${examMonth ? "border-green-300 bg-green-50" : "border-slate-200 bg-white"}`}>
        <span className="font-medium text-slate-800">{examMonth ? "🏸 Exam window is open" : "Next exam window"}</span>
        <span className={examMonth ? "text-green-700" : "text-slate-500"}>{win.label}</span>
        <span className="text-slate-400">· Cycle: January / April / July / October</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Active students" value={totalStudents} />
        <StatCard label="Exams recorded" value={(exams ?? []).length} />
        <StatCard label="Promotions" value={passes} tone="green" />
        <StatCard label="Elite (L5–6)" value={(dist.get(5) ?? 0) + (dist.get(6) ?? 0)} tone="blue" />
      </div>

      {/* ── Grading day ─────────────────────────────────────────────────────── */}
      {(toAssess.length > 0 || recommendedNow.length > 0) && (
        <Section
          title={`Grading day · ${win.label}`}
          description="Eligible students still to assess this window, plus one-tap promotion for those recommended."
          flush
        >
          {recommendedNow.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-emerald-50/60 px-5 py-3">
              <span className="text-sm text-slate-700">{recommendedNow.length} assessed student{recommendedNow.length === 1 ? "" : "s"} recommended for promotion this window.</span>
              <form action={promoteAllRecommended}>
                <input type="hidden" name="window_label" value={win.label} />
                <SubmitButton pendingText="Promoting…">⬆ Promote all {recommendedNow.length}</SubmitButton>
              </form>
            </div>
          )}
          {toAssess.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {toAssess.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <Link href={`/admin/students/${s.id}`} className="font-medium text-slate-900 hover:text-green-700 hover:underline">{s.full_name}</Link>
                  <span className="text-xs text-slate-500">L{s.level ?? 1} · {levelName(s.level ?? 1)}</span>
                  <Badge tone="green">{s.pct}% att</Badge>
                  <span className="ml-auto text-xs text-slate-400">awaiting coach assessment</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-4 text-sm text-slate-500">Every eligible student has been assessed this window. 🎉</div>
          )}
        </Section>
      )}

      <Section title="Students by level" flush>
        <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-6">
          {syl.map((lv) => (
            <div key={lv.level} className="bg-white p-4 text-center">
              <div className="text-2xl font-bold tabular-nums text-slate-900">{dist.get(lv.level) ?? 0}</div>
              <div className="mt-1 text-xs text-slate-500">L{lv.level} · {lv.name}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Recent exams" flush>
        {exams && exams.length > 0 ? (
          <Table>
            <thead>
              <tr><Th>Date</Th><Th>Student</Th><Th>Level</Th><Th>Score</Th><Th>Result</Th><Th>Recommends</Th><Th>Coach</Th><Th className="text-right">Action</Th></tr>
            </thead>
            <tbody>
              {(exams as any[]).map((e) => {
                const canPromote = e.decision === "promote" && e.to_level <= 6 && Number(e.students?.level ?? 1) < Number(e.to_level);
                return (
                <tr key={e.id} className="hover:bg-slate-50">
                  <Td>{formatDate(e.exam_date)}{e.window_label ? <span className="block text-xs text-slate-400">{e.window_label}</span> : null}</Td>
                  <Td label="Student" className="font-medium text-slate-900">{e.students?.full_name ?? "—"}</Td>
                  <Td label="Level">{e.from_level} → {e.to_level > 6 ? "Elite" : `${e.to_level} (${levelName(e.to_level)})`}</Td>
                  <Td label="Score" className="font-semibold tabular-nums">{e.total}/100</Td>
                  <Td label="Result"><Badge tone={BAND_TONE[e.band] ?? "slate"}>{e.band ?? "—"}</Badge></Td>
                  <Td label="Recommends" className="text-slate-600">{DECISION_LABEL[e.decision as Decision] ?? e.decision ?? "—"}</Td>
                  <Td label="Coach" className="text-slate-500">{e.coach?.full_name ?? "—"}</Td>
                  <Td label="Actions" className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <a href={`/api/exams/${e.id}/pdf`} target="_blank" rel="noopener" className="text-green-700 hover:underline">PDF</a>
                      {canPromote && (
                        <form action={promoteFromExam}>
                          <input type="hidden" name="exam_id" value={e.id} />
                          <SubmitButton pendingText="…" className="!px-2.5 !py-1 text-xs">⬆ Promote to L{e.to_level}</SubmitButton>
                        </form>
                      )}
                    </div>
                  </Td>
                </tr>
              );
              })}
            </tbody>
          </Table>
        ) : (
          <div className="p-5"><EmptyState message="No exams recorded yet. Coaches grade them from their Exams page each window (Jan / Apr / Jul / Oct)." /></div>
        )}
      </Section>
    </div>
  );
}
