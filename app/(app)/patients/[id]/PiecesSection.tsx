import Link from "next/link";
import { FileText, Receipt } from "lucide-react";
import { frDate } from "@/lib/format";
import { formatCents } from "@/lib/money";
import type { PieceBilan, PieceFacture } from "@/lib/dossier/queries";

/**
 * Bilans et pièces comptables rattachés au dossier.
 *
 * Les pièces viennent du modèle cible ; les bilans, eux, sont encore ceux de la
 * v1 et seront repris à leur lot. Le lien tient dans les deux cas parce que la
 * bascule a conservé les identifiants des patients — c'est ce que les
 * migrations de reprise garantissent, et ce que les tests vérifient.
 */
export default function PiecesSection({
  bilans,
  factures,
}: {
  bilans: PieceBilan[];
  factures: PieceFacture[];
}) {
  if (bilans.length === 0 && factures.length === 0) return null;

  return (
    <section
      aria-labelledby="titre-pieces"
      className="bg-white rounded-xl border border-slate-100 shadow-sm p-5"
    >
      <h2 id="titre-pieces" className="font-semibold text-slate-800 mb-3">
        Bilans et pièces comptables
      </h2>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            Bilans
          </h3>
          {bilans.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun bilan.</p>
          ) : (
            <ul className="space-y-1.5 list-none p-0 m-0">
              {bilans.map((b) => (
                <li key={b.id} className="text-sm">
                  <Link
                    href={`/bilans/${b.id}`}
                    className="text-slate-700 hover:text-brand-700 hover:underline"
                  >
                    {b.title}
                  </Link>
                  <span className="block text-xs text-slate-500">
                    {b.bilan_date ? frDate(b.bilan_date) : "Sans date"}
                    {" · "}
                    {b.type === "sensoriel" ? "sensoriel" : "psychomoteur"}
                    {" · "}
                    <span
                      className={
                        b.status === "finalisé" ? "text-brand-700" : "text-amber-700"
                      }
                    >
                      {b.status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
            <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
            Pièces comptables
          </h3>
          {factures.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune pièce.</p>
          ) : (
            <ul className="space-y-1.5 list-none p-0 m-0">
              {factures.map((f) => {
                const solde = f.total_cents - f.encaisse_cents - f.avoirs_cents;
                const brouillon = f.status === "brouillon";
                // Une pièce annulée ou remplacée n'appelle plus de règlement :
                // afficher « 180,00 € à encaisser » à perpétuité sur une
                // facture annulée serait faux, et inquiétant.
                const caduque =
                  f.status === "annule_par_avoir" || f.status === "remplace";
                return (
                  <li key={f.id} className="text-sm">
                    <Link
                      href={`/comptabilite/${f.id}`}
                      className="text-slate-700 hover:text-brand-700 hover:underline"
                    >
                      {f.number ?? "Brouillon"}
                    </Link>
                    <span className="block text-xs text-slate-500">
                      {f.issued_on ? frDate(f.issued_on) : "Non émise"}
                      {" · "}
                      {formatCents(f.total_cents)}
                      {caduque && (
                        <span className="text-slate-400">
                          {" · "}
                          {f.status === "remplace" ? "remplacée" : "annulée par avoir"}
                        </span>
                      )}
                      {!brouillon && !caduque && f.kind !== "devis" && solde > 0 && (
                        <span className="text-amber-700">
                          {" · "}
                          {formatCents(solde)} à encaisser
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
