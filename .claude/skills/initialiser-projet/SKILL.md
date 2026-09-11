---
name: initialiser-projet
description: "Analyse un dépôt SaaS de psychomotricité après installation du kit et initialise le contexte, l’architecture, les flux, le modèle métier, les risques et les questions ouvertes sans inventer les informations absentes."
argument-hint: "[périmètre facultatif]"
---

# Initialiser le projet

Analyse `$ARGUMENTS` ou, sans argument, l’ensemble du dépôt à un niveau raisonnable.

## Procédure

1. Lis `CLAUDE.md`, le manifeste du kit et tous les modèles dans `docs/`.
2. Inspecte structure, README, manifestes de dépendances, configuration, schéma et migrations, routes/API, authentification, tests, CI/CD et déploiement. Ne lis ni n’affiche la valeur des secrets.
3. Fais analyser en missions séparées :
   - le produit et les parcours par `product-manager-psychomotricite` et `expert-metier-psychomotricien` ;
   - les entités et autorisations par `architecte-fonctionnel-metier` ;
   - l’architecture par `architecte-logiciel` ;
   - les données et flux par `responsable-protection-donnees`.
4. Consolide les rapports avec des preuves du dépôt. Résous les divergences par les fichiers réels et conserve les inconnues.
5. Renseigne `docs/context/`, `docs/architecture/ARCHITECTURE.md`, `docs/security/DATA_FLOWS.md` et `THREAT_MODEL.md`. Ne supprime pas les avertissements ou principes du kit.
6. Place les hypothèses et choix non confirmés dans `OPEN_QUESTIONS.md`; n’ajoute une décision que si elle est déjà démontrée ou explicitement validée.
7. Exécute `bash scripts/validate-agent-kit.sh .` et les vérifications non destructives nécessaires pour confirmer la stack.

## Résultat

Présente l’état démontré, les modules, les commandes de développement, le modèle d’organisation, les données sensibles, les risques, les incohérences et les décisions utilisateur qui changent matériellement la suite. Utilise uniquement des exemples synthétiques.

