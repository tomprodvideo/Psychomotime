# Produit

Dernière mise à jour : 2026-09-11, par `/initialiser-projet`.
Chaque affirmation ci-dessous est démontrée par le dépôt. Ce qui reste inconnu est marqué `À renseigner` et ne doit pas être converti en fait.

## Vision

Construire un SaaS qui réduit la charge administrative du psychomotricien, sécurise l’information utile à sa pratique et lui laisse la maîtrise de toute décision clinique.

## Ce que le produit est aujourd’hui — état démontré

`README.md:3` le définit comme une « application web pour psychomotricien(ne) libéral(e) » couvrant **la comptabilité** et **les bilans psychomoteurs**. Le dépôt confirme un périmètre plus large que ces deux axes.

Modules réellement présents dans `app/(app)/` :

| Module | Route | Contenu démontré |
|---|---|---|
| Tableau de bord | `/` | Revenu net annuel, URSSAF estimée, patients, derniers bilans (`README.md:56`). |
| Comptabilité | `/comptabilite` | Factures, rétrocession, URSSAF, net, loyers et charges, filtres par période, statut de paiement, export CSV, numérotation automatique, facture imprimable. |
| Patients | `/patients` | Fiche d’identité et de contact, responsable légal, dossier de suivi, historique des factures et bilans, fiche imprimable. |
| Bilans | `/bilans` | Éditeur structuré par sections, statut brouillon/finalisé, aperçu imprimable, reformulation IA, dictée vocale. |
| Documents | `/documents` | Dossiers et fichiers stockés dans un bucket Supabase privé (`supabase/migration_008.sql`). |
| Paramètres | `/parametres` | Taux, mode de charge, profil professionnel, trames de bilan, modèles, abonnement, suppression de compte. |
| Administration | `/admin` | Réservé au rôle `is_admin` (`supabase/migration_004.sql`). |

**Deux types de bilan** coexistent, avec trames, modèles et réglages séparés par type : le **bilan psychomoteur** et le **bilan sensoriel (Dunn 2)** (commits `71586f6`, `61bb0ea`, `d3fc5ba`, `3ca533a`, `55915dd`).

## Problèmes résolus, tels que le code le démontre

- Recalculer à la main rétrocession, URSSAF et revenu net : automatisé dans `lib/calc.ts`, formules documentées dans `README.md:70`.
- Perdre l’historique comptable quand un taux change : les montants sont figés à la saisie, un changement de taux ne rétroagit pas (`README.md:78`).
- Rédiger un bilan à partir de notes brutes : trames structurées dans `lib/constants.ts`, reformulation assistée dans `app/(app)/bilans/ai-actions.ts`, export imprimable.
- Retrouver les pièces d’un patient : factures, bilans et documents rattachés au dossier.

## Proposition de valeur

- À renseigner. Le dépôt démontre les fonctions, pas la promesse commerciale ni le différenciant revendiqué face aux logiciels existants.

## Modèle économique

Partiellement démontré, à confirmer :

- Une table `subscriptions` existe avec les statuts `trialing | active | inactive | past_due | canceled` et une **période d’essai de 7 jours** attribuée à l’inscription (`supabase/migration_004.sql`).
- Des colonnes `stripe_customer_id` et `stripe_subscription_id` existent, mais **aucun code Stripe n’est présent dans le dépôt** : le paiement n’est pas implémenté.
- Un mécanisme `manual_override` permet d’accorder l’accès à la main.
- Tarif, palier et facturation : à renseigner.

## Modules envisagés mais absents

Éléments cités comme pistes par le kit et **non présents** dans le dépôt à ce jour — ce ne sont pas des engagements de périmètre :

- agenda, séances, liste d’attente et rappels : aucune table ni écran ;
- consentements formalisés : aucun objet dédié ;
- échanges avec des interlocuteurs externes et coordination : aucun flux ;
- portail patient ou responsable légal : aucun accès prévu ;
- devis, paiements en ligne, relances : non implémentés.

## Indicateurs de succès

- À renseigner avec une définition mesurable, une source et une fréquence. Le dépôt ne contient aucune instrumentation produit (ni analytics, ni journal d’usage).

## Principes non négociables

- maîtrise clinique par le psychomotricien ;
- confidentialité et isolation des données ;
- traçabilité des contenus sensibles ;
- accessibilité et faible charge de saisie ;
- transparence des automatismes et de l’IA.
