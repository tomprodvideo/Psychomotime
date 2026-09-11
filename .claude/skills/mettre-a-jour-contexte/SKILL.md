---
name: mettre-a-jour-contexte
description: "Synchronise la mémoire partagée du projet avec le code, les tests et les décisions confirmées, notamment après une livraison ou avant une reprise."
argument-hint: "[périmètre ou période]"
---

# Mettre à jour le contexte

Synchronise `$ARGUMENTS` ou l’état courant global.

## Procédure

1. Confie la consolidation à `gardien-contexte`.
2. Lis Git, le diff, les tests, les rapports, les ADR et les mémoires projet pertinentes.
3. Compare chaque affirmation de `CURRENT_STATE.md` et `ARCHITECTURE.md` à une preuve actuelle.
4. Ajoute les décisions explicitement confirmées dans `DECISIONS.md` et crée ou relie un ADR si elles sont structurantes.
5. Déplace les questions résolues, conserve les questions ouvertes et marque les éléments obsolètes sans effacer l’historique utile.
6. Mets à jour produit, utilisateurs, glossaire, flux, menaces et matrice de tests uniquement si le changement le justifie.
7. Vérifie qu’aucun secret, identifiant ou contenu patient réel n’a été conservé.
8. Exécute `bash scripts/validate-agent-kit.sh .`.

## Résultat

Rends une note de reprise concise : objectif, état démontré, dernières décisions, vérifications, risques, questions et prochaine action exacte. Distingue toujours faits, hypothèses et propositions.

