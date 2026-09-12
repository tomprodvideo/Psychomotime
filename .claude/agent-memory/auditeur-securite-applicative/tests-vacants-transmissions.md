---
name: tests-vacants-transmissions
description: Les tests SQL « sentinelle » de ce dépôt ont des angles morts récurrents — fixtures qui ne ressemblent pas à la production, branches non couvertes, contraintes non protégées
metadata:
  type: project
---

Les tests SQL de ce dépôt ont un mode de défaillance récurrent — l'utilisateur signale que c'est arrivé plusieurs fois : **un test qui a l'air de contrôler une garde ne contrôle que sa propre fixture.**

**Why :** les fixtures `pg_temp.*` construisent les données à la main (elles hachent le jeton elles-mêmes, elles fabriquent un instantané qui n'a pas la forme de ceux que produisent réellement les migrations de reprise). Le chemin d'écriture réel de l'application n'est donc jamais exercé, et la sentinelle observe une forme de donnée qui n'existe pas en production.

**How to apply :** en auditant un lot de tests SQL de ce dépôt, vérifier systématiquement trois choses avant de conclure qu'une garde est testée —
1. la fixture reproduit-elle la forme de donnée réellement produite par le code de production (comparer avec le résultat de `npm run db:cutover`) ;
2. toutes les **branches** de la fonction auditée sont-elles exercées, pas seulement la première ;
3. les contraintes `check` et les politiques RLS sont-elles tuées par une mutation, ou seulement contournées par la fixture.

La méthode de vérification est dans [[methode-mutation-tests-sql]].
