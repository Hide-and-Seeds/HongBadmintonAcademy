import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { monthLabel } from "@/lib/format";
import { GROUP_LABEL, type GroupKey } from "@/lib/growth";

export const dynamic = "force-dynamic";

const GROUP_BAR: Record<GroupKey, string> = {
  physical: "bg-blue-500",
  technical: "bg-amber-500",
  character: "bg-emerald-600",
};
const GROUP_TRACK: Record<GroupKey, string> = {
  physical: "bg-blue-100",
  technical: "bg-amber-100",
  character: "bg-emerald-100",
};
const GROUP_ORDER: GroupKey[] = ["physical", "technical", "character"];

function GroupBlock({ group, dims }: { group: GroupKey; dims: { name: string; score: number }[] }) {
  if (!dims.length) return null;
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{GROUP_LABEL[group]}</div>
      <div className="space-y-2">
        {dims.map((d) => (
          <div key={d.name}>
            <div className="flex justify-between text-xs text-slate-600">
              <span>{d.name}</span>
              <span className="font-medium text-slate-900">{d.score}</span>
            </div>
            <div className={`mt-1 h-1.5 rounded-full ${GROUP_TRACK[group]}`}>
              <div className={`h-1.5 rounded-full ${GROUP_BAR[group]}`} style={{ width: `${Math.max(0, Math.min(100, d.score))}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function ParentScorecardsPage() {
  await requireRole("parent");
  const supabase = await createClient();

  const { data: cards } = await supabase
    .from("scorecards")
    .select("*, students(full_name)")
    .order("period_month", { ascending: false });

  return (
    <div>
      <PageHeader title="Growth Reports" description="Your child's monthly character & skills growth." />

      {cards && cards.length > 0 ? (
        <div className="space-y-4">
          {cards.map((c: any) => {
            const s = c.summary ?? {};
            const dims: { name: string; category: GroupKey | null; score: number }[] = s.dimensions ?? [];
            const trend: { year: number; index: number }[] = s.trend ?? [];
            return (
              <Card key={c.id} className="p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-900">{c.students?.full_name ?? "—"}</div>
                    <div className="text-sm text-slate-500">{monthLabel(c.period_month)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.stage?.label && <Badge tone="yellow">{s.stage.label}</Badge>}
                    <Badge tone={c.status === "sent" ? "green" : "blue"}>{c.status}</Badge>
                  </div>
                </div>

                {/* Growth index + trend */}
                <div className="mb-5 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl bg-emerald-50 p-4">
                  <div>
                    <div className="text-xs font-medium text-emerald-700">HBA Growth Index</div>
                    <div className="text-4xl font-bold leading-none text-emerald-900">
                      {s.growth_index != null ? s.growth_index : "—"}
                      <span className="ml-1 text-base font-medium text-emerald-700">/100</span>
                    </div>
                  </div>
                  {trend.length > 1 && (
                    <div className="flex items-end gap-2">
                      {trend.map((t, i) => (
                        <div key={t.year} className="flex items-end gap-2">
                          {i > 0 && <span className="pb-2 text-emerald-500">→</span>}
                          <div className="text-center">
                            <div className="flex h-9 min-w-9 items-center justify-center rounded-md bg-emerald-200 px-2 text-sm font-semibold text-emerald-900">
                              {t.index}
                            </div>
                            <div className="mt-1 text-[11px] text-emerald-700">{t.year}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="ml-auto text-right text-xs text-emerald-700">
                    <div>Attendance {s.attendance_pct != null ? `${s.attendance_pct}%` : "—"}</div>
                    <div>Reward points {s.reward_points ?? 0}</div>
                  </div>
                </div>

                {/* Dimension groups */}
                <div className="grid gap-5 sm:grid-cols-3">
                  {GROUP_ORDER.map((g) => (
                    <GroupBlock key={g} group={g} dims={dims.filter((d) => d.category === g)} />
                  ))}
                </div>

                {/* Coach observation */}
                {s.comment && (
                  <div className="mt-5 border-l-[3px] border-emerald-500 bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Coach observation</div>
                    <div className="mt-1 text-sm text-slate-700">{s.comment}</div>
                  </div>
                )}

                {c.pdf_url && (
                  <a
                    href={`/api/scorecards/${c.id}/pdf`}
                    target="_blank"
                    rel="noopener"
                    className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:underline"
                  >
                    Download PDF →
                  </a>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState message="No growth reports available yet." />
      )}
    </div>
  );
}
