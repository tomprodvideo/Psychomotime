---
name: ecrits-cliniques-serie
description: La série des écrits cliniques (docs/refonte/03) se livre rang par rang, migration et contrôles SQL d'abord, document imprimable en dernier — et les décisions en attente de la psychomotricienne
metadata:
  type: project
---

`docs/refonte/03-MOTEUR-DOCUMENTS.md` classe sept écrits manquants par coût.
Les rangs 1 à 3 (note de séance, courrier de liaison, synthèse de suivi) ont été
livrés à partir du 2026-09-13.

**Ordre de livraison observé, et il compte pour lire l'état d'un rang :**
migration + fichier de contrôles SQL d'abord, puis `lib/<domaine>/` et les
actions serveur, puis la section du dossier patient, et **la page
`document/page.tsx` en dernier**. Un rang dont le document imprimable manque
n'est donc pas défectueux : il est en cours. Vérifier avant de le signaler.

**Why:** le propriétaire fait relire chaque rang en cours de route, à un moment
où l'interface est volontairement incomplète. Signaler l'absence du document
imprimable comme un défaut fait perdre du temps et brouille les vrais constats.

**How to apply:** avant de conclure qu'un écrit est incomplet, vérifier ce qui
existe réellement (`Glob` sur le domaine) et distinguer « pas encore écrit » de
« écrit et faux ». Les liens « Imprimer » peuvent pointer vers une page
inexistante pendant cet intervalle.

**Décisions que le code ne peut pas prendre, récurrentes sur toute la série** —
elles reviennent à chaque rang et méritent d'être groupées pour une seule
séance de validation avec la psychomotricienne plutôt que posées une par une :
vocabulaire imprimé des statuts d'objectif ; faut-il imprimer les absences et
avec quelle symétrie ; consentement au partage — le dire ou l'exiger ([D-i],
ouverte depuis le courrier de liaison) ; destinataire d'un écrit concernant un
mineur (`Q-207`) ; périodicité d'une synthèse, qui se lit dans son contrat et
non dans le produit.

Voir [[moteur-bilans-ilot-v1]] pour le moteur de bilans, qui reste à part.
