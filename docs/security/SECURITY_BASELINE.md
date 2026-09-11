# Socle de sécurité

## Identité et accès

- Authentification robuste et récupération de compte contrôlée.
- Sessions révocables, expiration appropriée et protection contre le vol de session.
- Autorisation côté serveur sur chaque opération sensible.
- Principe du moindre privilège pour utilisateurs, services et intégrations.

## Données

- Chiffrement en transit et au repos selon l’infrastructure retenue.
- Secrets dans un gestionnaire adapté, jamais dans Git ou le client.
- Sauvegardes testées et restauration documentée.
- Rétention, export, archivage et suppression définis par type de donnée.

## Application

- Validation des entrées, sorties contextualisées et protections contre les injections.
- Téléversements limités par type, taille, contenu et autorisation.
- Dépendances suivies et vulnérabilités triées.
- Protection contre abus, automatisation et élévation de privilèges.

## Journalisation

- Événements d’authentification, d’autorisation et d’administration traçables.
- Aucun contenu clinique ou secret dans les logs.
- Accès aux journaux limité et conservation documentée.

## Livraison

- Séparation développement, prévisualisation et production.
- Variables Vercel classées par environnement et revues.
- Migrations réversibles ou accompagnées d’un plan de restauration.
- Procédure d’incident, rotation de secrets et communication définies.

