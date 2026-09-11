---
name: feedback-perimetre-strict
description: Les mandats arrivent bornés ("N correctifs précis, rien d'autre") — ne pas élargir, ne pas anticiper, s'arrêter et expliquer si un obstacle force à sortir du périmètre
metadata:
  type: feedback
---

Quand le mandat énumère un nombre précis de correctifs, traiter exactement ceux-là. Ne pas refactorer le code voisin, ne pas anticiper une fonctionnalité future, ne pas toucher la base ni créer de migration, ne pas commiter/pousser/déployer. Si un obstacle oblige à sortir du périmètre : s'arrêter et expliquer, ne pas décider seul d'élargir.

Quand un motif existe déjà dans le dépôt (type de résultat discriminé d'une Server Action, présentation d'un message d'erreur), le mandat demande explicitement de le **reprendre à l'identique** plutôt que d'en inventer un. Chercher le précédent avant d'écrire.

**Why:** l'application est en production avec une utilisatrice réelle et sans test automatisé ; chaque ligne modifiée hors périmètre est un risque non couvert. Le mandat du 2026-09-11 le disait mot pour mot.

**How to apply:** avant d'écrire, lister les fichiers strictement concernés. Les constats hors périmètre (autres bugs repérés en chemin) se rapportent dans le compte rendu comme observations, jamais sous forme de correctif non demandé. Voir [[verification-commandes-psychomotime]].
