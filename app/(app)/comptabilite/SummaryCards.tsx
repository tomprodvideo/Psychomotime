"use client";

import {
  Banknote,
  Clock,
  Coins,
  House,
  Landmark,
  PiggyBank,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { ChargeMode } from "@/lib/types";
import { euro } from "@/lib/format";
import type { Summary } from "./summary";

type Accent = "brand" | "amber" | "rose" | "slate" | "emerald" | "violet";

const ACCENTS: Record<Accent, { icon: string; value: string }> = {
  brand: { icon: "bg-brand-50 text-brand-600", value: "text-brand-700" },
  amber: { icon: "bg-amber-50 text-amber-600", value: "text-amber-600" },
  rose: { icon: "bg-rose-50 text-rose-600", value: "text-rose-600" },
  slate: { icon: "bg-slate-100 text-slate-500", value: "text-slate-700" },
  emerald: {
    icon: "bg-emerald-50 text-emerald-600",
    value: "text-emerald-600",
  },
  violet: { icon: "bg-violet-50 text-violet-600", value: "text-violet-600" },
};

export default function SummaryCards({
  summary,
  previous,
  chargeMode,
  onShowUnpaid,
}: {
  summary: Summary;
  previous: Summary | null;
  chargeMode: ChargeMode;
  onShowUnpaid?: () => void;
}) {
  const s = summary;
  const showRetro = chargeMode !== "loyer";

  return (
    <div className="grid lg:grid-cols-3 gap-4 mb-5">
      {/* Carte principale : le net qui reste vraiment */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white p-5 shadow-sm">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
        <div className="absolute -right-4 top-16 h-20 w-20 rounded-full bg-white/5" />
        <div className="relative">
          <div className="flex items-center gap-2 text-brand-100">
            <PiggyBank className="h-4 w-4" />
            <p className="text-xs font-medium uppercase tracking-wide">
              {chargeMode === "loyer" ? "Net après loyer" : "Net − loyer"}
            </p>
          </div>
          <p className="text-3xl sm:text-4xl font-semibold mt-2 tabular-nums">
            {euro(s.netApresCharges)}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Delta
              current={s.netApresCharges}
              previous={previous?.netApresCharges}
              light
            />
            <span className="text-xs text-brand-100/90">
              {s.count} facture{s.count > 1 ? "s" : ""}
            </span>
          </div>

          <Repartition summary={s} showRetro={showRetro} />
        </div>
      </div>

      {/* Le détail : toutes les lignes du calcul */}
      <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Metric
          icon={<Banknote className="h-4 w-4" />}
          label="Total brut"
          value={euro(s.brut)}
          accent="slate"
          delta={<Delta current={s.brut} previous={previous?.brut} />}
        />
        <Metric
          icon={<Wallet className="h-4 w-4" />}
          label="Brut encaissé"
          value={euro(s.brutPaye)}
          accent="slate"
          hint={`${s.countPayees} facture${s.countPayees > 1 ? "s" : ""} payée${
            s.countPayees > 1 ? "s" : ""
          }`}
        />
        <Metric
          icon={<Clock className="h-4 w-4" />}
          label="Reste à encaisser"
          value={euro(s.restant)}
          accent={s.restant > 0 ? "rose" : "emerald"}
          hint={
            s.countImpayees > 0
              ? `${s.countImpayees} facture${
                  s.countImpayees > 1 ? "s" : ""
                } en attente`
              : "Tout est encaissé 🎉"
          }
          onClick={s.countImpayees > 0 ? onShowUnpaid : undefined}
        />

        {showRetro && (
          <Metric
            icon={<Coins className="h-4 w-4" />}
            label="Rétrocession"
            value={euro(s.retrocession)}
            accent="rose"
          />
        )}
        {showRetro && (
          <Metric
            icon={<Receipt className="h-4 w-4" />}
            label="Brut − rétro"
            value={euro(s.brutMoinsRetro)}
            accent="slate"
          />
        )}
        {!showRetro && (
          <Metric
            icon={<House className="h-4 w-4" />}
            label="Charges"
            value={euro(s.charges)}
            accent="violet"
          />
        )}

        <Metric
          icon={<Landmark className="h-4 w-4" />}
          label="URSSAF"
          value={euro(s.urssaf)}
          accent="amber"
        />
        <Metric
          icon={<PiggyBank className="h-4 w-4" />}
          label="Revenu net"
          value={euro(s.net)}
          accent="brand"
          delta={<Delta current={s.net} previous={previous?.net} />}
        />
        {showRetro && (
          <Metric
            icon={<House className="h-4 w-4" />}
            label="Charges"
            value={euro(s.charges)}
            accent="violet"
          />
        )}
      </div>
    </div>
  );
}

/* ---------- Répartition du brut (barre empilée) ---------- */

function Repartition({
  summary,
  showRetro,
}: {
  summary: Summary;
  showRetro: boolean;
}) {
  const s = summary;
  // Décomposition du brut : rétrocession + loyers + URSSAF + net restant.
  const parts = [
    ...(showRetro && s.retrocession > 0
      ? [{ key: "retro", label: "Rétro", v: s.retrocession, cls: "bg-rose-300" }]
      : []),
    ...(s.charges > 0
      ? [{ key: "charges", label: "Charges", v: s.charges, cls: "bg-violet-300" }]
      : []),
    ...(s.urssaf > 0
      ? [{ key: "urssaf", label: "URSSAF", v: s.urssaf, cls: "bg-amber-300" }]
      : []),
    {
      key: "net",
      label: "Net",
      v: Math.max(0, s.netApresCharges),
      cls: "bg-white",
    },
  ];
  const base = parts.reduce((t, p) => t + p.v, 0);
  if (base <= 0) return null;

  return (
    <div className="mt-5 pt-4 border-t border-white/20">
      <p className="text-[11px] uppercase tracking-wide text-brand-100 mb-2">
        Répartition du brut
      </p>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-white/20">
        {parts.map((p) => (
          <div
            key={p.key}
            className={p.cls}
            style={{ width: `${(p.v / base) * 100}%` }}
            title={`${p.label} : ${euro(p.v)}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {parts.map((p) => (
          <span
            key={p.key}
            className="inline-flex items-center gap-1.5 text-[11px] text-brand-50"
          >
            <span className={`h-2 w-2 rounded-full ${p.cls}`} />
            {p.label} {Math.round((p.v / base) * 100)} %
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Briques ---------- */

function Metric({
  icon,
  label,
  value,
  accent = "slate",
  hint,
  delta,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: Accent;
  hint?: string;
  delta?: React.ReactNode;
  onClick?: () => void;
}) {
  const a = ACCENTS[accent];
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`text-left bg-white rounded-2xl border border-slate-100 shadow-sm p-4 transition ${
        onClick ? "hover:border-brand-200 hover:shadow cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`h-7 w-7 rounded-lg flex items-center justify-center ${a.icon}`}
        >
          {icon}
        </span>
        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
          {label}
        </p>
      </div>
      <p className={`text-xl font-semibold mt-2 tabular-nums ${a.value}`}>
        {value}
      </p>
      {delta}
      {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
    </Tag>
  );
}

function Delta({
  current,
  previous,
  light,
}: {
  current: number;
  previous?: number;
  light?: boolean;
}) {
  if (previous == null || Math.abs(previous) < 0.01) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.01) return null;
  const pctv = Math.round((diff / Math.abs(previous)) * 100);
  const up = diff > 0;
  const cls = light
    ? "bg-white/15 text-white"
    : up
      ? "bg-emerald-50 text-emerald-700"
      : "bg-rose-50 text-rose-600";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full mt-1 ${cls}`}
      title="Comparé à la période précédente"
    >
      {up ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {up ? "+" : ""}
      {pctv} %
    </span>
  );
}
