# Mémoire — auditeur-securite-applicative

## Vérifications reproductibles

- [Méthode : mutation des tests SQL](methode-mutation-tests-sql.md) — copier la base par template, retirer une garde, rejouer toute la suite.

## Angles morts connus du dépôt

- [Tests vacants sur les transmissions](tests-vacants-transmissions.md) — les fixtures SQL testent leur propre mise en scène, pas le chemin d'écriture réel.
