import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BoutonImprimer } from "@/components/BoutonImprimer";
import { cssRappelDePage, type Rappel } from "@/lib/impression/rappel";

/**
 * LA COQUE D'UN DOCUMENT QUI PART À L'IMPRESSION.
 *
 * ── CE QU'ELLE REMPLACE ───────────────────────────────────────────────────
 *
 * Neuf documents s'impriment, et ils portaient TROIS coques :
 *
 *  · six — bilan, fiche, courrier, synthèse, fin, écrit pour un tiers — une
 *    même chaîne de classes recopiée, corps de 13 px ;
 *  · deux — facture et attestation — une autre, corps de 14 px, cadre et
 *    marges différents, écrites en premier et jamais revues ;
 *  · une — la page publique ouverte par un tiers depuis un lien — une
 *    troisième encore, que la revue de conception n'avait pas relevée.
 *
 * Aucune de ces différences n'avait de raison. Une facture et un courrier de
 * liaison partent parfois dans la même enveloppe.
 *
 * ── CE QU'ELLE GARANTIT, ET QU'AUCUN DOCUMENT NE PEUT PLUS OUBLIER ────────
 *
 *  · un RAPPEL répété en marge de chaque page imprimée — nature, personne,
 *    date, « page N sur M ». Voir `lib/impression/rappel.ts` pour la mesure ;
 *  · un bouton d'impression. Les quatre écrits cliniques n'en avaient aucun :
 *    seulement « Retour », et l'impression par le raccourci du navigateur ;
 *  · une barre qui reste visible en haut d'un long document.
 *
 * ── CE QU'ELLE NE DÉCIDE PAS ──────────────────────────────────────────────
 *
 * Le contenu, et la hiérarchie de chaque en-tête. Une facture garde son titre
 * de nature en grand, à droite ; un écrit clinique garde le sien à gauche, à
 * la taille du texte. Ce sont deux genres de documents, et unifier la taille
 * d'un `<h1>` n'aurait fermé aucun défaut. Ni la place d'une signature
 * manuscrite, qui est une question pour la praticienne.
 */
