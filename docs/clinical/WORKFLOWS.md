# Parcours métier

Les parcours ci-dessous sont des cadres d’analyse. Ils doivent être adaptés au périmètre confirmé.

Depuis le 2026-09-11, chaque étape porte son **état réel dans le produit**, établi par lecture du code : ✅ outillé · ⚠️ partiel · ❌ absent. Une étape ❌ n’est pas une lacune à combler d’office : c’est une information à confronter à la pratique réelle avant toute décision.

## Entrée d’un nouveau patient

| # | Étape du cadre | État | Ce que fait réellement le produit |
|---|---|---|---|
| 1 | Recueil minimal de la demande et des coordonnées | ✅ | Fiche patient : identité, naissance, e-mail, téléphone, adresse, notes. Dossier de suivi en 11 champs répartis en 3 groupes — prescription et demande, clinique, environnement (`lib/constants.ts:37-92`). |
| 2 | Identification **distincte** du patient et des responsables légaux | ⚠️ | Le responsable légal existe comme objet jsonb unique rattaché au patient (`patients.guardian`). **Un seul responsable possible**, sans identité propre, non partageable entre deux patients d’une fratrie, et jamais destinataire d’un envoi. |
| 3 | Prescription et documents reçus | ⚠️ | Les champs `prescripteur` et `ordonnance_date` existent. Le module Documents existe mais **ses fichiers ne sont pas rattachables à un patient** : `documents` porte `folder_id`, jamais `patient_id` (`supabase/migration_008.sql:19-28`). |
| 4 | Information, autorisations et consentements | ❌ | Aucune entité, aucun champ, aucune trace. |
| 5 | Planification ou liste d’attente | ❌ | Aucun agenda, aucune séance, aucune liste d’attente dans le dépôt. |

## Bilan

| # | Étape du cadre | État | Ce que fait réellement le produit |
|---|---|---|---|
| 1 | Préparation et anamnèse | ✅ | Section anamnèse en tête de trame, aides de saisie détaillées. |
| 2 | Observations et saisies | ⚠️ | **Un seul champ de texte libre par domaine.** Le produit ne sépare pas observation, résultat et interprétation : tout arrive dans `content[sectionId]`, une chaîne (`lib/types.ts:224`). Saisie chiffrée structurée pour **2 instruments sur 8** seulement — M-ABC3 et Dunn 2. |
| 3 | Analyse conduite par le professionnel | ⚠️ | Le produit colore automatiquement les notes standard dès la frappe, avec des seuils que le praticien ne règle pas (`lib/constants.ts:756-765`). Une donnée brute est donc qualifiée par l’outil avant analyse. |
| 4 | Rédaction en brouillon, relecture, validation | ⚠️ | Les statuts `brouillon` et `finalisé` existent, mais la bascule est un simple interrupteur réversible, non horodaté, sans confirmation. **Un bilan finalisé reste intégralement modifiable** et le serveur accepte le statut envoyé par le client (`app/(app)/bilans/actions.ts:101`). |
| 5 | Restitution et partage contrôlé | ⚠️ | Aperçu imprimable et export par impression navigateur. **Le statut n’apparaît nulle part sur le document imprimé** : un brouillon sort identique à un bilan validé, signature comprise. Le partage se fait par `mailto:` hors du produit, sans trace. |

**Deux ruptures constatées dans ce parcours :**

- **Le bilan peut se détacher de toute fiche patient.** Saisir un nom libre efface l’identifiant patient (`app/(app)/bilans/nouveau/NouveauBilanForm.tsx:105-115`). Le bilan n’apparaît alors plus dans la fiche du patient, perd la date de naissance et l’âge, et aucune réconciliation ultérieure n’est proposée.
- **Aucune sauvegarde automatique.** Tout l’état de l’éditeur vit en mémoire du navigateur et n’est écrit qu’au clic sur « Enregistrer ». Aucun garde-fou à la fermeture d’onglet. Une passation saisie en séance peut être perdue intégralement.

## Suivi

| # | Étape du cadre | État |
|---|---|---|
| 1 | Définition des objectifs | ❌ Aucun objet « objectif ». Seul existe un champ texte libre « Accompagnement et objectifs » sur la fiche patient. |
| 2 | Planification et réalisation des séances | ❌ Aucune séance, aucun agenda. |
| 3 | Notes et évolution, avec statut et auteur | ❌ Aucune note de séance. L’auteur d’un bilan est une chaîne de texte libre, non reliée au compte (`supabase/schema.sql:80`). |
| 4 | Réévaluation des objectifs | ❌ |
| 5 | Synthèse, coordination, clôture | ❌ Aucune clôture de dossier, aucune coordination. |

**Constat d’ensemble : le produit outille l’évaluation, pas l’accompagnement.** Ce n’est pas nécessairement un défaut — c’est un périmètre. Il doit être confirmé comme tel ou inscrit en feuille de route, pas subi. Voir `Q-204` dans `OPEN_QUESTIONS.md`.

## Administration

| Fonction | État |
|---|---|
| Factures, rétrocession, URSSAF, net, loyers | ✅ Complet, avec numérotation automatique, filtres, export CSV et facture imprimable. |
| Lien facture ↔ bilan | ❌ Aucune clé étrangère. Le libellé de prestation par défaut est « Séance de psychomotricité », y compris pour facturer un bilan. |
| Destinataire de la facture | ⚠️ La facture est adressée au patient, à l’adresse du patient. Le responsable légal n’est jamais le destinataire ni le payeur. |
| Agenda, rappels, absences, devis, paiements, relances | ❌ Absents. |

## Points à faire trancher par une psychomotricienne en exercice

Ces questions sont bloquantes pour des choix de conception **déjà figés dans le code**. Elles sont reprises et instruites dans `docs/context/OPEN_QUESTIONS.md` (`Q-201` à `Q-208`).

1. Un seul bloc de prose par domaine, ou des champs séparés observation / résultat / interprétation ?
2. Quels seuils et quel vocabulaire font foi dans un compte rendu diffusé ?
3. Que doit signifier « finalisé » — verrouillage, horodatage, filigrane sur le PDF ?
4. La reformulation assistée doit-elle conserver les notes brutes et être signalée dans le dossier ?
5. Un seul responsable légal par patient suffit-il, et à qui s’adressent le compte rendu et la facture ?
6. Les normes doivent-elles se lire sur l’âge à la date de passation, et faut-il alerter si le groupe d’âge coché ne correspond pas ?
7. Les six tests sans saisie chiffrée ont-ils besoin de champs de scores ?
8. L’absence de séance, d’objectif et d’agenda est-elle un périmètre assumé ou le prochain manque bloquant ?
