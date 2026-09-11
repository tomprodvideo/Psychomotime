---
name: refonte-moteur-bilans
description: La refonte Psychomotime vise un moteur de bilans configurable par domaines activables, et non des types de bilan figés calqués sur des pathologies
metadata:
  type: project
---

Depuis 2026-09-11, une refonte complète de Psychomotime est engagée. Direction cadrée par le coordinateur : le bilan doit devenir un **moteur configurable par domaines activables**, explicitement **pas** une liste figée de « types de bilan ».

**Why:** le produit actuel fige deux types (`psychomoteur` / `sensoriel Dunn 2`) dans `content.__type__` (voir `DEC-006`). Un type calqué sur un instrument ou une pathologie ne décrit ni la demande réelle, ni l'âge, ni le contexte de financement. Aucun texte n'impose de contenu au bilan psychomoteur — R4332-1 CSP nomme l'acte sans le définir — donc **aucun domaine n'est obligatoire pour tous**.

**How to apply:** quand on me demande d'arbitrer une structure de bilan, décrire un document par quatre attributs indépendants — nature, domaines activés, destinataire principal, rattachement à un parcours — plutôt que par un type. Un « bilan sensoriel » n'est pas un type : c'est un bilan dont seul le domaine « traitement sensoriel » est activé. Ne jamais signaler un domaine désactivé comme une donnée manquante.

Référentiel sourcé produit pour cette refonte : voir [[referentiel-clinique-sourcé]].
Questions cliniques encore ouvertes et non validées : `docs/context/OPEN_QUESTIONS.md`, `Q-201` à `Q-208` — aucune tranchée à ce jour.
