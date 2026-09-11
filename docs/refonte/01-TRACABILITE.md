# Matrice de traçabilité — audit → exigence → implémentation → test

> Chaque défaut de l'audit et chaque exigence du mandat porte un identifiant stable.
> Une ligne n'est « faite » que si sa colonne **Test** nomme un test qui existe et qui passe.
> Une ligne sans test n'est jamais close.

Colonnes : **Origine** — `AUDIT` (audit fonctionnel du 2026-09-11), `MANDAT` (prompt de refonte),
`ORCH` (constat de l'orchestrateur). **État** — `à faire`, `en cours`, `fait`, `bloqué`, `sans objet`.

---

## A. Défauts critiques à éliminer (régression obligatoire)

| ID | Origine | Constat | Exigence cible | Lot | Implémentation | Test | État |
|---|---|---|---|---|---|---|---|
| A-01 | AUDIT | Aucune récupération ni changement de mot de passe ou d'e-mail | Réinitialisation par e-mail, changement de mot de passe et d'e-mail authentifiés, sessions révocables | L0 | `app/mot-de-passe/`, `app/auth/confirmer/`, `CompteSecuriteCard` | `lib/auth/password.test.mts` (11 tests) + parcours vérifié au navigateur | **fait** |
| A-02 | AUDIT | Changer le mode loyer/rétrocession met l'autre valeur à zéro (champ `disabled` non soumis) | Les deux valeurs coexistent et survivent au changement de mode | L0 | `updateSettings` : champ absent → valeur conservée ; champ présent et vide → 0 | à couvrir par un test serveur au L5 | **fait** |
| A-03 | AUDIT | Un brouillon s'imprime à l'identique d'un document validé, signature comprise | Filigrane obligatoire sur tout document non finalisé ; finalisation explicite, horodatée, attribuée | L4 | — | — | à faire |
| A-04 | AUDIT | L'âge imprimé est celui du jour de l'impression | Âge calculé à la **date de passation**, par passation | L1/L3 | `lib/age.ts` — la date de référence est un paramètre obligatoire | `lib/age.test.mts` — 8 tests | **en cours** — module livré et utilisé dans le dossier ; reste à câbler sur les passations au L3 |
| A-05 | AUDIT | Aucun contrôle entre la tranche d'âge d'un instrument et la date de naissance | Avertissement visible si l'âge à la passation sort de la tranche annoncée ; jamais un blocage silencieux | L3 | — | — | à faire |
| A-06 | AUDIT | NS 7 → orange dans le tableau, vert sur la courbe ; la légende range 7 dans deux bandes | Un score produit la même couleur et le même libellé dans le formulaire, le tableau, le graphique et le PDF | L3 | — | — | à faire |
| A-07 | AUDIT | Un échec d'enregistrement de bilan s'affiche « Enregistré ✓ » | Aucune erreur d'écriture ne peut être rendue comme un succès | L0 | `ecritureReussie` + `.select()` sur chaque mutation ; 9 actions et 6 écrans corrigés | build + parcours vérifiés ; test serveur à ajouter au L1 | **fait** |
| A-08 | AUDIT | Aucune sauvegarde automatique ; tout l'état vit en mémoire du navigateur | Autosauvegarde serveur débouncée et idempotente, état de synchronisation visible, reprise après erreur, protection avant fermeture | L4 | — | — | à faire |
| A-09 | AUDIT | Ré-enregistrer une ancienne facture la retarife aux taux du jour | Les paramètres applicables sont ceux de la date d'émission ; une pièce émise est immuable | L5 | — | — | à faire |
| A-10 | AUDIT | Modifier le nom détache le bilan du patient, sans moyen de le rattacher | Le rattachement est relationnel ; un document orphelin est signalé et rattachable | L1 | Bascule `0003` : identifiants conservés, clés étrangères repointées | `npm run db:cutover` — jointure bilan → patient vérifiée | **en cours** — le lien tient ; la réconciliation d'un bilan orphelin arrive au L3 |
| A-11 | AUDIT | L'abonnement n'est contrôlé que dans 3 pages, aucune server action | Contrôle d'accès dans chaque cas d'usage serveur, pas seulement dans l'UI | L0 | `lib/auth/guard.ts` câblé sur les 21 actions ; lecture autorisée sans abonnement, écriture non | `030_garanties_socle` § 5 | **fait** |
| A-12 | AUDIT | Le loyer mensuel n'entre dans aucune formule | Le loyer est une charge du cabinet et entre dans les agrégats correspondants | L5 | — | — | à faire |
| A-13 | AUDIT | La facture imprime « N° ADELI » (caduc) et omet le RPPS | Identifiants professionnels datés et configurés ; le RPPS figure là où il doit figurer | L5 | — | — | à faire |
| A-14 | AUDIT | PCO réduit à une case qui ajoute « (PCO) » au libellé | Circuit PCO complet : payeur distinct, période, forfait ou événements, tiers payant, retours et rejets | L5 | — | — | à faire |
| A-15 | AUDIT | Les tableaux du bilan sensoriel s'impriment vides | Aucune section vide n'est imprimée ; l'omission est la règle sans exception | L4 | — | — | à faire |
| A-16 | AUDIT | L'ordre de la trame est ignoré pour l'anamnèse et la conclusion | L'ordre configuré est l'ordre de saisie **et** l'ordre d'impression, sans exception | L4 | — | — | à faire |
| A-17 | AUDIT | Aucun lien public visible ni révocable ; aucune consultation tracée | Liens listés, révocables, expirants, journalisés ; jeton stocké haché | L7 | — | — | à faire |
| A-18 | AUDIT | La confirmation d'envoi ne nomme pas l'adresse destinataire | Avant tout envoi : adresse exacte, rôle du destinataire, document, canal | L7 | — | — | à faire |
| A-19 | AUDIT | Deux incohérences dans l'export CSV (loyers, totaux par mois) | Tout export est réconciliable avec les totaux affichés ; test d'égalité | L5 | — | — | à faire |
| A-20 | AUDIT | Le modèle IA est codé en dur | Modèle configurable côté serveur, erreurs compréhensibles, aucune fuite du message brut du fournisseur | L6 | — | — | à faire |
| A-21 | AUDIT | Aucune historisation des bilans ni journalisation des actions | Versions immuables des documents finalisés ; journal des accès et actions sensibles sans contenu clinique | L4/L7 | — | — | à faire |
| A-22 | AUDIT | Le type de bilan est caché dans `content.__type__` | Colonne explicite, indexée, contrainte | L3 | — | — | à faire |
| A-23 | AUDIT | Repli silencieux si une migration manque : l'écriture réussit en perdant des données | Toute migration manquante est une erreur franche, jamais une perte silencieuse | L0 | Replis retirés de `bilans/actions.ts` et `patients/actions.ts` après vérification des colonnes en production | inspection du schéma distant du 2026-09-11 | **fait** |
| A-24 | AUDIT | Aucune pagination ; les listes chargent tout, images comprises | Pagination et recherche serveur ; aucune image ni JSON lourd dans une liste | L1/L8 | `listPatients` — projection minimale, `range`, recherche serveur | — | **en cours** — fait pour les dossiers ; reste bilans et factures |
| A-25 | AUDIT | Les images de bilan sont encodées en base64 dans le JSON | Les fichiers vivent dans Storage, rattachables au patient, bilan, séance ou pièce comptable | L3 | — | — | à faire |
| A-26 | AUDIT | Le suivi des migrations est déclaratif, sans journal | Migrations versionnées, ordonnées, reproductibles depuis zéro | L0 | `supabase/migrations/`, `scripts/db.mjs` | `npm run db:reset` | **fait** |
| A-27 | AUDIT | La liste des champs du lien public existe en double, SQL et TypeScript, sans lien | Contrat unique, ou concordance testée entre les deux | L7 | — | — | à faire |
| A-28 | AUDIT | Le rôle admin repose sur une adresse e-mail codée en dur dans le SQL | Rôle porté par une donnée, pas par une constante | L0 | `platform_admins`, `app.is_platform_admin()` | `030_garanties_socle`, `020_isolation_cabinets` § 5 | **fait** |
| A-29 | AUDIT | Supprimer un patient efface physiquement, mais nom et contenu clinique survivent dans les bilans | Archivage, effacement raisonné, et cohérence de ce qui subsiste | L1 | `archive_patient` / `unarchive_patient` ; aucun bouton de suppression | `040_dossier_patient` §10 | **en cours** — l'archivage remplace la suppression ; l'effacement raisonné relève des droits des personnes |
| A-30 | AUDIT | La période comptable est une cascade de replis ; mois et année peuvent venir de sources différentes | Dates explicites et distinctes : prestation, émission, échéance, rattachement, encaissement | L5 | — | — | à faire |

### A bis. Défauts découverts par les audits de refonte (hors audit initial)

| ID | Origine | Constat | Exigence cible | Lot | Implémentation | Test | État |
|---|---|---|---|---|---|---|---|
| A-31 | ORCH | `round2()` perd un centime sur des montants ordinaires et arrondit de façon incohérente selon l'ordre de grandeur | L'argent est en centimes entiers, les taux en points de base ; arrondi commercial appliqué une seule fois | L0 | `lib/money.ts` | `lib/money.test.mts` — 15 tests, dont la preuve du défaut | **fait** |
| A-32 | ORCH | Une erreur de lecture des abonnements accordait l'accès **et** le rôle d'administration | Le refus est le comportement par défaut ; aucune erreur n'ouvre un accès | L0 | `lib/subscription.ts`, `lib/data.ts` | `030_garanties_socle` § 5 | **fait** |
| A-33 | ORCH | `next@16.2.9` : 1 advisory critique, 6 hautes, dont deux visant l'architecture du produit | Aucune haute ni critique en dépendance de production | L0 | `next@16.3.5` | `npm audit --omit=dev` : 1 modérée restante | **fait** |
| A-34 | ORCH | Le dépôt GitHub est **public** et un compte rendu de bilan y est versionné | Qualification du contenu, puis purge d'historique si réel | — | Fichier retiré du dépôt, `.gitignore` élargi aux PDF | — | **qualifié fictif par l'utilisateur le 2026-09-11** ; retiré du suivi. L'historique le conserve : sans incident, la purge n'est pas justifiée. |
| A-35 | ORCH | Aucun fournisseur de la chaîne n'est certifié HDS ; R1111-9-1 impose le stockage EEE au 2026-09-26 | Architecture compatible, ou périmètre restreint assumé | — | Adhérence Supabase isolée (`app.current_user_id`) pour rendre la bascule peu coûteuse | `010_couverture_rls` § 5 | **décidé le 2026-09-11** : poursuivre sur la stack actuelle, trancher l'hébergement **avant le premier patient réel**. Condition de mise en service, pas de développement. |
| A-36 | ORCH | Le rendu public de facture caste le retour SQL sans repasser par `toPrintable` : élargir la liste SQL seule ne fait échouer aucun test | Contrat unique, ou concordance testée **par le chemin public** avec valeurs sentinelles | L7 | — | — | à faire |
| A-37 | ORCH | Tous les jetons de partage sont sérialisés dans la charge RSC de `/comptabilite` à chaque chargement | Le jeton ne sort jamais vers un composant client ; stocké haché | L7 | — | — | à faire |
| A-38 | ORCH | Le schéma adhère à Supabase par `auth.uid()` dans chaque politique | Un seul point de contact, vérifié par test | L0 | `app.current_user_id()` | `010_couverture_rls` § 5 | **fait** |
| A-39 | ORCH | Trois implémentations concurrentes de la même règle de cotation divergent aux valeurs 4, 7 et 17 ; une teinte signifie « très supérieur » en tableau et « moyenne » sur la courbe | Une échelle porte ses propres bandes, versionnées ; même score → même couleur et même libellé dans les quatre rendus | L3 | — | — | à faire |
| A-40 | ORCH | `has_pco` est une donnée de santé imprimée sur la facture et exportée en clair dans le CSV | Le rattachement à un parcours PCO change le circuit, il ne s'imprime pas sur un document familial | L5 | — | — | à faire |
| A-43 | ORCH | Les privilèges par défaut de Supabase accordent `ALL` sur toute table et fonction de `public` ; un `revoke from public` ne les retire pas | Surface d'API explicite : `REVOKE ALL` puis `GRANT` du strict nécessaire | L0 | `0004`, `0006` | `010_couverture_rls` § 6 ; vérifié en production | **fait** |
| A-44 | ORCH | Les séances n'existaient que comme montant sur une facture : impossible de savoir combien de séances un enfant avait eues | Agenda, issues constatées, comptes par patient | L2 | `appointments`, `SeancesSection` | `050_agenda_seances` | **fait** |
| A-45 | ORCH | Une séance pouvait être « réalisée » avant d'avoir eu lieu — donc attestable | Un rendez-vous futur ne peut pas être marqué honoré | L2 | déclencheur `app.guard_appointment` | `050_agenda_seances` § 1, vérifié en production | **fait** |
| A-42 | ORCH | Mot de passe minimum de 6 caractères, aucune autre contrainte | Au moins 12 caractères, refus des racines les plus essayées, des suites et des mots bâtis sur l'adresse ; le refus dit toujours pourquoi | L0 | `lib/auth/password.ts` | `lib/auth/password.test.mts` — 11 tests | **fait** |
| A-41 | ORCH | La dictée vocale peut transmettre la parole clinique à l'éditeur du navigateur, sans information ni contrat | Information explicite de l'utilisateur, ou retrait de la fonction | L6 | — | — | **décision utilisateur** |

## B. Invariants à préserver (le contraire est une régression)

| ID | Origine | Invariant | Lot | Test | État |
|---|---|---|---|---|---|
| B-01 | AUDIT | Une donnée absente est **omise** du document ; jamais « normal », « RAS », « — » ou « N/A » | L4 | — | à faire |
| B-02 | AUDIT | Les clés de section restent stables au renommage et au déplacement d'une trame | L3 | — | à faire |
| B-03 | AUDIT | Les instruments restent rattachés au domaine dans lequel ils ont servi | L3 | — | à faire |
| B-04 | MANDAT | Trames, modèles et apparence peuvent varier par nature de bilan | L3 | — | à faire |
| B-05 | MANDAT | L'ordre de la trame est aussi l'ordre de saisie et d'impression | L4 | — | à faire |
| B-06 | AUDIT | Blocs libres, modèles de texte, images et dictée restent possibles | L3 | — | à faire |
| B-07 | AUDIT | L'appel IA ne reçoit aucune identité de patient | L6 | — | à faire |
| B-08 | MANDAT | Aucune automatisation n'invente observation, score, date, norme ou diagnostic | L6 | — | à faire |
| B-09 | MANDAT | L'aperçu, l'export et l'impression A4 sont reproductibles | L4 | — | à faire |
| B-10 | AUDIT | Aucune donnée de rétrocession, URSSAF, net ou encaissement n'atteint une facture publique | L7 | — | à faire |
| B-11 | AUDIT | L'e-mail ne porte ni pièce jointe, ni montant, ni nature de l'acte, ni diagnostic | L7 | — | à faire |
| B-12 | AUDIT | Aucune clé privilégiée côté client ; le serveur n'a pas plus d'autorité que l'utilisateur connecté | L0 | — | à faire |
| B-13 | AUDIT | Le stockage de documents : bucket privé, chemin anonymisé, URL signées courtes | L3 | — | à faire |
| B-14 | AUDIT | Les messages de suppression disent honnêtement ce qui est conservé et ce qui est perdu | L1 | — | à faire |
| B-15 | AUDIT | Aucun analytics, aucune télémétrie tierce ne capte de contenu clinique | L8 | — | à faire |
| B-16 | AUDIT | Ouvrir puis annuler un formulaire de facture ne consomme pas de numéro | L5 | — | à faire |
| B-17 | AUDIT | La numérotation est atomique : deux créations simultanées ne peuvent pas obtenir le même numéro | L5 | — | à faire |

## C. Exigences structurantes du mandat (fonctions absentes)

| ID | Origine | Exigence | Lot | État |
|---|---|---|---|---|
| C-01 | MANDAT | Entité `practice` (cabinet) distincte de l'utilisateur : adhésions, rôles, praticiens, entité juridique, lieux d'exercice, paramètres datés | L0 | **fait** — `0001_socle_identite.sql`, 11 tables |
| C-02 | MANDAT | RLS refus par défaut sur toutes les tables et liaisons ; tests négatifs inter-cabinets, y compris par UUID deviné | L0 | **fait** — `010_couverture_rls`, `020_isolation_cabinets` |
| C-03 | MANDAT | Plusieurs responsables légaux ; rôles distincts responsable légal / destinataire / payeur / assuré / prescripteur / adresseur | L1 | **fait** — `contacts` + `patient_contacts` datés, `040_dossier_patient` §1-4 |
| C-04 | MANDAT | Parcours de prise en soin : prescription, demande, objectifs, statut actif/en pause/terminé, archivage | L1 | **fait** — `care_pathways`, `care_objectives`, `archive_patient` |
| C-05 | MANDAT | Agenda, rendez-vous, séances, présence/absence/annulation, liste d'attente | L2 | **fait** — `appointments`, vue `realised_sessions`, liste d'attente portée par le parcours ; `050_agenda_seances` — 9 scénarios |
| C-06 | MANDAT | Moteur de bilans configurable : nature × population × contexte × domaines × instruments × destinataires | L3 | à faire |
| C-07 | MANDAT | Registre versionné des instruments avec statut de licence ; aucun contenu éditeur dans le code | L3 | à faire |
| C-08 | MANDAT | Passations multiples par bilan, chacune datée, avec son âge calculé | L3 | à faire |
| C-09 | MANDAT | Comparaison bilan initial / réévaluation, avec signalement des changements de version et de conditions | L4 | à faire |
| C-10 | MANDAT | Versions de comptes rendus immuables, addendum, restauration | L4 | à faire |
| C-11 | MANDAT | Catalogue de prestations historisé ; devis de bilan, de séances, mixte, forfait | L5 | à faire |
| C-12 | MANDAT | Factures multi-lignes, avoirs, paiements partiels et groupés, trop-perçus, remboursements, relances | L5 | à faire |
| C-13 | MANDAT | Dépenses ponctuelles et récurrentes, justificatifs, rapprochement | L5 | à faire |
| C-14 | MANDAT | Attestation de présence (séances réalisées, aucun contenu clinique) et attestation de paiement (paiements réellement affectés) | L5 | **en cours** — la source unique existe : vue `realised_sessions`, qui exclut par construction les rendez-vous à venir, annulés, non qualifiés et sans patient |
| C-15 | MANDAT | Exports réconciliables CSV/XLSX/PDF pour l'expert-comptable | L5 | à faire |
| C-16 | MANDAT | Configuration fiscale datée : micro-BNC, EI hors micro, société ; TVA par ligne ; aucun taux en dur | L5 | à faire |
| C-17 | MANDAT | Assistance IA : sélection explicite, désidentification, diff avant/après, acceptation paragraphe par paragraphe, jamais de finalisation | L6 | à faire |
| C-18 | MANDAT | Résistance aux instructions malveillantes contenues dans les notes patient | L6 | à faire |
| C-19 | MANDAT | Transmission par lien sécurisé : jeton haché, durée courte, révocation, rate limiting, `no-store`, `no-referrer`, non indexable | L7 | à faire |
| C-20 | MANDAT | Journalisation des accès, créations, modifications, exports et transmissions, sans contenu clinique | L7 | à faire |
| C-21 | MANDAT | Design system complet, WCAG 2.2 AA, impression fidèle à l'aperçu | L8 | à faire |
| C-22 | MANDAT | Cartographie des données personnelles, modèle de menace, rapport RGPD/HDS distinguant preuves, inconnues et blocages | L9 | à faire |
| C-23 | MANDAT | Seeds entièrement fictifs, dont un profil micro-BNC et un profil société | L0 | **fait** — `supabase/seed/0001_cabinets_fictifs.sql` |
| C-24 | MANDAT | Parcours E2E des 12 scénarios critiques du mandat | L9 | à faire |

## D. Points exigeant une validation humaine

Ces lignes ne seront **jamais** closes par du code. Elles restent ouvertes jusqu'à décision d'une personne compétente.

| ID | Question | Responsable |
|---|---|---|
| D-01 | Seuils et vocabulaire psychométriques qui font foi sur un document remis à une famille | psychomotricien en exercice |
| D-02 | Ce que doit signifier « finalisé » : verrouillage, version corrigée, addendum | psychomotricien en exercice |
| D-03 | Destinataires légitimes d'un compte rendu dans chaque circuit | psychomotricien + DPO |
| D-04 | Rattachement comptable : période de facturation ou date de réalisation | expert-comptable |
| D-05 | Qualification TVA des activités accessoires | expert-comptable |
| D-06 | Durées de conservation par type de donnée | DPO + expert-comptable |
| D-07 | Couverture HDS de la chaîne technique | juriste + fournisseurs |
| D-08 | Licences des instruments psychométriques intégrés | éditeurs + juriste |
| D-09 | Base légale de chaque traitement | DPO |
| D-10 | Nécessité d'une AIPD | DPO |
