# Référentiel comptable et fiscal — psychomotricien libéral (France)

**Objet.** Fournir au moteur financier du produit un référentiel *sourcé, daté et versionnable*. Aucun seuil, taux, tarif, mention ou durée ne doit être écrit en dur dans le code : tout ce qui suit est destiné à vivre dans des **tables datées** (§ 11) que le code lit, et non dans des constantes TypeScript.

**Date de rédaction et de consultation des sources : 2026-09-11.** Toutes les URL ci-dessous ont été consultées à cette date. Le droit fiscal français change au moins une fois par an, et deux textes structurants basculent le **1er janvier 2027** (§ 2.4 et § 6). Ce document a une date de péremption courte : il doit être relu à chaque loi de finances.

**Ce document ne vaut pas conseil.** Il est produit par lecture de sources publiques. Il doit être validé par un expert-comptable avant toute mise en production d'un calcul déclaratif (§ « Validations externes nécessaires »).

---

## 0. Conventions de lecture

Chaque affirmation porte un **statut**. Ne jamais promouvoir un statut sans preuve nouvelle.

| Statut | Signification |
|---|---|
| **Vérifié** | Lu dans une source primaire (Légifrance, BOFiP, service-public.gouv.fr, ameli.fr, urssaf.fr) citée avec URL et date de consultation. |
| **À instruire** | Point identifié, source à consulter nommée, non vérifié pendant cette session. Aucune valeur ne doit être codée sur cette base. |
| **Écart produit** | Constat de lecture du dépôt actuel, sans valeur réglementaire : c'est une différence entre ce que fait le code et ce que dit ce référentiel. |

**Aucune donnée réelle** ne figure ici. Tous les montants d'exemple sont synthétiques.

**Avertissement sur les sources secondaires.** Les cabinets comptables, éditeurs de logiciels et blogs fiscaux publient des tableaux de seuils souvent exacts et parfois faux. Pendant cette recherche, **trois sources secondaires se contredisaient** sur la date de disparition de la mention « art. 293 B du CGI » (1er septembre 2026 selon les unes, 1er janvier 2027 selon les autres) et **deux** sur le seuil micro-BNC 2026 (77 700 € ou 83 600 €). Les deux points ont dû être tranchés sur Légifrance et sur service-public.gouv.fr. **Règle : aucune valeur du référentiel ne doit avoir pour seule source un article de blog ou un éditeur.**

---

## 1. Taxonomie — cinq axes indépendants qu'il ne faut pas confondre

C'est la section la plus importante du document, parce que c'est celle où une erreur de modèle se propage partout ailleurs.

Un professionnel libéral n'a pas « un statut ». Il a une position sur **cinq axes distincts**, qui se combinent. Le logiciel doit stocker les cinq séparément. Fusionner deux axes dans un seul champ (« statut : micro-entreprise ») rend impossible tout calcul correct et est la cause la plus fréquente des erreurs de ce type de produit.

### 1.1 Les cinq axes

| # | Axe | Valeurs possibles (psychomotricien libéral) | Ce qu'il détermine |
|---|---|---|---|
| **A** | **Forme juridique** | Entreprise individuelle (EI) · EURL · SASU · SELARL · SELASU · SELAS | Qui est la personne juridique, qui émet la facture, quel patrimoine, quelle immatriculation |
| **B** | **Régime fiscal (assiette du bénéfice)** | Micro-BNC (régime déclaratif spécial, art. 102 ter CGI) · Déclaration contrôlée / BNC réel (2035) · Impôt sur les sociétés (IS) | Comment le bénéfice imposable est calculé, quelles charges sont déductibles, quel formulaire |
| **C** | **Régime social** | Travailleur non salarié (TNS) · Assimilé salarié | Quel organisme, quelle assiette, quelle périodicité de cotisation |
| **D** | **Méthode comptable** | Recettes–dépenses (encaissements/décaissements) · Créances–dettes (art. 93 A CGI, sur option) · Engagement (comptabilité commerciale, IS) | **À quelle date un euro entre dans le résultat** |
| **E** | **Régime de TVA** | Exonération de l'art. 261, 4, 1° CGI (les soins) · Franchise en base (art. 293 B CGI) · Régime réel de TVA | Ce qui s'imprime sur la facture, ce qui est déclaré |

### 1.2 Correction d'une erreur courante : « la micro-entreprise est une société »

**C'est faux, et le logiciel ne doit jamais laisser penser le contraire.**

La **micro-entreprise n'est pas une forme juridique** et n'est **pas une société**. C'est un **régime simplifié applicable à une entreprise individuelle** — c'est-à-dire à une personne physique. Précisément, « micro-entreprise » recouvre en pratique deux choses distinctes qui se cumulent souvent mais pas nécessairement :

- le **régime fiscal** micro-BNC (axe B), dit *régime déclaratif spécial*, art. 102 ter CGI ;
- le **régime micro-social** simplifié (axe C), qui fait calculer les cotisations en pourcentage du chiffre d'affaires déclaré.

Conséquences que le modèle de données doit porter :

- une micro-entreprise **n'a pas de capital social, pas d'associés, pas de dénomination sociale, pas de K-bis de société** ; l'émetteur de la facture est **une personne physique**, identifiée par ses nom et prénom, éventuellement suivis d'un nom commercial ;
- une EI au régime micro **peut sortir du micro** (dépassement de seuil ou option) sans changer de forme juridique : l'axe B change, l'axe A ne change pas ;
- inversement, créer une SASU **change l'axe A, l'axe B (IS) et l'axe C (assimilé salarié) en même temps**, mais l'axe E peut rester identique (les soins restent exonérés).

**Écart produit.** Le dépôt actuel ne stocke **aucun** de ces cinq axes. `settings.profile` (`lib/types.ts:24-53`) contient `siret`, `adeli`, `rpps`, une adresse et des `legal_mentions` en texte libre — rien qui permette de savoir sous quel régime fiscal, social ou de TVA le compte se trouve. Tous les calculs de `lib/calc.ts` sont donc faits *sans connaître le régime*, ce qui n'est tenable que parce qu'ils sont présentés comme une estimation (§ 8.4).

### 1.3 Combinaisons réalistes et ce que le logiciel doit savoir de chacune

Quatre combinaisons couvrent la quasi-totalité de la pratique libérale de psychomotricité. Pour chacune, la colonne de droite liste **les données que le moteur doit détenir pour calculer juste**.

#### Combinaison 1 — EI au micro-BNC (installation, activité modérée)

| Axe | Valeur |
|---|---|
| A — Forme juridique | Entreprise individuelle |
| B — Régime fiscal | Micro-BNC (art. 102 ter CGI) |
| C — Régime social | TNS |
| D — Méthode comptable | Recettes–dépenses, **obligatoirement** (recettes encaissées) |
| E — TVA | Exonération art. 261, 4, 1° pour les soins ; la franchise en base ne concerne que d'éventuelles activités hors soins |

