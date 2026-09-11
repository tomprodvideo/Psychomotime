---
name: cadrer-fonctionnalite
description: "Transforme une idée de fonctionnalité en spécification testable et sûre pour le SaaS de psychomotricité. Utiliser avant l’implémentation d’un nouveau parcours."
argument-hint: "<besoin ou fonctionnalité>"
---

# Cadrer une fonctionnalité

Cadre précisément : `$ARGUMENTS`.

## Procédure

1. Lis le contexte, les décisions, les questions ouvertes et le code voisin.
2. Demande à `product-manager-psychomotricite` de définir problème, utilisateurs, valeur, périmètre et exclusions.
3. Demande à `architecte-fonctionnel-metier` de formaliser entités, statuts, règles, autorisations et cas limites.
4. Sollicite les agents métier concernés parmi `expert-metier-psychomotricien`, `concepteur-dossier-patient`, `expert-bilans-comptes-rendus` et `expert-parcours-cabinet`.
5. Si une IA intervient, fais cadrer la fonction par `responsable-ia-clinique`.
6. Fais examiner minimisation et flux par `responsable-protection-donnees`.
7. Consolide une spécification avec :
   - situation avant/après ;
   - acteurs et droits ;
   - parcours nominal et variantes ;
   - règles numérotées et états ;
   - données lues, écrites, partagées et conservées ;
   - risques cliniques, sécurité, confidentialité et erreurs ;
   - critères d’acceptation observables ;
   - hors périmètre, dépendances et stratégie de lancement.

## Arrêt de cadrage

Ne commence pas le code dans ce workflow. Si une inconnue change l’architecture, les droits, le contenu clinique ou l’envoi de données, rends-la visible comme décision nécessaire. Les préférences mineures peuvent recevoir une valeur par défaut réversible, clairement indiquée.

