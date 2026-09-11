---
name: feedback-preuve-execution
description: Ne déclarer vérifié que ce qui a été réellement exécuté, et rapporter la sortie brute des commandes — pas un résumé
metadata:
  type: feedback
---

Rapporter la sortie réelle des commandes de vérification, succès **ou** échec, sans la reformuler en « tout va bien ». « Ne déclare rien vérifié que tu n'aies exécuté » est une consigne explicite de l'utilisateur.

**Why:** l'application tourne en production sur du code comptable ; un « vérifié » non exécuté y est une fausse garantie. Le dépôt a des tests depuis le 2026-09-11 (`npm test`), ce qui étend la preuve disponible au-delà de `npx tsc --noEmit` et `npm run build` — y compris pour le SQL, exécutable en local sur un cluster jetable.

**How to apply:** exécuter avant de rédiger le compte rendu, coller le résultat exact (y compris le code de sortie), et distinguer ce qui est prouvé par exécution de ce qui n'est qu'une lecture de code. Commandes dans [[verification-commandes-psychomotime]].