**Ce que le logiciel doit savoir pour calculer :** le seuil de recettes en vigueur et ses années d'application ; le taux d'abattement et son plancher ; le fait que **les charges réelles ne sont pas déductibles** (donc : n'affichez jamais un « net après charges » présenté comme un résultat fiscal) ; le fait que le bénéfice imposable = recettes encaissées − abattement, et rien d'autre. **Une rétrocession versée ne se déduit pas comme une charge dans ce régime** — point à instruire (§ 10.4).

#### Combinaison 2 — EI en déclaration contrôlée (cas le plus fréquent en cabinet installé)

| Axe | Valeur |
|---|---|
| A | Entreprise individuelle |
| B | Déclaration contrôlée (BNC réel, formulaire 2035) |
| C | TNS |
| D | Recettes–dépenses par défaut ; **créances–dettes sur option** (art. 93 A CGI) |
| E | Exonération art. 261, 4, 1° |

**Ce que le logiciel doit savoir :** que la date qui compte est **la date d'encaissement**, pas la date d'émission de la facture, sauf option créances–dettes ; la liste des postes de charges déductibles et leur ventilation 2035 ; la distinction honoraires rétrocédés / redevance de collaboration / loyer (§ 10) ; les obligations de tenue (livre-journal chronologique, registre des immobilisations, art. 99 CGI).

#### Combinaison 3 — Société unipersonnelle à l'IS (SELARL, SELASU, EURL option IS, SASU)

| Axe | Valeur |
|---|---|
| A | SELARL / SELASU / EURL / SASU |
| B | Impôt sur les sociétés |
| C | TNS (gérant majoritaire SELARL/EURL) **ou** assimilé salarié (président SASU/SELASU) |
| D | Comptabilité d'engagement |
| E | Exonération art. 261, 4, 1° |

**Ce que le logiciel doit savoir :** que la rémunération du dirigeant n'est **pas** le bénéfice ; que la comptabilité est d'engagement (la facture entre au résultat à l'émission, pas à l'encaissement) ; que le régime social dépend du couple forme juridique × qualité du dirigeant, pas de la forme seule.

> **Hors périmètre recommandé.** Cette combinaison demande une comptabilité en partie double, un bilan et un compte de résultat. Un moteur conçu pour des recettes–dépenses ne doit **pas** prétendre la couvrir. Recommandation : que le produit déclare explicitement ne traiter que les combinaisons 1, 2 et 4, et refuse de produire un chiffre pour la 3.

#### Combinaison 4 — Remplaçant ou collaborateur (EI, micro ou réel)

Même axes que 1 ou 2, **plus** un flux de rétrocession ou de redevance qui inverse le sens de l'argent selon le cas (§ 10). C'est la combinaison que le dépôt actuel modélise — partiellement, et sans savoir de quel côté du flux se trouve l'utilisateur.

### 1.4 Ce que cela impose au modèle de données

- cinq champs distincts, jamais fusionnés, chacun **daté** : un régime change au 1er janvier, et les factures antérieures doivent rester interprétées sous l'ancien régime ;
- une **période de validité** sur chaque valeur d'axe (`effet_du`, `effet_au`), sans quoi un changement de régime en cours d'année rend tout l'historique faux ;
- aucun calcul déclaratif ne doit s'exécuter si l'axe qu'il suppose n'est pas renseigné : **afficher « régime non renseigné » plutôt qu'un chiffre par défaut**. C'est la transposition comptable de la règle clinique « ne pas transformer l'absence de donnée en résultat normal » (`docs/clinical/CLINICAL_SAFETY.md`).

---

## 2. TVA

### 2.1 L'exonération des soins — article 261, 4, 1° du CGI

**Statut : vérifié.**

Les soins dispensés par un psychomotricien sont **exonérés de TVA** sur le fondement du 1° du 4 de l'article 261 du CGI. Le BOFiP mentionne explicitement les psychomotriciens parmi les professions paramédicales réglementées visées, par renvoi à l'article **L. 4332-1 du code de la santé publique**.

> Source : BOFiP, *TVA – Champ d'application et territorialité – Exonérations – Opérations exonérées en régime intérieur – Professions libérales et assimilées – Professions médicales et paramédicales*, **BOI-TVA-CHAMP-30-10-20-10**, version du **09/04/2025** (version précédente 08/02/2023) — https://bofip.impots.gouv.fr/bofip/1139-PGP.html/identifiant=BOI-TVA-CHAMP-30-10-20-10-20250409 — consulté le 2026-09-11.

**Conditions cumulatives, telles que posées par le BOFiP :**

1. **Profession réglementée** par le code de la santé publique ou ses textes d'application. Le psychomotricien l'est (art. L. 4332-1 et s. CSP, art. R. 4332-1 CSP).
2. **Exercice dans le cadre légal et réglementaire de la profession**, tel que défini par le CSP.
3. **Finalité thérapeutique** de la prestation : prévenir, diagnostiquer, soigner et, dans la mesure du possible, guérir une maladie ou une anomalie de santé.

Le troisième point est le plus important pour le produit : **l'exonération porte sur la nature de l'acte, pas sur la qualité de la personne.** Un psychomotricien diplômé n'est pas exonéré sur tout ce qu'il facture ; il est exonéré sur les *soins*.

### 2.2 Ne pas confondre exonération et franchise en base

C'est la confusion la plus répandue, et elle a des conséquences directes sur la mention imprimée.

| | **Exonération art. 261, 4, 1° CGI** | **Franchise en base art. 293 B CGI** |
|---|---|---|
| **Fondement** | La nature de l'opération (un soin) | Le niveau de chiffre d'affaires |
| **Dépend du chiffre d'affaires ?** | **Non**, jamais | **Oui**, seuils annuels |
| **Peut-on y renoncer ?** | Non | Oui, option pour le paiement de la TVA |
| **Effet du dépassement d'un seuil** | Aucun : l'exonération demeure | Sortie du régime, TVA due |
| **Droit à déduction de la TVA d'amont** | Non | Non |
| **Mention en facture** | Référence à la disposition d'exonération (§ 3.4) | « TVA non applicable, art. 293 B du CGI » |

> Sources : BOI-TVA-CHAMP-30-10-20-10 (ci-dessus) ; article 293 B du CGI, Légifrance — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000052488142 — consulté le 2026-09-11 ; *Facture : mentions obligatoires*, entreprendre.service-public.gouv.fr, fiche **F31808**, page vérifiée le **11/08/2026** — https://entreprendre.service-public.gouv.fr/vosdroits/F31808 — consultée le 2026-09-11.

**Conséquence pratique et non intuitive :** un psychomotricien qui dépasse largement le seuil de la franchise en base **reste exonéré sur ses soins**. Il n'y a aucun seuil de chiffre d'affaires à surveiller *pour la TVA sur les soins*. Le logiciel ne doit donc **jamais** afficher une alerte « vous approchez du seuil de TVA » sur la base des recettes de soins. Les seuils de l'article 293 B ne concernent, chez ce professionnel, **que les éventuelles recettes hors soins** (§ 2.3).

**Seuils de l'article 293 B — statut : partiellement vérifié.** La version Légifrance en vigueur (« Version en vigueur du 01/03/2025 au 01/01/2027 ») porte, pour l'année en cours, **93 500 €** de chiffre d'affaires national total et **41 250 €** pour les prestations de services. Les seuils de référence de l'année civile précédente (85 000 € / 37 500 €) n'ont **pas** été relus sur Légifrance pendant cette session : ils proviennent de sources secondaires et sont marqués **à instruire** dans la table `tva_franchise_seuils` (§ 11).

### 2.3 Activités accessoires et activités mixtes

**Statut : vérifié pour le principe, à instruire pour la qualification acte par acte.**

Le BOFiP exclut expressément de l'exonération les actes dépourvus de finalité thérapeutique, et cite notamment les **expertises** (§ 80) ainsi que les activités non réglementées (§ 210).

Le produit doit donc porter une **qualification par ligne de prestation**, jamais par compte. Voici les cas à prévoir, avec leur statut :

| Activité | Qualification probable | Statut |
|---|---|---|
| Séance de psychomotricité, bilan psychomoteur, bilan sensoriel, compte rendu associé | **Soin** → exonéré 261, 4, 1° | Vérifié (finalité thérapeutique) |
| Réunion de synthèse, ESS, coordination autour d'un patient suivi | Probablement accessoire au soin | **À instruire** — expert-comptable |
| Formation, intervention en école ou en institution, conférence | **Hors soins** → régime de droit commun, franchise en base ou TVA | **À instruire** |
| Atelier collectif sans prescription ni finalité thérapeutique individualisée | **Hors soins** probable | **À instruire** |
| Vente de matériel, de jeux, d'outils sensoriels | **Livraison de biens** → hors exonération | Vérifié (non-soin) |
| Supervision, analyse de pratique pour des confrères | **Hors soins** probable | **À instruire** |
| Expertise, bilan à la demande d'un tiers sans visée de soin | **Hors exonération** | Vérifié (BOI-TVA-CHAMP-30-10-20-10 § 80) |

**Ce que cela impose au modèle.** Le catalogue de prestations (`settings.profile.service_catalog`, `lib/types.ts`) doit porter, **sur chaque entrée**, un champ de **régime de TVA** parmi `exonere_261_4_1 | franchise_293b | tva_taux_normal | tva_taux_reduit | a_qualifier`, avec `a_qualifier` comme **valeur par défaut refusant l'émission** plutôt qu'un repli silencieux sur « exonéré ». Ce champ doit être **figé sur la ligne de facture au moment de l'émission**, exactement comme `unit_price` et `label` le sont déjà dans `lib/invoiceLines.ts` — la logique de figement qui y est écrite est la bonne et doit être étendue à ce champ.

Une facture peut porter des lignes de régimes différents (activité mixte). Le document imprimé doit alors porter **une mention par régime présent**, et un sous-total par régime.

### 2.4 Mentions de TVA à porter sur la facture

**Statut : vérifié, avec une date de bascule proche.**

| Cas | Mention à porter | En vigueur |
|---|---|---|
| Soins exonérés | Référence à la disposition d'exonération — formulation recommandée : **« Exonération de TVA — article 261, 4, 1° du code général des impôts »** | Aujourd'hui |
| Activité hors soins sous franchise en base | **« TVA non applicable, art. 293 B du code général des impôts »** | **Jusqu'au 31/12/2026** |
| Activité hors soins sous franchise en base | Référence CIBS à déterminer — **à instruire** | **À partir du 01/01/2027** |
| Activité hors soins soumise | Taux et montant de TVA par ligne, totaux HT et TTC | Aujourd'hui |

Le fondement de l'obligation de mention en cas d'exonération est le **12° du I de l'article 242 nonies A de l'annexe II au CGI** : « la référence à la disposition pertinente du présent code, à la directive 2006/112/CE ou à toute autre mention indiquant que l'opération bénéficie d'une mesure d'exonération ».

> Source : article 242 nonies A de l'annexe II au CGI, Légifrance, **en vigueur depuis le 01/01/2025**, modifié par le décret n° 2024-1195 du 21 décembre 2024 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000050811276 — consulté le 2026-09-11.

**Tempérament — statut : vérifié, mais à faire confirmer.** Le **II** du même article dispense des mentions des 2° (numéro de TVA) et 12° (référence d'exonération) les factures **dont le montant est inférieur ou égal à 150 € HT** ainsi que celles relevant du régime de franchise des articles 293 B et 293 B ter. Une part importante des factures d'un psychomotricien étant sous 150 €, la portée pratique de cette dispense est réelle. **Recommandation produit : porter la mention dans tous les cas.** Elle ne coûte rien, elle est exacte, et elle évite d'avoir à raisonner sur un seuil qui bouge.

### 2.5 La bascule CGI → CIBS du 1er janvier 2027

**Statut : vérifié — et c'est un cas d'école pour la conception des tables.**

L'**ordonnance n° 2025-1247 du 17 décembre 2025** recodifie l'ensemble de la TVA du CGI vers le **code des impositions sur les biens et services (CIBS)**. L'article 293 B du CGI est abrogé par l'article 9 de cette ordonnance. Légifrance affiche, à la date de consultation, la mention littérale :

> « Version en vigueur du 01/03/2025 au 01/01/2027 » — « Abrogé par Ordonnance n° 2025-1247 du 17 décembre 2025 - art. 9 »

L'entrée en vigueur, initialement fixée au **1er septembre 2026**, a été **reportée au 1er janvier 2027** par l'**ordonnance n° 2026-671 du 27 juillet 2026** (JO du 28 juillet 2026), afin de ne pas faire coïncider la recodification avec l'entrée en vigueur de la facturation électronique.

> Sources : article 293 B du CGI, Légifrance — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000052488142 ; ordonnance n° 2025-1247 du 17 décembre 2025, Légifrance — https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053091516 ; rapport au Président de la République relatif à l'ordonnance n° 2026-671 du 27 juillet 2026, Légifrance — https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000054497139 — tous consultés le 2026-09-11.

**À instruire :**
- la **nouvelle référence CIBS exacte** à porter sur les factures sous franchise à compter du 01/01/2027 ;
- l'existence et la portée d'une **période transitoire** pendant laquelle les anciennes références CGI resteraient admises. Des sources secondaires évoquent une tolérance jusqu'au **30 juin 2028** ; **cette date n'a pas été vérifiée sur source primaire et ne doit pas être codée.** Source à consulter : le texte de l'ordonnance n° 2025-1247 et le BOFiP à paraître.
- la **nouvelle référence de l'exonération des soins** (actuel art. 261, 4, 1° CGI) dans le CIBS.

**Ce que cet épisode démontre.** Une mention de facture n'est pas une constante : c'est **une valeur avec une date d'entrée en vigueur et une date de fin**, dont la date de fin peut elle-même être reportée par un texte postérieur. Toute implémentation qui écrit `"TVA non applicable, art. 293 B du CGI"` dans un fichier `constants.ts` produira des factures fausses au 1er janvier 2027, et les produira **silencieusement**.

---

## 3. Mentions obligatoires d'une facture

Deux corps de règles se superposent et n'ont ni le même objet ni les mêmes sanctions :

- **Fiscal** — article 289 du CGI et article **242 nonies A de l'annexe II au CGI** : ce que la facture doit porter au regard de la TVA ;
- **Commercial** — article **L. 441-9 du code de commerce** : ce que la facture doit porter dans les relations entre professionnels.

### 3.1 Liste fiscale — article 242 nonies A, annexe II au CGI

**Statut : vérifié.** Version en vigueur depuis le 01/01/2025, modifiée par le décret n° 2024-1195 du 21 décembre 2024.
https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000050811276 — consulté le 2026-09-11.

| Item | Mention | S'applique au psychomotricien libéral ? |
|---|---|---|
| 1° | Nom complet, numéro d'identification (art. R. 123-221 c. com.) et adresse de l'assujetti **et du client** | **Oui** |
| 2° | Numéro individuel d'identification à la TVA du vendeur | **Non en pratique** — dispense du II (≤ 150 € HT / franchise) ; et un exonéré 261-4-1° n'en dispose pas nécessairement. **À instruire** |
| 3° | Numéros de TVA pour les livraisons intracommunautaires (art. 262 ter) | Non |
| 4° | Numéros de TVA lorsque le preneur est redevable | Non |
| 5° | Représentant fiscal | Non |
| 5° bis | Membre d'un assujetti unique | Non |
| **6°** | **Date d'émission** | **Oui** |
| **7°** | **Numéro unique fondé sur une séquence chronologique et continue** (séries distinctes admises si justifiées) | **Oui** — voir § 4 |
| 7° bis | Adresse de livraison si différente | Sans objet |
| **8°** | Pour chaque bien ou service : **quantité, dénomination précise, prix unitaire hors taxe**, taux de TVA applicable **ou bénéfice d'une exonération** | **Oui** |
| 8° bis | Indication que les opérations sont exclusivement des biens, exclusivement des services, ou les deux | **Oui** |
| **9°** | **Tous rabais, remises, ristournes** acquis et chiffrables lors de l'opération | **Oui, si applicable** |
| **10°** | **Date de réalisation** de la livraison ou de la prestation, ou date d'acompte, si différente de la date d'émission | **Oui** — c'est la date de séance |
| 11° | Montant de la taxe à payer, total HT et taxe par taux | Sans objet si tout est exonéré |
| 11° bis | Option pour le paiement de la TVA d'après les débits | Non |
| **12°** | En cas d'exonération : **référence à la disposition pertinente du CGI, à la directive 2006/112/CE, ou toute autre mention indiquant que l'opération bénéficie d'une mesure d'exonération** | **Oui** — voir § 2.4 |
| 13° | « Autoliquidation » | Non |
| 14° | « Autofacturation » | Non |
| 15° à 18° | Agences de voyages, biens d'occasion, moyens de transport neufs, ventes aux enchères | Non |

**Dispense du II.** Les factures **≤ 150 € HT** et celles relevant de la franchise (art. 293 B et 293 B ter) peuvent omettre les mentions **2° et 12°**.

**Point de vigilance sur l'item 10°.** Le produit actuel imprime les dates de séance dans la désignation de la ligne (`lib/invoiceDocument.ts`, `documentLinesForBlock`). C'est fonctionnellement correct au regard du 10°, mais le champ `dates` n'est **obligatoire** dans le code que pour les lignes au tarif `unitaire` (`validateInvoiceLines`, `lib/invoiceLines.ts:205`). Une ligne au **forfait** peut donc être émise sans aucune date de réalisation. **À instruire** : l'item 10° l'exige-t-il dès lors que la date de réalisation diffère de la date d'émission ? Si oui, la validation doit être étendue au forfait.

### 3.2 Liste commerciale — article L. 441-9 du code de commerce (relations entre professionnels)

**Statut : vérifié pour le contenu, via service-public.gouv.fr et la synthèse Légifrance.**
https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038414397/ ; https://entreprendre.service-public.gouv.fr/vosdroits/F31808 (vérifiée le 11/08/2026) — consultés le 2026-09-11.

L'article L. 441-9 impose, **dans les relations entre professionnels** :

1. la **date à laquelle le règlement doit intervenir** ;
2. les **conditions d'escompte** applicables en cas de paiement anticipé — et, s'il n'y en a pas, la mention **« Escompte pour paiement anticipé : néant »** ;
3. le **taux des pénalités de retard** exigibles le jour suivant la date de règlement portée sur la facture ;
4. le **montant de l'indemnité forfaitaire pour frais de recouvrement** due au créancier en cas de retard — **40 €** ;
5. le **numéro du bon de commande** lorsqu'il a été préalablement établi par l'acheteur.

**Sanction : vérifiée.** Le manquement est passible d'une **amende administrative plafonnée à 75 000 € pour une personne physique et 375 000 € pour une personne morale**.

**Taux des pénalités de retard.** À défaut de stipulation contractuelle, le taux légal est le taux directeur de la BCE majoré de 10 points, avec un plancher de 3 fois le taux d'intérêt légal. **Le taux BCE applicable change chaque semestre : il ne doit jamais être codé en dur.** La valeur précise applicable au second semestre 2026 est **à instruire** (source : Banque de France / economie.gouv.fr).

### 3.3 Ce qui s'applique — et ce qui ne s'applique pas — à un psychomotricien libéral

| Situation | Les mentions L. 441-9 s'appliquent-elles ? |
|---|---|
| Facture au **patient** (ou à son responsable légal), particulier | **Non.** L'article L. 441-9 régit la facturation entre professionnels. Les mentions « pénalités de retard », « indemnité 40 € », « escompte : néant » n'ont pas à y figurer. |
| Facture à une **institution, une école, une association, un cabinet, une entreprise** (atelier, formation, vacation, intervention) | **Oui.** Mentions L. 441-9 requises en plus des mentions fiscales. |
| **Rétrocession** à un titulaire ou facture au collaborateur | **Oui** — c'est une relation entre deux professionnels. |
| **Circuit PCO** (§ 9) | **À instruire** : la relation professionnel ↔ caisse d'assurance maladie n'est pas une relation commerciale ordinaire ; le support est un formulaire dédié, pas une facture libre. |

**Écart produit majeur.** Le dépôt actuel produit **un seul modèle de facture** (`lib/invoiceDocument.ts`) sans aucune notion de nature du destinataire. Le champ destinataire est `patient_name` + l'adresse du patient (`buildInvoiceDocument`, bloc `billedTo`), et il n'existe aucun type « payeur institutionnel ». Une facture émise à une école ou à une association sortira donc **sans les mentions de l'article L. 441-9**, ce qui l'expose à l'amende administrative ci-dessus. C'est le même défaut de modèle que celui relevé au § 9 sur le PCO : **le produit suppose que le destinataire de la facture est toujours le patient.**

### 3.4 Mentions supplémentaires à instruire

| Mention | Statut |
|---|---|
| **Assurance de responsabilité civile professionnelle** (assureur, coordonnées, couverture géographique) | La fiche service-public rattache cette obligation aux **artisans**. L'obligation d'assurance RCP des professionnels de santé résulte de l'**article L. 1142-2 du code de la santé publique**, mais **l'obligation d'en porter les références sur la facture n'a pas été vérifiée** pour un psychomotricien. **À instruire** — source : art. L. 1142-2 CSP, ordre / syndicat professionnel, assureur. |
| **Numéro ADELI / RPPS** | Aucune obligation de mention en facture n'a été trouvée. Le produit l'imprime déjà (`lib/invoiceDocument.ts`, `issuerLines`). C'est **utile et sans risque**, mais ne doit pas être présenté comme obligatoire. **À instruire** si une obligation existe pour le remboursement ou le circuit PCO. |
| **SIRET** | Couvert par l'item 1° (numéro d'identification, art. R. 123-221 c. com.). Déjà imprimé par le produit. **Vérifié.** |
| **Mention « membre d'une association agréée »** (OGA/AGA) | Régime largement modifié depuis la suppression de la majoration de 25 %. **À instruire** — expert-comptable. |
| **Garantie légale de conformité** (2 ans) | Concerne certaines catégories de biens vendus à des consommateurs. Sans objet pour des soins ; **à instruire** si vente de matériel (§ 2.3). |

---

## 4. Numérotation

**Statut : vérifié.**

> Source : BOFiP, **BOI-TVA-DECLA-30-20-20-10**, version du **18/10/2013**, § 70 à § 100 — https://bofip.impots.gouv.fr/bofip/140-PGP.html/identifiant=BOI-TVA-DECLA-30-20-20-10-20131018 — consulté le 2026-09-11. Fondement légal : 7° du I de l'article 242 nonies A de l'annexe II au CGI.

### 4.1 Les règles

| Règle | Contenu | Source |
|---|---|---|
| **Unicité** | Chaque facture porte un numéro unique | 242 nonies A, I, 7° |
| **Chronologie** | Le numéro est fondé sur une **séquence chronologique**, attribuée au fur et à mesure de l'émission | BOI § 70 |
| **Continuité** | La séquence est **continue** : les ruptures ne sont pas autorisées | BOI § 90 |
| **Unicité annuelle** | « Deux factures émises la même année ne peuvent pas porter le même numéro » | BOI § 90 |
| **Séries distinctes** | **Admises** lorsque les conditions d'exercice de l'activité le justifient, à condition que chaque série soit elle-même chronologique et continue, et que le dispositif garantisse l'unicité annuelle. L'assujetti doit faire des séries « un usage conforme à leur justification initiale ». | BOI § 80, § 90, § 100 |
| **Justifications admises de séries** | Lieux de facturation multiples, catégories de clients distinctes, modes de facturation mixtes | BOI § 100 |
| **Mandataire** | Si un tiers établit matériellement les factures, sa séquence doit être chronologique, continue et **propre à l'assujetti** | BOI |

### 4.2 Numéro annulé, rupture de série

**À instruire, avec une position de repli sûre.** Le BOFiP consulté **n'énonce pas** de procédure explicite pour un numéro attribué puis abandonné. Ce qu'il énonce, c'est l'exigence de continuité. La position de repli — à faire valider par l'expert-comptable — est donc :

- **ne jamais laisser un trou sans explication** : si un numéro est réservé puis la facture non émise, le produit doit conserver une **trace du numéro et du motif**, consultable, plutôt que de faire disparaître le numéro ;
- **ne jamais réattribuer** un numéro consommé ;
- **préférer l'annulation par facture rectificative ou avoir** (§ 5) à toute suppression, ce qui supprime le problème : le numéro reste utilisé, et son annulation est documentée.

### 4.3 Modifier un numéro après émission

**À instruire — mais la réponse pratique est non.** Aucune disposition autorisant la modification d'un numéro déjà émis n'a été trouvée, et une telle modification contredirait frontalement l'exigence d'unicité et de continuité. Le produit ne doit pas l'offrir.

**Écart produit.** Le dépôt actuel **le permet** : en édition, `app/(app)/comptabilite/actions.ts` reprend le numéro posté par le client —

```ts
const invoiceNumber = id
  ? str(formData.get("invoice_number"))      // ← édition : le client fixe le numéro
  : await reserveInvoiceNumber(/* … */);
```

— sans aucun contrôle d'unicité, de format ou de non-régression. Le commentaire du code l'assume (« modifiable à la main si besoin »). Par ailleurs, `docs/context/CURRENT_STATE.md` note qu'**aucune contrainte d'unicité n'existe en base** sur `invoice_number`. Deux factures peuvent donc porter le même numéro.

**Ce qui est bien fait et doit être conservé.** Le compteur de `supabase/migration_010.sql` est **atomique** (`next_invoice_seq`, upsert verrouillant) et garantit qu'« un numéro attribué ne sera jamais réutilisé, même si la facture est supprimée ensuite ». C'est exactement la bonne propriété. Le mécanisme de *portée* (`counterScope`, `lib/invoiceNumber.ts`) implémente par ailleurs, de fait, la notion de **séries distinctes** du BOFiP : un modèle contenant `{AAAA}` ouvre une série par an. **Point à instruire : la remise à zéro annuelle constitue-t-elle une série distincte « justifiée » au sens du § 80 ?** L'usage est universel et l'unicité annuelle est respectée, mais la justification formelle mérite d'être validée par l'expert-comptable.

---

## 5. Immuabilité et correction

### 5.1 Peut-on supprimer une facture émise ?

**Réponse pratique : non. Statut : vérifié par déduction, à faire confirmer.**

Aucune disposition consultée n'autorise expressément la suppression d'une facture émise, et **trois règles vérifiées l'excluent en pratique** :

1. **La continuité de la numérotation** (§ 4) : supprimer une facture crée une rupture de séquence, que le BOFiP n'autorise pas (BOI-TVA-DECLA-30-20-20-10 § 90).
2. **L'obligation de conservation** (§ 7) : la facture est une pièce justificative dont la conservation est imposée par l'article L. 102 B du LPF.
3. **L'existence même d'un régime de la facture rectificative** (§ 5.2) : le droit organise la *correction* d'une facture, ce qui n'aurait pas de sens si l'effacement était admis.

La règle opérationnelle est donc : **une facture émise ne se supprime pas, elle s'annule** — par facture de remplacement ou par avoir.

> **À instruire.** L'obligation d'inaltérabilité *logicielle* (article 286, I, 3° bis du CGI, dispositif « logiciels de caisse ») n'a **pas** été vérifiée pendant cette session, et son champ est incertain ici : elle vise les assujettis enregistrant les règlements de clients particuliers au moyen d'un logiciel de caisse, et son application à un professionnel dont **toutes les opérations sont exonérées** de TVA doit être tranchée. **Ne pas affirmer que le produit y est soumis, ni qu'il en est dispensé.** Source à consulter : art. 286, I, 3° bis CGI, BOI-TVA-DECLA-30-10-30 ; responsable de validation : expert-comptable.

**Écart produit — le plus grave de cette revue.** `app/(app)/comptabilite/actions.ts` expose :

```ts
export async function deleteInvoice(formData: FormData) {
  const supabase = await createClient();
  const id = str(formData.get("id"));
  if (id) await supabase.from("invoices").delete().eq("id", id);   // ← suppression physique
  revalidatePath("/comptabilite");
  revalidatePath("/");
}
```

Une facture émise, numérotée et potentiellement remise au patient est **physiquement supprimée**, sans trace, sans avoir, sans motif, sans horodatage, et sans que l'erreur d'écriture soit même remontée (aucun contrôle du retour). Le compteur de numéros, lui, ne recule pas — la série présente donc un trou définitif et inexpliqué. C'est exactement le défaut que `docs/clinical/CLINICAL_SAFETY.md` interdit côté clinique (« mécanisme de correction sans effacer silencieusement l'historique ») et qui n'a pas été transposé côté comptable.

