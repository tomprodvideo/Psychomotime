import { cloneElement, isValidElement, useId } from "react";
import type { ReactElement } from "react";

/**
 * UN CHAMP DE FORMULAIRE : son étiquette, son aide, son erreur — et les liens
 * qui les relient.
 *
 * ── POURQUOI CE COMPOSANT EXISTE ──────────────────────────────────────────
 *
 * Le style de champ était redéclaré **33 fois dans 29 fichiers**, sous trois
 * noms de constante différents, et il avait déjà divergé en trois variantes.
 * Les plus récentes étaient celles des derniers écrans écrits : la dérive
 * était active, pas historique. Chaque nouvel écrit clinique ajoutait une
 * nuance de plus.
 *
 * Mais la redite n'est pas le vrai problème. Le vrai problème est que
 * `aria-invalid` n'apparaissait NULLE PART dans le produit, et que les erreurs
 * de formulaire s'affichaient en bas, sans lien avec le champ fautif. Un
 * composant est ce qui rend ce lien possible sans toucher trente-sept
 * fichiers.
 *
 * ── CE QU'IL FAIT, ET DANS QUEL ORDRE ─────────────────────────────────────
 *
 * `aria-describedby` nomme l'ERREUR AVANT L'AIDE : ce qui bloque passe devant
 * ce qui accompagne. Un lecteur d'écran énonce l'erreur d'abord.
 *
 * Le message d'erreur ne porte PAS `role="alert"`. Le produit en compte déjà
 * cinquante-trois ; plusieurs simultanés produiraient un empilement
 * d'annonces interruptives. Une seule région d'annonce par formulaire suffit —
 * les messages de champ restent silencieux et simplement DÉCRITS.
 *
 * L'état invalide ne se signale pas par la seule couleur : le trait s'épaissit,
 * un signe apparaît, et la couleur n'est que le troisième canal.
 *
 * ── CE QU'IL NE FAIT PAS ──────────────────────────────────────────────────
 *
 * Il ne valide rien pendant la frappe. Une note de séance rédigée pendant une
 * séance, soulignée en rouge à mi-phrase, est une interruption au pire moment.
 * L'erreur vient de la soumission, jamais du clavier.
 */

/**
 * Le style d'un champ. UNE seule déclaration, et c'est tout l'objet.
 *
 * LA VARIANTE RETENUE EST LA MAJORITAIRE : un fond `slate-50` qui devient
 * blanc au focus. Sept fichiers l'écrivaient ainsi, quatre en blanc plein,
 * trois sans fond du tout — et ces trois derniers étaient les plus récents. On
 * unifie donc VERS LE HAUT : un champ rempli qui s'éclaircit quand on écrit
 * dedans dit ce qu'il est, là où un champ sans fond compte sur son seul
 * liseré.
 *
 * L'anneau de focus `brand-100` n'est PAS ce qui rend le focus visible — il
 * est à 1,58:1, très en dessous des 3:1 exigés. Ce qui le rend visible est la
 * règle `:focus-visible` de `globals.css`, posée hors de toute couche en
 * cascade et donc prioritaire sur les `outline-none` d'ici. L'anneau n'est
 * qu'un ornement qui s'y ajoute ; aucun composant ne doit contourner cette
 * règle par un `outline` explicite.
 */
/**
 * Le style de champ, SANS largeur.
 *
 * POURQUOI LA LARGEUR EST SORTIE. `CHAMP` portait `w-full`, et rien d'autre
 * n'existait. Un champ qui ne devait PAS occuper toute la ligne — un sélecteur
 * de période dans une barre d'outils, un nom de cabinet dans une rangée — ne
 * pouvait donc pas employer la constante : il recopiait ses neuf classes pour
 * en changer une. Onze styles de champ en ligne vivaient dans six fichiers pour
 * cette seule raison.
 *
 * Les deux constantes restent la voie normale. `CHAMP_AUTO` n'est là que
 * lorsque la largeur appartient au contexte.
 */
const BASE =
  "rounded-lg border border-slate-500 bg-slate-50 px-3 py-2 text-sm " +
  "outline-none transition focus:border-brand-400 focus:bg-white " +
  "focus:ring-2 focus:ring-brand-100";

export const CHAMP = `w-full ${BASE}`;

/** Le même, la largeur laissée à l'appelant. */
export const CHAMP_AUTO = BASE;

/**
 * Le même, en état invalide.
 *
 * TROIS CANAUX, JAMAIS LA COULEUR SEULE : le trait s'épaissit, un signe
 * apparaît à côté du message, et la teinte n'arrive qu'en troisième. C'est ce
 * qui le fait tenir pour qui distingue mal le rouge — et sur une impression en
 * noir et blanc, où `rose-50` devient du blanc.
 */
export const CHAMP_INVALIDE =
  "w-full rounded-lg border-2 border-rose-600 bg-rose-50 px-3 py-2 text-sm " +
  "outline-none transition focus:border-rose-700 focus:bg-white " +
  "focus:ring-2 focus:ring-rose-100";

export function Champ({
  label,
  aide,
  erreur,
  requis,
  children,
}: {
  label: string;
  /** Ce qui accompagne : une précision, une conséquence. Jamais une consigne. */
  aide?: React.ReactNode;
  /** Ce qui bloque. Énoncé avant l'aide pour un lecteur d'écran. */
  erreur?: string | null;
  requis?: boolean;
  /** Un `input`, `select` ou `textarea`. Le composant lui pose ce qu'il faut. */
  children: ReactElement<Record<string, unknown>>;
}) {
  const auto = useId();
  const donne = children.props?.id;
  const id = typeof donne === "string" ? donne : auto;
  const idAide = aide ? `${id}-aide` : undefined;
  const idErreur = erreur ? `${id}-erreur` : undefined;

  const decrit = [idErreur, idAide].filter(Boolean).join(" ") || undefined;
  const classeDonnee = children.props?.className;

  return (
    <div>
      <label htmlFor={id} className="block text-sm text-slate-700 mb-1">
        {label}
        {requis && (
          <span className="text-slate-500"> (obligatoire)</span>
        )}
      </label>

      {isValidElement(children)
        ? cloneElement(children, {
            id,
            "aria-invalid": erreur ? true : undefined,
            "aria-describedby": decrit,
            /* LA CLASSE DE L'APPELANT S'AJOUTE, elle ne remplace plus.
               L'ancienne règle abandonnait tout le style de champ dès qu'un
               appelant voulait ajouter une largeur — il devait donc recopier
               les neuf classes. Contrôlé avant de changer : sur les 54 appels
               de `Champ` du produit, AUCUN ne passait de `className`. Cette
               branche n'avait jamais servi, et sa règle était précisément ce
               qui poussait à ne pas s'en servir. */
            className: [erreur ? CHAMP_INVALIDE : CHAMP, classeDonnee]
              .filter((c) => typeof c === "string" && c.length > 0)
              .join(" "),
          })
        : children}

      {erreur && (
        <p id={idErreur} className="text-sm text-rose-700 mt-1">
          {/* Le signe est masqué aux lecteurs d'écran : `aria-invalid` le leur
              a déjà dit, et l'entendre deux fois n'apporte rien. Il est là pour
              qui distingue mal le rouge. */}
          <span aria-hidden="true">⚠ </span>
          {erreur}
        </p>
      )}
      {aide && (
        <p id={idAide} className="text-xs text-slate-500 mt-1">
          {aide}
        </p>
      )}
    </div>
  );
}
