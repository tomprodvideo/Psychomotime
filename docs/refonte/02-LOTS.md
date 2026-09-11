# Plan de lots verticaux

> Un lot est vertical : base + serveur + interface + tests + documentation.
> Un lot n'est terminé que si ses critères d'acceptation sont **vérifiés**, pas déclarés.
> Les identifiants entre crochets renvoient à `01-TRACABILITE.md`.

---

## L0 — Socle : cabinet, isolation, migrations, harnais de tests

**Pourquoi en premier.** Tout le reste repose sur l'identité du locataire et sur une base
reconstructible. Introduire le cabinet après coup obligerait à réécrire chaque table et
chaque politique une seconde fois.

**Contenu**
1. Baseline de migrations numérotées et reproductibles depuis zéro `[A-26]`.
2. Schéma d'identité : `practices`, `practice_members`, `practitioner_profiles`,
   `legal_entities`, `practice_locations`, `practice_settings` datés `[C-01]`.
3. RLS refus par défaut sur toutes les tables, isolation par appartenance active `[C-02]`.
4. Rôle d'administration porté par une donnée, plus par une constante SQL `[A-28]`.
5. Harnais de test SQL local sur PostgreSQL 16 avec stub `auth` `[D-07 ADR]`.
6. Tests négatifs d'isolation, y compris par UUID deviné `[C-02]`.
7. Récupération et changement de mot de passe et d'e-mail `[A-01]`.
8. Garde serveur unique : session + appartenance + abonnement, appliquée à chaque cas
   d'usage, pas aux pages `[A-11]`.
9. Aucune écriture ne peut rendre une erreur comme un succès `[A-07]`, aucun repli
   silencieux sur colonne manquante `[A-23]`.
10. Seeds entièrement fictifs : deux cabinets, profil micro-BNC et profil société `[C-23]`.

**Critères d'acceptation**
- `npm run db:reset` reconstruit la base locale de zéro et charge les seeds, sans erreur.
- Un membre du cabinet A ne peut lire ni écrire aucune ligne du cabinet B, sur **chaque**
  table, y compris en fournissant l'UUID exact d'une ligne de B. Prouvé par test.
- Une table sans politique RLS fait échouer un test de couverture.
- `npm run lint`, `npm run typecheck` et `npm test` passent.

---

## L1 — Dossier patient, entourage et parcours de soin

**Contenu.** `patients`, `contacts`, `patient_contacts` (rôles multiples et datés),
responsables légaux multiples, prescripteur, adresseur, payeur, destinataires `[C-03]` ;
`care_pathways` avec demande, prescription, objectifs, statut et archivage `[C-04]` ;
rattachement relationnel des documents `[A-10]` ; archivage et effacement raisonné `[A-29]` ;
messages de suppression honnêtes `[B-14]` ; recherche, filtres, détection de doublons.

**Critères.** Un enfant avec deux responsables légaux à deux adresses ; un payeur qui n'est
ni le patient ni un responsable ; un document jamais orphelin ; un patient archivé absent
des listes actives mais accessible en consultation.

---

## L2 — Agenda, séances, présences, objectifs

**Contenu.** `appointments`, `sessions`, présence/absence/annulation avec motif,
liste d'attente, notes de suivi datées et attribuées, objectifs réévalués `[C-05]`.
Chronologie unifiée du patient.

**Critères.** Une séance réalisée est la seule source possible d'une attestation de présence.
Une absence non facturable ne produit aucune ligne de facture.

---

## L3 — Moteur de bilans configurable et registre d'instruments

**Contenu.** Catalogue des natures de documents, versions de schémas et de trames `[C-06]` ;
domaines activables, aucun obligatoire ; anamnèse adaptative ; `instruments` versionnés avec
statut de licence `[C-07]` ; extraction hors du code de tout contenu éditeur `[R-02]` ;
passations multiples datées avec âge calculé à la passation `[A-04, C-08]` ; contrôle de
tranche d'âge `[A-05]` ; échelles portant leurs propres bandes et leur vocabulaire `[A-06]` ;
type en colonne contrainte `[A-22]` ; fichiers dans Storage `[A-25]` ; clés de section stables
`[B-02]` ; instruments rattachés au domaine `[B-03]`.

**Critères.** Un même score produit la même couleur et le même libellé dans les quatre rendus.
Un bilan à trois passations affiche trois âges corrects. Aucun intitulé d'épreuve d'un test
sous licence ne subsiste dans le code.