**Correction attendue :** remplacer la suppression par une **annulation** qui conserve la ligne, porte un statut (`annulee`), une date, un motif, et déclenche l'émission d'un avoir ou d'une facture de remplacement. Réserver une suppression réelle au seul cas du **brouillon jamais numéroté**.

### 5.2 Facture rectificative et avoir

**Statut : vérifié.**

> Source : BOFiP, **BOI-TVA-DECLA-30-20-20-20**, version du **25/09/2019** (mise à jour 19/01/2022), § 180 à § 270 — https://bofip.impots.gouv.fr/bofip/142-PGP.html/identifiant=BOI-TVA-DECLA-30-20-20-20-20190925 — consulté le 2026-09-11. Fondement : **5 du I de l'article 289 du CGI**.

**Définition (art. 289, I, 5 CGI ; BOI § 180).** Est assimilé à une facture « tout document ou message qui modifie la facture initiale et qui y fait référence **de façon spécifique et non équivoque** ».

Deux modalités, soumises au même régime de mentions :

| | **Facture de remplacement** | **Note d'avoir** |
|---|---|---|
| Effet | **Annule et remplace** intégralement la facture initiale | Vient **en déduction** sans supprimer la facture initiale |
| BOFiP | § 240–250 | § 260–270 |
| Doit porter | **la référence exacte à la facture initiale** et **la mention expresse de l'annulation de celle-ci** ; toutes les mentions obligatoires du I de l'art. 242 nonies A | **la référence à la facture initiale** (ou à la période contractuelle si plusieurs factures sont concernées) ; les **noms et adresses des parties** ; le **montant total hors taxe et de la TVA due après application de la réduction** |
| Usage typique | Erreur sur l'identité, le libellé, le montant, découverte avant ou après remise | Annulation partielle, geste commercial, séance facturée puis non due |

**Mentions dispensables (BOI § 180).** Les factures rectificatives peuvent omettre les mentions des **2° et 12°** du I de l'article 242 nonies A — « quel que soit son montant ».

**Ce que cela impose au modèle de données.**

