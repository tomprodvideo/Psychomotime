"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

/**
 * UNE FENÊTRE MODALE QUI TIENT CE QU'ELLE PROMET.
 *
 * ── CE QU'ON AVAIT, ET POURQUOI C'ÉTAIT PIRE QUE RIEN ─────────────────────
 *
 * Sept fenêtres, écrites sept fois, toutes bâties sur un `div` portant
 * `role="dialog"` et `aria-modal="true"`. Aucune ne piégeait le focus, aucune
 * ne se fermait au clavier, aucune ne rendait l'arrière-plan inerte, aucune ne
 * restituait le focus en se fermant. `Escape` : zéro occurrence dans tout
 * `app/`.
 *
 * `aria-modal="true"` n'est pas une décoration : c'est une PROMESSE faite à la
 * technologie d'assistance — « tout ce qui est derrière n'existe pas ». Elle
 * amène le lecteur d'écran à ignorer le reste de la page, alors que la
 * tabulation, elle, continuait de s'y promener. Annoncer l'inertie sans la
 * produire laisse l'utilisateur dans une page dont il ne peut plus entendre la
 * moitié.
 *
 * ── POURQUOI `<dialog>` PLUTÔT QU'UN PIÈGE À FOCUS ÉCRIT À LA MAIN ────────
 *
 * `showModal()` donne, implémenté par le navigateur et non par nous : le
 * piégeage du focus, la fermeture par `Escape`, l'inertie réelle de
 * l'arrière-plan, la restitution du focus à l'élément qui a ouvert, et une
 * couche de fond (`::backdrop`) qui ne réclame aucun `z-index`.
 *
 * Écrire tout cela nous-mêmes, c'était sept occasions de se tromper, et un
 * comportement qui aurait dérivé du comportement natif à chaque version de
 * navigateur.
 *
 * ── CE QUE CE COMPOSANT AJOUTE ────────────────────────────────────────────
 *
 * Le titre est OBLIGATOIRE et relié : une fenêtre sans nom s'annonce
 * « dialogue », ce qui n'apprend rien. Et la fermeture par `Escape` passe par
 * `onFermer`, pour que l'état de l'appelant suive — sans quoi la fenêtre
 * disparaîtrait de l'écran en restant « ouverte » dans le code.
 */
export function Dialogue({
  ouvert,
  onFermer,
  titre,
  description,
  taille = "moyenne",
  children,
}: {
  ouvert: boolean;
  onFermer: () => void;
  titre: string;
  /** Une phrase lue après le titre, quand le titre seul ne suffit pas. */
  description?: string;
  taille?: "petite" | "moyenne" | "large";
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitre = useId();
  const idDescription = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ouvert && !d.open) d.showModal();
    if (!ouvert && d.open) d.close();
    /* Fermer AVANT le démontage. Plusieurs appelants font disparaître la
     * fenêtre en cessant de la rendre : sans ce `close()`, le navigateur
     * retire l'élément sans rendre le focus à ce qui l'avait ouvert, et le
     * clavier se retrouve au début de la page. */
    return () => {
      if (d.open) d.close();
    };
  }, [ouvert]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    /* `cancel` est l'événement d'`Escape`. On l'intercepte pour prévenir
     * l'appelant : sans cela, la fenêtre se fermerait à l'écran tandis que son
     * état resterait « ouvert », et le bouton d'ouverture ne répondrait plus. */
    const surAnnulation = (e: Event) => {
      e.preventDefault();
      onFermer();
    };
    d.addEventListener("cancel", surAnnulation);
    return () => d.removeEventListener("cancel", surAnnulation);
  }, [onFermer]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitre}
      aria-describedby={description ? idDescription : undefined}
      /* Un clic sur la couche de fond ferme, comme le faisaient les fenêtres
       * précédentes — mais UNIQUEMENT sur elle : `event.target` vaut l'élément
       * `dialog` lui-même quand on clique à côté du panneau, et le panneau
       * sinon. Sans ce test, un clic relâché sur le fond après une sélection de
       * texte à l'intérieur fermerait la fenêtre en pleine saisie. */
      onClick={(e) => {
        if (e.target === ref.current) onFermer();
      }}
      /* LA HAUTEUR EST BORNÉE ET LE CONTENU DÉFILE.
       *
       * Les fenêtres précédentes posaient `overflow-y-auto` sur la couche de
       * fond : un formulaire plus haut que l'écran restait atteignable. Un
       * `<dialog>` ne défile pas de lui-même — sans cette borne, le bouton
       * « Enregistrer » d'un dossier complet serait sous le bord de l'écran,
       * hors d'atteinte à la souris comme au clavier. `dvh` plutôt que `vh` :
       * sur téléphone, la barre d'adresse mange la différence. */
      className={
        "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto " +
        "rounded-2xl border-0 bg-white p-0 shadow-2xl backdrop:bg-slate-900/40 " +
        (taille === "large"
          ? "max-w-3xl"
          : taille === "petite"
            ? "max-w-lg"
            : "max-w-2xl")
      }
    >
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
        <div className="min-w-0">
          <h2 id={idTitre} className="font-semibold text-slate-800">
            {titre}
          </h2>
          {description && (
            <p id={idDescription} className="text-xs text-slate-500 mt-0.5">
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
