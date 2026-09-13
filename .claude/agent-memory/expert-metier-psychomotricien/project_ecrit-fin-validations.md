---
name: ecrit-fin-prise-en-soin-validations
description: Points d'arbitrage (F-01 à F-09) et deux défauts de modèle relevés lors de la revue métier du rang 4 — l'écrit de fin de prise en soin — le 2026-09-13
metadata:
  type: project
---

Revue métier du **rang 4 des écrits manquants** (écrit de fin de prise en soin) faite le
2026-09-13, avant écriture de la migration. Aucun de ces points n'est tranché.

**Position retenue par la revue, à faire confirmer :** UN seul objet pour les trois fins
(`termine`, `interrompu`, `reoriente`), discriminé par un `closure_kind` propre au document
et NON recopié du statut de parcours. Le parcours se clôt d'abord ; l'écrit en découle et ne
change jamais le statut.

## Points à soumettre à une psychomotricienne en exercice

- `F-01` Un écrit de fin est-il produit pour les trois fins, ou seulement quand quelqu'un
  l'attend (prescripteur, relais, financeur) ?
- `F-02` Manque-t-il une cinquième nature : fin à l'initiative de la praticienne (cessation
  d'activité, cadre intenable) ?
- `F-03` Formulations imprimées proposées pour chaque nature de fin — surtout « sans nouvelle ».
- `F-04` Un écrit « versé au dossier », sans destinataire, est-il légitime, ou est-ce une note ?
- `F-05` Faut-il imprimer le nombre de rendez-vous non honorés dans un écrit de fin, et à qui ?
- `F-06` Objectifs restés `en_cours` sur un parcours clos : que doit lire la famille ?
  (Prolonge `D-j` — vocabulaire imprimé des statuts d'objectif.)
- `F-07` Plusieurs écrits de fin pour un même parcours (un au médecin, un à la famille) :
  usage réel ? Décide s'il faut une unicité en base ou un simple avertissement d'écran.
- `F-08` Une reprise après un écrit de fin remis : nouveau parcours, ou réouverture ?
- `F-09` Délai réel entre la dernière séance et l'écrit ; existe-t-il un moment où l'on
  renonce à écrire ?

## Deux défauts de modèle relevés, indépendants du rang 4

1. **`care_pathways.status = 'interrompu'` est commenté « arrêt à l'initiative de la famille
   ou du patient »** (`0002_dossier_patient.sql`). Un arrêt sans nouvelle y est rangé faute
   d'autre valeur — ce qui **prête une intention** à la famille, exactement ce que le tableau
   de vocabulaire §8.3 de `docs/refonte/recherche/01-clinique-domaines.md` proscrit.
2. **`archive_patient()` écrit `end_reason = 'Dossier archivé'`** et force `status = 'termine'`.
   Un parcours « terminé » peut donc être un artefact d'archivage, pas une fin clinique.
   Conséquence : ne jamais pré-remplir ni imprimer `end_reason` en lecture directe.

**Why :** ces points décident de ce qu'une famille et un financeur liront sur le document qui
clôt un accompagnement ; `CLINICAL_SAFETY.md` exige une relecture par une praticienne
représentative avant diffusion, et aucun texte ne fixe le contenu de cet écrit
(🔵 usage — cf. [[referentiel-clinique]], § 2 « Natures de documents », ligne D-4).

**How to apply :** joindre `F-01`–`F-09` au même envoi que `T-01`–`T-08`
([[transmissions-validations]]), `V-01`–`V-39` et `Q-201`–`Q-208`. Ne convertir aucun de ces
points en règle produit sans retour écrit.
