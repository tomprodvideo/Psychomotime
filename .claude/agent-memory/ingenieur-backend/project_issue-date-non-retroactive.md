---
name: issue-date-non-retroactive
description: Décision du 2026-09-11 — les factures existantes sans date d'émission ne doivent PAS être renseignées rétroactivement, ni en base ni à l'ouverture du formulaire
metadata:
  type: project
---

Le champ `issue_date` d'une facture n'est pré-rempli **qu'à la création** (date du jour, fuseau local). En édition, une valeur vide reste vide.

**Why:** dater après coup une facture déjà émise reviendrait à inventer une date d'émission sur un document comptable. En production, quelques factures anciennes ont ce champ vide et les trois rendus de facture (`app/(app)/comptabilite/[id]/facture/page.tsx`, `lib/invoicePdf.tsx`, `app/facture/[token]/page.tsx`) retombent alors en cascade sur `payment_date` puis sur la date du jour — leur date affichée bouge d'une impression à l'autre. C'est un défaut connu et **assumé** pour l'existant, pas un oubli.

**How to apply:** refuser toute migration de backfill de `issue_date` et tout pré-remplissage en mode édition. Si le sujet revient, la correction légitime porte sur les rendus (afficher l'absence de date plutôt qu'une date inventée) ou sur une reprise manuelle facture par facture par la praticienne — décision métier, pas technique. Ne pas produire de date via `toISOString()` : il bascule en UTC et renvoie la veille en soirée. Voir [[feedback-perimetre-strict]].
