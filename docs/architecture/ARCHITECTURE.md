# Architecture

## Vue d’ensemble

- Stack : à découvrir dans le dépôt.
- Hébergement : à confirmer.
- Modèle d’organisation : à confirmer.
- Authentification : à découvrir.
- Stockage principal : à découvrir.
- Stockage de documents : à découvrir.
- Services externes : à inventorier.

## Frontières fonctionnelles candidates

- identité et accès ;
- organisations et professionnels ;
- patients et responsables légaux ;
- agenda et séances ;
- dossier clinique et documents ;
- facturation et paiements ;
- communications et intégrations ;
- audit et observabilité ;
- fonctions IA éventuelles.

Cette liste ne décide pas du découpage technique. Documenter le découpage réellement retenu et ses dépendances.

## Invariants attendus

- chaque donnée sensible possède un propriétaire ou périmètre d’organisation explicite ;
- chaque accès serveur vérifie identité, rôle, relation et action ;
- les traitements asynchrones conservent le contexte d’autorisation nécessaire ;
- les actions sensibles sont idempotentes lorsque les répétitions sont possibles ;
- les événements et logs techniques excluent le contenu clinique inutile.

## Diagrammes et références

- À renseigner avec des liens vers des diagrammes maintenus.

