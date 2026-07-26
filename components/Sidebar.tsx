"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  LayoutDashboard,
  Calculator,
  Users,
  FileText,
  Settings as SettingsIcon,
  ShieldCheck,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const NAV = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { href: "/comptabilite", label: "Comptabilité", icon: Calculator },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/bilans", label: "Bilans", icon: FileText },
  { href: "/parametres", label: "Paramètres", icon: SettingsIcon },
];

export default function Sidebar({
  displayName,
  signOutAction,
  isAdmin,
  planLabel,
  planActive,
}: {
  displayName: string;
  signOutAction: () => Promise<void>;
  isAdmin?: boolean;
  planLabel?: string | null;
  planActive?: boolean;
}) {
  const nav = isAdmin
    ? [
        ...NAV,
        { href: "/admin", label: "Administration", icon: ShieldCheck },
      ]
    : NAV;
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <>
      {/* Barre mobile */}
      <div className="md:hidden flex items-center justify-between bg-white border-b border-slate-200 px-4 py-3 no-print">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-brand-600 text-white flex items-center justify-center">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <span className="font-semibold text-brand-900 block leading-tight">
              Psychomotime
            </span>
            {planLabel && (
              <span
                className={`text-[11px] font-medium ${
                  planActive ? "text-emerald-600" : "text-amber-600"
                }`}
              >
                {planLabel}
              </span>
            )}
          </div>
        </div>
        <button onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <aside
        className={`${
          open ? "block" : "hidden"
        } md:flex md:flex-col fixed md:static inset-x-0 top-[57px] md:top-0 z-20 md:w-64 bg-white md:bg-brand-900 border-b md:border-0 border-slate-200 md:min-h-screen no-print`}
      >
        <div className="hidden md:block px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-white/10 text-white flex items-center justify-center">
              <Activity className="h-5 w-5" />
            </div>
            <span className="font-semibold text-white text-lg">
              Psychomotime
            </span>
          </div>
          {planLabel && (
            <div className="mt-2 ml-11">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                  planActive
                    ? "bg-emerald-400/15 text-emerald-300"
                    : "bg-amber-400/15 text-amber-300"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    planActive ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
                {planLabel}
              </span>
            </div>
          )}
        </div>

        <nav className="flex flex-col gap-1 p-3 md:p-4 md:flex-1">
          {nav.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  active
                    ? "bg-brand-600 text-white md:bg-white/15"
                    : "text-slate-600 md:text-white/70 hover:bg-slate-100 md:hover:bg-white/10 md:hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 md:p-4 border-t border-slate-200 md:border-white/10">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs text-slate-400 md:text-white/40">Connectée</p>
            <p className="text-sm font-medium text-slate-700 md:text-white truncate">
              {displayName}
            </p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 md:text-white/70 hover:bg-slate-100 md:hover:bg-white/10 transition"
            >
              <LogOut className="h-5 w-5" />
              Déconnexion
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
