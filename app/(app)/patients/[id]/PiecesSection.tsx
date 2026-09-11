import Link from "next/link";
import { FileText, Receipt } from "lucide-react";
import { euro, frDate } from "@/lib/format";
import type { PieceBilan, PieceFacture } from "@/lib/dossier/queries";

/**
 * Bilans et pièces comptables rattachés au dossier.
 *
 * Ces deux listes viennent des tables de la v1, encore en service. Le lien
 * tient parce que la bascule a conservé les identifiants des patients : c'est
 * ce que la migration de reprise garantit, et ce qu'un test vérifie.
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
            Factures
          </h3>
          {factures.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune facture.</p>
          ) : (
            <ul className="space-y-1.5 list-none p-0 m-0">
              {factures.map((f) => {
                const solde = (f.revenue_gross || 0) - (f.revenue_gross_paid || 0);
                return (
                  <li key={f.id} className="text-sm">
                    <Link
                      href={`/comptabilite/${f.id}/facture`}
                      className="text-slate-700 hover:text-brand-700 hover:underline"
                    >
                      {f.invoice_number ?? "Sans numéro"}
                    </Link>
                    <span className="block text-xs text-slate-500">
                      {f.issue_date
                        ? frDate(f.issue_date)
                        : [f.billing_month, f.billing_year].filter(Boolean).join(" ") ||
                          "Sans date"}
                      {" · "}
                      {euro(f.revenue_gross)}
                      {solde > 0.005 && (
                        <span className="text-amber-700">
                          {" · "}
                          {euro(solde)} à encaisser
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