- Un **type de document** : `facture | facture_de_remplacement | avoir`, et non un simple booléen.
- Un **lien typé et obligatoire vers la pièce rectifiée** (`rectifie_id`), qui porte à la fois le numéro et la date de la facture initiale — « de façon spécifique et non équivoque » exige les deux.
- La **référence imprimée** sur le document, pas seulement stockée : la mention doit apparaître sur le PDF remis.
- Pour une facture de remplacement, une **mention expresse d'annulation** dans le rendu.
- Un **statut sur la facture initiale** (`remplacee_par`, `annulee_par_avoir`), pour qu'elle ne soit plus comptée deux fois dans les agrégats de `app/(app)/comptabilite/summary.ts`.
- Une **numérotation propre** : l'avoir et la facture de remplacement sont des documents émis, donc numérotés. **À instruire** : doivent-ils partager la série des factures ou constituer une série distincte au sens du § 80 ? L'usage courant est une série distincte préfixée (`AV-2026-001`) ; la justification formelle est à faire valider.

**Écart produit.** Aucune de ces notions n'existe : `public.invoices` (`supabase/schema.sql`) n'a ni type de document, ni lien de rectification, ni statut d'annulation. Le seul statut modélisé est le **statut de paiement**, et il est *dérivé* des montants (`paymentStatus`, `summary.ts`), pas stocké. Toute correction se fait aujourd'hui par réécriture en place de la ligne d'origine, ce qui efface l'état antérieur.

---

## 6. Facturation électronique

**Statut : vérifié pour le calendrier et le périmètre ; la conclusion pratique pour ce produit est importante et contre-intuitive.**

### 6.1 Le calendrier

| Date | Obligation | Qui |
|---|---|---|
| **1er septembre 2026** | **Recevoir** des factures électroniques | **Toutes** les entreprises assujetties à la TVA établies en France |
| **1er septembre 2026** | **Émettre** des factures électroniques | Grandes entreprises et ETI |
| **1er septembre 2027** | **Émettre** des factures électroniques | PME, TPE, micro-entreprises, indépendants |

> Sources : entreprendre.service-public.gouv.fr, fiche F31808, vérifiée le **11/08/2026**, citant la **LOI n° 2023-1322** — https://entreprendre.service-public.gouv.fr/vosdroits/F31808 ; article **289 bis du CGI**, Légifrance, « Version en vigueur depuis le 21/02/2026 » — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000046195635 — consultés le 2026-09-11.

**La première échéance est passée depuis dix jours à la date de rédaction.** Le produit doit en tenir compte immédiatement.

### 6.2 Le périmètre — et pourquoi les soins en sont exclus

**Statut : vérifié.**

L'article **289 bis du CGI** impose la forme électronique lorsque « l'émetteur de la facture et son destinataire sont des assujettis qui sont établis ou ont leur domicile ou leur résidence habituelle en France », pour les opérations visées au a et au d du 1 du I de l'article 289. Or **le a du 1 du I de l'article 289 vise les opérations « qui ne sont pas exonérées en application des articles 261 à 261 E »**.

L'article **290 du CGI** (e-reporting, transmission des données de transaction) est bâti sur la même exclusion : il vise quatre catégories d'opérations **non exonérées au titre des articles 261 à 261 E**.

> Sources : article 289 bis du CGI, Légifrance — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000046195635 ; article 290 du CGI, Légifrance, « en vigueur depuis le 21/02/2026 », modifié par la **loi n° 2026-103 du 19 février 2026, art. 123** — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000046195617 — consultés le 2026-09-11.

**Conclusion pour ce produit :**

| Flux | Facturation électronique obligatoire ? | e-reporting ? |
|---|---|---|
| **Soins facturés à un patient** (exonérés 261, 4, 1° ; destinataire non assujetti) | **Non**, à double titre | **Non** (opération exonérée 261 à 261 E) |
| **Prestation hors soins à un professionnel français** (formation, atelier en institution, vacation) | **Oui**, à l'échéance applicable à la taille de l'entreprise | Selon le cas |
| **Rétrocession / redevance entre deux professionnels français non exonérée** | **Oui** | Selon le cas |
| **Factures reçues des fournisseurs** (loyer, matériel, logiciel, assurance, énergie) | **Le professionnel doit pouvoir les recevoir depuis le 1er septembre 2026** | — |

