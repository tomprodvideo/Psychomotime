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

## Atelier local : publier les échanges visibles

Un tableau de bord local observe l’activité des agents (`STUDIO AGENTS/atelier-agents-local`, hors dépôt). Des hooks locaux lui transmettent les états et les appels d’outils. Ils ne lisent aucun transcript.

**Quand publier un résumé.** Lorsqu’un travail est confié à un autre rôle, lorsqu’un résultat important revient, lorsqu’un défaut doit être corrigé, ou lorsqu’une décision est attendue. **Pas à chaque appel d’outil** : ceux-ci sont déjà observés par les hooks. Distinguer constat, proposition et vérification.

**Comment publier.** Exécuter le script `scripts/message.mjs` de l’atelier avec Node, en fournissant un objet JSON sur stdin. Le hook place le chemin exact du script et l’identifiant de session dans le contexte de `UserPromptSubmit` et `SubagentStart` — utiliser cet identifiant tel quel. En shell POSIX, passer le JSON par un **heredoc à délimiteur cité**, afin qu’aucune variable, substitution ni backtick ne soit interprété :

```sh
node '/chemin/absolu/atelier-agents-local/scripts/message.mjs' <<'ATELIER_JSON'
{"session":"SESSION_FOURNIE_PAR_LE_HOOK","from":"ingenieur-backend","to":"auditeur-securite-applicative","text":"Le contrôle de l’export est prêt pour contre-vérification."}
ATELIER_JSON
```

**Règles de contenu — elles priment sur l’envie de documenter.**

- `from` et `to` doivent être des identifiants exacts du catalogue des 24 agents. Un rôle inconnu est refusé.
- Texte limité à 400 caractères, et **potentiellement sensible malgré cette limite** : l’auteur reste responsable de son contenu.
- Ne jamais publier : donnée de patient ou de responsable légal, donnée personnelle, transcript, raisonnement interne, contenu d’un dossier, valeur de secret, URL signée, chemin sensible, commande complète.
- Un résumé est une **déclaration**, pas une preuve. Les statuts et les appels d’outils viennent des hooks ; les messages viennent de l’auteur. L’atelier n’atteste pas cryptographiquement l’identité de l’auteur d’un résumé.

**Ce que cette publication n’est pas.** Elle ne délègue rien et ne remplace jamais la délégation effective de la tâche. Un message affiché n’envoie aucune instruction à l’agent destinataire. Publier un résumé ne dispense pas de confier réellement le travail à l’agent concerné.

**Agents sans Bash.** Si un agent n’a pas `Bash` parmi ses outils — c’est le cas des agents de revue en lecture seule — **conserver cette restriction**. Ne pas élargir ses permissions pour l’atelier : il retourne son résumé au coordinateur, qui le publie en l’attribuant à ce rôle.

**Si l’atelier n’est pas lancé**, le hook échoue silencieusement en moins de deux secondes et ne bloque ni n’autorise aucun travail. L’absence de message signifie « aucun résumé publié », pas « aucun échange ».

## Instructions de synthèse et de continuité

Lors d’une compaction ou d’un passage de relais, préserver :

- l’objectif courant et les critères d’acceptation ;
- les fichiers lus ou modifiés ;
- les décisions prises avec leur justification ;
- les commandes de vérification et leurs résultats ;
- les risques, inconnues, blocages et prochaine action exacte.
