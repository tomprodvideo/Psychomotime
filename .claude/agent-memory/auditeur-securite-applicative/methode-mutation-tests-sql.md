---
name: methode-mutation-tests-sql
description: Comment vérifier par mutation que les tests SQL de supabase/tests/ discriminent vraiment, sur la base locale jetable
metadata:
  type: reference
---

Les tests SQL de ce dépôt se vérifient **par mutation**, jamais en les lisant : on retire une garde, on rejoue la suite, et un test qui passe encore ne protège rien.

**Recette (locale, non destructive pour `psychomotime_dev`) :**

1. `npm run db:reset` puis `npm run db:test` pour une ligne de base verte.
2. Pour chaque mutation : `createdb -T psychomotime_dev psychomotime_mutation`, appliquer la mutation sur la copie, rejouer `supabase/tests/*.sql`, puis `dropdb`.
3. Une mutation qui survit à **toute** la suite (pas seulement au fichier de son lot) est une garde non testée.

**Pourquoi la copie par template :** les fichiers de test ouvrent et annulent leurs propres transactions, on ne peut donc pas envelopper la mutation dans un `begin/rollback`. Le `createdb -T` est instantané en local et laisse la base de développement intacte.

**Mutations qui paient :** retirer une clause `where` d'une garde, remplacer une condition de seuil par `false`, ajouter une colonne fuyante à une projection publique, supprimer une contrainte `check`, élargir une politique RLS à `using (true)`.

Voir [[tests-vacants-transmissions]] pour le résultat de cette méthode sur le lot 0017.
