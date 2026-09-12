---
name: projet-durees-non-tranchees
description: Aucune durée de conservation n'est tranchée dans Psychomotime ; liste des durées ouvertes et de leur défaut technique actuel
metadata:
  type: project
---

**Aucune durée de conservation n'est arbitrée dans le produit.** Constaté au commit `65bd5f0` (2026-09-12). Durées ouvertes et défaut technique en vigueur :

| Objet | Défaut technique actuel | Décideur |
|---|---|---|
| Validité d'un lien de transmission | plafond **400 jours** en base (`shared_links_validite_ck`), 7/30/90/365 proposés par l'interface, 30 par défaut | produit + DPO |
| Liens expirés ou révoqués | **conservation illimitée**, `delete` retiré au rôle applicatif | DPO |
| Journal des consultations `shared_link_accesses` | **croissance sans fin**, aucune purge | DPO |
| `audit_events` | survit à la suppression de compte (`practice_id` → null) | DPO |
| Dossier patient | **aucune suppression** dans le produit : seul l'archivage existe | DPO + psychomotricienne |

**Why:** le plafond de 400 jours est explicitement écrit dans la migration comme une **hypothèse produit réversible**, pas comme la transposition d'une obligation. Le confondre avec une règle de droit figerait un choix arbitraire.

**How to apply:** ne jamais présenter une de ces durées comme acquise ni comme légalement fondée. Toute proposition doit être réversible par migration et rapprochée du référentiel CNIL — voir [[reference-sources-reglementaires-fr]].
