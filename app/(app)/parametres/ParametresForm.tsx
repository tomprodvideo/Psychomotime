"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import type { Settings } from "@/lib/types";
import { updateSettings } from "./actions";

export default function ParametresForm({ settings }: { settings: Settings }) {
  const [mode, setMode] = useState(settings.charge_mode);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [logo, setLogo] = useState(settings.profile?.logo_url ?? "");
  const [logoError, setLogoError] = useState("");

  function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) {
      setLogoError("Image trop lourde (max 1 Mo). Réduisez-la puis réessayez.");
      return;
    }
    setLogoError("");
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result));
    reader.readAsDataURL(file);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      await updateSettings(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Section title="Profil">
        <div>
          <Label>Votre nom (apparaît sur les bilans)</Label>
          <input
            name="display_name"
            defaultValue={settings.display_name ?? ""}
            placeholder="Ex. Manon Dupont, psychomotricienne D.E."
            className={inputCls}
          />
        </div>
      </Section>

      <Section title="Profil professionnel (apparaît sur les factures)">
        <input type="hidden" name="logo_url" value={logo} />
        <div className="flex items-center gap-4 mb-4">
          <div className="h-20 w-20 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt="Logo"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-xs text-slate-400 text-center px-1">
                Aucun logo
              </span>
            )}
          </div>
          <div>
            <label className="inline-block cursor-pointer text-sm font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-2 rounded-lg">
              {logo ? "Changer le logo" : "Ajouter un logo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={handleLogo}
                className="hidden"
              />
            </label>
            {logo && (
              <button
                type="button"
                onClick={() => setLogo("")}
                className="ml-2 text-sm text-slate-500 hover:text-rose-600"
              >
                Retirer
              </button>
            )}
            {logoError && (
              <p className="text-xs text-rose-600 mt-1">{logoError}</p>
            )}
            <p className="text-xs text-slate-400 mt-1">PNG, JPG ou SVG · max 1 Mo.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label>Adresse (cabinet)</Label>
            <input
              name="address"
              defaultValue={settings.profile?.address ?? ""}
              placeholder="12 rue des Lilas, 75000 Paris"
              className={inputCls}
            />
          </div>
          <div>
            <Label>Email professionnel</Label>
            <input
              name="business_email"
              type="email"
              defaultValue={settings.profile?.business_email ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <Label>Téléphone</Label>
            <input
              name="business_phone"
              defaultValue={settings.profile?.business_phone ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <Label>N° SIRET</Label>
            <input
              name="siret"
              defaultValue={settings.profile?.siret ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <Label>N° ADELI</Label>
            <input
              name="adeli"
              defaultValue={settings.profile?.adeli ?? ""}
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Mentions légales (bas de facture)</Label>
            <textarea
              name="legal_mentions"
              rows={2}
              defaultValue={
                settings.profile?.legal_mentions ??
                "TVA non applicable, art. 293 B du CGI."
              }
              className={inputCls}
            />
          </div>
        </div>
      </Section>

      <Section title="Charges du cabinet">
        <p className="text-sm text-slate-500 -mt-2 mb-3">
          Choisissez comment vos charges de local sont calculées dans la
          comptabilité.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <ModeCard
            active={mode === "retrocession"}
            onClick={() => setMode("retrocession")}
            title="Rétrocession (%)"
            desc="Un pourcentage du brut est rétrocédé sur chaque facture."
          />
          <ModeCard
            active={mode === "loyer"}
            onClick={() => setMode("loyer")}
            title="Loyer fixe"
            desc="Vous payez un loyer mensuel, géré à part. Pas de rétrocession par facture."
          />
        </div>
        <input type="hidden" name="charge_mode" value={mode} />

        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div>
            <Label>Taux de rétrocession (%)</Label>
            <input
              name="retrocession_rate"
              type="number"
              step="0.1"
              defaultValue={(settings.retrocession_rate * 100).toString()}
              disabled={mode === "loyer"}
              className={`${inputCls} disabled:bg-slate-100 disabled:text-slate-400`}
            />
          </div>
          <div>
            <Label>Loyer mensuel (€)</Label>
            <input
              name="monthly_rent"
              type="number"
              step="0.01"
              defaultValue={settings.monthly_rent.toString()}
              disabled={mode === "retrocession"}
              className={`${inputCls} disabled:bg-slate-100 disabled:text-slate-400`}
            />
          </div>
        </div>
      </Section>

      <Section title="Cotisations">
        <div className="max-w-xs">
          <Label>Taux URSSAF (%)</Label>
          <input
            name="urssaf_rate"
            type="number"
            step="0.01"
            defaultValue={(settings.urssaf_rate * 100).toString()}
            className={inputCls}
          />
          <p className="text-xs text-slate-400 mt-1">
            Appliqué sur le revenu après rétrocession. Valeur usuelle : 23,2 %.
          </p>
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg disabled:opacity-60"
        >
          {saved ? <Check className="h-4 w-4" /> : null}
          {pending ? "Enregistrement…" : "Enregistrer les paramètres"}
        </button>
        {saved && (
          <span className="text-sm text-brand-700">Paramètres enregistrés ✓</span>
        )}
      </div>
    </form>
  );
}

function ModeCard({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border p-4 transition ${
        active
          ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100"
          : "border-slate-200 hover:border-brand-300"
      }`}
    >
      <p className="font-medium text-slate-800 text-sm">{title}</p>
      <p className="text-xs text-slate-500 mt-1">{desc}</p>
    </button>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <h2 className="font-semibold text-slate-800 mb-4">{title}</h2>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-500 mb-1">
      {children}
    </label>
  );
}
