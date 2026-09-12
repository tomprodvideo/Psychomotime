---
name: feedback-forme-des-rapports
description: Forme attendue d'un rapport protection des données dans ce projet — séparer DÉMONTRÉ / HYPOTHÈSE / DÉCISION HUMAINE, nommer question + source + décideur, ne jamais conclure « conforme »
metadata:
  type: feedback
---

Tout rapport doit séparer explicitement **ce qui est DÉMONTRÉ par le code**, ce qui est **HYPOTHÈSE**, et ce qui exige une **DÉCISION HUMAINE**. Pour chaque point ouvert : nommer **la question exacte**, **la source à vérifier**, et **qui tranche**. Ne jamais conclure globalement « conforme ».

**Why:** l'utilisateur a formulé sa demande du lot 7 exactement dans ces termes, et le dépôt tout entier tient cette discipline — les migrations SQL portent elles-mêmes des marqueurs `[HYPOTHÈSE]` et `[VALIDATION HUMAINE — DPO]` en commentaire. Un avis qui mélangerait les trois registres serait repris comme un fait acquis dans les documents de continuité.

**How to apply:** structurer le rendu par question posée, pas par gravité. Quand un défaut prudent est déjà en place dans le code (envoi de courriel désactivé, plafond de 400 jours), le dire et proposer un défaut **réversible** plutôt qu'exiger une décision immédiate. Proposer systématiquement une réduction de donnée avant une mesure de sécurité supplémentaire.
