---
name: methode-reprise-v1
description: Méthode imposée pour toute reprise de données v1 vers le modèle cible — conserver la table v1 en filet, ne rien deviner, consigner dans la pièce reprise
metadata:
  type: feedback
---

Toute migration de données v1 → cible suit la méthode des migrations `0003`
(patients) et `0011` (factures), que l'utilisateur désigne explicitement comme
les précédents à lire. Quatre règles, toutes démontrées par ces deux fichiers :

1. **La table v1 n'est ni supprimée ni vidée.** Elle est renommée (`_v1`) ou
   laissée en place tant qu'un retour arrière a du sens.
2. **Les identifiants sont conservés à l'identique.** C'est ce qui permet aux
   clés étrangères d'être repointées sans réécrire une seule ligne.
3. **Rien n'est deviné.** Une donnée que la v1 ne porte pas ne s'invente pas :
   un prescripteur en texte libre devient un contact par valeur distincte, sans
   dédoublonnage ; un fondement juridique absent reste absent ; une facture dont
   le compte n'a pas de cabinet reste en v1.
4. **Un trou doit se voir.** Un numéro manquant devient `SANS-NUMERO-…`, un
   doublon est suffixé et signalé dans la note interne, une hypothèse est écrite
   dans l'en-tête de la migration ET dans la pièce reprise (`snapshot.origine`,
   `internal_note`).

S'y ajoutent deux garanties : la reprise est **idempotente** (elle se détecte
elle-même par une marque d'origine et sort), et elle **passe par la même porte
que tout le monde** — une pièce naît brouillon puis s'émet, au lieu d'être
insérée directement dans l'état final.

**Why:** le rejeu complet de la bascule sur base jetable (`npm run db:cutover`,
enchaîné par `npm run verify`) a trouvé avant la production des défauts que la
base de développement ne pouvait pas voir. Cette discipline a une valeur
démontrée dans ce dépôt, pas théorique.

**How to apply:** dès qu'un module bascule de `user_id` vers `practice_id`,
écrire la migration de reprise même si le volume est dérisoire — son rôle n'est
pas de sauver des lignes mais de garder le rejeu de bascule honnête et de
retirer la table du jeu v1. Voir [[moteur-bilans-dernier-module-v1]].