**Le point le plus important est la troisième ligne du tableau du § 6.1 lue avec celui-ci : l'obligation de *réception* n'est pas écartée par l'exonération.** Un psychomotricien exonéré reste un **assujetti** ; ses fournisseurs basculent leurs factures dans le circuit électronique. **À instruire** : l'obligation de réception de l'article 289 bis s'applique-t-elle à un assujetti dont *toutes* les opérations en sortie sont exonérées, dès lors qu'il est *destinataire* d'une facture émise par un fournisseur non exonéré ? La lecture littérale (« l'émetteur **et** son destinataire sont des assujettis ») le suggère fortement. **Source à consulter : BOFiP à paraître sur 289 bis, DGFiP ; responsable de validation : expert-comptable.**

### 6.3 Plateforme agréée (ex-PDP)

**Statut : vérifié.**

L'article 289 bis dispose que « l'émission, la transmission et la réception des factures électroniques s'effectuent en recourant à une **plateforme agréée** », l'État maintenant un **annuaire central** des plateformes pour l'adressage des factures. La terminologie a évolué : les « plateformes de dématérialisation partenaires » (PDP) sont désormais désignées comme **plateformes agréées (PA)**, immatriculées par l'État.

### 6.4 Ce qu'un logiciel non agréé peut légitimement annoncer

C'est une question de loyauté commerciale autant que de conformité. Formulations **admissibles** et **inadmissibles** :

| ✅ Admissible | ❌ Inadmissible |
|---|---|
| « Vos factures de soins sont exonérées de TVA : elles ne relèvent pas de l'obligation de facturation électronique. » (si la qualification est établie) | « Logiciel conforme à la facturation électronique 2026 » |
| « Psychomotime n'est pas une plateforme agréée. Pour vos prestations hors soins facturées à des professionnels, vous devrez passer par une plateforme agréée. » | « Certifié PDP » / « Agréé par l'État » |
| « Export du document au format PDF/A-3 ou Factur-X, à transmettre via votre plateforme agréée. » | « Conforme Factur-X » sans test d'interopérabilité réel |
| « Nous ne recevons pas vos factures fournisseurs : cette obligation vous incombe depuis le 1er septembre 2026. » | Silence sur l'obligation de réception |

**Recommandation produit.** Afficher, dans les paramètres de comptabilité, un encart informatif **daté et sourcé** rappelant (a) que les soins sont hors périmètre, (b) que l'obligation de réception est en vigueur, (c) que le produit n'est pas une plateforme agréée. Cet encart doit lire la table `efacture_calendrier` (§ 11) et non un texte codé en dur, puisque la dernière échéance de 2027 peut encore bouger — celle de 2026 avait déjà été reportée une fois.

---

## 7. Conservation

**Statut : vérifié, avec une nuance importante que les sources secondaires manquent systématiquement.**

### 7.1 Obligation fiscale — article L. 102 B du LPF

> Source : article **L. 102 B du Livre des procédures fiscales**, Légifrance, en vigueur depuis le **1er janvier 2023** — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041471233/ — consulté le 2026-09-11.

| Point | Contenu |
|---|---|
| **Durée** | **6 ans** |
| **Point de départ** | La date de la **dernière opération** mentionnée sur les livres et registres, ou la date à laquelle les documents ont été **établis** |
| **Documents couverts** | Livres, registres, documents et pièces sur lesquels peuvent s'exercer les droits de communication, d'enquête et de contrôle de l'administration — support papier et informatique, pièces justificatives, documentation des systèmes et traitements informatisés |
| **Forme** | Les documents **établis ou reçus sous forme électronique doivent être conservés sous cette forme** pendant le délai. Les documents papier peuvent être numérisés et conservés sous forme électronique, ou conservés sur papier. |
| **Cas particulier** | Registres des articles 298 sexdecies F, G et H du CGI : **10 ans** à compter du 31 décembre de l'année de l'opération (sans objet ici) |

### 7.2 Obligation comptable — article L. 123-22 du code de commerce

**Statut : à instruire — la nuance est décisive.**

L'article **L. 123-22 du code de commerce** impose une conservation de **10 ans** des documents comptables et pièces justificatives. **Mais cet article figure au livre Ier du code de commerce, dont le champ vise les commerçants.** Un psychomotricien libéral exerçant en entreprise individuelle **n'est pas commerçant** : il relève des bénéfices non commerciaux, et ses obligations comptables sont celles de l'**article 99 du CGI** (livre-journal chronologique des recettes et dépenses, registre des immobilisations et amortissements).

**Il ne faut donc pas affirmer sans vérification que le délai de 10 ans s'impose à lui.** Les sources secondaires consultées présentent systématiquement « 10 ans » comme la règle universelle, sans discuter le champ d'application.

- **Point à instruire :** l'article L. 123-22 c. com. s'applique-t-il à un professionnel libéral en BNC ? Quelle durée de conservation s'impose réellement à lui — 6 ans (LPF), 10 ans, ou une combinaison selon le type de pièce ?
- **Sources à consulter :** art. L. 123-22 et L. 123-12 c. com. (champ d'application), art. 99 CGI, BOI-BNC-DECLA-10-20.
- **Responsable de validation :** expert-comptable.
- **Position de repli recommandée en attendant :** conserver **10 ans**, durée la plus longue, et ne pas proposer de purge automatique avant validation. Une conservation trop longue est un risque RGPD à documenter (minimisation), pas une infraction comptable ; l'inverse n'est pas vrai.

### 7.3 Articulation avec le RGPD

**À instruire, et à ne pas trancher ici.** La durée de conservation comptable et la durée de conservation des données de santé ne sont pas les mêmes, ne reposent pas sur la même base légale, et ne portent pas sur les mêmes objets. Une facture contient à la fois une donnée comptable (montant, numéro, date) et une donnée d'identité, et le seul fait qu'elle émane d'un professionnel de santé peut la rendre indirectement révélatrice d'un état de santé. Conformément à `docs/security/DATA_CLASSIFICATION.md` (« appliquer la classe la plus élevée lorsqu'un objet mélange plusieurs catégories »), la facture est à traiter comme **sensible**.

**À faire instruire par le responsable de la protection des données et un juriste**, pas par l'expert-comptable seul.

---

## 8. Cotisations sociales

### 8.1 Quel organisme ?

**Statut : vérifié pour le texte ; contesté en pratique.**

Le psychomotricien **n'est pas affilié à la CARPIMKO**. La CARPIMKO couvre les auxiliaires médicaux conventionnés (infirmiers, masseurs-kinésithérapeutes, pédicures-podologues, orthophonistes, orthoptistes) — le psychomotricien n'en fait pas partie, sa profession n'étant pas conventionnée avec l'assurance maladie.

Le psychomotricien figure **explicitement** à l'article **L. 640-1 du code de la sécurité sociale**, item 1 : « médecin, […] chirurgien-dentiste, sage-femme, pharmacien, auxiliaire médical, psychothérapeute, psychologue, **psychomotricien**, ergothérapeute, ostéopathe, chiropracteur, diététicien ». Il relève à ce titre de l'organisation autonome d'assurance vieillesse des professions libérales, section **CIPAV**.

> Source : article L. 640-1 du code de la sécurité sociale, Légifrance, **en vigueur depuis le 28 décembre 2023**, modifié par la **LOI n° 2023-1250 du 26 décembre 2023, art. 24** — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048684761 — consulté le 2026-09-11.

**Recouvrement.** Depuis le **1er janvier 2023**, l'**URSSAF** — et non plus la CIPAV — recouvre les cotisations de retraite de base, de retraite complémentaire et d'invalidité-décès des professionnels relevant de la CIPAV. La CIPAV conserve la gestion du dossier retraite et le versement des prestations. L'URSSAF est donc l'interlocuteur unique du recouvrement.

> Source : urssaf.fr, *Réforme de l'assiette sociale et du barème des cotisations sociales* — https://www.urssaf.fr/accueil/independant/comprendre-payer-cotisations/reforme-cotisations-independants.html — consulté le 2026-09-11.

**Difficulté réelle à signaler — à instruire.** Des organisations professionnelles de psychomotriciens (AFPL, Fédération Française des Psychomotriciens) ont publiquement signalé que **certaines URSSAF classent les psychomotriciens en profession non réglementée**, avec des conséquences directes sur l'affiliation et sur les taux appliqués. Le produit ne doit donc **pas** déduire l'affiliation de la profession déclarée : **elle doit être saisie par l'utilisateur d'après ses propres avis d'appel de cotisations**, et non devinée.

### 8.2 Assiette

**Statut : vérifié pour l'architecture de la réforme ; taux non vérifiés sur source primaire.**

Une **réforme de l'assiette sociale des travailleurs indépendants** s'applique à compter de **2026**, sur les revenus 2025 déclarés lors de la campagne d'avril 2026. Elle instaure :

- une **assiette unique** pour les cotisations et pour la CSG-CRDS : le revenu professionnel brut, hors cotisations sociales, diminué d'un **abattement forfaitaire de 26 %** ;
- cet abattement étant **encadré** par un plancher de **1,76 % du PASS** et un plafond de **130 % du PASS**.

Le **PASS 2026** est de **48 060 €** (arrêté du 22 décembre 2025, JO du 23 décembre 2025), soit un PMSS de 4 005 €.

> Sources : urssaf.fr, page de la réforme (ci-dessus) ; arrêté du 22 décembre 2025 portant fixation du plafond de la sécurité sociale pour 2026, Légifrance — https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053143451 — consultés le 2026-09-11.

**Les valeurs de plancher (845,86 €) et de plafond (62 478 €) de l'abattement, ainsi que le taux de 26 %, proviennent de sources secondaires et sont marqués « à instruire » dans la table `cotisations_parametres` (§ 11).**

### 8.3 Table des taux — non fournie, et c'est un constat, pas un oubli

**Statut : à instruire.** La page URSSAF portant le barème détaillé — *Taux de cotisations — Profession libérale réglementée relevant de la Cipav*, https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-plr-cipav.html — **n'a pas pu être consultée pendant cette session** (le serveur a interrompu la connexion à trois reprises). Conformément aux règles du dépôt, **aucune valeur n'est reproduite ici depuis une source secondaire.**

La table `cotisations_taux` (§ 11) est donc livrée **avec sa structure et sans ses valeurs**, à remplir depuis les deux pages officielles :

- profession libérale réglementée **relevant de la CIPAV** : https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-plr-cipav.html
- profession libérale réglementée **hors CIPAV** : https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-plr-hors-cipav.html

Lignes à renseigner pour chacune : maladie-maternité ; indemnités journalières ; allocations familiales ; CSG-CRDS ; retraite de base ; retraite complémentaire ; invalidité-décès ; contribution à la formation professionnelle. Pour chaque ligne : taux, assiette, bornes en PASS, date d'entrée en vigueur, URL, date de consultation.

Le seul élément de barème relevé, **à vérifier avant usage** : pour les professions CIPAV, le taux de retraite complémentaire passerait de 9 % à 11 % sur la part plafonnée et de 22 % à 21 % au-delà d'un PASS, et le taux de retraite de base de première tranche de 8,23 % à 8,73 %, lors de la régularisation d'avril 2026. **Source secondaire uniquement — ne pas coder.**

### 8.4 Pourquoi un « taux URSSAF » unique est une approximation

C'est le cœur de la critique du moteur actuel, et il faut le dire au professionnel, pas seulement au développeur.

Un taux unique est faux pour **six raisons cumulatives** :

1. **Il n'y a pas une cotisation, il y en a huit** (§ 8.3), chacune avec son propre taux.
2. **Plusieurs sont progressives ou à tranches** : le taux effectif dépend du niveau de revenu et se lit en parts de PASS. Un taux moyen constant ne peut pas reproduire une fonction par tranches.
3. **Certaines sont forfaitaires ou à minima** : elles sont dues même à revenu nul ou faible, ce qu'un pourcentage du chiffre d'affaires ne produit jamais.
4. **L'assiette n'est pas le chiffre d'affaires** : c'est le **revenu professionnel** (recettes moins charges déductibles), après l'abattement de 26 % de la réforme 2026. Appliquer un taux au brut encaissé, comme le fait le code actuel, est doublement décalé.
5. **Le rythme n'est pas celui des recettes** : les cotisations sont appelées sur une base provisionnelle puis **régularisées** l'année suivante. Ce qui est « dû » au titre d'un mois n'est pas ce qui est appelé ce mois-là.
6. **La première année et les débuts d'activité** relèvent de règles propres (assiettes forfaitaires, exonérations éventuelles), et des dispositifs comme l'ACRE ou une exonération ZFRR modifient le résultat.

**Comment le logiciel doit le présenter honnêtement.** Quatre exigences, et elles sont non négociables :

- **Nommer la chose exactement.** Jamais « URSSAF », jamais « cotisations ». Écrire : **« Provision estimée pour cotisations sociales »**.
- **Afficher la formule et le taux employés**, à côté du chiffre, avec la date du paramétrage : « estimation = 23,2 % du brut après rétrocession — taux saisi par vous le 12/03/2026 ».
- **Afficher un avertissement permanent, pas un tooltip** : « Cette estimation n'est ni un appel de cotisations, ni une déclaration. Elle ne tient compte ni des tranches, ni des minima, ni de la régularisation. Seuls vos avis URSSAF font foi. »
- **Ne jamais agréger cette estimation dans un total présenté comme un résultat** (« revenu net », « net après charges »). Le produit le fait aujourd'hui dans `summarize()` et dans l'export CSV.

**Écart produit.** `lib/calc.ts` calcule `urssaf = round2(afterRetro * settings.urssaf_rate)` avec un `urssaf_rate` unique (défaut `0.232`, `supabase/schema.sql`), appliqué au **brut après rétrocession** et non à un revenu. La colonne SQL est `urssaf_amount`, la colonne dérivée est **`net_revenue`**, l'export CSV titre la colonne **« URSSAF »** et la ligne **« Revenu net »** (`app/(app)/comptabilite/csv.ts`). Rien, ni dans le nom des colonnes, ni dans l'export, ni dans le schéma, ne signale qu'il s'agit d'une estimation. Un document exporté sous ce libellé peut être transmis à un tiers et lu comme un chiffre déclaratif.

> **Renommage recommandé** (migration de colonnes et libellés) : `urssaf_amount` → `provision_cotisations_estimee`, `net_revenue` → `revenu_apres_provisions_estime`, colonne CSV « URSSAF » → « Provision cotisations (estimation) ». Le renommage est plus important que la correction du calcul : un chiffre approximatif correctement nommé est utilisable ; un chiffre approximatif nommé « URSSAF » ne l'est pas.

---

## 9. PCO et forfait d'intervention précoce

**Statut : vérifié pour le circuit ; tarifs et rejets à instruire.**

### 9.1 Le dispositif

Le **forfait d'intervention précoce** finance les interventions de trois professions non conventionnées — **psychomotricien**, ergothérapeute, psychologue — auprès d'enfants suivis par une **plateforme de coordination et d'orientation (PCO)** pour un trouble du neurodéveloppement. Il couvre des bilans et interventions qui ne sont pas remboursés par l'assurance maladie de droit commun.

> Sources : ameli.fr, *Rémunération des professionnels libéraux dans les PCO : les étapes clés*, page mise à jour le **26/06/2024** — https://www.ameli.fr/etablissement/exercice-professionnel/facturation-prise-charge/remuneration-des-professionnels-liberaux-dans-les-pco-les-etapes-cles ; ameli.fr, *Guide des structures coordinatrices PCO-TND* (PDF) — https://www.ameli.fr/sites/default/files/Documents/Guide-structures-coordinatrices-PCO-TND.pdf ; handicap.gouv.fr, *Forfait d'intervention précoce*, fiche technique — https://handicap.gouv.fr/sites/handicap/files/2025-04/TND-fiche-technique-forfait-intervention-2025.pdf — consultés le 2026-09-11.

### 9.2 Le circuit de facturation

| Étape | Contenu | Statut |
|---|---|---|
| **Payeur** | **La caisse d'assurance maladie (CPAM)**, qui verse directement la rémunération au professionnel. **Depuis le 1er juin 2024** — auparavant, c'était la structure porteuse de la PCO qui payait. | Vérifié |
| **Prérequis 1** | Enregistrement au **RPPS** (répertoire partagé des professionnels intervenant dans le système de santé), obtenu via l'ARS / esante.gouv.fr | Vérifié |
| **Prérequis 2** | Inscription au **FNPS** (fichier national des professionnels de santé), via la CPAM | Vérifié |
| **Prérequis 3** | **Attestation de coopération** délivrée par chaque PCO avec laquelle le professionnel travaille | Vérifié |
| **Support** | Le **formulaire de facturation des parcours en PCO** — un document dédié, **ni une facture libre, ni une feuille de soins SESAM-Vitale** | Vérifié |
| **Circuit** | Le professionnel transmet ses factures **à la PCO**, qui les **transmet à la CPAM** | Vérifié |
| **Périodicité** | **Mensuelle** | Vérifié |
| **Reste à charge patient** | Le dispositif dispense la famille d'avance de frais pour les prestations couvertes | **À instruire** — non explicité sur la page consultée |
| **Rejets et retours** | Motifs, délais, procédure de correction, réémission | **À instruire** — non documenté sur la page consultée. Source à consulter : CPAM de rattachement, guide des structures coordinatrices PCO-TND |
| **Tarifs / montants du forfait** | Montants par tranche d'âge (0-6 ans, 7-12 ans) et par type d'acte | **À instruire** — non chiffré sur les pages consultées. Source : fiche technique handicap.gouv.fr, arrêté tarifaire, Légifrance |
| **Durée du parcours** | Au moins un an, prolongation de 6 mois possible sous conditions | Vérifié |

### 9.3 Ce que cela implique pour le modèle de données — et c'est structurant

**Une case à cocher ne modélise pas un circuit.** Le dépôt actuel représente le PCO par un booléen `has_pco` sur la facture (`supabase/schema.sql`), rendu par le suffixe atténué `« (PCO) »` dans la désignation de ligne (`lib/invoiceDocument.ts`, `invoiceSuffixes`). Le glossaire du projet le relève déjà : « Le produit n'en documente ni le sens ni la conséquence » (`docs/context/GLOSSARY.md`). Voici ce que le circuit réel exige :

1. **Le payeur n'est pas le patient.** Il faut une entité `payeur` distincte du patient, avec un **type** (`patient`, `responsable_legal`, `caisse_assurance_maladie`, `institution`, `organisme_tiers`). C'est la même correction que celle appelée au § 3.3 pour les factures institutionnelles : **un seul modèle règle les deux problèmes.**
2. **Le destinataire du document n'est pas le payeur.** Le document part à la **PCO**, qui le relaie à la **CPAM**, qui paie. Trois rôles distincts : bénéficiaire des soins (l'enfant), destinataire du document (la PCO), payeur (la CPAM).
3. **Le circuit a des prérequis vérifiables.** RPPS, FNPS et attestation de coopération sont des conditions de paiement. Le produit devrait les porter au niveau du profil et de la relation professionnel ↔ PCO, et **refuser de produire un document PCO si un prérequis est déclaré manquant** plutôt que de l'émettre et de le voir rejeté.
4. **La périodicité est mensuelle et groupée.** Le circuit produit un **bordereau mensuel multi-patients**, pas une facture par séance. C'est un objet que le modèle actuel ne peut pas représenter : `invoices` est mono-patient (`patient_id`, `patient_name`).
5. **Il faut un cycle de vie, avec des rejets.** Au minimum : `a_transmettre → transmis_pco → transmis_cpam → paye | rejete`. Un rejet doit porter un motif, une date, et permettre une réémission tracée — sans supprimer l'original (§ 5).
6. **Le support n'est pas le modèle de facture du produit.** Le formulaire PCO est un document imposé. Le produit ne doit pas prétendre le générer tant que sa forme exacte n'a pas été obtenue auprès de la CPAM. **À instruire.**
7. **Un parcours a une durée et des droits.** Un an, prolongeable de six mois. Facturer hors parcours ouvert, c'est un rejet certain. Le produit devrait porter la période de droits et alerter avant l'échéance.

**Qualification de la donnée.** Le fait qu'un enfant soit suivi en PCO-TND est une **information de santé** : elle révèle un suivi pour suspicion de trouble du neurodéveloppement. Le drapeau `has_pco`, aujourd'hui **imprimé sur la facture** et **exporté en clair dans le CSV** (colonne « PCO », `app/(app)/comptabilite/csv.ts`), doit être reclassé **« très sensible »** au sens de `docs/security/DATA_CLASSIFICATION.md`, et non traité comme une donnée comptable ordinaire. Son impression sur un document remis à un tiers est à réexaminer.

---

## 10. Rétrocession et loyer — deux objets qui ne se calculent pas pareil

**Statut : vérifié pour le principe de qualification ; traitement en micro-BNC à instruire.**

### 10.1 Trois situations à distinguer

| | **Remplacement** | **Collaboration** | **Location / sous-location** |
|---|---|---|---|
| Qui encaisse le patient ? | Le **remplaçant** | Le **collaborateur** (sa patientèle) | Chacun la sienne |
| Qui verse quoi ? | Le remplaçant **rétrocède** un % au titulaire | Le collaborateur verse une **redevance** au titulaire | Le locataire verse un **loyer** |
| Sens du flux | Remplaçant → titulaire | Collaborateur → titulaire | Locataire → bailleur |
| Nature | **Honoraires rétrocédés** | **Redevance de collaboration** | **Loyer** |
| Assiette | **Proportionnelle** aux honoraires encaissés | Souvent proportionnelle, parfois forfaitaire | **Forfaitaire**, indépendante de l'activité |

> Le sens du flux s'inverse entre les deux premiers cas : **le titulaire perçoit dans les deux, mais dans le remplacement c'est le remplaçant qui encaisse d'abord le patient, tandis que dans la collaboration chacun encaisse sa propre patientèle.** Confondre les deux inverse la déclaration.

### 10.2 Traitement déclaratif (déclaration contrôlée, formulaire 2035)

**Statut : vérifié quant au principe ; lignes exactes à confirmer.**

| Flux | Chez celui qui verse | Chez celui qui perçoit |
|---|---|---|
| **Honoraires rétrocédés** | Portés en **« à déduire — honoraires rétrocédés »** : ils viennent en **diminution des recettes**, ce n'est pas une charge d'exploitation | Ajoutés aux **recettes** (montant brut) |
| **Redevance de collaboration** | Portée en **charge déductible**, sur la ligne des locations de matériel et de mobilier | Constitue une **recette** |
| **Loyer** | **Charge déductible** (loyers et charges locatives) | Recette du bailleur |

**La conséquence est arithmétique, pas cosmétique.** Une rétrocession **réduit la base de recettes** ; un loyer **s'impute en charge**. Sur un même montant, les deux ne produisent pas le même chiffre d'affaires déclaré, donc pas la même assiette sociale, ni les mêmes seuils de régime. Traiter un loyer comme une rétrocession gonfle artificiellement une diminution de recettes ; traiter une rétrocession comme une charge gonfle le chiffre d'affaires déclaré et peut faire franchir indûment un seuil.

**Obligation DAS2 — à instruire.** La déductibilité des honoraires rétrocédés est conditionnée à leur déclaration sur l'**imprimé DAS2** (déclaration des honoraires versés) au-delà d'un seuil annuel par bénéficiaire. Le seuil de **2 400 € par an et par bénéficiaire** provient d'une source secondaire et **n'a pas été vérifié**. Source à consulter : article 240 du CGI, BOI-BIC-DECLA-30-70-20 ; responsable : expert-comptable. **Si le produit gère des rétrocessions versées, il doit produire le cumul annuel par bénéficiaire nécessaire à cette déclaration.**

### 10.3 Pourquoi ils ne se calculent pas de la même manière

| | **Rétrocession** | **Loyer** |
|---|---|---|
| Formule | `montant = base × taux` | `montant = valeur fixe` |
| Base | Les honoraires **encaissés**, pas facturés — et l'assiette exacte (brut ? après quels frais ?) relève du **contrat** | Aucune base |
| Varie avec l'activité | **Oui**, mécaniquement | **Non** |
| Un mois sans patient | Rétrocession nulle | **Loyer dû quand même** |
| Rattachement à une facture | **Oui**, ligne par ligne ou facture par facture | **Non** : c'est une charge de **période**, pas d'opération |
| Effet d'un impayé | La rétrocession ne devrait porter que sur l'encaissé | Aucun |

**Écart produit — trois défauts de conception.**

1. **Les deux modes sont exclusifs.** `charge_mode: "retrocession" | "loyer"` (`lib/types.ts`) force un choix. Or un praticien peut parfaitement verser une redevance de collaboration **et** un loyer, ou remplacer dans un cabinet tout en louant ailleurs. Le modèle devrait permettre **plusieurs engagements simultanés**, chacun typé.
2. **La rétrocession est calculée sur le facturé, pas sur l'encaissé.** `computeInvoice(revenueGross, …)` (`lib/calc.ts`) applique le taux à `revenue_gross`. La colonne `revenue_gross_paid` existe et n'est pas utilisée pour cela. Une facture impayée génère donc une rétrocession due. Or la logique du régime des recettes–dépenses, comme celle du contrat de remplacement, repose normalement sur l'**encaissement**. **À instruire** : l'assiette est contractuelle, mais le produit devrait au minimum permettre de choisir entre assiette « facturé » et assiette « encaissé », plutôt que d'imposer la première en silence.
3. **La rétrocession est présentée comme une charge.** Dans `summarize()` et dans l'export CSV, elle est retranchée du brut pour produire `brutMoinsRetro`, puis `net`. Fonctionnellement c'est une soustraction correcte ; **déclarativement, la nature de l'opération est perdue** : rien ne distingue, dans les données exportées, une diminution de recettes d'une charge d'exploitation. L'expert-comptable qui reçoit ce CSV ne peut pas remplir la 2035 correctement sans redemander l'information.

### 10.4 Rétrocession en micro-BNC — point ouvert important

**À instruire.** En micro-BNC, le bénéfice est déterminé par application d'un abattement forfaitaire aux **recettes**, sans déduction de charges réelles. La question — **les honoraires rétrocédés viennent-ils en diminution des recettes déclarées, ou bien le seuil et l'abattement s'apprécient-ils sur le brut encaissé avant rétrocession ?** — est déterminante à deux titres : elle change l'impôt, et elle change le franchissement du seuil de régime. **Source à consulter :** BOI-BNC-DECLA-20-10, BOI-BNC-BASE-20-10 ; **responsable : expert-comptable.** Le produit ne doit produire **aucun chiffre** sur cette hypothèse tant qu'elle n'est pas tranchée.

---

## 11. Tables versionnées — format exact que le code doit lire

### 11.1 Principe

**Aucune valeur réglementaire ne vit dans le code.** Le code lit une table qui répond à la question : *« quelle valeur de ce paramètre était en vigueur à telle date ? »*.

Cinq propriétés non négociables :

1. **Datée par l'effet, pas par la saisie.** Un taux 2027 publié en décembre 2026 doit être stockable sans prendre effet.
2. **Historique, jamais écrasée.** Une facture de 2025 doit se recalculer avec les paramètres de 2025. C'est la transposition de `DEC-004` du registre des décisions (figement des montants) au niveau des paramètres eux-mêmes.
3. **Sourcée.** URL + date de consultation sur **chaque entrée**, pas sur la table.
4. **Statuée.** `verifie` ou `a_instruire` — et le code **refuse d'utiliser** une entrée `a_instruire` pour produire un chiffre affiché comme fiable.
5. **Sans recouvrement.** Deux entrées du même paramètre ne peuvent pas être en vigueur au même moment. En SQL, cela s'impose par contrainte, pas par convention.

### 11.2 Champs communs à toute entrée

| Champ | Type | Obligatoire | Rôle |
|---|---|---|---|
| `cle` | texte | ✓ | Identifiant stable du paramètre, hiérarchique et versionnable (`tva.mention.exoneration_soins`) |
| `valeur` | JSON | ✓ | Nombre, chaîne, ou objet structuré (barème à tranches) |
| `unite` | texte | ✓ | `taux_decimal`, `centimes`, `euros`, `annees`, `texte`, `date` |
| `effet_du` | date | ✓ | Premier jour d'application |
| `effet_au` | date | ✗ | Dernier jour ; `null` = en vigueur sans terme connu |
| `source_url` | texte | ✓ | URL de la source **primaire** |
| `source_titre` | texte | ✓ | Intitulé et identifiant du texte (article, BOI-…, arrêté) |
| `source_type` | texte | ✓ | `legifrance`, `bofip`, `service_public`, `urssaf`, `ameli`, `autre` |
| `consulte_le` | date | ✓ | Date de consultation |
| `statut` | texte | ✓ | `verifie` \| `a_instruire` |
| `valide_par` | texte | ✗ | Qui a validé (`expert-comptable`, `juriste`), `null` tant que non validé |
| `valide_le` | date | ✗ | Date de validation |
| `note` | texte | ✗ | Réserve, condition d'application, renvoi |

### 11.3 Format JSON

Un fichier par domaine, versionné dans Git, lu au démarrage ou importé en base par migration.

```json
{
  "table": "tva",
  "version": "2026-09-11",
  "entrees": [
    {
      "cle": "tva.mention.exoneration_soins",
      "valeur": "Exonération de TVA — article 261, 4, 1° du code général des impôts",
      "unite": "texte",
      "effet_du": "2026-01-01",
      "effet_au": null,
      "source_url": "https://bofip.impots.gouv.fr/bofip/1139-PGP.html/identifiant=BOI-TVA-CHAMP-30-10-20-10-20250409",
      "source_titre": "BOI-TVA-CHAMP-30-10-20-10, version du 09/04/2025 ; art. 242 nonies A, I, 12° ann. II CGI",
      "source_type": "bofip",
      "consulte_le": "2026-09-11",
      "statut": "verifie",
      "valide_par": null,
      "valide_le": null,
      "note": "Formulation recommandée, non imposée : le 12° exige 'la référence à la disposition pertinente'. Dispense possible si facture <= 150 EUR HT (II de l'art. 242 nonies A)."
    },
    {
      "cle": "tva.mention.franchise_en_base",
      "valeur": "TVA non applicable, art. 293 B du code général des impôts",
      "unite": "texte",
      "effet_du": "2025-03-01",
      "effet_au": "2026-12-31",
      "source_url": "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000052488142",
      "source_titre": "Art. 293 B CGI — 'Version en vigueur du 01/03/2025 au 01/01/2027' — abrogé par Ordonnance n° 2025-1247 du 17/12/2025 art. 9",
      "source_type": "legifrance",
      "consulte_le": "2026-09-11",
      "statut": "verifie",
      "valide_par": null,
      "valide_le": null,
      "note": "Ne concerne PAS les soins (exonérés 261-4-1°). Bascule CIBS reportée au 01/01/2027 par ordonnance 2026-671 du 27/07/2026."
    },
    {
      "cle": "tva.mention.franchise_en_base",
      "valeur": null,
      "unite": "texte",
      "effet_du": "2027-01-01",
      "effet_au": null,
      "source_url": "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053091516",
      "source_titre": "Ordonnance n° 2025-1247 du 17 décembre 2025 (recodification TVA vers le CIBS)",
      "source_type": "legifrance",
      "consulte_le": "2026-09-11",
      "statut": "a_instruire",
      "valide_par": null,
      "valide_le": null,
      "note": "BLOQUANT au 01/01/2027 : référence CIBS de remplacement inconnue. Période transitoire évoquée jusqu'au 30/06/2028 par sources secondaires, NON VÉRIFIÉE. Responsable : expert-comptable."
    },
    {
      "cle": "tva.franchise.seuil_majore.services",
      "valeur": 4125000,
      "unite": "centimes",
      "effet_du": "2025-03-01",
      "effet_au": "2026-12-31",
      "source_url": "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000052488142",
      "source_titre": "Art. 293 B CGI",
      "source_type": "legifrance",
      "consulte_le": "2026-09-11",
      "statut": "verifie",
      "note": "41 250 EUR. Seuil de base 37 500 EUR : NON relu sur Légifrance, entrée séparée en statut a_instruire."
    }
  ]
}
```

**Note sur `valeur: null` avec `statut: "a_instruire"`.** C'est le mécanisme central. Au 1er janvier 2027, le code cherchera la mention de franchise, trouvera une entrée en vigueur dont la valeur est nulle et le statut `a_instruire`, et devra **refuser d'émettre** en affichant « mention légale non déterminée pour cette date — contactez votre expert-comptable », plutôt qu'imprimer une référence périmée. **Une table bien conçue fait échouer bruyamment ce qui échouerait silencieusement.**

### 11.4 Format SQL

```sql
-- Référentiel réglementaire daté et sourcé.
-- Lecture seule pour l'application ; alimenté par migration uniquement.
-- Aucune donnée patient, aucun secret : cette table est publiable en revue.

create table if not exists public.referentiel (
  id            uuid primary key default gen_random_uuid(),
  cle           text        not null,
  valeur        jsonb,                          -- null admis : « connu comme inconnu »
  unite         text        not null
                check (unite in ('taux_decimal','centimes','euros','annees','jours','texte','date','bareme')),
  effet_du      date        not null,
  effet_au      date,                           -- null = sans terme connu
  source_url    text        not null,
  source_titre  text        not null,
  source_type   text        not null
                check (source_type in ('legifrance','bofip','service_public','urssaf','ameli','autre')),
  consulte_le   date        not null,
  statut        text        not null
                check (statut in ('verifie','a_instruire')),
  valide_par    text,
  valide_le     date,
  note          text,
  cree_le       timestamptz not null default now(),

  -- Une entrée a_instruire ne peut pas porter une valeur utilisable sans réserve.
  constraint referentiel_valeur_verifiee
    check (statut = 'a_instruire' or valeur is not null),
  constraint referentiel_periode_coherente
    check (effet_au is null or effet_au >= effet_du)
);

-- INTERDIT LE RECOUVREMENT : deux valeurs d'une même clé ne peuvent pas
-- être en vigueur simultanément. C'est la garantie que « la valeur au
-- 12 mars 2026 » est une question qui a exactement une réponse.
create extension if not exists btree_gist;
alter table public.referentiel
  add constraint referentiel_sans_recouvrement
  exclude using gist (
    cle with =,
    daterange(effet_du, effet_au, '[]') with &&
  );

create index if not exists idx_referentiel_cle_periode
  on public.referentiel (cle, effet_du desc);

-- Lecture : la valeur en vigueur à une date donnée.
create or replace function public.referentiel_valeur(p_cle text, p_date date)
returns table (valeur jsonb, unite text, statut text, source_url text, note text)
language sql stable
as $$
  select r.valeur, r.unite, r.statut, r.source_url, r.note
  from public.referentiel r
  where r.cle = p_cle
    and daterange(r.effet_du, r.effet_au, '[]') @> p_date
  limit 1;
$$;

-- Le référentiel n'est pas une donnée d'utilisateur : il est lisible par tous
-- les comptes authentifiés et n'est écrit que par migration.
alter table public.referentiel enable row level security;
drop policy if exists "referentiel lisible" on public.referentiel;
create policy "referentiel lisible" on public.referentiel
  for select to authenticated using (true);
```

### 11.5 Clés à prévoir

| Domaine | Clés | Statut de remplissage |
|---|---|---|
| **TVA** | `tva.mention.exoneration_soins` · `tva.mention.franchise_en_base` · `tva.franchise.seuil_base.services` · `tva.franchise.seuil_majore.services` · `tva.franchise.seuil_base.total` · `tva.franchise.seuil_majore.total` | Partiellement rempli (§ 2) |
| **Facture** | `facture.mentions.communes` · `facture.mentions.b2b` · `facture.dispense_mentions.seuil_ht` (15000 centimes) · `facture.indemnite_recouvrement` (4000 centimes) · `facture.penalites_retard.taux` | `indemnite_recouvrement` vérifiée ; `penalites_retard.taux` **à instruire** (§ 3.2) |
| **Numérotation** | `numerotation.regle` · `numerotation.series_distinctes_admises` | Vérifié (§ 4) |
| **Rectification** | `rectification.mentions.facture_remplacement` · `rectification.mentions.avoir` | Vérifié (§ 5.2) |
| **E-facture** | `efacture.obligation_reception.date` (2026-09-01) · `efacture.obligation_emission.tpe_pme.date` (2027-09-01) · `efacture.perimetre.exclusion_exonerees` | Vérifié (§ 6) |
| **Conservation** | `conservation.lpf_l102b.duree` (6 ans) · `conservation.com_l123_22.duree` (10 ans) · `conservation.applicable_bnc` | Les deux premières vérifiées ; la troisième **à instruire** (§ 7.2) |
| **Régime fiscal** | `micro_bnc.seuil_recettes` (8 360 000 centimes, 2026-2028) · `micro_bnc.abattement.taux` (0.34) · `micro_bnc.abattement.plancher` (30500 centimes) | Vérifié (§ 1.3, sources ci-dessous) |
| **Cotisations** | `pass.annuel` (4 806 000 centimes, 2026) · `cotisations.abattement_assiette.taux` · `cotisations.abattement.plancher_pct_pass` · `cotisations.abattement.plafond_pct_pass` · `cotisations.taux.*` (8 lignes × 2 régimes) | `pass.annuel` vérifié ; **tout le reste à instruire** (§ 8.3) |
| **PCO** | `pco.payeur` · `pco.periodicite` · `pco.prerequis` · `pco.forfait.montant.*` | Circuit vérifié ; **montants à instruire** (§ 9.2) |

> Sources micro-BNC : seuil **83 600 €** pour les revenus **2026, 2027 et 2028** (loi de finances pour 2026, publiée au JO le 20/02/2026), confirmé par entreprendre.service-public.gouv.fr, page vérifiée le **21/02/2026** — https://entreprendre.service-public.gouv.fr/vosdroits/F32105 ; abattement **34 %** confirmé par BOFiP **BOI-BNC-DECLA-20-10**, version du **19/08/2026** — https://bofip.impots.gouv.fr/bofip/4807-PGP.html/identifiant=BOI-BNC-DECLA-20-10-20260819 — consultés le 2026-09-11. Le plancher de 305 € provient d'une source secondaire : **à instruire** (art. 102 ter CGI).

### 11.6 Deux règles d'usage dans le code

1. **Toute lecture passe par une date d'effet explicite.** `referentielValeur('micro_bnc.seuil_recettes', facture.date_emission)` — jamais `new Date()` implicite. Le module `lib/period.ts` montre déjà la bonne discipline (`resolvePeriod` reçoit ses dates), et `lib/invoiceDocument.ts` injecte son horloge (`options.now`) : c'est le modèle à généraliser.
2. **Un `statut = 'a_instruire'` ne produit pas de chiffre.** Il produit un **état d'interface** : « paramètre non validé — calcul indisponible ». Jamais un zéro, jamais une valeur par défaut. Même règle que l'absence de donnée clinique.

---

## 12. Arithmétique

### 12.1 Pourquoi pas les flottants — démonstration sur le code actuel

`lib/calc.ts` définit :

```ts
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
```

L'ajout de `Number.EPSILON` est une tentative de correction connue. **Elle ne fonctionne pas.** `Number.EPSILON` vaut ≈ 2,22 × 10⁻¹⁶ : c'est l'écart entre 1 et le flottant suivant. Dès que le nombre s'éloigne de 1, cette constante est trop petite pour compenser l'erreur de représentation, qui grandit avec la magnitude.

**Résultats exécutés** (Node, `round2` copiée telle quelle depuis `lib/calc.ts`) :

| Appel | Résultat du code | Attendu (demi-supérieur) |
|---|---|---|
| `round2(1.005)` | `1.01` | 1,01 ✅ |
| `round2(8.165)` | **`8.16`** | 8,17 ❌ |
| `round2(162.295)` | **`162.29`** | 162,30 ❌ |
| `round2(1.015)` | `1.02` | 1,02 ✅ |
| `round2(1234.565)` | `1234.57` | 1234,57 ✅ |

**Le défaut n'est pas qu'elle arrondisse mal : c'est qu'elle arrondisse mal *de façon imprévisible*.** Deux nombres qui se présentent de la même manière (une moitié exacte de centime) sont traités différemment selon leur magnitude. Aucune règle d'arrondi ne peut être documentée sur ce comportement, parce qu'il n'en suit aucune.

**Cas réalistes dans ce produit** — recherche exhaustive sur les montants multiples de 5 centimes entre 20 € et 3 000 € :

| Taux de rétrocession | Montant brut | Calculé par le code | Exact (demi-supérieur) |
|---|---|---|---|
| 25 % | **32,30 €** | **8,07 €** | 8,08 € |
| 25 % | 33,30 € | 8,32 € | 8,33 € |
| 30 % | **20,15 €** | **6,04 €** | 6,05 € |
| 30 % | 21,65 € | 6,49 € | 6,50 € |
| 15 % | 22,90 € | 3,43 € | 3,44 € |

Ce ne sont pas des montants exotiques : **32,30 € est un tarif de séance ordinaire.** 32,30 × 0,25 = 8,075 exactement en décimal ; mais 32,30 n'est pas représentable en binaire, le produit vaut 8,074999999999999 en flottant, et `Math.round(807.4999999999999)` donne 807.

**Propagation sur la chaîne complète.** Sur un brut de 162,295 €, avec 25 % de rétrocession et un taux de provision de 23,2 %, la chaîne en flottants et la chaîne en centimes entiers **divergent** :

| | Rétrocession | Après rétro. | Provision | Net |
|---|---|---|---|---|
| Flottants (code actuel) | 40,57 | **121,73** | 28,24 | **93,49** |
| Centimes entiers | 40,57 | **121,72** | 28,24 | **93,48** |

Un centime d'écart sur une ligne, multiplié par un volume annuel, produit un total qui ne se rapproche d'aucun relevé bancaire.

**Le risque n'est pas que théorique dans ce dépôt.** `supabase/migration_013.sql` installe une contrainte `CHECK` qui compare, côté PostgreSQL en `numeric` **exact**, le total de la facture à la somme des lignes. Le commentaire de la migration le dit explicitement : un passage par `float8` « introduirait un écart de dernière décimale que la contrainte transformerait en refus d'écriture inexplicable ». Le SQL est donc déjà exact ; **c'est le TypeScript qui ne l'est pas.** L'écart se manifestera par une insertion refusée que l'utilisatrice ne pourra pas comprendre.

### 12.2 La règle : centimes entiers

**Tout montant est un entier de centimes.** Pas un flottant arrondi à deux décimales : un entier.

| | Flottant | Entier de centimes |
|---|---|---|
| Stockage TS | `number` (IEEE 754) | `number` entier, ou `bigint` |
| `0,07 × 12` | `0.8400000000000003` | `7 × 12 = 84` → exact |
| Addition | Erreur cumulative | **Exacte** |
| Comparaison d'égalité | Interdite | **Sûre** |
| Correspondance SQL | `numeric` (conversion lossy) | `integer` / `bigint`, ou `numeric(12,2)` |

**Limite à connaître :** `Number.MAX_SAFE_INTEGER` = 9 007 199 254 740 991 centimes, soit plus de 90 000 milliards d'euros. Aucun risque ici. Les entiers restent donc utilisables dans `number`, ce qui évite la complexité de `bigint` ou d'une bibliothèque décimale.

**Où les convertir.** Aux deux frontières, et nulle part ailleurs :

- **entrée** : saisie utilisateur `"32,30"` → `3230` ;
- **sortie** : `3230` → `"32,30 €"` à l'affichage et à l'impression.

Entre les deux, **aucune division par 100**. Le module `lib/format.ts` (fonction `euro()`) est déjà le point de sortie unique — c'est la bonne architecture, il suffit de changer ce qu'il reçoit.

### 12.3 Règles d'arrondi

**À quel moment arrondir : une seule fois, au dernier moment de chaque calcul autonome.**

| Étape | Arrondir ? | Pourquoi |
|---|---|---|
| Prix unitaire saisi | Déjà en centimes | Point d'entrée |
| `prix_unitaire × quantité` | **Non** — le résultat est déjà entier | Multiplication d'un entier par un entier |
| `base × taux` (rétrocession, provision) | **Oui, ici et une seule fois** | Seule opération qui produit une fraction de centime |
| Somme des lignes | **Non** | Somme d'entiers |
| Total de facture | **Non** | Déjà exact |
| Agrégats de période | **Non** | Sommes d'entiers |
| Affichage | **Non** | Formatage d'un entier |

**Quelle règle d'arrondi : demi-supérieur (« arrondi commercial »), en valeur absolue.**

```ts
/**
 * Applique un taux à un montant en centimes.
 * Le taux est exprimé en dix-millièmes (23,20 % => 2320) pour rester entier :
 * un taux en flottant réintroduirait précisément le problème qu'on évite.
 * Arrondi demi-supérieur en valeur absolue, symétrique autour de zéro —
 * un avoir et la facture qu'il annule doivent s'arrondir de la même manière.
 */
export function appliquerTaux(montantCentimes: number, tauxDixMilliemes: number): number {
  const signe = Math.sign(montantCentimes * tauxDixMilliemes) || 1;
  const produit = Math.abs(montantCentimes * tauxDixMilliemes);
  const quotient = Math.floor(produit / 10000);
  const reste = produit % 10000;
  return signe * (reste * 2 >= 10000 ? quotient + 1 : quotient);
}
```

**Statut : à instruire.** La règle d'arrondi demi-supérieur est l'usage commercial français courant, mais **aucune source primaire imposant une règle d'arrondi pour les montants de facture hors TVA n'a été trouvée pendant cette session**. Des règles d'arrondi existent pour la TVA due et pour la déclaration fiscale (arrondi à l'euro le plus proche sur les déclarations), qui ne sont pas le même sujet. **Source à consulter : BOI-TVA-DECLA, doctrine sur l'arrondi ; responsable : expert-comptable.** En attendant : **choisir demi-supérieur, le documenter, et l'appliquer uniformément** — la cohérence importe davantage que le choix lui-même.

### 12.4 Écart de répartition

Répartir un forfait de 50,00 € sur 3 séances donne 16,67 € × 3 = **50,01 €**. L'écart d'un centime est inévitable ; ce qui est évitable, c'est qu'il soit invisible.

**Règle : le total fait foi, et l'écart est porté sur une ligne, jamais réparti silencieusement.** Si le produit ventile un forfait, il attribue `total − somme(parts déjà attribuées)` à la dernière part. **Ne jamais afficher une ventilation dont la somme ne fait pas le total imprimé.**

Le code actuel évite déjà ce piège dans un cas : au forfait, `lineAmount()` retourne le prix unique quel que soit le nombre de dates (« trois séances au forfait valent le forfait, pas trois fois ») et `validateInvoiceLines()` **refuse** une ligne « par date » dont la quantité ne suit pas le nombre de dates, précisément parce que « la somme des lignes imprimées ne ferait plus le total affiché ». **Ce raisonnement est juste et doit être la règle générale.**

---

## 13. Synthèse des écarts constatés dans le dépôt actuel

Constats de lecture du code au 2026-09-11. Ils n'ont **aucune valeur réglementaire** : ce sont des différences entre le code et le référentiel ci-dessus, à arbitrer par le produit.

| # | Écart | Où | Gravité | Section |
|---|---|---|---|---|
| **C-1** | **Une facture émise est physiquement supprimée**, sans avoir, sans motif, sans trace ; le compteur ne recule pas → trou définitif inexpliqué dans la série | `comptabilite/actions.ts` `deleteInvoice` | **Élevée** | § 5.1 |
| **C-2** | **Le numéro est modifiable après émission** et aucune contrainte d'unicité n'existe en base | `comptabilite/actions.ts` ; `supabase/schema.sql` | **Élevée** | § 4.3 |
| **C-3** | **Aucun régime de TVA n'est modélisé** : ni sur le compte, ni sur la prestation, ni sur la ligne ; aucune mention d'exonération n'est produite (les `legal_mentions` sont du texte libre facultatif) | `lib/types.ts` ; `lib/invoiceDocument.ts` | **Élevée** | § 2.4, § 3.1 |
| **C-4** | **Aucune facture rectificative, aucun avoir** : pas de type de document, pas de lien vers la pièce rectifiée, pas de statut d'annulation | `supabase/schema.sql` | **Élevée** | § 5.2 |
| **C-5** | **Les montants sont des flottants** ; `round2` produit des résultats faux sur des montants ordinaires (32,30 € × 25 %) et incohérents entre eux | `lib/calc.ts` ; `lib/invoiceLines.ts` | **Élevée** | § 12.1 |
| **C-6** | **Une estimation est nommée « URSSAF » et « Revenu net »** en base, à l'écran et dans l'export CSV, sans aucune réserve visible | `lib/calc.ts` ; `schema.sql` ; `comptabilite/csv.ts` | **Élevée** | § 8.4 |
| **C-7** | **Le PCO est un booléen** ; aucun payeur distinct du patient, aucun circuit, aucun statut de rejet, aucun bordereau mensuel multi-patients | `schema.sql` ; `lib/invoiceDocument.ts` | **Élevée** | § 9.3 |
| **C-8** | **Le drapeau PCO est imprimé sur la facture et exporté en clair**, alors qu'il révèle un suivi pour suspicion de TND | `lib/invoiceDocument.ts` ; `comptabilite/csv.ts` | **Élevée** | § 9.3 |
| **C-9** | **Aucune mention de l'article L. 441-9** n'est produite ; une facture à une institution est donc incomplète | `lib/invoiceDocument.ts` | **Moyenne** | § 3.3 |
| **C-10** | **Rétrocession et loyer sont exclusifs**, et la rétrocession est calculée sur le **facturé** et non sur l'**encaissé** | `lib/types.ts` `ChargeMode` ; `lib/calc.ts` | **Moyenne** | § 10.3 |
| **C-11** | **La nature déclarative de la rétrocession est perdue** : rien ne distingue, à l'export, une diminution de recettes d'une charge | `comptabilite/csv.ts` | **Moyenne** | § 10.2 |
| **C-12** | **La période comptable privilégie le mois de facturation sur la date d'encaissement**, alors que le régime BNC de droit commun est un régime d'encaissement | `lib/period.ts` `resolvePeriod` ; `invoicePeriod` | **Moyenne** | § 1.3 |
| **C-13** | **Les agrégats mélangent facturé et encaissé** : `net` est calculé sur `revenue_gross`, tandis que `brutPaye` suit `revenue_gross_paid` | `comptabilite/summary.ts` | **Moyenne** | § 1.3 |
| **C-14** | **Une ligne au forfait peut être émise sans date de réalisation** (item 10° de l'art. 242 nonies A) | `lib/invoiceLines.ts` `validateInvoiceLines` | **À instruire** | § 3.1 |
| **C-15** | **La date d'émission a un repli en cascade** qui fait bouger la date imprimée d'une impression à l'autre sur les anciennes factures | `lib/invoiceDocument.ts` | **Moyenne** | § 3.1 item 6° |

**Ce qui est bien conçu et doit être préservé dans la refonte :**

- le **figement** des valeurs sur la ligne de facture au moment de la création (`lib/invoiceLines.ts`) — le catalogue n'est relu nulle part ailleurs. **C'est exactement le bon principe**, et il doit être étendu au régime de TVA, au taux de rétrocession et aux mentions légales ;
- le **recalcul systématique côté serveur** des montants postés par le client ;
- le **refus de substitut silencieux** (`validateInvoiceLines`) plutôt que le remplissage d'une valeur plausible ;
- le **compteur de numéros atomique** de `migration_010.sql`, qui ne réattribue jamais un numéro ;
- la **contrainte SQL exacte** de `migration_013.sql` comparant le total aux lignes en `numeric` ;
- la **pureté** et l'**injection d'horloge** de `lib/invoiceDocument.ts`.

---

## 14. Ce que ce document ne dit pas

Pour éviter qu'une absence soit lue comme une autorisation :

- il **n'établit aucune conformité** — ni fiscale, ni comptable, ni RGPD, ni HDS ;
- il **ne qualifie pas acte par acte** ce qui est un soin exonéré et ce qui ne l'est pas (§ 2.3) ;
- il **ne contient aucune table de taux de cotisations** (§ 8.3) ;
- il **ne chiffre pas** le forfait d'intervention précoce (§ 9.2) ;
- il **ne tranche pas** la durée de conservation applicable à un BNC (§ 7.2) ;
- il **ne tranche pas** le traitement de la rétrocession en micro-BNC (§ 10.4) ;
- il **ne traite pas** la combinaison société à l'IS autrement que pour recommander de l'exclure du périmètre (§ 1.3) ;
- il **ne couvre pas** l'impôt sur le revenu, le prélèvement à la source, la CFE, la TVA sur les acquisitions intracommunautaires, ni les dispositifs d'exonération territoriale (ZFRR, ZRR).

---

## Validations externes nécessaires

Aucune des lignes ci-dessous ne peut être levée par une revue de code ou une recherche documentaire. Rien de ce qui est marqué **bloquant** ne doit atteindre la production.

### Expert-comptable — obligatoire avant toute mise en production d'un calcul déclaratif

| # | Point à valider | Réf. | Bloquant |
|---|---|---|---|
| EC-1 | **Table complète des taux de cotisations** URSSAF/CIPAV : 8 lignes, assiettes, tranches en PASS, minima, dates d'effet | § 8.3 | **Oui** |
| EC-2 | **Paramètres de la réforme d'assiette 2026** : taux d'abattement 26 %, plancher 1,76 % du PASS, plafond 130 % du PASS | § 8.2 | **Oui** |
| EC-3 | **Affiliation réelle** du psychomotricien (CIPAV ou autre) au vu des avis de cotisation, compte tenu de la difficulté signalée par les organisations professionnelles | § 8.1 | **Oui** |
| EC-4 | **Qualification TVA acte par acte** : réunions de synthèse, ateliers, formations, supervisions, ventes | § 2.3 | **Oui** |
| EC-5 | **Référence CIBS de remplacement** de l'article 293 B au 01/01/2027, et existence d'une période transitoire | § 2.5 | **Oui au 01/01/2027** |
| EC-6 | **Traitement de la rétrocession en micro-BNC** : diminution de recettes ou non | § 10.4 | **Oui** |
| EC-7 | **Durée de conservation applicable à un BNC** : L. 123-22 c. com. s'applique-t-il ? | § 7.2 | Non (repli 10 ans) |
| EC-8 | **Numérotation des avoirs** : série commune ou série distincte justifiée | § 5.2 | Non |
| EC-9 | **Remise à zéro annuelle du compteur** comme série distincte justifiée au sens du BOI § 80 | § 4.3 | Non |
| EC-10 | **Règle d'arrondi** applicable aux montants de facture et fondement | § 12.3 | Non (repli demi-sup.) |
| EC-11 | **Seuil DAS2** par bénéficiaire et obligations déclaratives associées | § 10.2 | Non |
| EC-12 | **Date de réalisation obligatoire** sur une ligne au forfait (item 10°) | § 3.1, C-14 | Non |
| EC-13 | **Seuils de base** de l'article 293 B (85 000 / 37 500 €) non relus sur Légifrance | § 2.2 | Non |
| EC-14 | **Plancher d'abattement micro-BNC** (305 €) non relu sur source primaire | § 11.5 | Non |
| EC-15 | **Montants du forfait d'intervention précoce** par tranche d'âge et type d'acte | § 9.2 | **Oui si PCO implémenté** |
| EC-16 | **Applicabilité de l'obligation d'inaltérabilité** (art. 286, I, 3° bis CGI) à un professionnel intégralement exonéré | § 5.1 | **Oui** |

### Juriste — droit des affaires et droit de la santé

| # | Point à valider | Réf. | Bloquant |
|---|---|---|---|
| JU-1 | **Obligation de réception de factures électroniques** pour un assujetti dont toutes les opérations en sortie sont exonérées | § 6.2 | **Oui** |
| JU-2 | **Formulations commerciales admissibles** sur la facturation électronique, au regard des pratiques commerciales trompeuses | § 6.4 | **Oui avant publication** |
| JU-3 | **Mention de l'assurance RCP** en facture : obligation ou non pour un professionnel de santé | § 3.4 | Non |
| JU-4 | **Nature juridique du formulaire PCO** et régime applicable à la relation professionnel ↔ CPAM ↔ PCO | § 3.3, § 9 | Non |
| JU-5 | **Mentions L. 441-9 applicables** aux factures institutionnelles émises par un professionnel de santé | § 3.3 | Non |

### Responsable de la protection des données — articulation avec le RGPD

| # | Point à valider | Réf. | Bloquant |
|---|---|---|---|
| DPO-1 | **Articulation durée comptable / durée de conservation des données de santé** | § 7.3 | **Oui** |
| DPO-2 | **Qualification du drapeau PCO** comme donnée de santé, et conséquences sur son impression et son export | § 9.3, C-8 | **Oui** |
| DPO-3 | **Minimisation sur la facture** : quelles données d'identité sont strictement nécessaires selon le type de destinataire | § 3 | Non |

### Psychomotricienne en exercice

| # | Point à valider | Réf. |
|---|---|---|
| PM-1 | Réalité des activités hors soins effectivement exercées, pour dimensionner § 2.3 | § 2.3 |
| PM-2 | Réalité du circuit PCO tel que vécu : délais, rejets, forme du formulaire | § 9.2 |
| PM-3 | Configuration réelle d'exercice : remplacement, collaboration, location, ou combinaison | § 10.1 |
| PM-4 | Acceptabilité du renommage « URSSAF » → « provision estimée » | § 8.4 |

---

## Journal des versions

| Date | Auteur | Contenu |
|---|---|---|
| 2026-09-11 | `general-purpose` (recherche) | Création. Sources primaires consultées le 2026-09-11 : Légifrance (art. 293 B, 289 bis, 290, 242 nonies A ann. II, L. 441-9 c. com., L. 102 B LPF, L. 640-1 CSS, arrêté PASS 2026, ordonnances 2025-1247 et 2026-671), BOFiP (BOI-TVA-CHAMP-30-10-20-10, BOI-TVA-DECLA-30-20-20-10, BOI-TVA-DECLA-30-20-20-20, BOI-BNC-DECLA-20-10), entreprendre.service-public.gouv.fr (F31808, F32105), ameli.fr (rémunération PCO), urssaf.fr (réforme d'assiette). **Non consultées** : pages de barème urssaf.fr (échec de connexion, § 8.3). |

**Prochaine relecture obligatoire :** à la publication de la loi de finances pour 2027, et **au plus tard le 1er décembre 2026** — la bascule CGI → CIBS du 1er janvier 2027 rend la mention de franchise en base (§ 2.4) et les références des articles 289 bis et 290 (§ 6) inexactes à cette date.
