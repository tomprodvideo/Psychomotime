# État courant

Dernière mise à jour : 2026-09-13. Dépôt sur `main`, synchronisé avec `origin/main`.

Ce document ne contient que ce que le dépôt et la base DÉMONTRENT. Ce qui est
supposé est marqué comme tel. Il a été entièrement réécrit : la version
précédente décrivait le produit d'avant la refonte et était devenue trompeuse —
or elle est chargée dans le contexte de chaque session.

## Ce que le produit est aujourd'hui

Une refonte est en cours, lot par lot, sur une base PostgreSQL neuve. **Le
locataire n'est plus le compte : c'est le CABINET** (`practices` +
`practice_members`, cinq rôles). C'est le changement structurant dont tout le
reste découle.

Vingt-cinq migrations (`0000` à `0024`) sont appliquées en production —
projet Supabase `sisummvlowhtfgiatwwf`, vérifié après chaque application.
Depuis `0023`, la vérification ne se contente plus de compter les objets :
**les empreintes des huit fonctions déployées sont comparées une à une à
celles de la base locale éprouvée.** C'est ce contrôle qui a montré, sur cette
migration, que la divergence venait de la base LOCALE — laissée sur une
mutation par le harnais de falsification — et non de la production.

| Lot | Objet | État |
|---|---|---|
| L0 | Socle d'identité, cabinets, rôles, RLS, bascule depuis la v1 | livré |
| L1 | Dossier patient, entourage, parcours de prise en soin | livré |
| L2 | Agenda, séances, présences | livré |
| L3 | Registre d'instruments et règle de cotation unique | partiel — le moteur de bilans reste sur le modèle v1 |
| L5 | Moteur comptable, charges, attestations | livré |
| L7 | Transmissions par lien | livré |
| L8 | Design, accessibilité, performance | en cours — performance faite, cinq manquements WCAG corrigés, socle de composants à faire |
| L4 | Écrits cliniques : note de séance, courrier, synthèse, écrit de fin | 4 des 7 écrits manquants livrés |
| L6, L9 | IA, préparation à la production | à faire |

## Ce qui est solide, et pourquoi on peut le dire

- **L'isolation entre cabinets est éprouvée par des contrôles qui échouent
  quand on la casse.** Douze fichiers SQL, rejoués à chaque `npm run verify`.
  Chaque garde ajoutée est FALSIFIÉE : on la désarme et on vérifie que le
  contrôle échoue. Cette discipline a trouvé, à répétition, des contrôles qui
  validaient leur propre mise en scène.
- **La falsification est devenue un outil, et ses plans sont versionnés.**
  `npm run falsifier supabase/falsifications/<plan>.json` désarme chaque garde
  une par une et exige qu'un contrôle tombe. Il ferme trois pièges que
  l'écriture à la main laissait ouverts : une mutation dont le motif ne
  correspond plus ne prouve rien et est signalée comme telle ; la base est
  reconstruite après coup, sans quoi elle reste sur la dernière mutation ; le
  fichier est restauré même en cas d'erreur. **Cinquante-trois gardes
  démontrées sur `0023`.**
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
- **Les instantanés des quatre documents sont désormais PROUVÉS immuables.**
  La garde existait sur les quatre ; rien ne la démontrait sur trois d'entre
  eux — désarmer la ligne qui protège `snapshot` ne faisait échouer aucun
  contrôle. Trouvé en falsifiant la synthèse, corrigé sur la pièce comptable,
  l'attestation et le courrier au passage.
- **La synthèse de suivi (`0023`) est le premier document dont une moitié est
  pré-remplie.** La ligne est tenue en base : `public.follow_up_facts` relève
  des FAITS — comptes de séances, objectifs tels qu'elle les a posés — et la
  MÊME fonction sert l'écran avant la remise et l'émission qui les fige. Aucune
  phrase d'évolution n'est produite, et l'émission **refuse** tant qu'elle n'a
  rien écrit.

## Vérifications connues

