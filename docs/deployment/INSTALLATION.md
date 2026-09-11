# Installation détaillée

## Prérequis

- Un dépôt local du SaaS.
- Claude Code démarré à la racine du dépôt.
- Une version de Claude Code prenant en charge les agents `.claude/agents/`, les skills `.claude/skills/` et la mémoire d’agent `memory: project`.

Mettre Claude Code à jour et consulter sa documentation si un champ de frontmatter est refusé. Les agents utilisent des alias de modèle `inherit` afin de conserver le modèle choisi pour la session.

## Intégration dans un dépôt neuf

Copier le contenu du kit à la racine du dépôt, fusionner `GITIGNORE.snippet` dans `.gitignore`, puis exécuter :

```bash
bash scripts/validate-agent-kit.sh .
```

Redémarrer la session Claude Code si `.claude/agents/` n’existait pas lors de son lancement. Exécuter ensuite `/initialiser-projet`.

## Intégration dans un dépôt existant

Ne pas remplacer aveuglément :

- `CLAUDE.md` ;
- `AGENTS.md` ;
- `.claude/settings.json` ;
- les agents ou skills de même nom ;
- les modèles de documentation déjà personnalisés ;
- les workflows GitHub.

Utiliser le prompt d’installation de `PROMPTS_CLAUDE.md`. Claude doit comparer et fusionner les règles. En cas de conflit de sécurité, conserver la règle la plus protectrice jusqu’à décision explicite.

## Contrôle dans Claude Code

1. Utiliser `/context` pour vérifier le chargement de `CLAUDE.md`.
2. Utiliser `/agents` pour vérifier les 24 agents.
3. Saisir `/` et vérifier les 8 skills.
4. Tester un agent en lecture seule avec une demande limitée, par exemple une revue du glossaire.
5. Vérifier que `.claude/agent-memory/` est créé après un apprentissage pertinent et qu’il ne contient aucune donnée sensible.

## GitHub

Avant le premier commit :

```bash
git status --short
git diff --check
bash scripts/validate-agent-kit.sh .
```

Examiner tout le diff et le contenu de `.claude/agent-memory/`. Le workflow fourni répète la validation structurelle sur les push et pull requests qui touchent le kit.

## Vercel

Le kit n’exige aucune variable Vercel. Si le dépôt est déjà lié à Vercel, le push d’une branche peut déclencher une preview selon la configuration du projet. Vérifier le build et s’assurer que les fichiers Markdown de configuration ne sont pas exposés par l’application.

Une fonction IA du SaaS demande une architecture runtime distincte. Ne copier ni les mémoires Claude Code ni les prompts de développement dans une base de production.

