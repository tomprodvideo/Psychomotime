---
name: user-attentes-analyses
description: Comment le propriétaire de Psychomotime commande et attend une analyse de conception (bilans) — brief pré-documenté, lecture du code exigée, tri valeur/effort
metadata:
  type: user
---

Le propriétaire du dépôt (tom.marcon@live.fr) développe Psychomotime **pour une
psychomotricienne libérale** ; il n'est pas lui-même le clinicien. Il commande
des analyses de conception, pas des implémentations, tant qu'il n'a pas tranché.

Sa façon de briefer, observée le 2026-09-12 (analyse « automatiser la création
des bilans ») :

- il **fournit l'état connu** en tête de demande (« pour que tu ne le
  redécouvres pas ») et liste nommément les fichiers qui comptent. Redécouvrir
  ce qu'il a déjà écrit est une perte ;
- il exige « **LIS LE CODE AVANT DE CONCLURE** » et refuse l'intuition générale :
  chaque affirmation doit s'appuyer sur ce que le code rend possible ou
  impossible ;
- il demande de **trancher**, pas de lister des options (« Tranche, avec tes
  raisons ») ;
- il veut un tri **valeur/effort** explicite, séparant ce qui tient en quelques
  heures de ce qui demande une migration ;
- il veut savoir, pour chaque point, **ce qui relève d'une décision de la
  praticienne** et ne peut pas être tranché par la conception.

**How to apply :** rendre un rapport ordonné, chiffré quand c'est possible
(nombre de champs, de clics, de lignes), avec les chemins absolus des fichiers.
Ne pas recopier le code lu ; ne citer que ce qui porte la démonstration. Quand
il écrit « NE MODIFIE AUCUN FICHIER », cela inclut les docs de continuité.

Voir [[moteur-bilans-ilot-v1]] pour l'état du domaine sur lequel portent ces
demandes.
