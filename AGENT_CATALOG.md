# Catalogue des agents

## Pilotage

| Agent | Type | Quand l’utiliser |
|---|---|---|
| `orchestrateur-saas` | Coordination | Fonctionnalité ou audit qui mobilise plusieurs spécialités. |
| `gardien-contexte` | Continuité | Après une décision, une livraison ou avant une reprise. |
| `product-manager-psychomotricite` | Réflexion | Cadrage, priorisation, user stories et critères d’acceptation. |
| `architecte-fonctionnel-metier` | Réflexion | Entités, statuts, règles, autorisations et événements métier. |

## Psychomotricité et cabinet

| Agent | Type | Quand l’utiliser |
|---|---|---|
| `expert-metier-psychomotricien` | Réflexion/revue | Vocabulaire, réalisme du parcours et validation par un praticien. |
| `concepteur-dossier-patient` | Conception | Dossier, anamnèse, notes, responsables légaux et documents. |
| `expert-bilans-comptes-rendus` | Conception/revue | Bilans, saisies, calculs, synthèses, comptes rendus et restitution. |
| `expert-parcours-cabinet` | Conception | Agenda, liste d’attente, rappels, absences, facturation et coordination. |
| `responsable-ia-clinique` | Gouvernance IA | Finalité, garde-fous, validation et évaluations d’une fonction IA. |

## Construction

| Agent | Type | Quand l’utiliser |
|---|---|---|
| `architecte-logiciel` | Conception technique | Architecture, modules, événements, stockage et ADR. |
| `ingenieur-base-donnees` | Construction | Schéma, contraintes, migrations, index et transactions. |
| `ingenieur-backend` | Construction | API, services, règles, autorisations et tâches asynchrones. |
| `ingenieur-frontend-ux` | Construction | Écrans, formulaires, états, responsive et accessibilité. |
| `designer-ux-psychomotricite` | Conception | Flux, hiérarchie, microcopie et prévention des erreurs. |
| `ingenieur-integrations` | Construction | Calendrier, e-mail, SMS, paiement, IA et services tiers. |
| `ingenieur-tests-qualite` | Construction/QA | Stratégie, fixtures synthétiques, tests et preuves. |

## Audit

Les agents suivants sont configurés en lecture seule pour préserver l’indépendance de la revue.

| Agent | Périmètre |
|---|---|
| `auditeur-securite-applicative` | Authentification, autorisations, sessions, entrées, secrets et isolation. |
| `responsable-protection-donnees` | Finalités, minimisation, conservation, droits et sous-traitants. |
| `auditeur-donnees-sante-hebergement` | Flux, régions, chiffrement, sauvegardes, contrats et cadres d’hébergement. |
| `auditeur-ia-confidentialite` | Prompts, contexte, fournisseurs, injections, fuites et hallucinations. |
| `auditeur-fonctionnel-metier` | Parcours de cabinet, règles, cas limites et critères d’acceptation. |
| `relecteur-final` | Preuves, cohérence globale et verdict de livraison. |

## Exploitation

| Agent | Type | Quand l’utiliser |
|---|---|---|
| `devops-github-vercel` | Construction/livraison | CI/CD, GitHub, previews, production et retour arrière. |
| `observabilite-incidents` | Construction/exploitation | Logs sûrs, métriques, alertes et procédures d’incident. |

## Exemples d’appel

```text
@agent-product-manager-psychomotricite cadre un module de liste d’attente.
@agent-architecte-fonctionnel-metier modélise les responsables légaux et leurs droits.
@agent-auditeur-securite-applicative audite les accès au dossier patient sur ce diff.
@agent-auditeur-ia-confidentialite vérifie la génération de brouillons de comptes rendus.
@agent-relecteur-final vérifie si cette branche satisfait ses critères d’acceptation.
```

Claude peut aussi choisir automatiquement un agent grâce à son champ `description`. Pour une tâche transversale, invoquer `/implementer-fonctionnalite` ou demander explicitement à `orchestrateur-saas` de coordonner.

