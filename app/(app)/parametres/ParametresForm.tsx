"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import type { Settings } from "@/lib/types";
import {
  BILAN_FONTS,
  BILAN_STYLE_PRESETS,
  BILAN_TITLE_STYLES,
  DEFAULT_ANAMNESE_NOTE,
  DEFAULT_CLOSING_NOTE,
  bilanFontCss,
} from "@/lib/constants";
import { updateSettings } from "./actions";
import AdaptationTemplatesManager from "./AdaptationTemplatesManager";

/** Redimensionne une image raster et renvoie un data-URL JPEG léger.
 *  Les SVG (déjà légers et vectoriels) sont conservés tels quels. */
function resizeImage(file: File, maxDim = 1400, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      if (file.type === "image/svg+xml") {
        resolve(String(reader.result));
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error("img"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("ctx"));
        // Fond blanc (les courbes sont sur fond clair ; évite le noir du JPEG).
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function TitlePreview({
  variant,
  color,
  children,
}: {
  variant: string;
  color: string;
  children: React.ReactNode;
}) {
  if (variant === "boxed")
    return (
      <span
        className="font-bold text-sm inline-block border-2 rounded-md py-1 px-3"
        style={{ borderColor: color, color }}
      >
        {children}
      </span>
    );
  if (variant === "plain")
    return (
      <span className="font-bold text-sm" style={{ color }}>
        {children}
      </span>
    );
  return (
    <span
      className="font-bold text-sm text-slate-900 inline-block border-b-2 pb-0.5"
      style={{ borderColor: color }}
    >
      {children}
    </span>
  );
}

const DEFAULT_THEME = "#2f8a82";
const THEME_PRESETS = [
  { name: "Bleu-vert (défaut)", value: "#2f8a82" },
  { name: "Émeraude", value: "#059669" },
  { name: "Bleu", value: "#2563eb" },
  { name: "Indigo", value: "#4f46e5" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Rose", value: "#db2777" },
  { name: "Framboise", value: "#e11d48" },
  { name: "Ambre", value: "#d97706" },
  { name: "Terracotta", value: "#c0504d" },
  { name: "Ardoise", value: "#475569" },
];

export default function ParametresForm({ settings }: { settings: Settings }) {
  const [mode, setMode] = useState(settings.charge_mode);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [logo, setLogo] = useState(settings.profile?.logo_url ?? "");
  const [logoError, setLogoError] = useState("");
  const [themeColor, setThemeColor] = useState(
    settings.profile?.theme_color ?? DEFAULT_THEME,
  );
  const [bilanFont, setBilanFont] = useState(
    settings.profile?.bilan_font ?? "sans",
  );
  const [bilanTitleStyle, setBilanTitleStyle] = useState(
    settings.profile?.bilan_title_style ?? "underline",
  );
  const [curve, setCurve] = useState(settings.profile?.gaussian_curve_url ?? "");
  const [curveError, setCurveError] = useState("");
  const [tab, setTab] = useState<"general" | "bilan" | "compta">("general");

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

  async function handleCurve(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10_000_000) {
      setCurveError("Image trop lourde (max 10 Mo). Réduisez-la puis réessayez.");
      return;
    }
    setCurveError("");
    try {
      setCurve(await resizeImage(file));
    } catch {
      setCurveError("Image illisible. Essayez un autre fichier (PNG ou JPG).");
    }
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

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "general", label: "Général" },
    { id: "bilan", label: "Bilan" },
    { id: "compta", label: "Comptabilité" },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition ${
              tab === t.id
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Onglet Général */}
      <div className={tab === "general" ? "space-y-6" : "hidden"}>
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
            <Label>Adresse (rue du cabinet)</Label>
            <input
              name="address"
              defaultValue={settings.profile?.address ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <Label>Code postal</Label>
            <input
              name="postal_code"
              defaultValue={settings.profile?.postal_code ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <Label>Ville</Label>
            <input
              name="city"
              defaultValue={settings.profile?.city ?? ""}
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
          <div>
            <Label>N° RPPS</Label>
            <input
              name="rpps"
              defaultValue={settings.profile?.rpps ?? ""}
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
      </div>

      {/* Onglet Bilan */}
      <div className={tab === "bilan" ? "space-y-6" : "hidden"}>
      <Section title="Thème des bilans">
        <input type="hidden" name="theme_color" value={themeColor} />
        <p className="text-sm text-slate-500 -mt-2 mb-3">
          Couleur d&apos;accent des titres dans vos comptes rendus de bilan.
        </p>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {THEME_PRESETS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.name}
              onClick={() => setThemeColor(c.value)}
              className={`h-8 w-8 rounded-full border-2 border-white transition ${
                themeColor.toLowerCase() === c.value.toLowerCase()
                  ? "ring-2 ring-offset-2 ring-slate-400"
                  : ""
              }`}
              style={{ backgroundColor: c.value }}
            />
          ))}
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg px-2 py-1.5 cursor-pointer">
            Personnalisée
            <input
              type="color"
              value={themeColor}
              onChange={(e) => setThemeColor(e.target.value)}
              className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0"
            />
          </label>
        </div>
        <p className="text-sm">
          <span
            className="font-bold text-slate-800 border-b-2 pb-0.5"
            style={{ borderColor: themeColor }}
          >
            Aperçu du titre de section
          </span>
        </p>
      </Section>

      <Section title="Style des bilans (police & titres)">
        <input type="hidden" name="bilan_font" value={bilanFont} />
        <input type="hidden" name="bilan_title_style" value={bilanTitleStyle} />

        <p className="text-sm text-slate-500 -mt-2 mb-2">Modèles rapides :</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {BILAN_STYLE_PRESETS.map((p) => {
            const on = bilanFont === p.font && bilanTitleStyle === p.title;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setBilanFont(p.font);
                  setBilanTitleStyle(p.title);
                }}
                className={`text-sm px-3 py-1.5 rounded-lg border transition ${
                  on
                    ? "border-brand-400 bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                    : "border-slate-200 text-slate-600 hover:border-brand-300"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <Label>Police</Label>
            <select
              value={bilanFont}
              onChange={(e) => setBilanFont(e.target.value)}
              className={inputCls}
            >
              {BILAN_FONTS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Titres de section</Label>
            <select
              value={bilanTitleStyle}
              onChange={(e) => setBilanTitleStyle(e.target.value)}
              className={inputCls}
            >
              {BILAN_TITLE_STYLES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          className="border border-slate-200 rounded-lg p-4 bg-slate-50"
          style={{ fontFamily: bilanFontCss(bilanFont) }}
        >
          <p className="text-xs text-slate-400 mb-2">Aperçu</p>
          <TitlePreview variant={bilanTitleStyle} color={themeColor}>
            La motricité globale
          </TitlePreview>
          <p className="text-sm text-slate-700 mt-2">
            Exemple de texte du bilan, affiché dans la police choisie pour vos
            comptes rendus.
          </p>
        </div>
      </Section>

      <Section title="Texte de fin d'anamnèse">
        <label className="flex items-start gap-2 text-sm text-slate-700 mb-3">
          <input
            type="checkbox"
            name="anamnese_note_on"
            defaultChecked={settings.profile?.anamnese_note_on ?? false}
            className="h-4 w-4 mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
          />
          <span>
            Ajouter automatiquement ce texte à la fin de l&apos;anamnèse de
            chaque nouveau bilan (il reste séparé par un petit trait et
            modifiable dans chaque bilan).
          </span>
        </label>
        <Label>Texte par défaut</Label>
        <textarea
          name="anamnese_note"
          rows={6}
          defaultValue={settings.profile?.anamnese_note ?? DEFAULT_ANAMNESE_NOTE}
          className={`${inputCls} leading-relaxed resize-y`}
        />
        <p className="text-xs text-slate-400 mt-1">
          Les tests cités (M-ABC, BHK, NP-MOT…) peuvent varier d&apos;un bilan à
          l&apos;autre : ajustez-les directement dans le bilan concerné.
        </p>
      </Section>

      <Section title="Conclusion & signature">
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="conclusion_top"
            defaultChecked={settings.profile?.conclusion_top ?? false}
            className="h-4 w-4 mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
          />
          <span>
            Afficher la conclusion <strong>en tête du bilan</strong>, dans un
            encadré légèrement grisé au-dessus de l&apos;anamnèse.
          </span>
        </label>
        <p className="text-xs text-slate-400 mt-2 mb-4">
          Décoché, la conclusion reste à sa place habituelle, en bas du bilan.
        </p>

        <Label>Formule de fin (sous votre nom, dans la conclusion)</Label>
        <textarea
          name="closing_note"
          rows={2}
          defaultValue={settings.profile?.closing_note ?? DEFAULT_CLOSING_NOTE}
          className={`${inputCls} resize-y`}
        />
        <p className="text-xs text-slate-400 mt-1">
          Votre nom vient de l&apos;onglet Général. La signature s&apos;affiche
          dans l&apos;encart de la conclusion.
        </p>
      </Section>

      <Section title="Courbe de Gauss">
        <input type="hidden" name="gaussian_curve_url" value={curve} />
        <p className="text-sm text-slate-500 -mt-2 mb-3">
          Par défaut, une courbe est générée automatiquement. Vous pouvez la
          remplacer par votre propre image (elle s&apos;affichera dans la partie
          « Résultats chiffrés des tests » du bilan).
        </p>
        <div className="flex items-start gap-4">
          <div className="h-28 w-44 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
            {curve ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={curve}
                alt="Courbe de Gauss"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-xs text-slate-400 text-center px-2">
                Courbe automatique
              </span>
            )}
          </div>
          <div>
            <label className="inline-block cursor-pointer text-sm font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-2 rounded-lg">
              {curve ? "Changer l'image" : "Importer une image"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={handleCurve}
                className="hidden"
              />
            </label>
            {curve && (
              <button
                type="button"
                onClick={() => setCurve("")}
                className="ml-2 text-sm text-slate-500 hover:text-rose-600"
              >
                Rétablir la courbe automatique
              </button>
            )}
            {curveError && (
              <p className="text-xs text-rose-600 mt-1">{curveError}</p>
            )}
            <p className="text-xs text-slate-400 mt-1">
              PNG, JPG ou SVG. L&apos;image est automatiquement optimisée.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Modèles d'adaptations">
        <AdaptationTemplatesManager
          initial={settings.profile?.adaptation_templates ?? []}
        />
      </Section>
      </div>

      {/* Onglet Comptabilité */}
      <div className={tab === "compta" ? "space-y-6" : "hidden"}>
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
      </div>

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