export function CoqueDocument({
  retour,
  contexte,
  actions,
  imprimer = true,
  rappel,
  bandeau,
  note,
  style,
  children,
}: {
  /** Le lien de retour. Absent de la page publique, qui n'a nulle part où revenir. */
  retour?: { href: string; libelle: string };
  /** Ce que la barre dit à la place du retour. */
  contexte?: React.ReactNode;
  /** Des actions propres au document, placées AVANT le bouton d'impression. */
  actions?: React.ReactNode;
  /**
   * Faux sur la page publique, qui a choisi de ne charger aucun JavaScript
   * pour cela : l'impression du navigateur y suffit.
   */
  imprimer?: boolean;
  rappel: Rappel;
  /** L'état du document — annulé, brouillon — en tête de la page imprimée. */
  bandeau?: React.ReactNode;
  /** Une note pour l'écran seulement ; elle ne s'imprime jamais. */
  note?: React.ReactNode;
  /** L'accent et la police réglés par la praticienne, pour le bilan et la fiche. */
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-100 min-h-screen">
      {/* `dangerouslySetInnerHTML` et non un enfant texte : le contenu d'un
          `<style>` n'est pas décodé par le navigateur, un `&quot;` produit par
          un échappement HTML y casserait la chaîne. Le seul texte variable a
          déjà traversé `chaineCss`, dont la sortie ne contient que lettres,
          chiffres et échappements hexadécimaux — aucun chevron n'y peut
          fermer l'élément. Éprouvé par `rappel.test.mts`. */}
      <style dangerouslySetInnerHTML={{ __html: cssRappelDePage(rappel) }} />

      <div className="no-print sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-document mx-auto flex flex-wrap items-center justify-between gap-3">
          {retour ? (
            <Link
              href={retour.href}
              className="inline-flex items-center gap-1.5 text-sm text-encre-faible hover:text-brand-700"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {retour.libelle}
            </Link>
          ) : (
            <p className="text-sm text-encre-faible">{contexte}</p>
          )}
          {(actions || imprimer) && (
            <div className="flex flex-wrap items-center gap-2">
              {actions}
              {imprimer && <BoutonImprimer />}
            </div>
          )}
        </div>
      </div>

      <div className="py-8 px-4 print:p-0">
        {/* MARGES : resserrées sur un téléphone — c'est là qu'une famille ouvre
            le lien reçu — et identiques sur le papier aux six documents qui
            imprimaient déjà ainsi. À l'impression, la page A4 dépasse le
            point de rupture `sm`, ce sont donc ces valeurs-là qui s'appliquent. */}
        <article
          className="print-area max-w-document mx-auto bg-white shadow-sm border border-slate-200 rounded-lg px-5 py-6 sm:px-12 sm:py-10 print:shadow-none print:border-0 text-document text-slate-800"
          style={style}
        >
          {bandeau}
          {children}
        </article>

        {note && (
          <p className="no-print max-w-document mx-auto text-xs text-encre-faible mt-4">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * L'ÉTAT D'UN DOCUMENT, EN TÊTE DE PAGE, EN TROIS CANAUX.
 *
 * Il doit tenir SANS couleur : un mot en capitales, un trait de 2 px, et la
 * teinte seulement en troisième. `print:bg-white` retire l'aplat — sur une
 * imprimante monochrome, un fond teinté devient un gris qui dégrade le texte.
 *
 * TRAIT PLEIN pour un état définitif — annulé, remplacé, expiré. TIRETÉ pour
 * un état transitoire — le brouillon. Les quatre écrits cliniques traçaient
 * leur annulation en tireté : c'était le mauvais signal, une annulation ne
 * se reprend pas.
 *
 * LE TRAIT D'AVIS N'EST PAS LE JETON D'ÉCRAN. `--color-avis-trait` (ambre 300)
 * s'imprime au gris 215 — quarante niveaux sous le blanc du papier, un trait
 * presque invisible. L'ambre 600 s'imprime au gris 144 ; le rose 600 du trait
 * d'arrêt, au gris 116. Mesuré, pas estimé.
 */
export function BandeauEtat({
  ton,
  trait,
  titre,
  children,
}: {
  ton: "arret" | "avis";
  trait: "plein" | "tirete";
  titre: string;
  children?: React.ReactNode;
}) {
  const teinte =
    ton === "arret"
      ? "border-arret-trait bg-arret-fond text-arret-encre"
      : "border-amber-600 bg-avis-fond text-avis-encre";
  return (
    <div
      className={`mb-6 border-2 ${trait === "plein" ? "border-solid" : "border-dashed"} ${teinte} rounded-lg px-4 py-3 print:bg-white`}
      style={{ breakInside: "avoid" }}
    >
      <p className="font-semibold uppercase tracking-wide text-xs">{titre}</p>
      {children && <p className="text-xs mt-1">{children}</p>}
    </div>
  );
}

/**
 * CE QUI S'AFFICHE À LA PLACE D'UN DOCUMENT QUI NE DOIT PAS S'IMPRIMER.
 *
 * Six documents refusent d'imprimer un brouillon, et portaient chacun leur
 * propre version de cet écran. Le bilan, lui, imprime son brouillon avec un
 * bandeau : on le relit sur papier pour l'annoter. Cette différence-là est
 * justifiée, et elle est conservée.
 */
export function RefusBrouillon({
  retour,
  titre,
  children,
}: {
  retour: { href: string; libelle: string };
  titre: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Link
        href={retour.href}
        className="inline-flex items-center gap-1.5 text-sm text-encre-faible hover:text-brand-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {retour.libelle}
      </Link>
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <h1 className="font-semibold text-slate-800">{titre}</h1>
        <div className="text-sm text-slate-600 mt-2">{children}</div>
      </div>
    </div>
  );
}
