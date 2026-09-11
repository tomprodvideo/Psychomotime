@AGENTS.md

# Mission du dépôt

Construire et maintenir un SaaS fiable destiné à la pratique libérale de la psychomotricité. Le logiciel peut assister l’organisation, la documentation et la coordination du professionnel. Il ne pose pas de diagnostic, ne remplace pas le jugement clinique et ne transforme jamais une suggestion générée en décision clinique sans validation humaine explicite.

## Dépôt tel qu’observé

Faits constatés dans le dépôt le 2026-09-11. Toute évolution de cette section doit rester démontrable par le code.

- Next.js `16.2.9` avec App Router, React `19.2.4`, TypeScript `5`, Tailwind CSS `4` via `@tailwindcss/postcss`.
- Application sous `app/`, groupe de routes authentifié `app/(app)/`, page de connexion `app/login/`.
- Domaines présents : `patients`, `bilans`, `comptabilite`, `documents`, `parametres`, `admin`.
- Mutations écrites en Server Actions dans les fichiers `actions.ts` de chaque domaine. `next.config.ts` porte `serverActions.bodySizeLimit` à `6mb` pour les images encodées en base64.
- Supabase via `@supabase/supabase-js` et `@supabase/ssr`. Clients dans `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`. Rafraîchissement de session dans `proxy.ts`.
- Schéma et migrations SQL versionnés dans `supabase/` : `schema.sql`, `migration_002.sql` à `migration_009.sql`, `migrations_en_attente.sql`.
- Fonction IA présente : `@anthropic-ai/sdk` en dépendance et `app/(app)/bilans/ai-actions.ts`. Le périmètre, les garde-fous et la validation humaine de cette fonction sont à documenter avec `responsable-ia-clinique` et `auditeur-ia-confidentialite`.
- Logique partagée dans `lib/` (`calc.ts`, `data.ts`, `format.ts`, `period.ts`, `invoiceNumber.ts`, `constants.ts`, `types.ts`), composants partagés dans `components/`.
- Secrets locaux dans `.env.local`, non versionné. Ne jamais lire, recopier ni afficher son contenu.

## Commandes

- `npm run dev` : serveur de développement.
- `npm run build` : build de production.
- `npm run start` : serveur de production.
- `npm run lint` : ESLint (`eslint-config-next`).
- `npx tsc --noEmit` : vérification des types.
- `bash scripts/validate-agent-kit.sh .` : intégrité du kit d’agents.

Aucun script de test automatisé n’existe à ce jour. Tant que c’est le cas, une vérification proportionnée au risque doit être décrite explicitement dans le compte rendu, et l’ajout d’un harnais de test reste une décision ouverte pour `ingenieur-tests-qualite`.

## Contexte à charger

Lire avant tout travail pertinent :

- @docs/context/PRODUCT.md
- @docs/context/USERS.md
- @docs/context/GLOSSARY.md
- @docs/context/SCOPE.md
- @docs/context/CURRENT_STATE.md
- @docs/context/DECISIONS.md
- @docs/clinical/CLINICAL_SAFETY.md
- @docs/clinical/WORKFLOWS.md
- @docs/security/DATA_CLASSIFICATION.md
- @docs/security/SECURITY_BASELINE.md

Une rubrique marquée `À renseigner` est une inconnue. Ne pas la convertir en fait. Rechercher une preuve dans le dépôt ou demander une décision si elle change matériellement le résultat.

## Règles absolues

1. Ne jamais introduire de données réelles de patient, de responsable légal ou de professionnel dans le code, les tests, les prompts, les captures, les logs ou les exemples. Utiliser uniquement des données synthétiques clairement fictives.
2. Traiter les données cliniques, administratives et d’identité comme sensibles conformément à `docs/security/DATA_CLASSIFICATION.md`.
3. Vérifier toute lecture ou mutation de ressource côté serveur. L’isolation entre cabinets, professionnels et patients ne doit jamais dépendre uniquement de l’interface. Dans ce dépôt, cela concerne les Server Actions, les lectures Supabase et les politiques SQL de `supabase/`.
4. Ne jamais présenter un résultat généré comme un diagnostic, une prescription, un score validé ou une décision du psychomotricien.
5. Toute synthèse clinique générée doit indiquer sa provenance, rester modifiable et exiger une validation humaine avant partage ou inscription définitive au dossier.
6. Ne pas inventer une obligation RGPD, HDS, CNIL, fiscale, conventionnelle ou professionnelle. Identifier le point, la source à vérifier et le responsable de validation.
7. Ne jamais stocker de secret dans Git, le code client, un fichier Markdown, un exemple de log ou une variable préfixée comme publique. Une variable `NEXT_PUBLIC_*` est exposée au navigateur.
8. Ne pas pousser, fusionner, publier ou déployer sans demande explicite de l’utilisateur. Avant une opération autorisée, montrer les contrôles réalisés et la cible exacte.

## Méthode de travail

1. Lire l’état courant, le périmètre et les décisions.
2. Identifier les acteurs, données, règles métier, risques et critères d’acceptation concernés.
3. Utiliser l’agent spécialisé adapté. L’orchestrateur conserve la responsabilité de la synthèse.
4. Pour une modification, inspecter l’existant, proposer le plus petit changement cohérent, puis l’implémenter.
5. Tester les règles métier et les autorisations importantes avec des données synthétiques.
6. Faire relire les changements sensibles par les agents sécurité, métier ou IA concernés.
7. Mettre à jour `CURRENT_STATE.md` et les décisions uniquement avec des faits confirmés.

## Routage vers les agents

- Vision, priorisation et critères : `product-manager-psychomotricite`.
- Modèle métier et droits : `architecte-fonctionnel-metier`.
- Réalité de la pratique : `expert-metier-psychomotricien`.
- Dossier, bilan ou parcours cabinet : agent métier spécialisé correspondant.
- Architecture, base, backend, frontend ou intégrations : agent de construction correspondant.
- Sécurité, données, IA ou fonctionnement : agent d’audit correspondant.
- Livraison et exploitation : `devops-github-vercel` puis `relecteur-final`.

## Définition de terminé

Une tâche n’est terminée que lorsque :

- le comportement demandé existe et ses limites sont explicites ;
- les scénarios normaux, erreurs et autorisations ont été vérifiés proportionnellement au risque ;
- aucune donnée réelle ni secret n’a été ajouté ;
- les documents de continuité concernés sont à jour ;
- les risques non résolus et validations humaines nécessaires sont visibles.

## Instructions de synthèse et de continuité

Lors d’une compaction ou d’un passage de relais, préserver :

- l’objectif courant et les critères d’acceptation ;
- les fichiers lus ou modifiés ;
- les décisions prises avec leur justification ;
- les commandes de vérification et leurs résultats ;
- les risques, inconnues, blocages et prochaine action exacte.
