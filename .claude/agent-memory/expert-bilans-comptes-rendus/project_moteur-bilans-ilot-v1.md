---
name: moteur-bilans-ilot-v1
description: Le moteur de bilans est le dernier îlot v1 de Psychomotime — état vérifié des écarts C-1..C-8, ce que Q-201/Q-202 bloquent, et les pièges de documentation à ne pas rejouer
metadata:
  type: project
---

Au 2026-09-13, tout Psychomotime est passé au **cabinet** (`practices`, 24
migrations) sauf un domaine : **le moteur de bilans est resté en v1**, table
`public.bilans` clé sur `user_id`, contenu entier dans un `content` jsonb dont
le type vit dans `content.__type__`.

## Piège de documentation, vérifié deux fois — à ne pas rejouer

`docs/context/CURRENT_STATE.md` affirme que les écarts cliniques du moteur de
bilans « sont intacts », **et c'est faux**. Au 2026-09-12, cinq des huit écarts
de `docs/clinical/CLINICAL_SAFETY.md` ont été corrigés dans le code : C-1
(bandeau brouillon imprimé), C-4 (âge à la passation), C-6 (rattachement),
C-7 (enregistrement périodique 30 s + `beforeunload`), C-8 (suppression de
section de trame).

**Why :** `CURRENT_STATE.md` est chargé dans le contexte de chaque session, et
les briefs du propriétaire le recopient de bonne foi. J'ai reçu deux fois un
mandat fondé sur des défauts déjà corrigés.

**How to apply :** avant d'analyser un écart C-n, ouvrir le fichier concerné et
chercher le commentaire de correction — ce dépôt documente ses corrections DANS
le code, en tête du bloc corrigé. Ne jamais partir du seul `CURRENT_STATE.md`.

## Ce qui reste réellement ouvert

- **C-2 / `Q-202`** — la légende imprimée se contredit : `SCORE_INTERPRETATION`
  place la même valeur dans deux bandes (NS 7, et −1 DS sur la ligne DS), et
  `nsColor` tranche autrement que le texte. Q-201-indépendant, mais **aucun
  correctif ne peut être écrit sans choisir un seuil** : c'est une décision de
  la psychomotricienne, pas de la conception.
- **C-3** — « Zone dite “pathologique” » sur le document remis. Vocabulaire.
- **C-5, reste** — consigne de style, endossement d'identité, conclusion
  reformulable (`Q-302`, `Q-303`). Lot 6, pas Q-201.
- **Cohérence groupe d'âge M-ABC ↔ date de naissance** (`Q-205`) : la date de
  naissance est déjà dans le composant, le contrôle n'existe pas.

## `lib/scales.ts` — la nuance que j'avais mal notée

Ce n'est pas un module « juste mais non branché » faute de registre : c'est une
**autorité de cotation complète, testée, protégée par un test d'architecture**
(`lib/scales.architecture.test.mts`) qui plafonne à TROIS les fichiers v1
autorisés à porter une règle concurrente (`lib/constants.ts`,
`components/GaussianCurve.tsx`, `apercu/page.tsx`). Il porte déjà
`verifierTrancheAge` et le garde « un vocabulaire non validé ne sort pas du
cabinet » (`classer(..., surface: "document")`).

Il ne contient **aucune borne, aucune couleur, aucun libellé** — par
construction : ils viennent de la base. Le brancher exige donc un jeu de bandes
rempli, donc le registre d'instruments, donc la dépendance humaine P-4 de
[[registre-instruments-refonte]]. **La liste d'exemptions doit rétrécir, jamais
s'allonger** : ne jamais proposer un correctif qui ajoute une quatrième
autorité de cotation.

## `bilans` est invisible au harnais de vérification

`scripts/db.mjs reset` construit la base de test à partir de
`supabase/migrations/` seul ; `bilans` naît dans `supabase/schema-v1/schema.sql`,
appliqué uniquement par la voie `cutover`. Aucun des fichiers de
`supabase/tests/` ne nomme `bilans`, et `tests.check_rls_coverage()` ne peut pas
le voir. Sa RLS (`auth.uid() = user_id`) est correcte mais **jamais falsifiée**,
dans un dépôt dont toute la discipline est la falsification.

## Ce que Q-201 bloque, et ce qu'elle ne bloque pas

`Q-201` — ce que « validé » signifie — bloque **tout le palier C** de
`docs/refonte/03-MOTEUR-DOCUMENTS.md` : migration vers le cabinet, instantané,
verrouillage, historisation, refus d'émettre, signature retenue sur un
brouillon. Elle ne bloque **pas** : le rattachement d'un bilan orphelin, la
couverture SQL de `bilans`, les faits affichés au point de décision, le
vocabulaire imprimé, ni rien de l'IA.

Voir aussi [[user-attentes-analyses]] et [[ecrits-cliniques-serie]].
