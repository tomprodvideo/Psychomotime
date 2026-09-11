# Pilotage de la refonte Psychomotime

> Document de continuité. Il doit permettre à un autre contexte de reprendre le
> travail sans perte. Mis à jour à chaque fin de lot.

**Dernière mise à jour :** 2026-09-11 — L0 partiellement livré
**Base de départ :** `main` @ `d8af516` — audit fonctionnel du 2026-09-11.

---

## 1. Mandat

Transformer Psychomotime en SaaS français complet pour psychomotriciens libéraux :
patients et entourage, parcours de soin, bilans, comptes rendus, documents,
facturation, pré-comptabilité, protection des données.

Livrable attendu : **application exécutable**, pas un plan.

## 2. Faits établis au démarrage

| # | Fait | Preuve | Statut |
|---|---|---|---|
| F1 | Le locataire du système est `auth.users`, pas le cabinet | `supabase/schema.sql` — toutes les tables portent `user_id` | vérifié |
| F2 | Aucune entité cabinet, collaborateur, remplaçant, partage | recherche exhaustive du dépôt | vérifié |
| F3 | Un seul projet Supabase : `Psychomotime`, `eu-west-1`, ACTIVE_HEALTHY | MCP Supabase `list_projects` | vérifié |
| F4 | Ce projet sert l'application déployée — c'est l'environnement de production | un seul projet existe, `.env.local` y pointe | vérifié |
| F5 | Volumétrie : 5 comptes, 7 patients, 7 bilans, 9 factures | requête de comptage, aucun contenu lu | vérifié |
| F6 | Les données actuelles sont factices, aucun client réel connecté | **déclaration explicite de l'utilisateur le 2026-09-11** — remplace la conclusion contraire de l'audit | décision utilisateur |
| F7 | Aucune clé `service_role` dans le dépôt ; les 3 clients Supabase utilisent la clé publique | `lib/supabase/*` | vérifié |
| F8 | Pas de Docker, pas de CLI Supabase sur la machine ; PostgreSQL 16 local actif | `pg_isready` → accepte les connexions | vérifié |
| F9 | Le type de bilan vit dans `content.__type__`, pas en colonne | `apercu/page.tsx:99` | vérifié |
| F10 | Les montants sont en `numeric` PostgreSQL et manipulés en flottants JS | `lib/calc.ts` — `Math.round((n + EPSILON) * 100) / 100` | vérifié |

## 3. Décisions structurantes prises

Voir `docs/refonte/adr/` pour le détail. Résumé :

| ID | Décision | Réversible ? |
|---|---|---|
| D-01 | Refonte **en place** dans le dépôt existant, stack conservée (Next.js 16 / Supabase / Vercel) | ⚠️ **À ROUVRIR** — voir R-01 |
| D-02 | Schéma reconstruit **à zéro** sous un baseline de migrations reproductible et numéroté | non |
| D-03 | Entité `practice` (cabinet) distincte de `auth.users`, avec `practice_members` et rôles | non |
| D-04 | RLS en **refus par défaut** sur toutes les tables ; isolation par appartenance active au cabinet | non |
| D-05 | Les montants sont des **entiers de centimes** (`bigint` en base, entier en TS). Plus aucun flottant monétaire | non |
| D-06 | Le type de bilan devient une **colonne relationnelle contrainte et indexée** ; le contenu flexible reste en JSONB validé | non |
| D-07 | Tests locaux sur **PostgreSQL 16 + stub `auth`** (pas de Docker sur la machine). Les RLS sont testées négativement | oui |
| D-08 | Aucun seuil, taux, tarif ou mention légale codé en dur : **tables datées, versionnées et sourcées** | non |
| D-09 | **Aucune migration destructive** sur `sisummvlowhtfgiatwwf` sans autorisation au moment de l'action (c'est la production, cf. F3/F4) | — |
| D-10 | Séparation stricte **composition déterministe** (assemble des faits) / **assistance IA** (propose, ne décide jamais) | non |
| D-11 | **Portabilité du schéma** : `app.current_user_id()` est le seul point de contact avec Supabase. Aucune politique, aucune autre fonction n'appelle `auth.*`. Vérifié par test de couverture. | non |
| D-12 | L'accès payant a **une seule définition**, énoncée deux fois : `app.subscription_is_active` en base, `lib/subscription.ts` côté serveur. En cas de divergence, **la base fait foi**. | non |