---

## L4 — Composition documentaire, statuts, versions, exports

**Contenu.** Composition **déterministe** : n'assemble que des faits saisis ou validés.
Omission stricte des données absentes `[B-01]` ; ordre de trame respecté sans exception
`[A-16, B-05]` ; filigrane de brouillon `[A-03]` ; finalisation explicite, horodatée, attribuée,
créant un instantané immuable `[C-10]` ; addendum et versions ; autosauvegarde débouncée et
idempotente avec verrou optimiste `[A-08]` ; aucune section vide imprimée `[A-15]` ;
reproductibilité de l'aperçu, de l'export et de l'impression `[B-09]` ; comparaison de deux
bilans `[C-09]`.

**Critères.** Un PDF finalisé reste identique après changement de trame ou de paramètres du
cabinet. Un brouillon ne peut pas être confondu avec un document validé.

---

## L5 — Devis, factures, avoirs, paiements, attestations, PCO

**Contenu.** Arithmétique en centimes entiers `[D-05]` ; configuration fiscale datée
`[C-16]` ; catalogue de prestations historisé et devis `[C-11]` ; factures multi-lignes,
numérotation atomique `[B-16, B-17]`, instantané immuable à l'émission `[A-09]`, dates
distinctes `[A-30]` ; avoirs, paiements partiels et groupés, relances `[C-12]` ; dépenses
`[C-13]` ; loyer intégré aux agrégats `[A-12]` ; coexistence loyer/rétrocession `[A-02]` ;
identifiants professionnels datés `[A-13]` ; circuit PCO complet `[A-14]` ; attestations
`[C-14]` ; exports réconciliables `[A-19, C-15]`.

**Critères.** La somme des lignes d'un export retombe exactement sur le récapitulatif.
Cent créations simultanées produisent cent numéros distincts et continus.

---

## L6 — Assistance IA encadrée

**Contenu.** Séparation stricte composition / assistance `[D-10]` ; sélection explicite et
désidentification `[C-17]` ; notes traitées comme données, jamais comme instructions `[C-18]` ;
diff avant/après, acceptation paragraphe par paragraphe ; conservation du texte source ;
validation renforcée sur analyse, diagnostic psychomoteur, indications et conclusion ;
modèle configurable côté serveur `[A-20]` ; aucune identité transmise `[B-07]` ;
aucune invention `[B-08]`.

**Critères.** Un jeu de notes contenant une instruction malveillante n'altère pas le
comportement. Aucune suggestion ne peut finaliser, signer ou transmettre.

---

## L7 — Transmissions, liens sécurisés, journalisation

**Contenu.** Jeton haché, durée courte, révocation, rate limiting, `no-store`,
`no-referrer`, non indexable `[C-19, A-17]` ; destinataire affiché avant envoi `[A-18]` ;
e-mail neutre `[B-11]` ; invariant de la facture publique sous contrat unique testé
`[B-10, A-27]` ; journal des accès et actions sensibles `[C-20, A-21]`.

---

## L8 — Design system, accessibilité, performance

**Contenu.** Tokens, composants, états, impression `[C-21]` ; navigation cible ;
WCAG 2.2 AA ; pagination et recherche serveur `[A-24]` ; index composites ; projections SQL
minimales ; suppression des N+1 ; budgets de performance sur jeu synthétique volumineux.

---

## L9 — Préparation à la production

**Contenu.** 12 parcours E2E du mandat `[C-24]` ; tests visuels ; cartographie des données
personnelles et modèle de menace `[C-22]` ; rapport RGPD/HDS séparant preuves, inconnues et
blocages ; guides développeur, déploiement et utilisateur ; liste des validations externes ;
rapport final de préparation à la production, sans affirmation trompeuse.

---

## Ordre et dépendances

```
L0 ──┬─> L1 ──┬─> L2 ──┐
     │        │        ├─> L5 ──┐
     │        └─> L3 ──┴─> L4 ──┼─> L7 ──> L9
     │                   └─> L6 ┘
     └─────────────────> L8 (transverse, appliqué à chaque lot livré)
```

L8 n'est pas un lot terminal : le design system est posé en L0 et appliqué à chaque écran
livré. La ligne L8 du tableau ne concerne que l'audit final d'accessibilité et de performance.
