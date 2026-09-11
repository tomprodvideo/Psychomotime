# Architecture

Renseigné le 2026-09-11 par `/initialiser-projet`, par lecture du code. Vérification exécutée : `npx tsc --noEmit` → **0 erreur**.

## Vue d’ensemble

- **Stack** : Next.js 16.2.9 (App Router), React 19.2.4, TypeScript 5, Tailwind CSS 4.
- **Hébergement** : front sur Vercel (probable — commits « Relance build Vercel », `README.md:96`), **à confirmer** : il n’existe ni `vercel.json`, ni `export const runtime`, ni configuration de déploiement dans le dépôt. Région et cloisonnement des variables d’environnement inconnus.
- **Modèle d’organisation** : **aucun**. Le locataire est la ligne `auth.users`. Voir `docs/context/USERS.md`.
- **Authentification** : Supabase Auth par e-mail et mot de passe. Session rafraîchie à chaque requête non statique par `proxy.ts` → `lib/supabase/middleware.ts`. Inscription libre en self-service, mot de passe à 6 caractères minimum.
- **Stockage principal** : PostgreSQL Supabase, 8 tables.
- **Stockage de documents** : **deux magasins distincts** — bucket Supabase privé `documents` pour le module Documents ; **base64 dans du jsonb** pour le logo, la signature, la courbe de Gauss et les photos de bilan. C’est la cause directe du `bodySizeLimit: 6mb` de `next.config.ts`.
- **Services externes** : Supabase et API Anthropic. **Aucun autre** : pas de Stripe (aucune dépendance dans `package.json`), pas d’analytics, pas de suivi d’erreur, pas de messagerie.

## Composants

| Composant | Exécution | Rôle |
|---|---|---|
| `proxy.ts` + `lib/supabase/middleware.ts` | À chaque requête non statique | Rafraîchit la session. **Ne redirige que les GET.** |
| `app/(app)/layout.tsx` | Serveur, au rendu | Redirection si pas de session, puis écran « Abonnement requis ». |
| Pages RSC | Serveur | Lectures Supabase, passent les lignes complètes en props. |
| 23 composants `"use client"` | Navigateur | Saisie, impression, dictée. |
| 7 fichiers d’actions, **20 Server Actions** | Serveur | Toutes les mutations, **sauf le module Documents**. |
| `lib/supabase/{client,server,middleware}.ts` | Navigateur / serveur / edge | 3 clients, **tous avec la clé anonyme**. |
| PostgreSQL + Storage Supabase | Externe | Données **et autorisation**. |
| API Anthropic | Externe | Reformulation de texte clinique. |

## La frontière de confiance

**Elle passe au niveau de PostgreSQL, pas au niveau du processus Next.js.**

