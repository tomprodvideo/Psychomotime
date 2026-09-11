---
name: audit-metier
description: "Audite en lecture seule un parcours ou une version selon les règles du cabinet, la psychomotricité, la sécurité clinique, l’accessibilité et les critères d’acceptation."
argument-hint: "<parcours ou fonctionnalité>"
---

# Auditer le métier

Audite : `$ARGUMENTS`.

## Procédure

1. Rassemble critères, règles, rôles, états, maquettes ou interface, code et tests.
2. Demande à `auditeur-fonctionnel-metier` d’exécuter les scénarios de bout en bout avec données synthétiques.
3. Demande à `expert-metier-psychomotricien` de relire vocabulaire, séquence, flexibilité et place du jugement clinique.
4. Ajoute selon le périmètre `concepteur-dossier-patient`, `expert-bilans-comptes-rendus` ou `expert-parcours-cabinet`.
5. Vérifie nominal, données manquantes, correction, mauvais patient, responsable légal, erreur, reprise, mobile, clavier et partage.
6. Distingue bug démontré, écart de spécification, dette UX, préférence et question devant être validée par un praticien.

## Résultat

Produis la couverture des critères, les scénarios et preuves, les constats classés, les validations métier encore nécessaires et un verdict : prêt, prêt avec réserves ou bloqué. Ne corrige rien pendant l’audit.

