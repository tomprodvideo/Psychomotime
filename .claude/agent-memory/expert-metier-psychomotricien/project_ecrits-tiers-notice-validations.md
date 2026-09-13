---
name: ecrits-tiers-notice-validations
description: Points d'arbitrage E-01..E-15 (écrit pour tiers non soignant, rang 5) et N-01..N-10 (notice d'information, rang 6), plus le blocage qui empêche d'écrire honnêtement une notice aujourd'hui — revue du 2026-09-13
metadata:
  type: project
---

Spécification métier des **rangs 5 et 6** des écrits manquants
(`docs/refonte/03-MOTEUR-DOCUMENTS.md`), faite le 2026-09-13, avant migration.
Aucun de ces points n'est tranché.

## Positions retenues par la revue, à faire confirmer

- **Rang 5 : UN objet, trois natures d'usage déclaré** (`ecole`, `mdph`, `autre_tiers`),
  comme `0024` pour les quatre natures de fin. Raison décisive : l'équipe de suivi de
  scolarisation est le lieu où école et MDPH se recouvrent — deux tables y forceraient un
  choix faux.
- **Le destinataire et la destination sont deux choses.** Le mode dominant pour la MDPH
  est « remis à la famille, qui transmet » : il n'y a alors aucun `recipient_contact_id`.
  Les rangs 2 à 4 ne connaissent pas ce cas.
- **Le consentement : D-i ne tient plus tel quel au rang 5.** L1110-4 CSP présume
  l'échange autorisé DANS une équipe de soins ; une école et une MDPH n'en font pas
  partie, donc la présomption disparaît. Position : refus par défaut sans accord
  enregistré, dérogation possible et motivée ; et refus sur un retrait enregistré.
  **Argument de cohérence produit, pas d'obligation sourcée.**
- **Rang 6 : document DU CABINET, versionné**, dont on trace la remise par personne — pas
  un instantané par patient. L'instantané se pose sur la VERSION publiée.

## Le blocage du rang 6, à ne pas contourner

Une notice honnête doit énoncer destinataires, hébergement, durées de conservation et
bases légales. `docs/refonte/recherche/04-hds-rgpd-hebergement.md` établit qu'**aucun de
ces quatre éléments n'est arrêté** : aucun fournisseur n'est certifié HDS (`R-01`), aucune
durée n'est tranchée, aucun contrat article 28 n'existe. Livrer un gabarit pré-rempli
ferait imprimer à la praticienne, sous sa signature, des affirmations non établies.
**Conséquence : livrer le moteur et les rubriques d'organisation ; laisser la rubrique
données en champ libre vide, avec la liste de ce qui manque.**

## Piège de source vérifié le 2026-09-13

**R1111-21 à R1111-25 CSP (affichage des tarifs) sont ABROGÉS** depuis le 2020-03-22
(décret n° 2020-282 du 18 mars 2020) — vérifié sur Légifrance. Le cadre à vérifier est
**L1111-3-2 CSP** (version en vigueur au 2023-12-31) et l'**arrêté du 30 mai 2018**. De
nombreuses pages professionnelles citent encore les articles abrogés. Même famille de
piège que le décret de 1988 et que les textes PCO — cf. [[referentiel-clinique-sourcé]].

## Questions à soumettre

- `E-01` à `E-15` : nature unique ou double, formulation des mentions imprimées, mode de
  remise dominant pour la MDPH, préconisations (AESH, aménagements), scores, objectifs,
  nomination des autres professionnels, durée de validité, adolescent opposé, et les
  trois points de consentement (exiger / retrait / qui accorde pour un mineur).
- `N-01` à `N-10` : existence réelle d'une notice, signature de retour, contenu
  d'organisation, versionnage, rôle `assistant` pour tracer la remise, remise par lien,
  durées, hébergement, et la migration d'`information_recue`.

`E-13`–`E-15`, `N-08`, `N-09` exigent **un juriste ou un DPO**, pas une praticienne.

**Défaut de modèle relevé :** `patient_consents.kind = 'information_recue'` range un FAIT
(avoir reçu) parmi des ACCORDS. `withdrawn_on` n'y a pas de sens — on ne dé-reçoit pas une
information — et l'écran propose pourtant « Retirer » sur cette ligne comme sur les autres.

**How to apply :** joindre au même envoi que `T-01`–`T-08`
([[transmissions-validations]]), `F-01`–`F-09` ([[ecrit-fin-prise-en-soin-validations]]),
`V-01`–`V-39` et `Q-201`–`Q-208`. Ne rien convertir en règle produit sans retour écrit.
