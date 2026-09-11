# Sécurité et données de santé

- Appliquer la minimisation des données et refuser les données réelles dans les environnements, tests et prompts de développement.
- Contrôler l’autorisation côté serveur pour chaque ressource et chaque mutation ; tester les identifiants appartenant à une autre organisation.
- Ne jamais exposer de secret, jeton, donnée clinique ou identifiant direct dans le navigateur, les URL, traces, analytics ou messages d’erreur.
- Chiffrer les communications et utiliser les mécanismes de chiffrement au repos proposés par l’infrastructure retenue ; documenter les limites et la gestion des clés.
- Journaliser les actions de sécurité et les accès sensibles sans copier le contenu clinique dans les logs.
- Définir conservation, archivage, export et suppression avec une traçabilité adaptée et une validation réglementaire.
- Cartographier chaque sous-traitant et chaque transfert de données. Ne conclure à la conformité HDS ou RGPD qu’après validation documentaire et humaine compétente.
- Toute fonction IA doit documenter fournisseur, région, rétention, entraînement éventuel, sous-traitants, données envoyées et mécanisme de suppression.

