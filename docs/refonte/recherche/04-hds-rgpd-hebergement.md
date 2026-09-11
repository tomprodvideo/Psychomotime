# Hébergement, HDS et RGPD — audit de la chaîne technique

**Date :** 2026-09-11 · **Mode :** lecture seule · **Base :** `main` @ `d8af516` + socle `0001`
**Toutes les URL ci-dessous ont été consultées le 2026-09-11.**

> Ce document ne conclut NI à la conformité RGPD, NI à la conformité HDS.
> Il établit des faits techniques, cite des sources primaires datées, et isole ce
> qui relève d'une décision juridique humaine. Une revue de code ne produit pas
> une conformité.

---

## 1. Flux sortants

| # | Destination | Donnée de santé ? | Statut |
|---|---|---|---|
| S-1 | **Vercel** — rendu serveur, Server Actions, génération PDF | **Oui, intégrale** | actif |
| S-2 | **Supabase** — PostgreSQL, Auth, Storage | **Oui, intégrale** | actif |
| S-3 | **Anthropic** — API, reformulation | **Oui, texte clinique libre** | actif |
| S-4 | **Resend** — e-mail | Non, mais **clé d'accès** à une donnée de santé | à confirmer en production |
| S-5 | **Navigateur sans compte** — `/facture/<jeton>` | Nom, adresse, nature de l'acte | actif |
| S-6 | Poste local — impression, PDF, export CSV | **Oui** | actif, hors traçabilité |
| S-7 | Éditeur du navigateur — dictée Web Speech | **Parole clinique** | actif, **non maîtrisé** |

### S-1 Vercel — la région n'est pas configurée [VÉRIFIÉ]

