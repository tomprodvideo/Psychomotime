/**
 * UNE SECTION DU DOSSIER : sa surface, son titre, son action, son erreur.
 *
 * Le motif était recopié **seize fois**, dont dix dans le seul dossier
 * patient, où huit sections répétaient mot pour mot la même carte suivie du
 * même `<h2>`.
 *
 * LE BÉNÉFICE N'EST PAS LA BRIÈVETÉ. Certaines de ces sections étaient reliées
 * à leur titre par `aria-labelledby`, d'autres non — selon la date d'écriture.
 * Un lecteur d'écran qui parcourt les régions d'une page annonce alors
 * « section » sans dire laquelle. Le composant supprime la question : il n'y a
 * plus de manière de l'oublier.
 *
 * L'ERREUR DE SECTION porte `role="alert"` — celle-là est la région d'annonce
 * du bloc. Les erreurs de CHAMP, elles, restent silencieuses et simplement
 * décrites : voir `components/Champ.tsx`.
 */
export function SectionDossier({
  titre,
  id,
  action,
  erreur,
  children,
}: {
  titre: string;
  /** Sert à relier le titre à la section. Généré si absent. */
  id: string;
  /** Le geste de droite : « Écrire », « Rédiger », « Ajouter ». */
  action?: React.ReactNode;
  /** Ce qui a échoué pour toute la section — une lecture, le plus souvent. */
  erreur?: string | null;
  children: React.ReactNode;
}) {
  const idTitre = `titre-${id}`;
  return (
    <section
      aria-labelledby={idTitre}
      className="bg-white rounded-xl border border-slate-100 shadow-sm p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={idTitre} className="font-semibold text-slate-800">
          {titre}
        </h2>
        {action}
      </div>

      {erreur && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-avis-trait bg-avis-fond px-3 py-2 text-sm text-avis-encre"
        >
          {erreur}
        </p>
      )}

      {children}
    </section>
  );
}

/**
 * Un avertissement qui appelle une vérification — jamais une erreur.
 *
 * LA DISTINCTION EST CLINIQUE, pas décorative : l'ambre dit « regardez avant de
 * continuer », le rose dit « ceci ne se reprend pas ». Le produit respectait
 * déjà cette règle sans la nommer ; la nommer empêche que le prochain écran
 * fasse l'inverse.
 *
 * Trois canaux, jamais la couleur seule : un mot ou une icône, un trait, une
 * teinte. C'est ce qui le fait survivre à une impression en noir et blanc —
 * `amber-50` et `rose-50` y deviennent tous deux du blanc.
 */
export function Avertissement({
  children,
  compact,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <p
      className={
        compact
          ? "text-xs text-avis-encre bg-avis-fond ring-1 ring-avis-trait rounded px-2 py-1.5"
          : "text-sm text-avis-encre bg-avis-fond ring-1 ring-avis-trait rounded-lg px-3 py-2"
      }
    >
      {children}
    </p>
  );
}
