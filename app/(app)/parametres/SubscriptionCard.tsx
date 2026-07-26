"use client";

import { useState } from "react";
import { BadgeCheck, Sparkles } from "lucide-react";

export default function SubscriptionCard({
  status,
  trialDaysLeft,
  isAdmin,
}: {
  status: string;
  trialDaysLeft: number | null;
  isAdmin: boolean;
}) {
  const [info, setInfo] = useState(false);

  const isPro = status === "active";

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-slate-800">Mon abonnement</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Formule Pro — 29 €/mois
          </p>
        </div>
        {isAdmin ? (
          <Badge tone="brand" icon={<BadgeCheck className="h-4 w-4" />}>
            Administrateur
          </Badge>
        ) : isPro ? (
          <Badge tone="emerald" icon={<BadgeCheck className="h-4 w-4" />}>
            Formule Pro · Active
          </Badge>
        ) : status === "trialing" ? (
          <Badge tone="amber">
            Essai
            {trialDaysLeft !== null
              ? ` — ${trialDaysLeft} jour${trialDaysLeft > 1 ? "s" : ""} restant${trialDaysLeft > 1 ? "s" : ""}`
              : ""}
          </Badge>
        ) : (
          <Badge tone="slate">Inactif</Badge>
        )}
      </div>

      {!isAdmin && !isPro && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setInfo(true)}
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg shadow-sm"
          >
            <Sparkles className="h-4 w-4" />
            Activer mon abonnement — 29 €/mois
          </button>
          {info && (
            <p className="text-sm text-slate-600 mt-3 bg-brand-50 rounded-lg px-3 py-2">
              Le paiement sécurisé en ligne (Stripe) arrive très prochainement.
              Vous pourrez activer votre abonnement ici en un clic. En attendant,
              votre accès reste ouvert pendant la période d&apos;essai.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Badge({
  children,
  tone,
  icon,
}: {
  children: React.ReactNode;
  tone: "brand" | "emerald" | "amber" | "slate";
  icon?: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand-100 text-brand-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    slate: "bg-slate-200 text-slate-600",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full ${tones[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}
