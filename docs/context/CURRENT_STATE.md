# État courant

Dernière mise à jour : 2026-09-11, par `/initialiser-projet`. Dépôt sur `main`, suivi par `origin/main`, dernier commit `e262bb6`.

## État démontré

**Le produit est fonctionnel et en service.** Application Next.js 16.2.9 + Supabase déployée sur Vercel, couvrant 7 modules : tableau de bord, patients, bilans, comptabilité, documents, paramètres, administration. Deux types de bilan — psychomoteur et sensoriel (Dunn 2) — avec trames, modèles et réglages séparés. Comptabilité libérale complète. `npx tsc --noEmit` passe sans erreur.

**Ce qui est solide :**

- L’isolation entre comptes repose sur la RLS PostgreSQL, appliquée à **toutes** les tables et au stockage. **Aucune clé `service_role` n’existe dans le code** : le serveur n’a jamais plus d’autorité que l’utilisateur connecté. Le rôle administrateur **ne franchit pas** cette barrière — il ne lit que la table des abonnements.
- Le module Documents est le mieux conçu : bucket privé, chemin épinglé sur l’identifiant du compte, URL signées à durée courte, nom de fichier anonymisé.
- **Aucun analytics, aucune télémétrie, aucun outil tiers** ne capte de contenu clinique.
- L’appel IA **s’abstient délibérément** de transmettre l’identité du patient, alors que le composant appelant en dispose.
- Au rendu, les champs vides sont omis, jamais remplis d’une valeur neutre : l’absence de donnée n’est pas convertie en résultat normal.

**Ce qui ne l’est pas :** le contrôle d’accès applicatif, la traçabilité et la gestion d’erreur. Détail dans `docs/security/THREAT_MODEL.md`.

## En cours

- Installation du kit d’agents (fait le 2026-09-11) et initialisation du contexte (ce document).
- Dernier travail fonctionnel, arrivé **pendant cette analyse** (commits `0a6ce52`, `3b85b9f`, `e262bb6`) : compteur de numérotation de facture persistant et atomique en base (`migration_010.sql`), message explicite si la fonction est appelée sans session, et création express de patient depuis le formulaire de facture.
- **Conséquence sur ce document** : `MEN-012` est passé de « ouvert » à « largement traité ». Les autres constats sont inchangés — ils ont été vérifiés sur le code dans son état actuel.

## Vérifications connues

| Date | Commande | Résultat |
|---|---|---|
| 2026-09-11 | `bash scripts/validate-agent-kit.sh .` | Kit valide : 24 agents, 8 skills, mémoires et fichiers essentiels présents. |
| 2026-09-11 | `npx tsc --noEmit` | **0 erreur.** |
| 2026-09-11 | `npm run build` | **Succès.** Toutes les routes applicatives sont dynamiques. |
| 2026-09-11 | POST non authentifié sur l’action de reformulation, serveur de production local | **Rejeté** : `{"error":"Session expirée…"}`, aucun appel à l’API Anthropic. Avant correctif, la même requête atteignait l’action. |
| 2026-09-11 | `npm run lint` | **3 erreurs, 2 avertissements — préexistants**, dans `app/(app)/bilans/[id]/useDictation.ts` et `app/(app)/patients/PatientFormDialog.tsx`. Non introduits par l’installation du kit. |
| 2026-09-11 | Recherche `service_role` sur tout le dépôt | Aucune occurrence. |
| 2026-09-11 | Recherche `console.*` sur `app/`, `lib/`, `components/` | **0 occurrence** — aucune observabilité. |
| 2026-09-11 | Recherche `unique` dans `supabase/*.sql` | **Aucune contrainte d’unicité en base.** La numérotation de facture est désormais protégée par un compteur atomique (`migration_010.sql`), mais un numéro saisi à la main reste non contraint. |

**Aucun test automatisé n’existe dans le dépôt.** La CI ne valide que le kit d’agents : ni `supabase/**` ni `app/**` ne sont couverts, et ni `npm run lint` ni `tsc --noEmit` n’y sont exécutés.

## Risques ouverts

Les quatre premiers appellent une décision ou une correction avant toute nouvelle fonctionnalité. Registre complet dans `docs/security/THREAT_MODEL.md`.

1. **`MEN-009` — un compte rendu de bilan est versionné dans Git et déjà poussé sur `origin/main`.** 8 pages, 356 Ko. Le fichier n’a pas été ouvert. Si son contenu est réel, c’est un incident de données de santé, et le retirer de l’index ne suffirait pas. **Décision du propriétaire du dépôt.**
2. ~~`MEN-001` — relais LLM non authentifié.~~ **Corrigé le 2026-09-11** : contrôle de session ajouté en tête de `app/(app)/bilans/ai-actions.ts`. Vérifié en exécution sur le serveur de production local — un POST sans cookie ni en-tête `Origin` atteignait l’action avant le correctif, et reçoit désormais l’erreur de session sans appeler l’API. **Reste ouvert** : `MEN-003`, le contournement de l’abonnement, qui touche les autres actions.
3. **`MEN-005` — privilège administrateur adossé à une adresse e-mail publiée**, présente 16 fois dans 4 fichiers versionnés, dont du code applicatif. Sous deux conditions à vérifier, une simple inscription suffirait à obtenir un compte administrateur.
4. **`MEN-007` — un enregistrement échoué affiche « enregistré ».** 18 mutations sur 20 avalent leurs erreurs, sur du contenu clinique. Le motif correct existe déjà dans le dépôt.
5. `MEN-002` — une future table sans politique RLS serait publique sur Internet, sans aucune défense en profondeur.
6. `MEN-014` — supprimer un patient laisse le bilan intégral, nom compris.
7. Aucune durée de conservation, aucune journalisation, aucun test.
8. Deux batteries éditées sous licence sont recopiées en dur dans le code — point de droit à instruire.
9. **`migrations_en_attente.sql` annonce « 004 à 007 » alors que 008, 009 et 010 existent.** L’écart se creuse à chaque migration : qui suit le chemin documenté obtient une base incomplète.

## Prochaine action

1. Répondre à `Q-501` : **le dépôt GitHub est-il public ou privé ?** Non déterminable depuis le dépôt local, et cette réponse conditionne l’urgence des points 1 et 3 ci-dessus.
2. Trancher `Q-502` — le sort du PDF versionné.
3. ~~Corriger `MEN-001`.~~ Fait. Décider ensuite si `MEN-003` — le contrôle d’abonnement — doit être ajouté aux Server Actions.
4. Soumettre les huit questions cliniques (`Q-201` à `Q-208`) à une psychomotricienne en exercice.
5. Arbitrer les cinq décisions structurantes listées en fin de `docs/context/OPEN_QUESTIONS.md`.

Aucune décision n’a été inscrite au registre sans preuve : `docs/context/DECISIONS.md` ne contient que des décisions **constatées dans le code**, toutes marquées « à valider ».
