import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  PageHeader, Section, Table, Th, Td, EmptyState, Badge, StatCard, LinkButton,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { formatDate } from "@/lib/format";
import {
  nextExamWindow, isExamMonth, EXAM_ATTENDANCE_MIN_PCT,
} from "@/lib/training";
import { loadSyllabus } from "@/lib/syllabus";
import { dict } from "@/lib/i18n";
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
  const me = await requireRole("admin");
  const L = dict(me.locale);
  const { promoted, error, n } = await searchParams;
  const supabase = await createClient();
  const win = nextExamWindow();
  const examMonth = isExamMonth();
  const bandLabel: Record<string, string> = {
    excellent: L.ex_band_excellent, pass: L.ex_band_pass, borderline: L.ex_band_borderline, fail: L.ex_band_fail,
  };
  const decisionLabel: Record<string, string> = {
    promote: L.ex_dec_promote, maintain: L.ex_dec_maintain, reassess: L.ex_dec_reassess,
  };

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
        title={L.ex_title}
        description={L.ex_desc}
        action={<LinkButton href="/admin/training" variant="secondary">{L.ex_syllabus}</LinkButton>}
      />

      {promoted && (
        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {promoted === "already"
            ? L.ex_promo_already
            : promoted === "batch"
            ? L.ex_promo_batch.replace("{n}", n ?? "0")
            : L.ex_promo_one}
        </p>
      )}
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border p-3 text-sm shadow-sm ${examMonth ? "border-green-300 bg-green-50" : "border-slate-200 bg-white"}`}>
        <span className="font-medium text-slate-800">{examMonth ? L.ex_window_open : L.ex_next_window}</span>
        <span className={examMonth ? "text-green-700" : "text-slate-500"}>{win.label}</span>
        <span className="text-slate-400">{L.ex_cycle}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={L.adm_active_students} value={totalStudents} />
        <StatCard label={L.ex_recorded} value={(exams ?? []).length} />
        <StatCard label={L.ex_promotions} value={passes} tone="green" />
        <StatCard label={L.ex_elite} value={(dist.get(5) ?? 0) + (dist.get(6) ?? 0)} tone="blue" />
      </div>

      {/* ── Grading day ─────────────────────────────────────────────────────── */}
      {(toAssess.length > 0 || recommendedNow.length > 0) && (
        <Section
          title={`${L.ex_grading_day} · ${win.label}`}
          description={L.ex_grading_desc}
          flush
        >
          {recommendedNow.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-emerald-50/60 px-5 py-3">
              <span className="text-sm text-slate-700">{L.ex_recommended_line.replace("{n}", String(recommendedNow.length))}</span>
              <form action={promoteAllRecommended}>
                <input type="hidden" name="window_label" value={win.label} />
                <SubmitButton pendingText={L.ex_promoting}>⬆ {L.ex_promote_all} {recommendedNow.length}</SubmitButton>
              </form>
            </div>
          )}
          {toAssess.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {toAssess.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <Link href={`/admin/students/${s.id}`} className="font-medium text-slate-900 hover:text-green-700 hover:underline">{s.full_name}</Link>
                  <span className="text-xs text-slate-500">L{s.level ?? 1} · {levelName(s.level ?? 1)}</span>
                  <Badge tone="green">{s.pct}% {L.ex_att_short}</Badge>
                  <span className="ml-auto text-xs text-slate-400">{L.ex_awaiting}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-4 text-sm text-slate-500">{L.ex_all_assessed}</div>
          )}
        </Section>
      )}

      <Section title={L.ex_by_level} flush>
        <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-6">
          {syl.map((lv) => (
            <div key={lv.level} className="bg-white p-4 text-center">
              <div className="text-2xl font-bold tabular-nums text-slate-900">{dist.get(lv.level) ?? 0}</div>
              <div className="mt-1 text-xs text-slate-500">L{lv.level} · {lv.name}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={L.ex_recent} flush>
        {exams && exams.length > 0 ? (
          <Table>
            <thead>
              <tr><Th>{L.col_date}</Th><Th>{L.student_col}</Th><Th>{L.level_word}</Th><Th>{L.ex_score}</Th><Th>{L.ex_result}</Th><Th>{L.ex_recommends}</Th><Th>{L.adm_coach}</Th><Th className="text-right">{L.col_actions}</Th></tr>
            </thead>
            <tbody>
              {(exams as any[]).map((e) => {
                const canPromote = e.decision === "promote" && e.to_level <= 6 && Number(e.students?.level ?? 1) < Number(e.to_level);
                return (
                <tr key={e.id} className="hover:bg-slate-50">
                  <Td>{formatDate(e.exam_date)}{e.window_label ? <span className="block text-xs text-slate-400">{e.window_label}</span> : null}</Td>
                  <Td label={L.student_col} className="font-medium text-slate-900">{e.students?.full_name ?? "—"}</Td>
                  <Td label={L.level_word}>{e.from_level} → {e.to_level > 6 ? L.ex_elite_word : `${e.to_level} (${levelName(e.to_level)})`}</Td>
                  <Td label={L.ex_score} className="font-semibold tabular-nums">{e.total}/100</Td>
                  <Td label={L.ex_result}><Badge tone={BAND_TONE[e.band] ?? "slate"}>{e.band ? (bandLabel[e.band] ?? e.band) : "—"}</Badge></Td>
                  <Td label={L.ex_recommends} className="text-slate-600">{e.decision ? (decisionLabel[e.decision] ?? e.decision) : "—"}</Td>
                  <Td label={L.adm_coach} className="text-slate-500">{e.coach?.full_name ?? "—"}</Td>
                  <Td label={L.col_actions} className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <a href={`/api/exams/${e.id}/pdf`} target="_blank" rel="noopener" className="text-green-700 hover:underline">PDF</a>
                      {canPromote && (
                        <form action={promoteFromExam}>
                          <input type="hidden" name="exam_id" value={e.id} />
                          <SubmitButton pendingText="…" className="!px-2.5 !py-1 text-xs">⬆ {L.ex_promote_to}L{e.to_level}</SubmitButton>
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
          <div className="p-5"><EmptyState message={L.ex_empty} /></div>
        )}
      </Section>
    </div>
  );
}
