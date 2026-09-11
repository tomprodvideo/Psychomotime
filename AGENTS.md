<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Instructions pour les agents de développement

Ce dépôt concerne un SaaS pour psychomotriciens. Lire `CLAUDE.md` et les documents qu’il référence avant toute modification importante.

## Principes communs

- Utiliser uniquement des données synthétiques. Ne jamais copier de donnée réelle de patient dans le dépôt ou un service tiers.
- Respecter l’isolation des cabinets, professionnels, patients et responsables légaux à chaque accès serveur.
- Conserver le professionnel comme décideur de tout contenu clinique.
- Distinguer faits confirmés, hypothèses et questions ouvertes.
- Ne pas affirmer la conformité réglementaire sur la seule base d’une revue de code.
- Faire des changements ciblés, vérifier leur comportement, puis documenter les décisions durables.
- Ne jamais inclure de secret dans Git ou dans les sorties de diagnostic.

## Sources de continuité

- Produit et périmètre : `docs/context/`.
- Pratique et sécurité clinique : `docs/clinical/`.
- Architecture et ADR : `docs/architecture/`.
- Sécurité et flux de données : `docs/security/`.
- Critères de qualité et livraison : `docs/quality/`.

## Compte rendu attendu

À la fin d’une tâche, indiquer le résultat, les fichiers modifiés, les vérifications exécutées, les limites connues et les décisions restant à prendre. Mettre à jour `docs/context/CURRENT_STATE.md` seulement si l’état du produit a réellement changé.

