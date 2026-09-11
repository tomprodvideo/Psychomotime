---
name: implementer-fonctionnalite
description: "Implémente une fonctionnalité déjà cadrée avec les agents de construction adaptés, tests, audits et mise à jour de la continuité."
argument-hint: "<spécification, ticket ou fichier de critères>"
---

# Implémenter une fonctionnalité

Implémente : `$ARGUMENTS`.

## Conditions d’entrée

Retrouve la spécification et ses critères. Si les règles métier, acteurs ou données sensibles sont encore indéterminés au point de changer l’implémentation, complète d’abord `/cadrer-fonctionnalite`.

## Procédure

1. Confie la coordination à `orchestrateur-saas`.
2. Inspecte l’existant et définis le changement minimal, les fichiers propriétaires et l’ordre des migrations.
3. Mobilise selon le besoin :
   - `architecte-logiciel` pour une frontière structurante ;
   - `ingenieur-base-donnees` pour schéma et migration ;
   - `ingenieur-backend` pour règles, API et autorisations ;
   - `ingenieur-frontend-ux` et `designer-ux-psychomotricite` pour l’interface ;
   - `ingenieur-integrations` pour tout service externe ;
   - `ingenieur-tests-qualite` pour les preuves par risque.
4. Évite les éditions concurrentes des mêmes fichiers. Intègre par étapes testables.
5. Exécute les contrôles ciblés, puis le build ou la suite plus large seulement si le risque ou les dépendances le justifient.
6. Fais auditer le résultat par `auditeur-fonctionnel-metier` et `auditeur-securite-applicative`. Ajoute `auditeur-ia-confidentialite` pour toute fonction IA.
7. Fais corriger les constats validés par les agents constructeurs, puis contre-vérifier par l’auditeur concerné.
8. Demande à `gardien-contexte` de mettre à jour état et décisions confirmées, puis à `relecteur-final` de rendre son verdict.

## Résultat

Rapporte comportement, fichiers, migrations, tests, audits, risques et décision de revue. Aucun push ou déploiement sans demande explicite.

