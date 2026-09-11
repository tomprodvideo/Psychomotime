# Modèle de menaces

## Actifs principaux

- identité et moyens d’accès ;
- dossiers, notes et documents ;
- relations patient–professionnel–responsable légal ;
- données de facturation ;
- secrets et configurations ;
- journaux et sauvegardes ;
- prompts, sorties et traces d’IA.

## Frontières de confiance

- navigateur et API ;
- services internes ;
- base, stockage et files de travaux ;
- fournisseurs externes ;
- environnements de prévisualisation et production ;
- outils d’administration et de support.

## Scénarios prioritaires

1. Un utilisateur modifie un identifiant et accède au patient d’un autre cabinet.
2. Un rôle administratif accède à une note clinique non nécessaire.
3. Un lien ou fichier partagé reste accessible après révocation.
4. Une donnée clinique apparaît dans un log, une erreur, une URL ou un outil tiers.
5. Une relance asynchrone exécute deux fois une mutation sensible.
6. Une injection de prompt pousse une fonction IA à révéler un autre contexte.
7. Une prévisualisation Vercel utilise par erreur des secrets ou données de production.
8. Un compte compromis exporte massivement des dossiers sans alerte.

## Registre

| ID | Menace | Probabilité | Impact | Contrôles existants | Action | Responsable | Statut |
|---|---|---|---|---|---|---|---|
| MEN-001 | À renseigner | À évaluer | À évaluer | À prouver | À renseigner | À renseigner | ouvert |