## 4. Agents mobilisés

| Rôle | Agent | Périmètre | Mode |
|---|---|---|---|
| Coordination, architecture, synthèse | orchestrateur principal (ce contexte) | décisions, arbitrages, implémentation des lots | écriture |
| Recherche clinique | `expert-metier-psychomotricien` | cadre professionnel, populations, domaines, natures de documents, PCO/TND | lecture + web |
| Psychométrie et licences | `expert-bilans-comptes-rendus` | registre des instruments, échelles, seuils, licences éditeurs | lecture + web |
| Comptabilité et fiscalité FR | `general-purpose` (mandat comptable) | formes juridiques, TVA, mentions, numérotation, facturation électronique, PCO | lecture + web |
| Données de santé et hébergement | `auditeur-donnees-sante-hebergement` | HDS, RGPD, flux sortants, couverture fournisseurs | lecture seule |
| Sécurité applicative | `auditeur-securite-applicative` | auth, autorisations, RLS, lien public, IA, secrets | lecture seule |
| Modèle métier | `architecte-fonctionnel-metier` | entités, relations, statuts, événements | à mobiliser lot 1 |
| Dossier patient | `concepteur-dossier-patient` | cycle de vie du dossier, responsables légaux, partages | à mobiliser lot 2 |
| Parcours cabinet | `expert-parcours-cabinet` | agenda, séances, présences, relances | à mobiliser lot 3 |
| UX et design system | `designer-ux-psychomotricite` | parcours, hiérarchie, microcopie, accessibilité | à mobiliser lot 2 |
| Qualité et tests | `ingenieur-tests-qualite` | stratégie de tests, fixtures, régressions | à mobiliser lot 1 |
| IA clinique | `responsable-ia-clinique` + `auditeur-ia-confidentialite` | désidentification, non-invention, injections | à mobiliser lot 6 |
| Revue finale | `relecteur-final` | preuves, métier, sécurité, tests, documentation | fin de chaque lot à risque |

**Règle d'écriture :** un seul agent écrit dans un fichier donné. Les agents d'audit
travaillent en lecture seule et renvoient leur rapport ; l'orchestrateur l'écrit.

## 5. Distinction des niveaux de certitude

Tout document de cette refonte utilise ces marqueurs, sans exception :

- **[VÉRIFIÉ]** — constaté dans le code, avec `fichier:ligne`.
- **[SOURCE]** — source officielle citée, avec URL et date de consultation.
- **[HYPOTHÈSE]** — supposition de travail, à confirmer.
- **[DÉCISION]** — choix produit réversible, avec son défaut prudent.
- **[VALIDATION HUMAINE]** — exige un psychomotricien, un expert-comptable, un
  juriste/DPO ou un auditeur sécurité. Le logiciel ne tranche pas.

## 6. État d'avancement

| Lot | Intitulé | État |
|---|---|---|
| L0 | Socle : migrations reproductibles, tenancy cabinet, RLS refus par défaut, harnais de tests | **partiellement livré** — base, isolation, tests, arithmétique monétaire faits ; authentification et garde serveur à faire |
| L1 | Dossier patient, entourage, rôles, parcours de soin | à faire |
| L2 | Agenda, séances, présences, objectifs | à faire |
| L3 | Moteur de bilans configurable + registre d'instruments | à faire |
| L4 | Composition documentaire, statuts, versions, exports | à faire |
| L5 | Devis, factures, avoirs, paiements, attestations, PCO | à faire |
| L6 | Assistance IA encadrée | à faire |
| L7 | Transmissions sécurisées, liens révocables, journalisation | à faire |
| L8 | Design system, accessibilité, performance | à faire |
| L9 | Préparation à la production, rapports finaux | à faire |

Détail : `docs/refonte/02-LOTS.md`.

## 7. Ce qui est livré et vérifié au 2026-09-11

