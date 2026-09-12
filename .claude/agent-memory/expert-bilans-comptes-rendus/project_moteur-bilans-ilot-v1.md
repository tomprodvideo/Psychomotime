---
name: moteur-bilans-ilot-v1
description: Le moteur de bilans est le dernier îlot v1 de Psychomotime, et sa refonte (L4) est gelée derrière une question clinique non tranchée (Q-203)
metadata:
  type: project
---

Au 2026-09-12, la refonte de Psychomotime a basculé tout le produit du compte
vers le **cabinet** (`practices`, 20 migrations appliquées), sauf un domaine :
**le moteur de bilans est resté en v1**, clé sur `user_id`, contenu entier dans
un `content` jsonb dont le type de bilan vit dans `content.__type__`.

**Why :** le lot L4 (composition documentaire, statuts, versions, exports) est
placé après L3 dans `docs/refonte/02-LOTS.md`, et sa décision fondatrice —
`Q-203` : un bloc de prose par domaine, ou des champs séparés observation /
résultat / interprétation / retentissement — **n'a été tranchée par aucune
psychomotricienne en exercice**. Le dossier de recherche
`docs/refonte/recherche/01-clinique-domaines.md` propose déjà les quatre
registres (§ 4, § 7 B-10), mais comme proposition, pas comme décision.

**How to apply :**
- Ne jamais concevoir une fonction de bilan comme si les registres existaient,
  ni comme si le bloc unique était définitif. Les deux sont des paris.
- Tout ce qui dépend de la structure — réutilisation fine, comparaison entre
  deux bilans, périmètre de l'IA section par section, bilan d'évolution — est
  **derrière** cette décision. Ce qui n'en dépend pas — variables dans les
  modèles, insertion au curseur, pré-remplissage de faits du dossier — peut
  avancer sans elle, et c'est là qu'il faut proposer en premier.
- Deux modules corrects existent et ne sont **branchés nulle part** :
  `lib/scales.ts` (règle de cotation unique) le reste, parce qu'il suppose un
  registre d'instruments rempli à la main — voir la question P-4 de
  [[registre-instruments-refonte]]. C'est un motif récurrent du dépôt : le
  module juste est écrit, le fil manque.

Voir aussi [[user-attentes-analyses]].
