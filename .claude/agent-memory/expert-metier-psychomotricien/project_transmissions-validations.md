---
name: transmissions-validations
description: Points de transmission par lien (factures/attestations) qui exigent l'arbitrage d'une psychomotricienne en exercice — issus de la relecture métier du lot 7 le 2026-09-12
metadata:
  type: project
---

Relecture métier du lot 7 (transmissions par lien) faite le 2026-09-12. Huit points ne peuvent
pas être tranchés par le logiciel et restent **non validés** à ce jour.

- `T-01` Le courriel nomme le cabinet (`practiceName`). Si ce nom contient « psychomotricité »,
  la neutralité du message tombe. Nommer le cabinet ou pas : arbitrage de praticienne.
- `T-02` Une attestation consultée par lien n'offre **aucun emplacement de signature manuscrite
  ni de cachet**, contrairement à sa version imprimée. Un employeur, une MDPH ou une mutuelle
  l'acceptent-ils sans signature ?
- `T-03` Durées de validité par destinataire (famille, employeur, mutuelle, MDPH). L'interface
  propose 7/30/90/365 j, défaut 30 j ; aucune n'est adossée à une obligation.
- `T-04` Qui peut légitimement recevoir un lien quand le patient est mineur ou représenté :
  quel rôle de `PatientContactRole`, et faut-il exiger un consentement enregistré.
- `T-05` L'adresse du patient/payeur ne figure pas sur la facture vue par lien alors qu'elle
  figure à l'impression. Une mutuelle la réclame-t-elle ?
- `T-06` Faut-il pouvoir transmettre un compte rendu de bilan, et à qui (médecin adresseur).
  Hors périmètre du lot 7 : `SUJETS` = `billing_document` | `attestation` seulement.
- `T-07` Accusé de réception et relance : utiles, ou surveillance de la famille ?
- `T-08` Formulation de l'attestation d'entretien parental — déjà ouvert dans
  `lib/attestations/types.ts` (`formulePresence`).

**Why :** ces points engagent ce qu'un tiers reçoit et ce qu'un document affirme ; la
`CLINICAL_SAFETY.md` exige une relecture par une praticienne représentative avant diffusion.

**How to apply :** les joindre au même envoi que `V-01`–`V-39`
(`docs/refonte/recherche/01-clinique-domaines.md`) et `Q-201`–`Q-208`
(`docs/context/OPEN_QUESTIONS.md`). Ne rien convertir en décision produit sans retour.
Voir [[referentiel-clinique]].
