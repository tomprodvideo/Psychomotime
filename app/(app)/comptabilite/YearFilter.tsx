"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function YearFilter({ years }: { years: number[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("year") ?? "all";

  return (
    <select
      value={current}
      onChange={(e) => {
        const v = e.target.value;
        router.push(v === "all" ? "/comptabilite" : `/comptabilite?year=${v}`);
      }}
      className="rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm outline-none focus:border-brand-400"
    >
      <option value="all">Toutes les années</option>
      {years.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  );
}
