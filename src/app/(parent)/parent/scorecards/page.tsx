import { requireParent } from "@/lib/parent-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card, Badge, EmptyState, cn } from "@/components/ui";
import { formatDate } from "@/lib/format";
import {
  bandFor, DECISION_LABEL, levelBadgeClass, nextExamWindow,
  type Decision,
} from "@/lib/training";
import { getLevelsMerged } from "@/lib/syllabus";

export const dynamic = "force-dynamic";

const BAND_TONE: Record<string, "green" | "blue" | "yellow" | "red" | "slate"> = {
  excellent: "green", pass: "blue", borderline: "yellow", fail: "red",
};
const SEC_BAR: Record<string, string> = {
  technical: "bg-amber-500", footwork: "bg-blue-500", tactical: "bg-emerald-600", physical: "bg-purple-500",
};
const SEC_TRACK: Record<string, string> = {
  technical: "bg-amber-100", footwork: "bg-blue-100", tactical: "bg-emerald-100", physical: "bg-purple-100",
};
const SEC_ORDER = ["technical", "footwork", "tactical", "physical"];
const BAND_HERO: Record<string, string> = {
  excellent: "bg-emerald-50", pass: "bg-blue-50", borderline: "bg-amber-50", fail: "bg-red-50",
};

// Parent Progress Card — the student's promotion-exam result (the HBA v2 progress
// card). Replaces the retired monthly Growth Report. Shows the latest graded exam
// per child + history; the full breakdown is one tap away.
export default async function ParentProgressPage() {
  const me = await requireParent();
  const supabase = createAdminClient();

  const { data: kids } = await supabase
    .from("students")
    .select("id, full_name, level")
    .eq("parent_id", me.id)
    .order("full_name");
  const kidIds = (kids ?? []).map((k: any) => k.id);

  const [{ data: exams }, levels] = await Promise.all([
    kidIds.length
      ? supabase
          .from("level_exams")
          .select("id, student_id, exam_date, window_label, from_level, to_level, technical, footwork, tactical, physical, total, band, decision, scores, coach_comment, next_target")
          .in("student_id", kidIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    getLevelsMerged(),
  ]);
  const levelName = new Map(levels.map((l) => [l.level, l.name]));
  const win = nextExamWindow();

  // Group exams by child, newest first.
  const byKid = new Map<string, any[]>();
  for (const e of (exams ?? []) as any[]) {
    const arr = byKid.get(e.student_id) ?? [];
    arr.push(e);
    byKid.set(e.student_id, arr);
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Progress Card" description="Your child's promotion-exam results. Exams run every 4 months — April, August, December." />

      {!kids || kids.length === 0 ? (
        <EmptyState message="No children linked to your account yet. Contact the academy." />
      ) : (
        kids.map((k: any) => {
          const lvl = Number(k.level ?? 1);
          const history = byKid.get(k.id) ?? [];
          const latest = history[0] ?? null;
          return (
            <Card key={k.id} className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-slate-900">{k.full_name}</span>
                  <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold", levelBadgeClass(lvl))}>
                    L{lvl} · {levelName.get(lvl) ?? "—"}
                  </span>
                </div>
                <span className="text-xs text-slate-400">Next exam: {win.label}</span>
              </div>

              {latest ? (
                <>
                  <div className={cn("flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between", BAND_HERO[latest.band] ?? "bg-slate-50")}>
                    <div>
                      <div className="text-xs font-medium text-slate-500">Latest exam · {formatDate(latest.exam_date)}</div>
                      <div className="text-4xl font-bold leading-none text-slate-900">
                        {latest.total}<span className="ml-1 text-base font-medium text-slate-500">/100</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-1 sm:items-end">
                      <Badge tone={BAND_TONE[latest.band] ?? "slate"}>{bandFor(Number(latest.total)).label}</Badge>
                      <span className="text-xs font-medium text-slate-600">{DECISION_LABEL[latest.decision as Decision] ?? latest.decision}</span>
                    </div>
                  </div>

                  <details className="group mt-3">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-emerald-700">
                      <span className="transition-transform group-open:rotate-90">▸</span> See full breakdown
                    </summary>
                    <div className="mt-4 space-y-3">
                      {SEC_ORDER.map((key) => {
                        const sec = latest.scores?.[key];
                        if (!sec) return null;
                        const pct = sec.max ? Math.round((sec.subtotal / sec.max) * 100) : 0;
                        return (
                          <div key={key}>
                            <div className="flex justify-between text-xs text-slate-600">
                              <span>{sec.label}</span>
                              <span className="font-medium text-slate-900">{sec.subtotal}/{sec.max}</span>
                            </div>
                            <div className={cn("mt-1 h-1.5 rounded-full", SEC_TRACK[key])}>
                              <div className={cn("h-1.5 rounded-full", SEC_BAR[key])} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      {latest.coach_comment && (
                        <p className="rounded-lg bg-slate-50 p-3 text-sm italic text-slate-700">“{latest.coach_comment}”</p>
                      )}
                      {latest.next_target && (
                        <p className="text-sm text-slate-600"><span className="font-medium text-slate-800">Next target:</span> {latest.next_target}</p>
                      )}
                    </div>
                  </details>

                  <a href={`/api/exams/${latest.id}/pdf`} target="_blank" rel="noopener" className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:underline">
                    Download exam report (PDF) →
                  </a>

                  {history.length > 1 && (
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Earlier exams</div>
                      <ul className="space-y-1.5">
                        {history.slice(1).map((h: any) => (
                          <li key={h.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-slate-500">{formatDate(h.exam_date)} · L{h.from_level}→{h.to_level > 6 ? "Elite" : h.to_level}</span>
                            <span className="flex items-center gap-2">
                              <span className="font-medium text-slate-700">{h.total}/100</span>
                              <Badge tone={BAND_TONE[h.band] ?? "slate"}>{h.band ?? "—"}</Badge>
                              <a href={`/api/exams/${h.id}/pdf`} target="_blank" rel="noopener" className="text-emerald-700 hover:underline">PDF</a>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No exam taken yet. Promotion exams run every 4 months — April, August, December.
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
