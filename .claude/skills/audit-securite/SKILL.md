---
name: audit-securite
description: "Réalise un audit de sécurité en lecture seule du SaaS, centré sur les accès, l’isolation, les données de santé, les fournisseurs et le déploiement."
argument-hint: "[périmètre, branche ou fonctionnalité]"
---

# Auditer la sécurité

Audite `$ARGUMENTS` ou, sans argument, le diff et les zones critiques du produit.

## Procédure

1. Fige le périmètre logique : révision, fichiers, environnement et limites.
2. Fais intervenir en lecture seule :
   - `auditeur-securite-applicative` pour code, API, sessions et autorisations ;
   - `responsable-protection-donnees` pour minimisation et cycles de données ;
   - `auditeur-donnees-sante-hebergement` pour flux et infrastructure ;
   - `auditeur-ia-confidentialite` si une fonction IA est dans le périmètre.
3. Interdis toute attaque d’un environnement externe ou réel sans autorisation spécifique. Utilise des preuves locales et données synthétiques.
4. Déduplique les constats et conserve pour chacun : sévérité, confiance, preuve reproductible, impact métier, correction et test de vérification.
5. Indique aussi les contrôles examinés sans constat et les zones non couvertes.
6. Compare les résultats au modèle de menaces et au socle de sécurité.

## Indépendance

Ne modifie aucun code durant l’audit. Remets le rapport à l’orchestrateur pour triage et correction séparée. Ne prononce pas une conformité juridique ou une certification globale.

