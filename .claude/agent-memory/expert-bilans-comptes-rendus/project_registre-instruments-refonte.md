---
name: registre-instruments-refonte
description: Refonte Psychomotime — le cadre du registre d'instruments (métadonnées seules, 4 statuts de licence) et la question qui décide de sa faisabilité
metadata:
  type: project
---

La refonte de Psychomotime intègre un **registre d'instruments en métadonnées seules** : le logiciel ne cote jamais, il enregistre une valeur et **qui l'a calculée** (`source_cotation`, dont aucune valeur ne désigne le logiciel). Cadre complet écrit le 2026-09-11 dans `docs/refonte/recherche/02-instruments-psychometrie.md`.

**Why:** le produit code en dur les intitulés d'épreuves et les grilles de deux batteries éditées sous licence, et les **imprime dans le compte rendu remis aux familles et aux tiers** — c'est la diffusion, pas le stockage, qui est le point le plus exposé. En parallèle, trois implémentations concurrentes de la même règle de cotation produisent des réponses contradictoires pour une même valeur.

**How to apply:**
- Quatre statuts de licence, du plus restrictif au plus permissif : `reference_seule` (défaut), `scores_saisis_par_le_praticien` (cible pour les deux batteries), `integration_editeur_autorisee` (aucun accord n'existe à ce jour), `outil_libre_valide`. Montée de statut = explicite et tracée ; descente = automatique.
- Ne jamais proposer un seuil, une couleur ou un vocabulaire de bande générique entre instruments : chaque échelle porte ses bandes, versionnées et sourcées, avec un vocabulaire unique choisi par le praticien.
- Invariant à tenir : une fonction de classement unique, appelée par le formulaire, le tableau, le graphique et le PDF. Aucune de ces quatre surfaces ne contient de borne, de couleur ni de libellé.
- L'âge se calcule à la **date de passation** et se fige ; plusieurs passations par bilan ; les écarts de tranche d'âge sont des avertissements, jamais des blocages ni des corrections automatiques.

**Question qui décide de tout (P-4)** : la saisie des intitulés d'épreuves par la praticienne elle-même est-elle une charge acceptable, ou un motif d'abandon ? Tant qu'elle n'est pas tranchée par une psychomotricienne en exercice, ne pas engager le retrait du contenu codé en dur. Voir [[sources-licences-tests]].
