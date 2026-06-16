import Link from "next/link";

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: string;
  accent?: "brand" | "amber" | "rose" | "slate" | "emerald";
  hint?: string;
}) {
  const accents: Record<string, string> = {
    brand: "text-brand-700",
    amber: "text-amber-600",
    rose: "text-rose-600",
    slate: "text-slate-700",
    emerald: "text-emerald-600",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {label}
      </p>
      <p className={`text-xl font-semibold mt-1 ${accents[accent ?? "slate"]}`}>
        {value}
      </p>
      {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-100 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-sm"
    >
      {children}
    </Link>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      <div className="h-14 w-14 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-medium text-slate-700">{title}</h3>
      <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
