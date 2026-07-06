"use client";

import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";

type Plan = { id: string; name: string; amount: number; currency: string; interval: string };

// Quick fee estimator for quoting a parent: pick a plan, how many children, how
// many months, an optional sibling discount and one-off joining fee.
export function FeeCalculator({ plans }: { plans: Plan[] }) {
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [children, setChildren] = useState(1);
  const [months, setMonths] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [joiningFee, setJoiningFee] = useState(0);

  const plan = plans.find((p) => p.id === planId) ?? null;
  const currency = plan?.currency ?? "MYR";
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-MY", { style: "currency", currency }).format(Number.isFinite(n) ? n : 0);

  const calc = useMemo(() => {
    const per = plan ? Number(plan.amount) : 0;
    const gross = per * children * months;
    const disc = gross * (Math.min(100, Math.max(0, discount)) / 100);
    const net = gross - disc + joiningFee * children;
    return { per, gross, disc, net, monthly: per * children * (1 - Math.min(100, Math.max(0, discount)) / 100) };
  }, [plan, children, months, discount, joiningFee]);

  const Num = ({ label, value, set, min = 0, max, step = 1, suffix }: { label: string; value: number; set: (n: number) => void; min?: number; max?: number; step?: number; suffix?: string }) => (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => set(Number(e.target.value))}
          className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-sm text-slate-900 focus:border-green-500 focus:outline-none"
        />
        {suffix && <span className="shrink-0 text-xs text-slate-400">{suffix}</span>}
      </div>
    </label>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">Fee plan</span>
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-sm text-slate-900 focus:border-green-500 focus:outline-none"
          >
            {plans.length === 0 && <option value="">No active fee plans</option>}
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {fmt(Number(p.amount))}{p.interval === "monthly" ? "/mo" : ""}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Num label="Children" value={children} set={setChildren} min={1} max={20} />
          <Num label="Months" value={months} set={setMonths} min={1} max={36} />
          <Num label="Sibling discount" value={discount} set={setDiscount} min={0} max={100} suffix="%" />
          <Num label="Joining fee (each)" value={joiningFee} set={setJoiningFee} min={0} step={10} />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border-2 border-green-100 bg-green-50/50 p-5">
        <div className="flex items-center gap-2 text-green-700">
          <Calculator className="h-4 w-4" />
          <span className="text-sm font-semibold">Estimate</span>
        </div>
        <Row label={`${fmt(calc.per)} × ${children} child${children > 1 ? "ren" : ""} × ${months} mo`} value={fmt(calc.gross)} />
        {discount > 0 && <Row label={`Sibling discount (${discount}%)`} value={`− ${fmt(calc.disc)}`} muted />}
        {joiningFee > 0 && <Row label={`Joining fee × ${children}`} value={fmt(joiningFee * children)} />}
        <div className="border-t border-green-200 pt-3">
          <div className="flex items-end justify-between">
            <span className="text-sm font-medium text-slate-600">Total estimate</span>
            <span className="text-3xl font-bold text-green-700">{fmt(calc.net)}</span>
          </div>
          <div className="mt-1 text-right text-xs text-slate-500">≈ {fmt(calc.monthly)} / month</div>
        </div>
        <p className="text-xs text-slate-400">Estimate only — final invoices may prorate a mid-month start.</p>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      <span className={muted ? "font-medium text-amber-700" : "font-medium text-slate-900"}>{value}</span>
    </div>
  );
}