Le dépôt ne contient **ni `vercel.json`, ni `preferredRegion`, ni `export const runtime`**
(recherche exhaustive sur `app/` et `lib/`, zéro résultat). Or Vercel documente :
« Vercel Functions default to running in the `iad1` (Washington, D.C., USA) region »
(<https://vercel.com/docs/regions>). La liste de bascule place quatre régions
nord-américaines avant la première région européenne.

`lib/invoicePdf.tsx` rend le PDF **côté serveur** (`renderToBuffer`), appelé par
`app/facture/[token]/pdf/route.ts` : le serveur du front **traite** du contenu, il ne
route pas. Sauf réglage fait dans l'interface Vercel — non vérifiable depuis le dépôt —
les Server Actions qui manipulent bilans et fiches patients s'exécutent aux États-Unis.
`cdg1` (Paris) et `fra1` (Francfort) existent et ne sont pas sélectionnées.

Sauvegardes Vercel : toutes les 2 h, 30 jours, **non accessibles au client**.
Transferts déclarés : « Vercel may transfer data to and in the United States and
anywhere else in the world » (<https://vercel.com/docs/security/compliance>).

### S-2 Supabase [VÉRIFIÉ]

Projet unique, région **`eu-west-1` (Irlande)**. Trois clients, tous sur la clé publique ;
aucune occurrence de `service_role` dans le dépôt. L'isolation repose entièrement sur la RLS.

### S-3 Anthropic — aucune région européenne n'existe [SOURCE]

Contenu transmis (`app/(app)/bilans/ai-actions.ts`) : titre de section + **texte intégral
de la section**. Aucun identifiant direct n'est passé — abstention délibérée, à préserver.
Mais le texte est de la rédaction clinique libre : prénom, âge, école y figurent
couramment, et la consigne système impose « Conserve toutes les données factuelles » —
elle **préserve** les identifiants au lieu de les neutraliser.

- `inference_geo` n'accepte que `"global"` (défaut) ou `"us"`. **Aucune valeur européenne.**
- « Workspace geo: Currently, "us" is the only available workspace geo » — **stockage aux États-Unis**.
  <https://platform.claude.com/docs/en/manage-claude/data-residency>
- Rétention : 30 jours par défaut ; **jusqu'à 2 ans** si signalé par les systèmes de sûreté.
  <https://platform.claude.com/docs/en/manage-claude/api-and-data-retention>
- Entraînement : non par défaut sur les produits commerciaux.
  <https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training>
- ZDR disponible par accord commercial. La politique « Covered Models » qui impose
  30 jours même sous ZDR ne vise pas `claude-opus-4-8` à la date de consultation.
  <https://privacy.claude.com/en/articles/15425996-data-retention-practices-for-covered-models>

Le paramètre `inference_geo` ne résout pas le problème : il ne choisit qu'entre
« monde » et « États-Unis ».

### S-4 Resend [VÉRIFIÉ + SOURCE]

`lib/email.ts` refuse l'envoi sans `RESEND_API_KEY` et `INVOICE_FROM_EMAIL` ; ces deux
variables **ne sont pas dans `.env.local`**. Le flux est inactif en local ; son état en
production dépend de variables Vercel, que le dépôt ne peut pas attester.

Le message ne porte **ni pièce jointe, ni nom de patient, ni nature de l'acte** — bon
arbitrage. Mais il contient **un jeton d'accès en clair** : le prestataire détient une
clé fonctionnelle vers une donnée de santé pendant sa rétention de **30 jours**.

« Resend stores all customer data in the United States », et « there is no setting today
that moves stored data to the EU » (<https://resend.com/security/gdpr>). DPA article 28
pré-signé, CCT modules 2 et 3, adhésion au EU-U.S. Data Privacy Framework.

### S-7 Dictée vocale — le flux le plus discret et le moins maîtrisé

`app/(app)/bilans/[id]/useDictation.ts` utilise `window.SpeechRecognition`. La
spécification ne garantit pas un traitement local : selon le navigateur, **l'audio d'une
passation clinique peut partir chez l'éditeur du navigateur**, sous-traitant de fait, non
identifié, non contractualisé, et l'utilisateur n'en est pas informé.

---

## 2. Champ d'application HDS

### 2.1 Le texte [SOURCE]

**Article L1111-8 I du CSP**, en vigueur depuis le 2025-07-01
(<https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049577902>) :

> « Toute personne qui héberge des données de santé à caractère personnel recueillies à
> l'occasion d'activités de prévention, de diagnostic, de soins ou de suivi social et
> médico-social, **pour le compte de personnes physiques ou morales à l'origine de la
> production ou du recueil de ces données** […] réalise cet hébergement dans les
> conditions prévues au présent article. »

L'article impose aussi : information préalable de la personne prise en charge sauf
opposition légitime, **contrat** de prestation (I), **certificat de conformité** pour
l'hébergement numérique (II), usage limité à l'hébergement, **restitution sans copie** en
fin de prestation, secret professionnel (V).

### 2.2 Le critère décisif : « pour le compte de »

- Un psychomotricien qui conserve ses dossiers **sur son poste** héberge ses propres
  données. **Hors champ.**
- Un éditeur SaaS qui conserve les dossiers **sur son infrastructure**, pour le compte du
  professionnel qui les a produits. **Dans le champ.**

Psychomotime est dans le second cas. Le psychomotricien est un auxiliaire médical
(CSP, livre III de la partie IV, art. L4332-1 et suivants). **Confiance : établie.**

### 2.3 Les six activités certifiables [SOURCE]

**Article R1111-9 du CSP**, en vigueur depuis le 2026-03-27
(<https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053720790/2026-04-25>) :
1. sites physiques — 2. infrastructure matérielle — 3. infrastructure virtuelle —
4. plateforme d'hébergement d'applications — 5. **administration et exploitation du SI** —
6. **sauvegarde**, y compris archivage électronique.

⚠️ **Point à ne pas propager comme un fait.** L'ANS a annoncé une modification visant à
retirer l'activité 5 du périmètre (<https://esante.gouv.fr/actualites/modification-du-perimetre-dactivite-hds>).
**Cette modification n'a pas eu lieu.** Le décret n° 2026-209 du 24 mars 2026 a modifié
R1111-9 en **conservant le 5°**. Vérifié sur le texte consolidé au 2026-09-11. Toute
analyse fondée sur le retrait de l'activité 5 serait fausse aujourd'hui.

### 2.4 L'échéance du 26 septembre 2026 [SOURCE]

**Décret n° 2026-209 du 24 mars 2026** (<https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053717250>)
crée l'**article R1111-9-1 du CSP**, en vigueur le **2026-09-26**
(<https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053720788/2026-09-26>) :

> « Lorsque l'activité d'hébergement de données de santé à caractère personnel sur support
> numérique […] donne lieu à un stockage de ces données, il est mis en œuvre
> **exclusivement sur le territoire d'un État membre de l'Union européenne ou partie à
> l'accord sur l'Espace économique européen**. »

R1111-11 modifié impose en outre d'informer le client des droits des personnes, des
transferts et accès distants depuis des pays tiers, des **législations extra-européennes**
susceptibles d'imposer un accès, des mesures d'atténuation et des **risques résiduels**,
et de publier une **cartographie des transferts** tenue à jour.

Référentiel de certification **v2**, arrêté du 26 avril 2024, obligatoire depuis le
2024-11-16 (<https://esante.gouv.fr/sites/default/files/media_entity/documents/referentiel_certification_hds---fr--v2.pdf>).

---

## 3. Couverture fournisseur par fournisseur

| Fournisseur | HDS | DPA art. 28 | Région des données | Verdict |
|---|---|---|---|---|
| **Supabase** | **Non certifié** — HDS n'est mentionné nulle part | Oui, click-through, CCT. Entité **Supabase Pte. Ltd, Singapour** | `eu-west-1` Irlande (Paris `eu-west-3` existe) | **Blocage** |
| **Vercel** | **Non certifié** | Oui, CCT + UK Addendum, certifié EU-U.S. DPF | **Défaut `iad1`, Washington D.C.** | **Blocage** |
| **Anthropic** | **Non certifié** | Oui, CCT, incorporé aux Commercial Terms | **États-Unis, sans option EEE** | **Blocage** |
| **Resend** | **Non certifié** | Oui, **pré-signé pour tout compte**, CCT + DPF | **États-Unis, sans option EEE** | **Risque élevé**, qualification à instruire |

Sources : <https://supabase.com/security>, <https://supabase.com/legal/dpa>,
<https://vercel.com/docs/security/compliance>, <https://vercel.com/legal/dpa>,
<https://platform.claude.com/docs/en/manage-claude/data-residency>, <https://resend.com/security/gdpr>.

> **Aucun des quatre fournisseurs de la chaîne n'est certifié hébergeur de données de
> santé. La chaîne actuelle ne peut pas accueillir de données de santé réelles.**
> Ce n'est pas une réserve de conformité : c'est un blocage de mise en production.

Le fait F6 du pilotage — données factices, aucun client réel — signifie que ce blocage est
**pris à temps**. Il doit être traité avant le premier patient réel, pas après.

---

## 4. Architectures compatibles

Aucun des trois hébergeurs ne publie de tarif HDS : les ordres de grandeur exigent un devis.

### Option A — Clever Cloud, PaaS certifié sur les 6 activités *(recommandée)*

Hébergeur français, certificat **FR094504**, Bureau Veritas Certification (accrédité
COFRAC), délivré le 2024-12-20, valide jusqu'au 2027-12-19, référentiel v2. Régions
certifiées : Paris (TH2, nLighten), Gravelines, Roubaix.
<https://www.clever.cloud/health-data-hosting/>

Le périmètre couvre les runtimes (dont Node.js) **et PostgreSQL managé**. C'est le seul
des trois qui couvre les activités 5 et 6, donc celui qui réduit le plus ce que l'éditeur
devrait démontrer en propre.

**Ce qu'on perd :** tout Supabase — Auth, Storage, client `@supabase/ssr`. L'authentification
est à réimplémenter ; la RLS est à conduire à la main (rôles, `set_config('request.jwt.claims')`,
politiques). **Le socle `0001` est du PostgreSQL standard et reste largement portable** :
ses seules adhérences sont `auth.users` et `auth.uid()`.
**Effort : élevé, borné, payé une fois.** Ordre de grandeur : quelques centaines d'euros par mois.

### Option B — Scaleway ou OVHcloud, IaaS certifié

**Scaleway** : certifié depuis juillet 2024 sur les activités **1 à 4** (Instances, Object
Storage, Block Storage, Bare Metal, VPC). Les bases managées ne sont pas clairement dans
le périmètre — **à faire confirmer par écrit, c'est déterminant.**
<https://www.scaleway.com/fr/security-and-compliance/hds/>

**OVHcloud** : certifié depuis 2019, bases managées incluses. **Trois conditions
cumulatives** : support **Business ou Enterprise** obligatoire, acceptation du *Healthcare
Addendum*, **activation de l'option HDS sur chaque service**.
<https://www.ovhcloud.com/fr/compliance/hds/>

Sur un IaaS certifié 1 à 4 seulement, **l'éditeur exerce de fait les activités 5 et 6**.
**Effort : très élevé.** Probablement le plus mauvais rapport effort/bénéfice pour un praticien seul.

### Option C — Supabase auto-hébergé sur substrat certifié

Conserve la surface d'API (GoTrue, PostgREST, Storage, Realtime). **Migration la moins
invasive pour le code** : `@supabase/ssr`, les trois clients, la RLS et `auth.uid()`
continuent de fonctionner ; le socle `0001` est préservé intégralement.
**Ce qu'on perd :** le managé. Mises à jour, sauvegardes, PITR, supervision et correctifs
deviennent une charge permanente pour une seule personne.
**Effort de migration moyen, effort d'exploitation durable élevé.**

**Dans les trois options, les flux Anthropic et Resend restent à traiter séparément :**
aucun hébergeur certifié ne les couvre. Ce sont des décisions produit distinctes.

---

## 5. AIPD

**Référentiel applicable :** délibération CNIL n° 2020-081 du 18 juin 2020, gestion des
cabinets médicaux et paramédicaux (<https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000042158211>).
Il vise les professionnels de santé libéraux et remplace la norme simplifiée NS-50.

Il ne rend l'AIPD nécessaire que pour les cabinets de groupe partageant un SI commun
**au-delà de 10 000 patients par an**. La délibération n° 2019-118 du 12 septembre 2019
(liste des traitements pour lesquels une AIPD **n'est pas requise**) vise expressément les
traitements de santé « par un professionnel de santé exerçant à titre individuel ».
La délibération n° 2018-327 (AIPD **requise**) vise les **établissements**, pas un cabinet libéral.

**Conclusion nuancée : l'AIPD n'apparaît pas obligatoire pour le traitement de base.**
Trois réserves qui peuvent inverser la réponse :

1. Les deux listes sont **non exhaustives** ; l'obligation de principe reste l'article 35.1.
   L'exemption vise le traitement **classique** de prise en charge — pas un SaaS qui
   transmet du texte clinique à une IA générative aux États-Unis et publie des documents
   nominatifs derrière un jeton porteur.
2. Le produit **sort du périmètre** du référentiel sur trois points : transmission hors UE,
   mise à disposition sans authentification, reformulation automatisée non tracée. Le
   **cumul de critères** WP248 — données sensibles, personnes vulnérables (mineurs), usage
   innovant — est précisément le déclencheur d'une AIPD.
3. **Le traitement de l'éditeur est distinct de celui du praticien** : l'exemption
   bénéficie au professionnel de santé, pas à l'éditeur pour ses propres finalités.

**[VALIDATION HUMAINE] — DPO.** Une AIPD est fortement recommandée, et probablement
requise dès lors que la fonction IA et le lien public sont maintenus.

---

## 6. Registre des traitements

Aucune durée de conservation n'est implémentée nulle part : recherche exhaustive de
`retention|purge|archiv|cron|anonymis|conservation` sur `app/`, `lib/`, `components/`,
`supabase/` → **zéro occurrence**, ni dans l'ancien schéma ni dans le socle `0001`.

| # | Traitement | Finalité | Données | Destinataires | Conservation |
|---|---|---|---|---|---|
| T-1 | Dossier patient | Prise en charge | Identité, naissance, coordonnées, notes, `guardian` | Praticien, Supabase, Vercel | 5 ans actif + 15 ans archivage (réf. 2020-081) — **[à instruire]**, 0 mise en œuvre |
| T-2 | Bilans et comptes rendus | Évaluation | `content` jsonb : anamnèse, observations, scores, conclusions | idem | idem — **[à instruire]** ; **aucune version, aucun historique** |
| T-3 | Documents déposés | Conservation de pièces | Fichiers non contraints, 10 Mo max | idem | **[à instruire]** |
| T-4 | Facturation | Obligation comptable | Nom, adresse, montants, dates, PCO | idem | **10 ans** — **[à instruire]**, à articuler avec T-1 |
| T-5 | Reformulation IA | Aide à la rédaction | **Texte clinique libre** | **Anthropic (É.-U.)** | 30 j, **2 ans si signalé** ; ZDR ? **[à instruire]** |
| T-6 | Mise à disposition de facture | Transmission | E-mail, n° de facture, **jeton** | **Resend (É.-U.)** | 30 j prestataire ; jeton 90 j |
| T-7 | Consultation sans compte | Accès du patient | Nom, adresse, nature de l'acte, montant | Porteur du lien | 90 j, **aucune révocation, aucun journal** |
| T-8 | Comptes et abonnement | Gestion du service | E-mail, statut, dates | Éditeur, Supabase | **[à instruire]** |
| T-9 | Journal d'événements | Traçabilité | Action, sujet, acteur, horodatage | Éditeur | **[à instruire]** — `audit_events` en ajout seul (socle `0001`) |
| T-10 | Dictée vocale | Saisie | **Parole clinique** | **Éditeur du navigateur, non identifié** | Inconnue — **aucune mesure** |

**Base légale [VALIDATION HUMAINE].** Le référentiel 2020-081 propose obligation légale
pour la tenue du dossier, intérêt légitime pour rendez-vous et comptabilité. Pour T-5, T-6
et T-7, **aucune base n'est évidente**. La qualification « donnée de santé » impose en
outre de lever l'interdiction de l'article 9.1 par une exception du 9.2, typiquement le
**9.2.h**, qui suppose le secret professionnel.

---

## 7. Rôles RGPD

Critère **factuel, pas contractuel** — lignes directrices **EDPB 07/2020**, version finale
du 2021-07-07 (<https://www.edpb.europa.eu/system/files/documents/2023-10/EDPB_guidelines_202007_controllerprocessor_final_en.pdf>).

- **Données patients** — le psychomotricien est **responsable de traitement**, l'éditeur
  **sous-traitant**. Un contrat article 28 est **obligatoire** ; il n'existe pas. Supabase,
  Vercel, Anthropic et Resend sont **sous-traitants ultérieurs** (art. 28.4).
- **Compte et abonnement** — l'éditeur est **responsable de traitement**.
- **Fonction IA — qualification à instruire, et c'est le point sensible.** L'éditeur a
  déterminé seul le fournisseur, le modèle, le contenu du prompt, le fait que le texte
  intégral parte, l'absence de neutralisation, l'absence de journalisation. Le praticien
  n'a le choix ni du fournisseur, ni de la région, ni de la rétention, et **n'en est pas
  informé par le produit**. Une **responsabilité conjointe (art. 26)** est plausible.
  **[VALIDATION HUMAINE] — juriste.**
- **Dictée vocale** — si le navigateur transmet l'audio, son éditeur devient destinataire
  sans contrat, sans information et sans base.

**Documents contractuels manquants, tous :** contrat de sous-traitance art. 28
éditeur ↔ praticien ; contrat d'hébergement au sens de L1111-8 I ; liste des
sous-traitants ultérieurs ; mention d'information des patients sur l'hébergement ;
politique de confidentialité ; registre ; analyse des transferts (TIA) pour les quatre
fournisseurs.

---

## 8. Droits des personnes

| Droit | État | À construire |
|---|---|---|
| Accès (15) | ❌ | Export par patient, avec destinataires réels et durées |
| Rectification (16) | ⚠️ | Le praticien modifie ; **aucune trace** — `updated_at` écrasé, aucun historique |
| Effacement (17) | ❌ | `deletePatient` supprime la fiche ; `bilans.patient_id` passe à `null` et **`patient_name` demeure**. Effacement **partiel et silencieux** |
| Limitation (18) | ❌ | Aucun état « gelé » |
| Portabilité (20) | ⚠️ | CSV comptable seulement ; portée à instruire |
| Opposition (21) | ❌ | Notamment l'opposition à l'hébergement de L1111-8 I, et le refus de la reformulation IA |

### La tension effacement / conservation

Le droit à l'effacement n'est pas absolu : l'article 17.3 l'écarte pour une obligation
légale (b) et pour le 9.2.h — médecine préventive, diagnostic, soins (c).

Le cadre français est **asymétrique, et cette asymétrie est souvent mal comprise** :

- **R1112-7 du CSP (20 ans)** vise **les établissements de santé**. Il **ne s'applique pas**
  à un libéral. <https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000036658351>
- **Aucun texte ne fixe de durée pour le praticien libéral.** L'usage s'adosse à la
  prescription décennale de **L1142-28**.
- La **CNIL (réf. 2020-081)** retient **5 ans en base active** puis **15 ans d'archivage
  intermédiaire** sur support distinct, puis anonymisation ou destruction sécurisée.

**Conséquences de conception :**
1. Une demande d'effacement **ne peut pas toujours être satisfaite intégralement**. Le
   logiciel doit permettre de **motiver un refus partiel**, pas d'effacer ou refuser en bloc.
2. Il faut **deux états distincts** — base active et archivage intermédiaire. Aucun n'existe.
3. Les données comptables suivent un régime propre (10 ans). Aujourd'hui c'est l'inverse
   qui se produit : la donnée d'identité survit, le lien disparaît.
4. **L'effacement doit atteindre les sous-traitants** — Anthropic, Resend, et les
   **sauvegardes Supabase**. Une suppression en base n'est pas un effacement tant que les
   sauvegardes n'ont pas tourné.

---

## 9. Verdict

### 9.1 Preuves techniques constatées [VÉRIFIÉ]

1. Aucune clé `service_role` ; les trois clients utilisent la clé publique.
2. `ai-actions.ts` transmet le **texte clinique intégral** d'une section, **sans `inference_geo`**.
3. Le même fichier **ne transmet aucun identifiant direct** alors que l'appelant en dispose.
4. Le contrôle de session en tête de cette action existe et fonctionne.
5. **Ni `vercel.json`, ni `preferredRegion`, ni `export const runtime`** dans le dépôt.
6. `lib/invoicePdf.tsx` rend le PDF **côté serveur**.
7. `lib/email.ts` refuse l'envoi sans ses deux variables, absentes de `.env.local`.
8. `sendInvoiceEmail` ne transmet ni nom, ni acte, ni pièce jointe — mais **un jeton en clair**.
9. `invoice_by_token` est `security definer`, bornée, champs énumérés un par un ; le
   cloisonnement inter-cabinets a été corrigé en `migration_012.sql`.
10. Jeton : 32 octets base64url, TTL **90 jours**, **aucune révocation**.
11. **Aucune durée de conservation implémentée, nulle part.**
12. **Aucun analytics, aucune télémétrie, aucun `console.log`.**
13. **Aucun code Stripe** : Stripe n'est pas un sous-traitant et ne doit pas figurer au registre.
14. `deletePatient` laisse `patient_name` dans les bilans.
15. Le socle `0001` introduit `audit_events` en ajout seul, une RLS en refus par défaut et
    un rôle d'administration **sans accès aux données d'exercice**. Il **ne contient aucun
    mécanisme de rétention ni d'effacement**.
16. Projet Supabase de production en **`eu-west-1` (Irlande)**.

### 9.2 Inconnues à lever

1. Région d'exécution réellement configurée dans Vercel.
2. Resend est-il actif en production ?
3. Compte Anthropic : type, ZDR souscrit ou non, réglages de workspace.
4. Rétention réelle des sauvegardes Supabase — conditionne la réalité de tout effacement.
5. Comportement de l'API Web Speech sur les navigateurs réellement utilisés.
6. Qualification juridique des flux Anthropic et Resend : hébergement ou sous-traitance ?
7. Rôle de l'éditeur sur la fonction IA : sous-traitant ou responsable conjoint ?
8. Périmètre HDS que l'éditeur devrait porter en propre selon l'architecture retenue.
9. Tarifs HDS réels — devis nécessaires.

### 9.3 Blocages de mise en production

Chacun interdit l'entrée du premier patient réel.

> **B-1. Aucun fournisseur de la chaîne n'est certifié HDS.** Blocage structurel : il commande tous les autres.
>
> **B-2. Aucun contrat d'hébergement de données de santé**, alors que L1111-8 I l'exige expressément.
>
> **B-3. Aucun contrat de sous-traitance article 28 entre l'éditeur et le praticien.**
>
> **B-4. Le contenu clinique part vers les États-Unis sans possibilité technique de l'en
> empêcher.** À compter du **2026-09-26**, R1111-9-1 impose un stockage exclusivement dans l'EEE.
>
> **B-5. Un jeton d'accès à un document nominatif séjourne 30 jours aux États-Unis**, sans
> révocation, sans journal.
>
> **B-6. Aucune durée de conservation définie ni implémentée.**
>
> **B-7. Aucun droit des personnes n'est outillé.** L'effacement est partiel et silencieux.
>
> **B-8. `invoice_by_token`, seul point où l'isolation ne repose pas sur `auth.uid()`,
> n'a jamais été testée avec le jeton d'un autre praticien.**
>
> **B-9. Aucune information des patients sur l'hébergement**, alors que L1111-8 I la conditionne.

### 9.4 Conséquence sur la refonte

La décision **D-01** — « stack conservée (Next.js 16 / Supabase / Vercel) », marquée non
réversible — est **incompatible avec B-1**. Elle a été prise avant cet audit, sur des
critères d'ingénierie légitimes. **Elle doit être rouverte avant l'engagement des lots
suivants.** Le socle `0001` est du PostgreSQL standard et reste largement portable : le
coût d'une bascule est **très inférieur maintenant** qu'après l'écriture des lots patients,
bilans et facturation.

---

## Validations externes nécessaires

**1. DPO ou juriste spécialisé en données de santé** — champ HDS pour un éditeur SaaS et
périmètre d'activités à certifier ; qualification des flux Anthropic et Resend ; rôles RGPD
sur la fonction IA ; nécessité d'une AIPD ; bases légales ; durées de conservation arbitrées
entre référentiel CNIL, obligations comptables et L1142-28 ; registre, mentions
d'information, TIA pour les quatre fournisseurs.

**2. Contrat d'hébergement HDS** — vérifier **numéro de certificat, organisme accrédité
COFRAC, dates de validité et périmètre d'activités exact** : un hébergeur certifié 1 à 4 ne
couvre pas 5 et 6. Contrat au sens de L1111-8 I comportant les mentions de R1111-11
modifié. Conformité au décret n° 2026-209 **avant le 2026-09-26**.

**3. Audit de sécurité indépendant** — isolation inter-cabinets sur `invoice_by_token` avec
données synthétiques ; revue des politiques RLS du socle `0001` ; Server Actions non
authentifiées ; gestion et rotation des secrets ; **restauration effective d'une sauvegarde**.

**Décisions du propriétaire du produit, non de l'audit :** maintien ou retrait de la
fonction IA ; maintien ou retrait de la dictée vocale ; maintien ou remplacement du lien de
facture sans authentification ; arbitrage de D-01.
