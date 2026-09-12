---
name: methode-mutation-tests-sql
description: Comment vérifier par mutation que les tests SQL et unitaires de ce dépôt discriminent vraiment, et ce que le harnais local ne peut pas voir
metadata:
  type: reference
---

Les tests de ce dépôt se vérifient **par mutation**, jamais en les lisant : on retire une garde, on rejoue la suite, et un test qui passe encore ne protège rien.

**Recette SQL (locale, non destructive pour `psychomotime_dev`) :**

1. `npm run db:test` pour une ligne de base verte (la commande reconstruit la base elle-même).
2. Pour chaque mutation : `createdb -T psychomotime_dev <copie>`, appliquer la mutation sur la copie, rejouer **tous** les `supabase/tests/*.sql`, puis `dropdb`.
3. Une mutation qui survit à **toute** la suite (pas seulement au fichier de son lot) est une garde non testée.

**Pourquoi la copie par template :** les fichiers de test ouvrent et annulent leurs propres transactions, on ne peut donc pas envelopper la mutation dans un `begin/rollback`. Le `createdb -T` est instantané en local.

**Étendre la mutation hors du lot audité.** Une nouvelle surface publique promeut des colonnes jusque-là internes au rang de contrôle de sécurité. Muter seulement la migration du lot laisse ce déplacement invisible : il faut aussi muter les gardes d'immuabilité des tables que la nouvelle surface *lit*, dans les migrations précédentes.

**Côté TypeScript, la mutation utile est différente :** rejouer les *assertions du test lui-même* avec une entrée réaliste que sa fixture évite. Le harnais est `node --import ./scripts/test-hooks.mjs --test <fichier.mts>` ; il résout l'alias `@/`, donc un fichier de contrôle posé hors du dépôt s'exécute tel quel sans rien modifier.

**Ce que le harnais local ne peut pas voir.** Les fonctions `security definer` y appartiennent à l'utilisateur POSIX courant, qui est `superuser` et `bypassrls`. Toute régression de privilège du rôle propriétaire côté hébergeur est donc indétectable par `npm run db:test`. Corollaire vérifié : un `insert` refusé par la RLS lève `42501`, il ne rend jamais `row_count = 0` — une garde écrite sur `row_count = 0` après un `insert` ne peut pas se déclencher pour la raison qu'elle invoque.

**Mutations qui paient :** retirer une clause `where` d'une garde, remplacer un seuil par `false`, ajouter une clé fuyante à une projection publique, supprimer une contrainte `check`, accorder un privilège d'écriture sur un journal, rendre à nouveau modifiable une colonne déclarée immuable.

Voir [[tests-vacants-transmissions]] pour les angles morts récurrents que cette méthode révèle.
