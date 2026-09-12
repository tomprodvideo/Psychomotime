---
name: moteur-bilans-dernier-module-v1
description: Le moteur de bilans est le seul module resté sur le modèle v1 (clé user_id) ; sa reprise vaut refonte du modèle « type de bilan » en nature + trame
metadata:
  type: project
---

Au 2026-09-12, tout le produit est passé au modèle de cabinet (`practice_id`) sauf
le moteur de bilans : `bilans` reste clé sur `user_id`, hors des politiques de
lecture réécrites en `0019`, et hors du modèle d'isolation éprouvé.

**Why:** la refonte s'est faite lot par lot (L0 → L2, L5, L7 livrés). Le L3
« moteur de bilans » est suspendu à des arbitrages cliniques non tranchés
(`Q-201` à `Q-208`), pas à une difficulté technique. Conséquences déjà
consignées ailleurs et vérifiées : l'incohérence `[A-59]` de la suppression de
compte (0015) ; l'impossibilité de journaliser `bilan.ia_reformulation` dans
`audit_events` ; `lib/scales.ts` construit au L3 et jamais branché sur le
document.

**How to apply:** ne pas traiter « porter N types de bilans » comme un ajout de
type. La direction cadrée par le coordinateur et documentée dans
`docs/refonte/recherche/01-clinique-domaines.md` § 2.1 décrit un document par
quatre attributs indépendants — nature, domaines activés, destinataire,
rattachement — et non par un type. Le « bilan sensoriel » n'est pas un type :
c'est une TRAME (et, plus tard, un domaine activé). Donc : `kind` (nature, liste
close contrainte en base) + `template_id` (trame, donnée du cabinet). Rejeter
l'option apparemment évidente `bilans.type_id -> bilan_types`, qui reproduit la
rigidité un niveau plus bas.

Voir aussi [[methode-reprise-v1]] pour la façon de basculer la table.
