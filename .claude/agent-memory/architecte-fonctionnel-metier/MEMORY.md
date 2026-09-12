# Mémoire — architecte-fonctionnel-metier

## Invariants confirmés

- Patient, responsable légal, utilisateur et professionnel sont des concepts distincts. Démontré par `0002_dossier_patient.sql` : `contacts` + `patient_contacts` à rôles datés, le patient n'est jamais un compte.

## Modèle métier propre au projet

- [Moteur de bilans, dernier module v1](project_moteur-bilans-dernier-module-v1.md) — `bilans` est clé sur `user_id` ; « N types de bilans » se modélise en nature + trame, pas en type.
- [Méthode de reprise v1](feedback_methode-reprise-v1.md) — table v1 en filet, identifiants conservés, rien deviné, trous visibles, reprise idempotente.