Les trois clients Supabase sont construits avec `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Aucune clé `service_role` n’existe dans le dépôt. **Le serveur Next.js n’a donc jamais plus d’autorité que l’utilisateur connecté** : un processus compromis ne donne pas accès aux données d’un autre compte. C’est une propriété forte, à consigner comme invariant délibéré.

**Deux capacités échappent à cette frontière :**

1. **`ANTHROPIC_API_KEY`**, détenue par le seul processus Next, sans médiation PostgreSQL. C’est la seule capacité que la RLS ne peut pas protéger — et c’est précisément celle qui n’a aucun contrôle applicatif. Voir `docs/security/THREAT_MODEL.md` § MEN-001.
2. **Deux fonctions `security definer`**, `public.is_admin()` et `public.delete_my_account()`, toutes deux correctement bornées à `auth.uid()`.

## Invariant d’autorisation : la RLS est l’unique couche

**Confirmé par recherche exhaustive.** Aucune requête sur `patients`, `invoices`, `expenses`, `bilans`, `documents` ou `doc_folders` ne filtre par `user_id` : toutes filtrent par `.eq("id", …)` ou ne filtrent pas du tout. Mieux, **l’application n’écrit jamais `user_id`** sur une table métier : la colonne est remplie par le défaut PostgreSQL `default auth.uid()`. La propriété est attribuée et vérifiée par PostgreSQL ; le code applicatif n’a aucune vue dessus.

Sur 16 Server Actions hors authentification, **8 comportent un contrôle de session** (direct via `auth.getUser()`, ou indirect via `getSettings()` qui lève une erreur sans session) et **8 n’en ont aucun**. Ces 8 sont toutes des actions base de données : elles échouent proprement par RLS. **La seule action sans contrôle *et* sans RLS derrière est `reformulateText`.**

**Conséquence si une future table oublie sa politique RLS** : la clé anonyme est par construction dans le bundle navigateur, et PostgREST expose toute table de `public` à son porteur. Une table sans RLS serait **en lecture et écriture pour tout Internet**, sans aucune défense en profondeur pour la rattraper — le code ne filtre déjà par rien d’autre que `id`. Aggravant : `migration_004.sql` active la RLS **avant** de définir ses politiques, exactement l’ordre où une migration interrompue laisse une table ouverte ; et la CI ne couvre ni `supabase/**` ni `app/**`.

## Flux principaux

| Flux | Mode | Détenteur | Point notable |
|---|---|---|---|
| Authentification | Synchrone | Supabase Auth | Le mot de passe transite par la mémoire du processus Next. |
| Lecture d’un bilan | Synchrone, RSC | PostgreSQL | `content` et `tests` complets traversent vers le navigateur en props RSC, **images base64 comprises**. |
| Écriture d’un bilan | Synchrone | PostgreSQL | Écrasement intégral sur la seule clé `id`. Photos redimensionnées **côté navigateur** — donc sans contrôle serveur. |
| Upload de document | Synchrone, **navigateur → Supabase en direct** | Supabase Storage | Seul domaine sans Server Action. La politique Storage épingle le chemin sur `auth.uid()`. URL signées 300 s / 120 s, bucket privé. **Aucune liste blanche MIME.** C’est le flux le mieux conçu. |
| Facture / PDF | Synchrone, navigateur | — | **Il n’existe aucune génération de PDF** : « Export PDF » est un `window.print()`. |
| Appel IA | Synchrone | Anthropic | Voir `docs/security/DATA_FLOWS.md` § FLUX-004. |

**Conséquence structurante du flux facture/PDF : il n’existe aucune copie immuable d’une facture émise ni d’un bilan finalisé.** Le document est re-dérivé à chaque impression depuis les lignes vivantes **et** depuis `settings.profile` vivant. Modifier son adresse ou ses mentions légales change rétroactivement l’apparence de toutes les factures passées, sur des documents à numérotation séquentielle.

## Migrations et dérive de schéma

Les fichiers `supabase/*.sql` sont des scripts à coller à la main. **Aucun journal n’enregistre ce qui a été appliqué : l’état de la base de production est structurellement inconnaissable depuis le dépôt.**

Deux pièges concrets :

- **`migrations_en_attente.sql` annonce « 004 à 007 » et s’arrête à 007.** Qui suit le chemin documenté obtient une base où le module Documents et la suppression de compte sont **cassés silencieusement**.
- **Relancer `schema.sql` rétrograde le trigger `handle_new_user`** vers sa version pré-004, qui ne crée pas la ligne `subscriptions` — les nouvelles inscriptions n’obtiennent alors plus d’abonnement. Les deux fichiers annoncent pourtant « relançable sans danger ».

**Ce que révèle le repli sur `PGRST204`/`42703` : le code encode l’incertitude au lieu de la résoudre.** Il convertit un invariant de déploiement en branche d’exécution, et ce repli est **silencieux et destructeur** — un `savePatient` qui réussit sur la branche dégradée a abandonné `guardian` et `dossier` sans rien dire, un `saveBilan` dégradé perd `tests`, c’est-à-dire les cotations. Ce n’est donc pas seulement un problème d’exploitation : `docs/clinical/CLINICAL_SAFETY.md` liste explicitement la confusion entre donnée absente et donnée renseignée parmi les risques à contrôler.

## Observabilité, erreurs, transactions, concurrence, idempotence

- **Observabilité : néant.** Zéro `console.*` dans `app/`, `lib/` et `components/`. Aucun journal, aucun SDK d’erreur, aucune piste d’audit. Il est impossible de répondre à « quel texte clinique a été envoyé au fournisseur IA, quand, par qui ».
- **Les Server Actions avalent leurs erreurs.** `saveBilan` jette l’erreur du second `update` et retourne `void` ; le client enchaîne `setDirty(false); setSavedAt(true)` sans condition. **Un enregistrement échoué affiche « enregistré » et efface l’indicateur de modification, sur du contenu clinique.** Le motif se répète sur la quasi-totalité des mutations. **Seules 2 actions sur 20 remontent leurs erreurs** — `signIn`/`signUp` et `reformulateText` — via un objet de résultat typé : **le motif correct existe déjà dans le dépôt**, il n’est simplement pas appliqué aux mutations.
- **Transactions : aucune.** `deleteAccount` enchaîne 4 opérations sans compensation. L’upload de document fait upload puis insert depuis le navigateur : un échec laisse un objet **orphelin dans le bucket**, invisible et jamais nettoyé. `updateSettings` et `saveAdaptationLibrary` font tous deux un lire-modifier-écrire du **même jsonb `profile`** : depuis deux onglets, l’un écrase l’autre.
- **Concurrence** : pas de verrou optimiste ; `updated_at` est écrit mais jamais comparé. **La numérotation de facture a été reprise le 2026-09-11** (`supabase/migration_010.sql`) : un compteur par compte et par portée réserve le rang suivant de façon atomique, par un upsert qui verrouille la ligne. Il subsiste **aucun index unique** sur `invoices(user_id, invoice_number)` : un numéro saisi à la main peut encore doubler un numéro réservé.
- **Idempotence** : un seul mécanisme dans tout le dépôt, la fenêtre anti-doublon de 15 secondes de `createBilan`. C’est une heuristique, pas une clé.

## Frontières fonctionnelles candidates

- identité et accès ;
- organisations et professionnels ;
- patients et responsables légaux ;
- agenda et séances ;
- dossier clinique et documents ;
- facturation et paiements ;
- communications et intégrations ;
- audit et observabilité ;
- fonctions IA éventuelles.

Cette liste ne décide pas du découpage technique. Documenter le découpage réellement retenu et ses dépendances.

**Découpage réellement retenu** : un découpage par domaine fonctionnel dans `app/(app)/`, chaque domaine portant ses pages, ses composants clients et son `actions.ts`. La logique partagée vit dans `lib/`. Il n’y a ni couche service, ni couche d’accès aux données : les Server Actions parlent directement à Supabase.

## Invariants attendus

- chaque donnée sensible possède un propriétaire ou périmètre d’organisation explicite ;
- chaque accès serveur vérifie identité, rôle, relation et action ;
- les traitements asynchrones conservent le contexte d’autorisation nécessaire ;
- les actions sensibles sont idempotentes lorsque les répétitions sont possibles ;
- les événements et logs techniques excluent le contenu clinique inutile.

**État de ces invariants :** le premier est tenu par `default auth.uid()` et la RLS. Le deuxième **n’est pas tenu** : 8 actions sur 16 n’ont aucun contrôle serveur, et le contrôle d’abonnement n’existe qu’au rendu des pages. Le troisième est sans objet — il n’existe aucun traitement asynchrone. Le quatrième **n’est pas tenu**, sauf pour la création de bilan. Le cinquième est tenu par défaut, faute de tout journal.

## Décisions structurantes méritant un ADR

Sept sujets, chacun posant le statu quo contre une alternative. Aucun ne choisit de technologie. À instruire à partir de `docs/architecture/decisions/ADR-000-template.md`.

| ADR | Sujet | Statu quo | Alternative |
|---|---|---|---|
| A | Où vit l’autorisation ? | RLS seule | Défense en profondeur : contrôle d’identité en tête de chaque action, RLS en filet |
| B | Le bord a-t-il le droit de filtrer les mutations ? | Aucune redirection des mutations, pour éviter le rejeu par 307 | Filtrer par **rejet** (401/403), qui ne rejoue pas |
| C | Comment connaît-on le schéma de production ? | SQL collé à la main, dérive absorbée au runtime | Application ordonnée et vérifiable, afin de **supprimer** les replis. Porte une dépendance : les replis ne peuvent pas partir avant le journal |
| D | Où vivent les binaires ? | Deux magasins : bucket + base64 dans jsonb | Un seul |
| E | Facture émise et bilan finalisé : artefact ou projection ? | Projection re-dérivée à l’impression | Figer le document à la finalisation |
| F | Quel est le contrat de la fonction IA ? | Synchrone, sans authentification, sans quota, sans audit, sans provenance | Séparer orchestration, autorisation, validation et audit |
| G | Forme du multi-locataire | Le locataire est une ligne `auth.users` | Introduire un identifiant d’organisation maintenant plutôt que plus tard — **la décision la plus coûteuse à différer** |

## Diagrammes et références

- À renseigner avec des liens vers des diagrammes maintenus.

## Inconnues assumées

- L’état réel du schéma de production — non déductible du dépôt, non interrogé délibérément.
- Le runtime, la région et le cloisonnement des variables d’environnement chez l’hébergeur.
- **`ANTHROPIC_API_KEY` est-elle définie sur les environnements de prévisualisation ?** Déterminant pour la gravité de MEN-001.
- La confirmation d’e-mail Supabase est-elle activée ? Le `README` suggère de la désactiver par commodité.
- Détail sans impact : `PUBLIC_PATHS` inclut `/auth`, alors qu’aucun `app/auth/` n’existe.
