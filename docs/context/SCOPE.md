# Périmètre

Dernière mise à jour : 2026-09-11, par `/initialiser-projet`.

## Inclus — démontré par le dépôt

- Compte individuel : inscription, connexion, paramètres, suppression de son propre compte.
- Dossier patient : identité, coordonnées, date de naissance, notes libres, responsable légal, dossier de suivi.
- Bilans : deux types (psychomoteur et sensoriel Dunn 2), trames et modèles éditables par type, statut brouillon/finalisé, aperçu imprimable et export PDF par impression.
- Assistance à la rédaction : reformulation d’une section par l’API Anthropic, dictée vocale via le navigateur.
- Comptabilité libérale : factures, numérotation automatique, rétrocession, URSSAF, revenu net, loyers et charges, filtres par période et statut de paiement, export CSV, facture imprimable.
- Documents : dossiers et fichiers dans un bucket privé, 10 Mo par fichier.
- Abonnement : période d’essai de 7 jours, statuts, résiliation par l’utilisateur, activation manuelle par un administrateur.

## Exclus

Exclusions de principe posées par le kit :

- Diagnostic automatisé.
- Décision clinique autonome.
- Utilisation de données réelles dans le développement et les tests.

Exclusions constatées — fonctions absentes du dépôt, à ne pas supposer acquises :

- Agenda, séances, liste d’attente, rappels et présences.
- Partage entre praticiens, remplaçants, cabinet ou structure multi-professionnels.
- Portail patient ou responsable légal.
- Envoi de documents à un tiers depuis l’application (e-mail, messagerie sécurisée, dépôt partagé).
- Consentements formalisés et traçés.
- Paiement en ligne : les colonnes Stripe existent, le code n’existe pas.
- Journalisation applicative des accès et des exports.

## Hypothèses en cours

| Hypothèse | Fondement dans le dépôt | Impact si fausse | Méthode de validation | Responsable |
|---|---|---|---|---|
| Le produit cible la pratique libérale individuelle. | Isolation par `user_id`, aucune entité organisation. | Refonte complète du modèle d’isolation et des droits. | Décision produit. | À renseigner |
| Le marché visé est la France. | `urssaf_rate`, `retrocession_rate`, champs SIRET et ADELI dans `settings.profile`, libellés en français. | Vocabulaire, calculs, obligations et hébergement. | Décision produit. | À renseigner |
| L’hébergement est Supabase + Vercel. | `@supabase/ssr`, `README.md:96`, commits « Relance build Vercel ». | Localisation des données de santé, contrats de sous-traitance. | À faire confirmer, voir `docs/security/DATA_FLOWS.md`. | À renseigner |
| Un seul praticien utilise réellement le produit aujourd’hui. | Compte administrateur unique codé en dur, absence de paiement. | Priorités, urgence des sujets multi-comptes. | Confirmation utilisateur. | À renseigner |

## Contraintes

- **Pays et cadre juridique ciblés** : la France est fortement suggérée par URSSAF, ADELI, SIRET et la rétrocession, mais n’est pas déclarée. À confirmer explicitement, car cela conditionne les validations réglementaires.
- **Plateformes et navigateurs** : application web responsive. La dictée vocale repose sur l’API Web Speech (`window.SpeechRecognition || window.webkitSpeechRecognition`, `app/(app)/bilans/[id]/useDictation.ts`) et n’est donc pas disponible sur tous les navigateurs ; le code prévoit un repli `supported = false`. L’export PDF passe par l’impression du navigateur, son rendu dépend donc du navigateur.
- **Modèle économique** : abonnement avec essai de 7 jours modélisé en base, encaissement non implémenté. À confirmer.
- **Hébergement et fournisseurs** : Supabase (base PostgreSQL, authentification, stockage), Anthropic (reformulation), hébergeur du front. Régions et engagements contractuels à confirmer.
- **Intégrations** : aucune intégration tierce en dehors de l’API Anthropic.
- **Taille des requêtes** : `next.config.ts` relève `serverActions.bodySizeLimit` à 6 Mo, car logo et images transitent en base64 dans les actions serveur.
