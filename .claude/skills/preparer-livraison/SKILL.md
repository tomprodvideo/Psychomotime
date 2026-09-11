---
name: preparer-livraison
description: "Prépare une version pour GitHub et Vercel en vérifiant diff, tests, audits, migrations, secrets, documentation, preview et retour arrière."
argument-hint: "[version, branche ou environnement]"
---

# Préparer une livraison

Prépare `$ARGUMENTS` ou la branche actuelle.

## Procédure

1. Demande à `devops-github-vercel` de résoudre branche, remote, cible Vercel, workflows et environnements par des contrôles en lecture seule.
2. Examine le diff complet et l’historique pertinent. Vérifie qu’aucun secret, `.env`, donnée réelle, mémoire locale ou rapport privé ne sera versionné.
3. Exécute le validateur du kit, les tests, l’analyse statique et le build pertinents.
4. Vérifie migrations, compatibilité, sauvegarde et retour arrière.
5. Exécute ou examine les rapports `/audit-securite`, `/audit-metier` et `/audit-ia` si applicable.
6. Demande à `observabilite-incidents` de confirmer signaux et procédures pour les parcours critiques.
7. Demande à `gardien-contexte` de synchroniser état et décisions, puis à `relecteur-final` de rendre un verdict indépendant.
8. Remplis `docs/quality/RELEASE_CHECKLIST.md` pour la version ou produis un rapport équivalent sans écraser un modèle partagé.

## Actions externes

Préparer est autorisé par l’invocation. Commit, push, pull request, fusion ou déploiement ne le sont que si l’utilisateur les demande explicitement. Avant chaque action autorisée, vérifie cible et impact. Pas de push forcé ni de production implicite.

