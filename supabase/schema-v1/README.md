# Schéma v1 — celui qui tourne aujourd'hui en production

Ces fichiers **ne sont pas obsolètes** : ils décrivent le schéma actuellement
déployé sur le projet Supabase `Psychomotime`. Ils sont conservés ici pour trois
raisons :

1. l'application en service s'exécute encore dessus ;
2. la reprise des données de démonstration en dépend ;
3. un audit doit pouvoir relire ce qui existait avant la refonte.

## Ce qu'ils valent, et ce qu'ils ne valent pas

- `schema.sql` **ne décrit que 5 tables sur 9**. `subscriptions`, `doc_folders`,
  `documents` et `invoice_counters` n'existent que dans les migrations.
  Ce n'est donc pas le schéma courant.
- `migrations_en_attente.sql` annonce « 004 à 007 » alors que 013 existe :
  qui suit ce chemin obtient une base amputée de six migrations.
- Aucun mécanisme ne dit ce qui est **réellement appliqué** en production.

Ces trois défauts sont exactement ce que `supabase/migrations/` corrige.

## Le nouveau chemin

`supabase/migrations/` contient le schéma cible, numéroté, ordonné et
reconstructible depuis zéro :

```bash
npm run db:reset   # reconstruit la base locale, applique les seeds
npm run db:test    # exécute les tests SQL, dont les tests négatifs d'isolation
```

Rien de ce dossier-ci n'est appliqué par `db:reset`.

## Bascule

La migration des données v1 → v2 fera l'objet d'un lot dédié, avec un plan de
retour arrière. Aucune suppression de table de production ne sera exécutée sans
identification formelle de l'environnement et autorisation explicite au moment
de l'action.
