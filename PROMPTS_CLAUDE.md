# Prompts prêts à donner à Claude Code

Remplacer les chemins entre chevrons avant utilisation.

## 1. Installer le kit dans un dépôt existant

```text
Tu travailles à la racine de mon dépôt SaaS destiné aux psychomotriciens. Le kit d’agents se trouve dans <CHEMIN_ABSOLU_DU_KIT_DECOMPRESSE>.

Installe ce kit dans le dépôt de façon prudente et complète. Commence par lire le README et le MANIFEST du kit, puis inspecte les éventuels fichiers CLAUDE.md, AGENTS.md, .claude/, docs/, scripts/ et workflows GitHub déjà présents dans le dépôt. Fusionne les contenus compatibles au lieu d’écraser les personnalisations existantes. Si une règle est contradictoire ou si un remplacement ferait perdre une information, conserve l’existant, signale le conflit et propose une résolution précise.

Copie les 24 agents, les 8 skills, les règles transversales, les modèles de documentation, le validateur et le workflow d’intégrité. Fusionne GITIGNORE.snippet dans le .gitignore existant sans doublons. N’ajoute aucun secret et n’utilise aucune donnée réelle.

Adapte CLAUDE.md à la structure et aux commandes réellement découvertes dans le dépôt, sans inventer la stack ni le périmètre produit. Exécute ensuite `bash scripts/validate-agent-kit.sh .` et les contrôles déjà prévus par le projet qui sont pertinents. Présente-moi le diff, les éventuels conflits, le résultat des vérifications et les champs de contexte restant à renseigner. Ne committe, ne pousse et ne déploie rien à cette étape.
```

## 2. Initialiser le contexte métier et technique

```text
Exécute le workflow /initialiser-projet sur ce dépôt. Inspecte le code, la configuration, les migrations, les tests et la documentation. Renseigne les fichiers docs/context, docs/clinical, docs/architecture et docs/security uniquement avec des faits démontrés par le dépôt ou explicitement confirmés par moi.

Fais intervenir l’architecte fonctionnel métier, l’expert métier psychomotricien, l’architecte logiciel et le responsable protection des données pour produire une première cartographie cohérente. Laisse clairement marquées les informations inconnues et regroupe à la fin uniquement les décisions utilisateur qui changeraient matériellement le produit. Utilise exclusivement des exemples synthétiques. Termine par une synthèse de l’état courant et exécute le validateur du kit.
```

## 3. Construire une fonctionnalité

```text
Je souhaite construire la fonctionnalité suivante : <DECRIRE_LA_FONCTIONNALITE>.

Commence par /cadrer-fonctionnalite, avec le product manager psychomotricité, l’architecte fonctionnel métier et les experts métier concernés. Présente les acteurs, règles, cas limites, données manipulées, risques cliniques, critères d’acceptation et questions réellement bloquantes.

Après résolution des choix nécessaires, exécute /implementer-fonctionnalite. Utilise les agents de construction adaptés, ajoute les vérifications proportionnées au risque et fais relire le résultat par l’auditeur fonctionnel métier, l’auditeur sécurité applicative et, si de l’IA intervient, l’auditeur IA et confidentialité. Mets à jour l’état courant et les décisions confirmées. Ne pousse ni ne déploie sans ma demande explicite.
```

## 4. Auditer avant livraison

```text
Prépare un audit de la version actuelle avant livraison. Exécute /audit-securite, /audit-metier et /audit-ia si le produit comporte une fonction IA. Analyse les autorisations, l’isolation entre cabinets et patients, les flux de données, les journaux, les secrets, les dépendances, les parcours métier, la sécurité clinique et les mécanismes de validation humaine.

Classe chaque constat par sévérité et confiance, donne une preuve reproductible, l’impact, la correction proposée et la vérification attendue. Ne modifie pas le code pendant les audits. Ensuite, demande aux agents de construction concernés de corriger uniquement les constats validés, puis fais effectuer une contre-vérification par les auditeurs. Termine par /preparer-livraison et indique clairement si la version est prête, prête avec réserves ou bloquée.
```

## 5. Versionner sur GitHub et vérifier Vercel

```text
L’installation et les audits sont validés. Prépare maintenant le versionnement du kit et des changements associés.

Vérifie l’état Git, la branche, le remote GitHub et le diff exact. Exécute le validateur du kit ainsi que les contrôles du projet pertinents. Vérifie qu’aucun secret, fichier d’environnement, donnée réelle, rapport privé ou artefact sensible ne sera committé. Mets à jour docs/context/CURRENT_STATE.md et les décisions confirmées.

Crée un commit ciblé avec un message explicite, puis pousse la branche actuelle vers le remote GitHub configuré. N’utilise pas de push forcé et ne pousse pas directement sur une branche protégée si le workflow du dépôt impose une pull request. Si une pull request est requise, prépare-la avec le résumé, les tests et les risques.

Ensuite, inspecte la configuration Vercel existante et l’état du déploiement lié à cette branche. Ne crée pas une nouvelle configuration Vercel et ne modifie pas de variable ou de domaine sans nécessité démontrée. Si le push déclenche déjà une preview, vérifie son résultat. Pour un déploiement de production, présente d’abord la cible, les contrôles et l’impact si je ne l’ai pas déjà explicitement demandé. Rappelle dans le compte rendu que GitHub versionne les agents et leur mémoire projet, tandis que Vercel ne sert que le produit déployé.
```

## 6. Reprendre le travail lors d’une nouvelle session

```text
Reprends ce projet en commençant par lire CLAUDE.md, docs/context/CURRENT_STATE.md, docs/context/DECISIONS.md, docs/context/OPEN_QUESTIONS.md et les ADR pertinents. Consulte ensuite la mémoire projet des agents concernés.

Vérifie l’état Git et compare les documents de continuité au code avant de les considérer comme exacts. Résume l’objectif courant, ce qui est réellement terminé, les vérifications connues, les risques ouverts et la prochaine action. Ne réintroduis pas une approche rejetée dans les décisions. Si le contexte est obsolète, exécute /mettre-a-jour-contexte avant de poursuivre.
```

