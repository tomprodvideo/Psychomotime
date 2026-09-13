"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, Sparkles } from "lucide-react";
import { cancelSubscription } from "./actions";
import { TONS, type Ton } from "@/components/Statut";
import { Bouton } from "@/components/Bouton";

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
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, start] = useTransition();

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
          <Badge tone="normal" icon={<BadgeCheck className="h-4 w-4" />}>
            Administrateur
          </Badge>
        ) : isPro ? (
          <Badge tone="normal" icon={<BadgeCheck className="h-4 w-4" />}>
            Formule Pro · Active
          </Badge>
        ) : status === "trialing" ? (
          <Badge tone="avis">
            Essai
            {trialDaysLeft !== null
              ? ` — ${trialDaysLeft} jour${trialDaysLeft > 1 ? "s" : ""} restant${trialDaysLeft > 1 ? "s" : ""}`
              : ""}
          </Badge>
        ) : (
          <Badge tone="inerte">Inactif</Badge>
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

      {/* Gestion / résiliation pour un compte Pro actif */}
      {!isAdmin && isPro && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <dl className="grid grid-cols-2 gap-y-1 text-sm mb-4">
            <dt className="text-slate-500">Formule</dt>
            <dd className="text-slate-800 text-right">Pro — 29 €/mois</dd>
            <dt className="text-slate-500">Statut</dt>
            <dd className="text-emerald-600 font-medium text-right">Actif</dd>
          </dl>

          {!confirmCancel ? (
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              className="text-sm font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 px-4 py-2 rounded-lg"
            >
              Résilier mon abonnement
            </button>
          ) : (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
              <p className="text-sm text-slate-700">
                Confirmer la résiliation ? Votre accès à la formule Pro sera
                interrompu.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Bouton variante="libre"
                  type="button"
                  pending={pending}
                  onClick={() => start(() => cancelSubscription())}
                  className="text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 px-4 py-2 rounded-lg"
              pendingLabel="Résiliation…"
            >
                  Confirmer la résiliation
                </Bouton>
                <button
                  type="button"
                  onClick={() => setConfirmCancel(false)}
                  className="text-sm text-slate-600 hover:bg-slate-100 px-4 py-2 rounded-lg"
                >
                  Annuler
                </button>
              </div>
            </div>
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
  tone: Ton;
  icon?: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full ${TONS[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}
