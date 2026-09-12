"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarCheck, Info, Wallet } from "lucide-react";
import { centsToEuros, formatCents } from "@/lib/money";
import { frDate } from "@/lib/format";
import { METHOD_LABELS, type PaymentMethod } from "@/lib/compta/types";
import { NATURE_ACTE_LABELS } from "@/lib/attestations/types";
import type {
  ReglementAttestable,
  SeanceAttestable,
} from "@/lib/attestations/queries";
import { basculerReglementAtteste, basculerSeanceAttestee } from "../actions";

/**
 * Ce que l'attestation va affirmer.
 *
 * AUCUNE DATE, AUCUN MONTANT NE SE SAISIT ICI. On coche parmi des faits déjà
 * enregistrés : des séances dont l'issue est « honoré », des règlements
 * réellement imputés sur les factures de ce patient. Une attestation dont les
 * dates seraient tapées serait une déclaration sans support.
 */
export default function FaitsAttestes({
  attestationId,
  kind,
  seances,
  reglements,
  choisies,
  modifiable,
}: {
  attestationId: string;
  kind: "presence" | "paiement";
  seances: SeanceAttestable[];
  reglements: ReglementAttestable[];
  choisies: Set<string>;
  modifiable: boolean;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  function basculer(fd: FormData, action: () => Promise<{ ok: boolean; error?: string }>) {
    setErreur(null);
    void fd;
    demarrer(async () => {
      const r = await action();
      if (!r.ok) setErreur(r.error ?? "L'opération a échoué.");
      else router.refresh();
    });
  }

  if (kind === "presence") {
    return (
      <div>
        {seances.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-500">
            Aucune séance honorée sur cette période. Une séance n&apos;apparaît
            ici qu&apos;une fois son issue renseignée dans l&apos;agenda : c&apos;est
            ce qui rend l&apos;attestation vérifiable.
          </p>
        ) : (
          <ul className="list-none p-0 m-0 divide-y divide-slate-50">
            {seances.map((s) => {
              const cochee = choisies.has(s.id);
              return (
                <li key={s.id} className="flex items-center justify-between px-5 py-2.5">
                  <label className="flex items-center gap-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={cochee}
                      disabled={!modifiable || enCours}
                      onChange={() => {
                        const fd = new FormData();
                        fd.set("attestation_id", attestationId);
                        fd.set("appointment_id", s.id);
                        if (cochee) fd.set("action", "retirer");
                        basculer(fd, () => basculerSeanceAttestee(fd));
                      }}
                      className="rounded border-slate-300"
                    />
                    <span>
                      <CalendarCheck
                        className="inline h-3.5 w-3.5 text-slate-400 mr-1.5"
                        aria-hidden="true"
                      />
                      {frDate(s.starts_at.slice(0, 10))}
                      <span className="text-slate-400">
                        {" · "}
                        {NATURE_ACTE_LABELS[s.kind] ?? s.kind}
                      </span>
                    </span>
                  </label>
                  {s.deja_attestee && (
                    <span
                      className="text-xs text-slate-400"
                      title="Cette séance figure déjà sur une autre attestation. Attester deux fois une présence réelle ne crée aucun faux — contrairement à une facture."
                    >
                      déjà attestée ailleurs
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {erreur && (
          <p role="alert" className="px-5 py-3 text-sm text-rose-700">
            {erreur}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="px-5 pt-4 text-xs text-slate-500 flex items-start gap-2">
        <Info className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" aria-hidden="true" />
        Seule la part de chaque règlement imputée sur les factures de ce dossier
        est proposée. Un virement couvrant deux familles ne s&apos;atteste pas en
        entier à l&apos;une d&apos;elles.
      </p>
      {reglements.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">
          Aucun règlement imputé sur une facture de ce dossier sur cette période.
        </p>
      ) : (
        <ul className="list-none p-0 m-0 divide-y divide-slate-50">
          {reglements.map((r) => {
            const cochee = choisies.has(r.id);
            return (
              <li key={r.id} className="flex items-center justify-between px-5 py-2.5">
                <label className="flex items-center gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={cochee}
                    disabled={!modifiable || enCours}
                    onChange={() => {
                      const fd = new FormData();
                      fd.set("attestation_id", attestationId);
                      fd.set("payment_id", r.id);
                      if (cochee) fd.set("action", "retirer");
                      else
                        fd.set(
                          "amount",
                          centsToEuros(r.impute_cents).toFixed(2).replace(".", ","),
                        );
                      basculer(fd, () => basculerReglementAtteste(fd));
                    }}
                    className="rounded border-slate-300"
                  />
                  <span>
                    <Wallet
                      className="inline h-3.5 w-3.5 text-slate-400 mr-1.5"
                      aria-hidden="true"
                    />
                    {formatCents(r.impute_cents)}
                    <span className="text-slate-400">
                      {" · "}
                      {METHOD_LABELS[r.method as PaymentMethod] ?? r.method}
                      {" · "}
                      {frDate(r.received_on)}
                    </span>
                    {r.factures.length > 0 && (
                      <span className="block text-xs text-slate-400">
                        Facture{r.factures.length > 1 ? "s" : ""}{" "}
                        {r.factures.join(", ")}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {erreur && (
        <p role="alert" className="px-5 py-3 text-sm text-rose-700">
          {erreur}
        </p>
      )}
    </div>
  );
}
