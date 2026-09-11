# Registre des décisions

Ne consigner que des décisions confirmées. Une hypothèse ou une proposition doit rester dans `OPEN_QUESTIONS.md` jusqu’à validation.

Les décisions ci-dessous sont **démontrées par le code** : elles décrivent des choix déjà en vigueur dans le dépôt. Leur justification est reconstituée à partir du code et des commentaires ; lorsqu’elle est incertaine, c’est écrit. Statut `constatée` = en vigueur dans le code, jamais formellement arbitrée.

| Date | ID | Statut | Décision | Justification | Conséquences | Auteur/validation |
|---|---|---|---|---|---|---|
| Avant 2026-09-11 | DEC-001 | constatée | L’isolation des données repose sur la RLS PostgreSQL, avec `auth.uid() = user_id` sur toutes les tables. | Contrôle serveur unique et centralisé, indépendant de l’interface. | Une table créée sans politique RLS est exposée à tous les comptes. Les Server Actions filtrent souvent par `.eq("id", …)` sans `user_id` et dépendent donc entièrement de cette couche. | À valider |
| Avant 2026-09-11 | DEC-002 | constatée | Le locataire est le compte utilisateur, pas le cabinet : aucune entité organisation. | Cible initiale = pratique libérale individuelle. | Ajouter un collaborateur ou un remplaçant est une refonte du modèle d’isolation, pas un ajout. | À valider |
| Avant 2026-09-11 | DEC-003 | constatée | Aucune clé `service_role` n’est utilisée : tout passe par la clé anonyme et la RLS. | Réduit la surface d’une fuite de secret côté serveur. | Aucune opération ne peut contourner la RLS, y compris pour l’administration. Vérifié : aucune occurrence de `service_role` dans le dépôt. | À valider |
| Avant 2026-09-11 | DEC-004 | constatée | Les montants comptables sont figés à la saisie ; changer un taux ne rétroagit pas sur les factures existantes. | Préservation de l’historique comptable (`README.md:78`). | Les colonnes `after_retro` et `net_revenue` sont `generated always as … stored` (`supabase/schema.sql:52`), donc cohérentes par construction. | Documentée dans le README |
| Avant 2026-09-11 | DEC-005 | constatée | Un bilan a deux statuts, `brouillon` et `finalisé`, contraints par un CHECK SQL. | Distinguer un document de travail d’un document abouti. | La contrainte existe en base, mais le passage d’un statut à l’autre n’est vérifié qu’en interface. Voir `Q-201`. | À valider |
| Avant 2026-09-11 | DEC-006 | constatée | Deux types de bilan coexistent : psychomoteur et sensoriel (Dunn 2), avec trames, modèles et réglages séparés. | Deux pratiques d’évaluation distinctes. | Le type est stocké dans `content.__type__` et non dans une colonne : non indexable, non contraignable, toute valeur inattendue retombe silencieusement sur `psychomoteur`. | À valider |
| Avant 2026-09-11 | DEC-007 | constatée | Les migrations SQL sont des fichiers à coller manuellement dans l’éditeur SQL de Supabase, tous « relançables sans danger ». | Simplicité, pas d’outillage à installer. | Aucun suivi de ce qui est réellement appliqué en production. Le code compense par des replis silencieux sur colonne manquante (`PGRST204`/`42703`). Voir `Q-203`. | À valider |
| Avant 2026-09-11 | DEC-008 | constatée | L’export d’un bilan ou d’une facture passe par l’impression du navigateur, pas par une génération PDF côté serveur. | Aucune dépendance ni coût serveur. | Le rendu dépend du navigateur ; aucune trace d’export n’est conservée ; aucun envoi n’est effectué par le système. | À valider |
| Avant 2026-09-11 | DEC-009 | constatée | La reformulation d’une section de bilan est confiée à l’API Anthropic, modèle `claude-opus-4-8`, avec une consigne système interdisant d’inventer. | Qualité rédactionnelle (commentaire `app/(app)/bilans/ai-actions.ts:5`). | Du contenu clinique quitte l’infrastructure Supabase. La consigne est un garde-fou de prompt, pas une garantie technique. Voir `docs/security/DATA_FLOWS.md` et `Q-301`. | À valider |
| Avant 2026-09-11 | DEC-010 | constatée | L’accès au produit est conditionné à un abonnement, avec un essai de 7 jours accordé à l’inscription. | Modèle économique par abonnement. | L’encaissement n’est pas implémenté : les colonnes Stripe existent, aucun code ne les lit ni ne les écrit. L’activation se fait à la main via `manual_override`. | À valider |

Pour une décision technique structurante, créer un ADR à partir de `docs/architecture/decisions/ADR-000-template.md` et référencer son identifiant ici.

## Décisions à arbitrer

Les points suivants sont en vigueur dans le code mais n’ont jamais été tranchés explicitement. Ils sont instruits dans `OPEN_QUESTIONS.md` et ne doivent pas être traités comme des décisions acquises :

- l’usage d’une adresse e-mail personnelle codée en dur pour attribuer le rôle d’administrateur ;
- la possibilité de repasser un bilan finalisé en brouillon, et de modifier un bilan finalisé ;
- le comportement de repli permissif lorsque la table des abonnements est en erreur ;
- l’absence d’historisation des bilans et d’horodatage de la finalisation.
