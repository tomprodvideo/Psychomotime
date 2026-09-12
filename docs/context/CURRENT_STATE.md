# État courant

Dernière mise à jour : 2026-09-12. Dépôt sur `main`, synchronisé avec `origin/main`.

Ce document ne contient que ce que le dépôt et la base DÉMONTRENT. Ce qui est
supposé est marqué comme tel. Il a été entièrement réécrit : la version
précédente décrivait le produit d'avant la refonte et était devenue trompeuse —
or elle est chargée dans le contexte de chaque session.

## Ce que le produit est aujourd'hui

Une refonte est en cours, lot par lot, sur une base PostgreSQL neuve. **Le
locataire n'est plus le compte : c'est le CABINET** (`practices` +
`practice_members`, cinq rôles). C'est le changement structurant dont tout le
reste découle.

Vingt migrations (`0000` à `0020`) sont appliquées en production — projet
Supabase `sisummvlowhtfgiatwwf`, vérifié après chaque application.

| Lot | Objet | État |
|---|---|---|
| L0 | Socle d'identité, cabinets, rôles, RLS, bascule depuis la v1 | livré |
| L1 | Dossier patient, entourage, parcours de prise en soin | livré |
| L2 | Agenda, séances, présences | livré |
| L3 | Registre d'instruments et règle de cotation unique | partiel — le moteur de bilans reste sur le modèle v1 |
| L5 | Moteur comptable, charges, attestations | livré |
| L7 | Transmissions par lien | livré |
| L8 | Design, accessibilité, performance | en cours — performance faite, accessibilité en audit |
| L4, L6, L9 | Documents, IA, préparation à la production | à faire |

## Ce qui est solide, et pourquoi on peut le dire

- **L'isolation entre cabinets est éprouvée par des contrôles qui échouent
  quand on la casse.** Dix fichiers SQL, rejoués à chaque `npm run verify`.
  Chaque garde ajoutée est FALSIFIÉE : on la désarme et on vérifie que le
  contrôle échoue. Cette discipline a trouvé, à répétition, des contrôles qui
  validaient leur propre mise en scène.
- **Les montants sont des entiers de centimes, les taux des points de base.**
  Aucun flottant monétaire dans le schéma.
- **Une pièce émise est immuable**, s'annule par un avoir, et son statut ne se
  pose plus à la main : il se constate (`0018`).
- **Les documents figent leur contenu à l'émission.** Une pièce se relit avec
  les mentions de son époque.
- **Le partage par lien ne stocke jamais le jeton**, seulement son empreinte.
  Révocable, tracé, borné dans le temps par la base.
- **Les lectures sont cloisonnées à coût constant** (`0019`) : l'appartenance
  est calculée une fois par requête, plus une fois par ligne.

## Vérifications connues

`npm run verify` enchaîne : `lint`, `typecheck`, 116 contrôles unitaires
(19 fichiers), 10 fichiers de contrôle SQL, un contrôle de concurrence sur la
numérotation, le **rejeu complet de la bascule v1 → cible** sur une base
jetable, et les **budgets de performance**.

| Date | Vérification | Résultat |
|---|---|---|
| 2026-09-12 | `npm run verify` | tout passe |
| 2026-09-12 | `npm run build` | succès |
| 2026-09-12 | Budgets à 400 puis 2 000 dossiers, sous RLS | aucune requête d'écran au-dessus de 1 ms |
| 2026-09-12 | Analyseur de sécurité Supabase | aucune erreur ; trois avertissements connus et assumés |
| 2026-09-12 | Page publique en production, sans compte | refus neutre d'un jeton inconnu, quatre en-têtes de protection posés |
| 2026-09-12 | `/documents` sans session, en production | redirige vers `/login` |

**Le rejeu de la bascule a trouvé, avant la production, des défauts que la base
de développement ne pouvait pas voir** : un changement de type de retour
impossible, une réécriture de politiques butant sur les tables v1. Il vaut la
peine de le garder.

## Ce qui n'est pas encore fait, et qu'il ne faut pas supposer acquis

- **Le moteur de bilans est toujours celui de la v1**, clé sur `user_id`. Les
  écarts cliniques documentés dans `docs/clinical/CLINICAL_SAFETY.md` — dont un
  brouillon qui s'imprime à l'identique d'un document validé — sont intacts.
- **Aucun parcours de bout en bout automatisé** (L9), aucun contrôle visuel.
- **Aucune fonction IA n'a été revue** depuis la refonte.
- **Le design system n'existe pas** : 58 lignes de CSS, 108 lignes de
  composants partagés.
- **Aucune durée de conservation n'est tranchée**, pour aucune donnée.

## Risques ouverts

Le registre complet est dans `docs/refonte/00-PILOTAGE.md`. Les deux qui
appellent une décision du propriétaire, et qu'aucun travail technique ne peut
lever :

1. **R-01 — aucun des quatre fournisseurs n'est certifié hébergeur de données
   de santé**, et l'échéance réglementaire citée dans le dossier de recherche
   est proche. Décision utilisateur.
2. **R-02 — un compte rendu de bilan reste dans l'historique Git d'un dépôt
   public.** Le retirer de l'arbre n'a pas suffi : le blob demeure accessible.
   L'effacer exigerait de réécrire l'historique, donc un push forcé, que les
   règles du dépôt interdisent. Qualification par le propriétaire requise.

## Prochaine action

Terminer le lot 8 : accessibilité WCAG 2.2 AA et socle visuel. Puis L4 et L6,
et L9 en dernier.
