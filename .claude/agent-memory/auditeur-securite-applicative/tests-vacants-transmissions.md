---
name: tests-vacants-transmissions
description: Trois modes de défaillance récurrents des tests de ce dépôt — fixtures qui esquivent, gardes contrôlées d'un seul côté, correctifs appliqués à une seule branche
metadata:
  type: project
---

Les tests de ce dépôt ont des modes de défaillance récurrents — constatés plusieurs fois, y compris sur des lots déjà relus et corrigés : **un test qui a l'air de contrôler une garde ne contrôle souvent que sa propre mise en scène.**

**Why :** les fixtures (`pg_temp.*` en SQL, constantes en tête de fichier `.test.mts`) sont écrites en même temps que le contrôle, par la même personne, avec des valeurs choisies pour que le contrôle passe. Elles finissent par décrire une forme de donnée ou un cas d'usage qui n'existe pas en production.

**Les trois formes à chercher systématiquement :**

1. **La fixture esquive.** Une sentinelle interdit une liste de mots dans une sortie, mais le seul fragment variable de cette sortie vient d'une valeur que la fixture a choisie neutre. Rejouer l'assertion avec une valeur réaliste du métier la fait tomber.
2. **Une seule branche est épinglée.** Quand un correctif ajoute un contrôle « jeu de clés exact » sur une branche d'une fonction, vérifier que l'autre branche l'a reçu aussi. Sinon l'en-tête de la migration affirme une garantie qui ne vaut que d'un côté.
3. **La colonne déclarée mais jamais écrite.** Une table porte des colonnes d'imputabilité (`created_by`, `revoked_by`…) que ni défaut, ni trigger, ni code applicatif ne renseigne. `grep` sur le nom de colonne dans le code d'écriture le montre en une commande.

**How to apply :** avant de conclure qu'une garde est testée, exiger (a) que la fixture reproduise la forme réellement produite par le code de production, (b) que toutes les branches soient exercées, (c) que la garde meure sous mutation. La méthode est dans [[methode-mutation-tests-sql]].
