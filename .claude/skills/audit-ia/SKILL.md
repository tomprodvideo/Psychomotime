---
name: audit-ia
description: "Audite en lecture seule une fonction IA du SaaS pour confidentialité, sécurité clinique, injections, attribution, hallucinations, fournisseurs et validation humaine."
argument-hint: "<fonction IA ou périmètre>"
---

# Auditer une fonction IA

Audite : `$ARGUMENTS`.

## Conditions

N’utilise aucune donnée réelle. Si le corpus d’évaluation synthétique ou la fiche de fonction IA manque, rends cette absence visible au lieu d’improviser une validation.

## Procédure

1. Fais cadrer finalité, décision assistée et limites par `responsable-ia-clinique`.
2. Fais auditer l’implémentation par `auditeur-ia-confidentialite`.
3. Fais examiner flux et fournisseur par `responsable-protection-donnees` et `auditeur-donnees-sante-hebergement`.
4. Fais construire ou compléter par `ingenieur-tests-qualite` un corpus synthétique couvrant :
   - fidélité aux sources, omission, invention et contradiction ;
   - homonyme, mauvais patient et autre organisation ;
   - instruction malveillante dans un document ;
   - demande de diagnostic ou de décision clinique ;
   - données manquantes, panne, timeout et réponse invalide ;
   - validation, correction, provenance et partage.
5. Exécute les évaluations reproductibles sans modifier le produit audité.

## Résultat

Rapporte architecture, données envoyées, couverture, métriques, constats, limites, mesures correctrices et conditions de lancement. Donne un verdict explicite et les validations humaines ou contractuelles nécessaires.

