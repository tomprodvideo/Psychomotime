# Mémoire — ingenieur-backend

## Façon de travailler attendue

- [Périmètre strict](feedback_perimetre-strict.md) — mandats bornés, reprendre les motifs existants, s'arrêter plutôt qu'élargir.
- [Preuve par exécution](feedback_preuve-execution.md) — ne déclarer vérifié que ce qui a été exécuté, coller la sortie réelle.

## Vérifications fiables

- [Commandes de vérification](verification_commandes.md) — `tsc --noEmit`, `npm run build`, `npm test`, eslint ciblé, et cluster PostgreSQL jetable pour exécuter une migration.

## Décisions portées par le produit

- [Date d'émission non rétroactive](project_issue-date-non-retroactive.md) — ne jamais backfiller `issue_date` sur les factures existantes.
- [Facture multi-prestations](project_facture-multi-prestations.md) — `lines jsonb`, valeurs figées à l'émission, aucun backfill ; interface livrée séparément.