| Livrable | Preuve |
|---|---|
| Baseline de migrations reconstructible depuis zéro | `npm run db:reset` — `supabase/migrations/0001_socle_identite.sql`, 11 tables |
| Harnais de test SQL local sans Docker | `scripts/db.mjs` + `supabase/local/` (stub `auth`, assertions, couverture) |
| Isolation inter-cabinets prouvée négativement | `supabase/tests/020_isolation_cabinets.sql` — 6 scénarios, dont l'accès par UUID exact, l'utilisateur sans appartenance, le visiteur anonyme, l'administrateur de plateforme et le rôle assistant |
| Couverture RLS automatique | `supabase/tests/010_couverture_rls.sql` — refuse toute table sans RLS, sans RLS forcée, sans politique, toute fonction `security definer` au `search_path` libre, tout privilège `anon`, et toute adhérence directe à `auth.*` |
| Garanties transactionnelles | `supabase/tests/030_garanties_socle.sql` — création atomique, dernier propriétaire, journal en ajout seul, paramètres non réécrivables, abonnement, configuration fiscale unique, identifiants datés |
| Seeds entièrement fictifs, micro-BNC et société | `supabase/seed/0001_cabinets_fictifs.sql` |
| Arithmétique monétaire en centimes entiers | `lib/money.ts` + 15 tests, dont la preuve du défaut corrigé |
| Règle d'accès unique et fermée par défaut | `lib/subscription.ts` + `app.subscription_is_active` |

Commandes : `npm run verify` (lint + typecheck + 42 tests unitaires + 3 fichiers de tests SQL).

## 8. Prochaine action exacte

1. **Décision utilisateur sur R-01 et R-02** — elles conditionnent la suite.
2. Terminer L0 : récupération et changement de mot de passe et d'e-mail `[A-01]`,
   garde serveur unique appliquée à chaque cas d'usage `[A-11]`, aucune écriture
   ne pouvant rendre une erreur comme un succès `[A-07]`.
3. Monter `next` en `16.3.5` et vérifier le build `[R-03]`.

## 9. Risques ouverts

| Risque | Gravité | Traitement |
|---|---|---|
| **R-01** | **BLOQUANT** | **Aucun des quatre fournisseurs — Supabase, Vercel, Anthropic, Resend — n'est certifié hébergeur de données de santé.** L'article R1111-9-1 du CSP, en vigueur le **2026-09-26**, impose un stockage exclusivement dans l'EEE. Anthropic et Resend stockent aux États-Unis, sans option européenne. **Décision utilisateur requise** — voir `docs/refonte/recherche/04-hds-rgpd-hebergement.md` § 4. |
| **R-02** | **critique** | `CR bilan psychomoteur.pdf` (356 Ko) est versionné et poussé sur `origin/main`, **et le dépôt GitHub est public** (vérifié : `api.github.com` répond 200, `"private": false`). Le fichier n'a pas été ouvert. **Si son contenu est réel, c'est un incident de données de santé** ; un `git rm` ne suffirait pas — le blob reste accessible par son SHA. **Qualification par le propriétaire requise.** |
| **R-03** | élevée | `next@16.2.9` porte 1 advisory critique et 6 hautes, dont deux visent l'architecture du produit : contournement de middleware (`proxy.ts` est le seul garde-fou de route) et divulgation des endpoints de Server Functions. Correctif : `next@16.3.5`. |
| R-04 | élevée | Le code reproduit en dur des intitulés d'épreuves et des grilles de deux batteries sous licence éditeur, **et les imprime dans le document remis aux familles**. Extraction vers un registre de métadonnées en L3. |
| R-05 | élevée | La production et le développement partagent le même projet Supabase. À séparer avant toute reprise d'activité réelle. |
| R-06 | moyenne | Deux textes fiscaux basculent le **1ᵉʳ janvier 2027** : l'article 293 B du CGI est abrogé par l'ordonnance 2025-1247. Une mention de TVA écrite en dur produira des factures fausses. Traité par D-08 (tables datées). |
| R-07 | résolu | Repli permissif accordant l'accès et le rôle d'administration sur erreur de lecture. **Corrigé le 2026-09-11** : `lib/subscription.ts` + `lib/data.ts`, le refus est le défaut. |
| R-08 | résolu | `round2()` perdait un centime sur des montants ordinaires (32,30 € à 25 % → 8,07 € au lieu de 8,08 €) et était incohérent selon l'ordre de grandeur. **Corrigé** : `lib/money.ts`, centimes entiers, 42 tests. |
