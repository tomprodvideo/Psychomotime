---
name: fiche-dossier-organisation
description: Points d'arbitrage O-01..O-12 sur l'ordre et le repli des blocs de la fiche dossier, plus les trois défauts démontrés (dialogues anonymes, titre d'onglet indistinct, avertissement non imprimé) — revue du 2026-09-13
metadata:
  type: project
---

Revue d'organisation de `app/(app)/patients/[id]/page.tsx` et de sa fiche imprimable,
faite le 2026-09-13 à la demande du coordinateur. Aucun point n'est tranché.

## Position retenue par la revue, à faire confirmer

**La friction est réelle, mais le diagnostic « l'ordre est mauvais » l'est moins que
« deux blocs qui se lisent ensemble sont séparés par quatre blocs le plus souvent
vides ».** Objectifs (dans `ParcoursSection`) et dernière note (`NotesSection`) sont
aux rangs 4 et 9, séparés par Courriers, Synthèses, Écrits tiers et Fins — dont les
états vides font chacun deux à trois lignes de pédagogie.

**Why:** l'ordre actuel des quatre écrits ENTRE EUX est justifié par des commentaires
de code cohérents (la synthèse se rédige en relisant les notes, l'écrit de fin reprend
la forme de la synthèse). Ce qui n'est justifié nulle part, c'est que le GROUPE des
écrits s'intercale entre le parcours et les notes. Les écrits sont des surfaces
d'ÉCRITURE, atteintes avec intention et du temps devant soi ; les objectifs et la
dernière note sont la seule surface de LECTURE avant une séance.

**How to apply:** proposer d'abord le plus petit changement cohérent — remonter
`NotesSection` juste après `ParcoursSection`, et raccourcir les états vides des quatre
écrits à une ligne. Ne proposer le repli qu'ensuite, et jamais sans la règle du titre
porteur ci-dessous. Ne pas réordonner les douze blocs d'un coup : la mémoire de
défilement d'une utilisatrice quotidienne a une valeur que l'analyse ne voit pas.

## Deux règles de repli, à poser avant d'ajouter le moindre repli

1. **Un bloc replié doit annoncer dans son titre ce qu'il contient et ce qui y appelle
   une action** (« Séances — 24 réalisées, 2 à renseigner », « Autorisations — 2 en
   cours, 1 retirée le 3 mars »). Si le titre ne peut pas s'écrire ainsi, le bloc ne
   doit pas être repliable. C'est ce qui répond à « un bloc replié est un bloc qu'on
   peut oublier ».
2. **`<details>`/`<summary>` natif, jamais un rendu conditionnel.** Un contenu absent
   du DOM échappe à `Ctrl+F`, au mode navigation d'un lecteur d'écran, et à
   l'impression. La convention existe déjà dans `EntourageSection` et
   `ConsentementsSection`.

Jamais repliables, quoi qu'il arrive : le bandeau doublon et le bandeau « dossier
archivé ». Ce sont les deux seuls éléments qui répondent à « suis-je dans le bon
dossier, et ai-je le droit d'écrire dedans ».

## Trois défauts démontrés, indépendants de toute décision d'ordre

- **Quatre dialogues d'écriture du dossier ne disent pas dans quel dossier ils
  écrivent.** `Dialogue` accepte `description` ; les quatre écrits du lot 4 la
  passent (`patientNom · né(e) le …`), les quatre blocs du lot 1 ne la passent pas —
  dont `NotesSection`, celui qui écrit du contenu clinique. Le `<dialog>` modal
  assombrit la page : au moment de la frappe, l'écran ne dit plus de qui il s'agit.
- **Le titre d'onglet est `Dossier · Psychomotime` pour tous les dossiers.** Le choix
  d'un titre non identifiant est délibéré et son raisonnement est bon (historique de
  navigateur parfois synchronisé). Sa conséquence ne l'est pas : plusieurs onglets
  ouverts deviennent indistinguables, et `CLINICAL_SAFETY.md` liste l'attribution au
  mauvais patient comme risque à contrôler. Arbitrage confidentialité / sécurité
  clinique — à instruire avec l'agent sécurité, pas seul.
- **L'avertissement « N notes retenues » de la fiche imprimable ne s'imprime pas** :
  il vit dans la barre `no-print`. Le papier ne dit jamais qu'il est incomplet.

## Questions à soumettre à une praticienne

- `O-01` Que regarde-t-elle vraiment entre deux patients, dans quel ordre, et combien
  de fois par jour ouvre-t-elle réellement un dossier pour un suivi installé ?
- `O-02` L'entrée se fait-elle par l'agenda ou par la liste des dossiers ? (décide si
  la correction est sur la fiche ou sur la ligne d'agenda)
- `O-03` Objectifs et dernière note se lisent-ils ensemble, ou séparément ?
- `O-04` Combien de notes veut-elle voir sans déplier : la dernière, trois, toutes ?
- `O-05` Manque-t-il un « point de vigilance » (accueil, sécurité, PAI) ? Si oui, que
  doit-il contenir, et doit-il s'imprimer ? **Risque de dérive vers une liste de
  diagnostics ou un raccourci stigmatisant : le contenu se définit avec elle, pas ici.**
- `O-06` « À reprendre la prochaine fois » : y pense-t-elle comme à une donnée
  distincte, ou est-ce déjà dans la prose de la note ?
- `O-07` La borne du financement (nombre de séances couvertes, date de fin) est-elle
  une information de décision ? Le modèle porte `funding_scheme` mais aucune borne.
  **Ne rien coder en dur pour la PCO** — cf. [[referentiel-clinique-sourcé]], cadre
  refondu en 2025, seul le contrat signé fait foi.
- `O-08` Le solde impayé doit-il rester atteignable depuis la fiche, ou seulement
  depuis la comptabilité ?
- `O-09` L'état de repli doit-il être mémorisé ? Position de la revue : non par
  dossier — un bloc replié un soir de fatigue ne se rouvrirait jamais sur ce dossier.
- `O-10` À qui la fiche imprimable est-elle remise, et pour quoi ? Trois usages
  incompatibles partagent un document : droit d'accès, transmission à un confrère,
  usage interne. Seul le premier justifie le filtre L1111-7 appliqué aujourd'hui aux
  trois.
- `O-11` Une fiche remise à une famille doit-elle porter jusqu'à cinquante notes
  cliniques in extenso ?
- `O-12` Le compte de séances doit-il figurer sur la fiche imprimable, ou l'attestation
  de présence reste-t-elle le seul véhicule ? (position de la revue : l'attestation)

`O-10` appelle aussi un juriste. Joindre au même envoi que `T-01`–`T-08`
([[transmissions-validations]]), `F-01`–`F-09` ([[ecrit-fin-prise-en-soin-validations]]),
`E-01`–`E-15` / `N-01`–`N-10` ([[ecrits-tiers-notice-validations]]), `V-01`–`V-39` et
`Q-201`–`Q-208`.

## À préserver si la fiche est restructurée

`PiecesSection` déduit le type d'un bilan de `content.__type__`. Toute restructuration
de ce bloc ne doit pas entériner la partition en deux types : la refonte vise un moteur
par domaines activables — cf. [[refonte-moteur-bilans]].
