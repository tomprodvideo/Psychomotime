---
name: projet-lot8-accessibilite
description: Lot 8 = design + accessibilité (WCAG 2.2 AA) ; quels docs/context sont fiables et lesquels mentent encore
metadata:
  type: project
---

Le **lot 8** de Psychomotime porte sur design, accessibilité et performance. Performance livrée ; accessibilité en audit. Cible annoncée : **WCAG 2.2 niveau AA** (2.4.11 Focus Not Obscured et 2.5.8 Target Size sont dans le périmètre ; 2.4.13 Focus Appearance est AAA, hors cible).

## Quels documents croire, au 2026-09-13

- **`docs/context/CURRENT_STATE.md` a été réécrit le 2026-09-13 et est globalement fiable** (locataire = cabinet, 24 migrations, falsification des gardes). Il reste **une ligne fausse** : « le design system n'existe pas : 58 lignes de CSS, 108 lignes de composants partagés ». Réel : `app/globals.css` fait 96 lignes et porte une règle `:focus-visible` posée hors couche en cascade, et `components/` contient 5 fichiers dont un `Dialogue` bâti sur `<dialog>` natif.
- **`PRODUCT.md`, `SCOPE.md`, `USERS.md`, `GLOSSARY.md`, `WORKFLOWS.md` sont restés au 2026-09-11** et sont désormais contredits par le code : ils affirment que le locataire est le compte utilisateur, qu'il n'y a ni agenda, ni séance, ni partage sortant, ni envoi d'e-mail, ni génération PDF serveur. Or `package.json` porte `resend` et `@react-pdf/renderer`, et `app/(app)/agenda/`, `courriers/`, `syntheses/`, `attestations/` existent.

**Why:** j'ai failli fonder un audit sur la cartographie de `PRODUCT.md`, qui est fausse. Et l'utilisateur ouvre désormais ses demandes par « état factuel, à vérifier toi-même avant de conclure » — il sait que ces documents dérivent et attend une contre-vérification, pas une citation.

**How to apply:** lire ces documents pour l'intention et les principes (sécurité clinique, vocabulaire, décisions), **jamais pour l'inventaire des fonctionnalités ni pour un chiffre**. Pour le périmètre réel, énumérer `app/` ; pour un volume, compter par `Grep`. Signaler l'écart quand il change le résultat. Voir [[feedback-rigueur-audit]] et [[feedback-rubrique-refus]].