`npm run verify` enchaîne : `lint`, `typecheck`, 134 contrôles unitaires
(20 fichiers), 12 fichiers de contrôle SQL, un contrôle de concurrence sur la
numérotation, le **rejeu complet de la bascule v1 → cible** sur une base
jetable, et les **budgets de performance**.

| Date | Vérification | Résultat |
|---|---|---|
| 2026-09-13 | `npm run verify` | tout passe — 134 contrôles unitaires, 12 fichiers SQL |
| 2026-09-13 | `npm run build` | succès |
| 2026-09-13 | `npm run falsifier` sur `0023`, `0024` et le schéma v1 | 105 gardes, 105 détectées |
| 2026-09-13 | Empreintes des fonctions déployées comparées à la base locale | 15 sur 15 identiques |
| 2026-09-13 | Analyseur de sécurité Supabase après `0023` et `0024` | aucune erreur ; trois avertissements connus |
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

- **Le moteur de bilans est toujours celui de la v1**, clé sur `user_id`, hors
  du modèle « cabinet ». Sa bascule est bloquée par `Q-201` — ce que « validé »
  doit signifier — qui est une décision de la praticienne.

  **Cinq des huit écarts cliniques de `docs/clinical/CLINICAL_SAFETY.md` sont
  corrigés** depuis le 2026-09-12 : le brouillon porte un bandeau qui s'imprime,
  l'âge est calculé à la date de passation, la saisie est enregistrée toutes les
  trente secondes, un bilan ne se détache plus de son dossier sur une frappe, et
  supprimer une section n'orpheline plus son texte. *Cette rubrique affirmait le
  contraire jusqu'au 2026-09-13 ; elle est chargée dans le contexte de chaque
  session et a induit deux analyses en erreur.*

  **Restent ouverts, et aucun ne dépend de `Q-201`** : la légende des scores se
  contredit à la note 7 et à −1 DS (`Q-202`, une question fermée), le
  vocabulaire « zone dite pathologique » figure sur un document remis à des
  familles, la cohérence entre groupe d'âge coché et date de naissance n'est pas
  montrée (`Q-205`), les bilans déjà orphelins sont invisibles et irréparables,
  et l'objet du courriel sortant annonce « bilan psychomoteur » quel que soit
  le type.
- **L'isolation de `public.bilans` est démontrée depuis le 2026-09-13.** Elle
  naît dans le schéma v1, appliqué seulement par la voie `cutover` : la base de
  contrôle courante est bâtie à partir des seules migrations, et la couverture
  RLS générique ne pouvait pas voir une table qui n'y est pas. Sa politique
  était correcte — elle n'avait simplement jamais été falsifiée, dans un dépôt
  où cent gardes l'ont été sur les deux dernières migrations. Les contrôles
  vivent maintenant dans `supabase/cutover/verifications.sql.check`, avec leur
  plan de falsification.
- **Aucun parcours de bout en bout automatisé** (L9), aucun contrôle visuel.
- **Aucune fonction IA n'a été revue** depuis la refonte.
- **Le design system n'existe pas** : 58 lignes de CSS, 108 lignes de
  composants partagés.
- **Aucune durée de conservation n'est tranchée**, pour aucune donnée.
- **Le socle de composants n'existe toujours pas.** Le style de champ est
  redéclaré **33 fois dans 29 fichiers**, en trois variantes divergentes — et
  les plus récentes sont celles des derniers écrans écrits, donc la dérive est
  active. `aria-invalid` n'apparaît **nulle part** : les erreurs de formulaire
  s'affichent en bas, sans lien avec le champ fautif. Le chemin est tracé
  (`Champ`, `SectionDossier`, `Bouton`) et il commence par élargir le contrat
  de retour des actions serveur, qui ne rendent aujourd'hui qu'une chaîne.

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

Appliquer `0023` en production, puis poursuivre les écrits manquants : rang 4
(écrit de fin de prise en soin), rang 5 (écrit pour un tiers non soignant),
rang 6 (notice d'information), rang 7 (projet d'accompagnement imprimable).
Reste ensuite l'accessibilité WCAG 2.2 AA du lot 8, puis L6, et L9 en dernier.
