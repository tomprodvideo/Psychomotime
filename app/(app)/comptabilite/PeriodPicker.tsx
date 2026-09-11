"use client";

import {
  Calendar,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Sigma,
} from "lucide-react";
import {
  parseMonthInput,
  periodLabel,
  shiftPeriod,
  toMonthInput,
  type Period,
  type PeriodMode,
} from "@/lib/period";

const MODES: { id: PeriodMode; label: string; icon: React.ReactNode }[] = [
  { id: "month", label: "Mois", icon: <Calendar className="h-4 w-4" /> },
  { id: "year", label: "Année", icon: <CalendarDays className="h-4 w-4" /> },
  {
    id: "range",
    label: "Période",
    icon: <CalendarRange className="h-4 w-4" />,
  },
  { id: "all", label: "Tout", icon: <Sigma className="h-4 w-4" /> },
];

export default function PeriodPicker({
  period,
  onChange,
  invoiceCount,
}: {
  period: Period;
  onChange: (p: Period) => void;
  invoiceCount: number;
}) {
  function setMode(mode: PeriodMode) {
    if (mode === period.mode) return;
    // On garde le repère courant en changeant de granularité.
    if (mode === "range") {
      const from =
        period.mode === "year"
          ? toMonthInput({ y: period.year, m: 0 })
          : toMonthInput({ y: period.year, m: period.month });
      const to =
        period.mode === "year"
          ? toMonthInput({ y: period.year, m: 11 })
          : toMonthInput({ y: period.year, m: period.month });
      onChange({ ...period, mode, from, to });
      return;
    }
    onChange({ ...period, mode });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 sm:p-4 mb-5">
      <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center gap-3">
        {/* Granularité */}
        <div className="inline-flex bg-slate-100 rounded-xl p-1 self-start">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition ${
                period.mode === m.id
                  ? "bg-white text-brand-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {m.icon}
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          ))}
        </div>

        {/* Navigation ◀ période ▶ */}
        <div className="flex items-center gap-1 flex-1 min-w-[15rem]">
          <NavButton
            dir={-1}
            disabled={period.mode === "all"}
            onClick={() => onChange(shiftPeriod(period, -1))}
          />
          <div className="flex-1 text-center min-w-0">
            <p className="text-base sm:text-lg font-semibold text-slate-800 truncate">
              {periodLabel(period)}
            </p>
            <p className="text-xs text-slate-400">
              {invoiceCount} facture{invoiceCount > 1 ? "s" : ""}
            </p>
          </div>
          <NavButton
            dir={1}
            disabled={period.mode === "all"}
            onClick={() => onChange(shiftPeriod(period, 1))}
          />
        </div>

        {/* Fourchette de dates */}
        {period.mode === "range" && (
          <div className="flex items-end gap-2 self-start lg:self-auto">
            <MonthInput
              label="Du"
              value={period.from}
              onChange={(v) => onChange({ ...period, from: v })}
            />
            <MonthInput
              label="Au"
              value={period.to}
              onChange={(v) => onChange({ ...period, to: v })}
            />
          </div>
        )}
      </div>

    </div>
  );
}

function NavButton({
  dir,
  disabled,
  onClick,
}: {
  dir: 1 | -1;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === -1 ? "Période précédente" : "Période suivante"}
      title={dir === -1 ? "Période précédente" : "Période suivante"}
      className="shrink-0 h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 active:scale-95 transition disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 disabled:active:scale-100"
    >
      {dir === -1 ? (
        <ChevronLeft className="h-5 w-5" />
      ) : (
        <ChevronRight className="h-5 w-5" />
      )}
    </button>
  );
}

function MonthInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-slate-400 mb-0.5">
        {label}
      </span>
      <input
        type="month"
        value={value}
        onChange={(e) => {
          if (parseMonthInput(e.target.value)) onChange(e.target.value);
        }}
        className="rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition"
      />
    </label>
  );
}
