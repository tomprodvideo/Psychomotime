---
name: projet-r01-fournisseurs-hors-eee
description: R-01, risque bloquant — aucun des quatre fournisseurs n'est certifié HDS, Anthropic et Resend stockent hors EEE ; l'envoi de courriel est désactivé par défaut à cause de cela
metadata:
  type: project
---

**R-01 est le risque bloquant du projet** : ni Supabase, ni Vercel, ni Anthropic, ni Resend ne sont certifiés hébergeur de données de santé ; Anthropic et Resend stockent aux États-Unis sans option EEE. Consigné dans `docs/refonte/00-PILOTAGE.md` § 9 et instruit dans `docs/refonte/recherche/04-hds-rgpd-hebergement.md` § 4.

**Conséquence déjà présente dans le code** (lot 7, commit `65bd5f0`) : l'envoi du lien par courriel est **désactivé tant que `RESEND_API_KEY` et `INVOICE_FROM_EMAIL` ne sont pas configurés**. Ce n'est pas un oubli mais un défaut prudent assumé, le temps que R-01 soit arbitré. Le message composé par `lib/transmissions/courriel.ts` ne porte ni pièce jointe, ni montant, ni nature d'acte, ni nom de patient, et des tests le prouvent.

**Why:** l'échéance du 2026-09-26 (art. R1111-9-1 CSP) rend la question datée et non théorique.

**How to apply:** toute proposition qui activerait l'envoi de courriel, ajouterait un fournisseur ou élargirait ce qui transite par un tiers doit d'abord renvoyer à R-01 et exiger une décision humaine. Voir [[reference-sources-reglementaires-fr]].
