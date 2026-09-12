---
name: projet-lot8-accessibilite
description: Lot 8 = accessibilité, cible WCAG 2.2 niveau AA ; et les docs/context sont en retard sur le code
metadata:
  type: project
---

Le **lot 8** du projet Psychomotime porte sur l'accessibilité. Cible annoncée : **WCAG 2.2 niveau AA** (donc 2.4.11 Focus Not Obscured et 2.5.8 Target Size sont dans le périmètre ; 2.4.13 Focus Appearance et 2.4.12 sont AAA, hors cible).

**Fait non évident à retenir : `docs/context/*` et `docs/clinical/*` décrivent le dépôt à l'état `e262bb6` (2026-09-11) et sont nettement en retard sur le code.** Au 2026-09-12 (`6987e0a`), des modules que ces documents déclarent « absents » existent bel et bien : agenda et présences, séances, consentements, entourage, attestations, parcours de soin, transmissions par lien, et une page publique `app/document/[token]` accessible sans compte.

**Why:** j'ai failli fonder un audit sur la cartographie de `PRODUCT.md`/`SCOPE.md`, qui affirme « aucun agenda, aucune table, aucun partage sortant ». C'est faux aujourd'hui.

**How to apply:** lire ces documents pour l'intention et les principes (sécurité clinique, vocabulaire, décisions), **jamais pour l'inventaire des fonctionnalités**. Pour le périmètre réel, énumérer l'arborescence `app/`. Signaler l'écart quand il change le résultat. Voir [[feedback-rigueur-audit]].
