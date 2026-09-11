---
name: facture-multi-prestations
description: Arbitrage rendu le 2026-09-11 — plusieurs prestations par facture via une colonne `lines jsonb`, valeurs figées à l'émission ; livré en deux temps, serveur d'abord, interface ensuite
metadata:
  type: project
---

Une facture porte plusieurs prestations, chacune avec ses dates de séance, via **une colonne `lines jsonb` sur `invoices`** — pas de table enfant. Chaque ligne **copie** `label`, `unit_price`, `pricing` et `intro` du catalogue (`settings.profile.service_catalog`) et ne les relit jamais ; `catalog_id` ne sert qu'à dire d'où vient la ligne.

**Why:** l'arbitrage jsonb tient à trois faits du dépôt — les lectures de facture sont des `select("*")`, la RLS des factures est héritée sans politique nouvelle, et supabase-js ne sait pas ouvrir de transaction, donc l'enregistrement doit rester une seule écriture. Le figement, lui, est une exigence comptable : une facture est un document émis, son contenu ne peut pas bouger parce qu'un référentiel de tarifs a bougé. L'utilisateur a explicitement écrit que cet arbitrage « n'est pas à rediscuter ».

**How to apply:** ne jamais proposer de normaliser `lines` en table, ni de recalculer une ligne depuis le catalogue, ni de backfiller les factures existantes — `lines = []` avec `revenue_gross > 0` est un état **légal et permanent**. La livraison est volontairement coupée en deux : couche données et serveur d'abord (faite), interface de saisie et bascule des trois rendus sur `doc.table.lines` ensuite. Tant que la seconde n'est pas faite, `doc.table.line` (au singulier, `@deprecated`) n'imprime que le premier bloc. Même esprit de non-rétroactivité que [[issue-date-non-retroactive]] ; vérification SQL décrite dans [[verification-commandes-psychomotime]].
