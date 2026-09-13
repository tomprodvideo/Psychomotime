"use client";

import { useId } from "react";

/**
 * UN BOUTON, ET LES DEUX FAÇONS DONT IL PEUT NE PAS RÉPONDRE.
 *
 * ── POURQUOI `disabled` EST PRESQUE TOUJOURS LE MAUVAIS OUTIL ─────────────
 *
 * Un élément `disabled` sort de l'ordre de tabulation et cesse d'être annoncé.
 * Deux conséquences, toutes deux constatées dans ce produit :
 *
 * 1. On ne peut PAS l'atteindre pour savoir pourquoi il est éteint. Le motif,
 *    quand il existe, est écrit à côté — donc lu par qui voit la page, et par
 *    personne d'autre.
 * 2. S'il portait le focus au moment où il s'éteint, le focus retombe sur
 *    `body`. C'est ce qui arrive à chaque enregistrement : on clique, la
 *    transition démarre, le bouton s'éteint, et le clavier est éjecté au
 *    milieu de l'action.
 *
 * Ce composant n'emploie donc JAMAIS `disabled` — le typage l'interdit. Il
 * emploie `aria-disabled`, qui dit « ceci ne répondra pas » SANS retirer
 * l'élément du parcours : on peut l'atteindre, l'entendre, et entendre
 * pourquoi.
 *
 * ── CE QUE CE CHOIX DÉPLACE, ET QU'IL FAUT SAVOIR ─────────────────────────
 *
 * `aria-disabled` n'empêche rien tout seul. La garantie passe du navigateur à
 * un gestionnaire de clic — c'est un recul qu'il faut assumer sciemment. Elle
 * est tenue ici pour les deux voies qui activent un bouton : le clic, et la
 * soumission implicite au clavier (« Entrée » dans un champ de texte), qui
 * active le bouton par défaut du formulaire et passe donc par le même
 * gestionnaire. `preventDefault` y est indispensable : sans lui, un
 * `type="submit"` soumettrait quand même.
 *
 * Ce qu'il ne couvre pas : une soumission déclenchée par programme. Aucune
 * n'existe dans ce produit aujourd'hui, et les gardes d'immuabilité de la base
 * refusent de toute façon une seconde émission.
 *
 * ── DEUX EMPÊCHEMENTS, QUI NE SE DISENT PAS PAREIL ────────────────────────
 *
 * `empeche` est une RAISON durable : « Ce dossier ne porte aucun parcours
 * ouvert. » Elle est rendue en texte et reliée par `aria-describedby`. Un
 * bouton empêché sans raison est refusé par le typage : si on ne sait pas dire
 * pourquoi, c'est qu'il ne faut pas l'éteindre.
 *
 * `pending` est un état TRANSITOIRE. Le libellé change, et c'est LUI qui porte
 * l'information — pas une roue qui tourne. Cinq boutons du produit disaient
 * « … » pendant l'attente : un lecteur d'écran annonce « points de suspension,
 * bouton ». Ce n'est pas une abréviation, c'est une perte d'information.
 *
 * ── CE QU'IL NE FAIT PAS ──────────────────────────────────────────────────
 *
 * Il ne pose aucun `outline` ni `outline-none`. La règle `:focus-visible` de
 * `globals.css` est posée hors de toute couche en cascade et doit primer ; un
 * bouton qui redéfinirait son contour la casserait.
 *
 * Il ne délave pas le libellé. `disabled:opacity-50` réduit AUSSI le contraste
 * du texte — un bouton empêché devenait illisible au moment précis où il faut
 * lire pourquoi. On change le curseur et on retire le relief.
 *
 * [Contrastes calculés sur les valeurs déclarées : blanc sur `brand-600`
 * 6,00:1, blanc sur `rose-700` 6,29:1. Le produit écrivait `rose-600` dans
 * trois fichiers et `rose-700` dans quatre ; `rose-600` ne vaut que 4,70:1, et
 * la marge compte sur le bouton qui supprime.]
 */

type Variante = "principal" | "discret" | "destructif" | "texte";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm " +
  "font-medium px-4 py-2 transition select-none";

const VARIANTES: Record<Variante, string> = {
  /** L'action attendue de l'écran. Une seule par écran. */
  principal: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
  /** Tout le reste : annuler, fermer, une action secondaire. */
  discret: "bg-white text-slate-700 border border-slate-500 hover:bg-slate-50",
  /** Ce qui retire, annule, ou rend une chose irréversible. */
  destructif: "bg-rose-700 text-white hover:bg-rose-800 shadow-sm",
  /** « Annuler », « Revenir » : la sortie d'un panneau, sans poids visuel. */
  texte: "text-slate-600 hover:text-slate-800 hover:bg-slate-100",
};

const EMPECHE = "opacity-70 cursor-not-allowed shadow-none";

export function Bouton({
  variante = "discret",
  pending,
  pendingLabel,
  empeche,
  type = "button",
  onClick,
  className = "",
  children,
  ...reste
}: {
  variante?: Variante;
  /** Une action est en cours. Le libellé change ; le focus ne bouge pas. */
  pending?: boolean;
  /** Ce qu'on lit pendant l'action. Une phrase, jamais « … ». */
  pendingLabel?: string;
  /** POURQUOI ce bouton ne répond pas. Obligatoire pour l'éteindre. */
  empeche?: string | null;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "disabled">) {
  const idMotif = useId();
  const inerte = Boolean(empeche) || Boolean(pending);

  const bouton = (
    <button
      {...reste}
      type={type}
      onClick={(e) => {
        if (inerte) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onClick?.(e);
      }}
      aria-disabled={inerte || undefined}
      aria-busy={pending || undefined}
      aria-describedby={empeche ? idMotif : undefined}
      className={`${BASE} ${VARIANTES[variante]} ${inerte ? EMPECHE : ""} ${className}`}
    >
      {pending ? (pendingLabel ?? "Enregistrement en cours…") : children}
    </button>
  );

  /* SANS MOTIF, ON REND LE BOUTON NU. Envelopper systématiquement ferait du
     motif un second enfant de la rangée flex qui contient le bouton, et
     déplacerait la mise en page de tous les écrans pour un cas rare. */
  if (!empeche) return bouton;

  return (
    <span className="inline-flex flex-col items-start gap-1">
      {bouton}
      {/* LE MOTIF EST DANS LE DOCUMENT, pas dans une infobulle : une infobulle
          n'existe ni au clavier, ni sur une tablette, ni à l'impression. */}
      <span id={idMotif} className="block text-xs text-encre-faible">
        {empeche}
      </span>
    </span>
  );
}
