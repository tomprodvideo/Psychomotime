# GitHub, Vercel et mémoire des agents

## GitHub

Versionner :

- `.claude/agents/`, `.claude/skills/` et `.claude/rules/` ;
- `CLAUDE.md`, `AGENTS.md` et les documents `docs/` ;
- `.claude/agent-memory/<agent>/` lorsque les apprentissages sont utiles à l’équipe et ne contiennent aucune donnée sensible ;
- le validateur et son workflow GitHub.

Ne jamais versionner les mémoires locales, secrets, données réelles, exports, captures ou rapports privés.

## Vercel

Vercel peut construire une preview après un push GitHub si le projet est déjà relié. Les fichiers Claude peuvent rester dans le dépôt sans être utilisés au runtime. Vérifier qu’ils ne sont pas servis publiquement par une règle de routage ou inclus dans un bundle client.

Les variables doivent être séparées par environnement. Une preview ne doit pas utiliser de base ou de secret de production sans décision explicite et contrôle approprié.

## Mémoire d’une IA intégrée au SaaS

La mémoire des agents de développement ne devient pas automatiquement une mémoire produit. Une fonction IA intégrée au SaaS nécessite une conception distincte :

- finalité et données autorisées ;
- isolation par organisation et patient ;
- fenêtre de contexte et sources ;
- consentement ou information applicable ;
- rétention, suppression et export ;
- fournisseur, région, contrat et sous-traitants ;
- validation humaine et journal d’audit ;
- tests de fuite, injection et attribution erronée.

Ne pas créer cette mémoire dans Vercel sans architecture, stockage persistant et analyse de sécurité documentés.

