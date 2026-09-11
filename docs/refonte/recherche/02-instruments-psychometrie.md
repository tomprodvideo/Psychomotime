# 02 — Instruments et psychométrie : cadre du registre d'instruments

> **Statut** : document de recherche préalable à la refonte. Aucune décision produit, aucune obligation juridique n'est établie ici.
> **Auteur** : agent `expert-bilans-comptes-rendus`, en lecture seule sur le dépôt.
> **Date de rédaction** : 2026-09-11. Dépôt observé : `/Users/tommarcon/Desktop/Manon SAAS/psychomotime`, branche `main`.
> **Portée** : conçoit un **registre de métadonnées d'instruments**. Ce registre n'est en aucun cas une copie numérique d'un manuel, d'un carnet de passation, d'une feuille de cotation ou d'une table d'étalonnage.

## Conventions de preuve

Chaque affirmation porte l'une des quatre marques suivantes. Une affirmation sans marque est une proposition de conception, donc discutable.

| Marque | Sens |
|---|---|
| **[FAIT]** | Vérifié dans le dépôt (fichier:ligne) ou dans une source externe citée avec son URL et sa date de consultation. |
| **[USAGE]** | Pratique courante et documentée, mais qui n'engage ni une norme ni un texte opposable. |
| **[HYPOTHÈSE]** | Formulé pour être confirmé ou infirmé. Ne pas traiter comme acquis. |
| **[À INSTRUIRE]** | Point de droit ou de contrat non tranché. Porte la source à consulter et le responsable de validation. |

---

# 1. Inventaire du contenu éditeur présent dans le code

## 1.1 Méthode

Chaque élément est **désigné par sa position et sa nature**, jamais recopié. Le classement retenu :

- **métadonnée libre** — désignation, titre, marque, plage d'âge annoncée, nom d'éditeur : information de catalogue, publiée par l'éditeur lui-même à des fins commerciales ou bibliographiques ;
- **probablement protégé** — structure, découpage, conventions de notation ou vocabulaire d'interprétation dont on ne peut pas démontrer, sans ouvrir le manuel, qu'ils relèvent de la connaissance générale ;
- **clairement protégé** — liste d'épreuves, architecture d'une grille de cotation, libellés de bandes de classification, définitions de dimensions : matériel constitutif de l'instrument.

Le classement est une **appréciation de conception**, pas un avis juridique. Il sert à prioriser ce qui doit sortir du code en premier. [À INSTRUIRE — qualification finale par un conseil en propriété intellectuelle.]

## 1.2 Tableau d'inventaire

| # | Position | Nature de l'élément | Classement | Conséquence si conservé |
|---|---|---|---|---|
| I-01 | `lib/constants.ts:183-184` | Texte par défaut nommant trois batteries éditées et l'autrice de l'une d'elles, et affirmant lesquelles sont « les principaux tests de ce bilan ». **Constante morte** : exportée, jamais importée (vérifié sur `app/`, `lib/`, `components/`). Les champs `Profile.anamnese_note` / `anamnese_note_on` (`lib/types.ts:42-43`) ne sont lus nulle part. | métadonnée libre (les noms), mais **affirmation clinique du logiciel** | Réintroduction possible d'une phrase qui décide à la place du praticien. À supprimer avec les deux champs de profil. |
| I-02 | `lib/constants.ts:265`, `279`, `290`, `291`, `297`, `303`, `309`, `315` | Aides de saisie (`hint`) qui énumèrent, domaine par domaine, les **sous-épreuves** de trois batteries nommément citées (deux batteries françaises et une échelle d'écriture), plus deux épreuves projectives/graphiques désignées par le nom de leur auteur. | probablement protégé | Ces listes décrivent l'organisation interne de batteries éditées. Elles sont affichées en placeholder à chaque ouverture d'un bilan. |
| I-03 | `lib/constants.ts:246-250` | Aide de saisie de la section « Tests psychomoteurs utilisés », citant trois sigles. | métadonnée libre | Aucune. Citer un nom d'instrument est nécessaire à un compte rendu. |
| I-04 | `lib/constants.ts:388-390` | Titre de document généré : le sigle commercial d'un questionnaire édité est intégré dans l'intitulé du compte rendu produit par le SaaS. | métadonnée libre, **usage de marque** | Un document commercialement diffusé porte un titre construit autour d'une marque tierce. Usage à cadrer. [À INSTRUIRE] |
| I-05 | `lib/constants.ts:453-511` | Trame par défaut du bilan sensoriel : la succession des sections reproduit l'**ordre de restitution des résultats** du questionnaire édité (profil global → sections sensorielles → sections comportementales → conclusion), et quatre sous-titres correspondent exactement aux quatre dimensions de l'instrument (`:476-489`). Les `hint` de `:491-503` énumèrent les six sections sensorielles et les trois sections comportementales. | probablement protégé (structure) à clairement protégé (`:476-503`) | La trame est l'architecture du profil de résultats de l'instrument. |
| I-06 | `lib/constants.ts:514-520` | `DUNN_BANDS` : les cinq **libellés de bandes de classification** de l'instrument, dans leur formulation française. | **clairement protégé** | Ce sont les catégories interprétatives publiées. Elles sont imprimées en en-tête de trois tableaux du compte rendu (`apercu/page.tsx:398-405`). |
| I-07 | `lib/constants.ts:533-581` | `DUNN_TABLES` : trois grilles, treize lignes, correspondant aux quatre dimensions globales, six sections sensorielles et trois sections comportementales. Les quatre dimensions portent en plus leur **définition** (`:541-557`). | **clairement protégé** | C'est la grille de restitution complète de l'instrument, définitions comprises, reconstituée en dur. |
| I-08 | `lib/constants.ts:605-614` | `PSYCHOMOTOR_TESTS` : huit désignations d'instruments (sigles et noms d'auteurs). Aucune version, aucun éditeur, aucune langue. | métadonnée libre | Aucune sur le plan des droits. **Défaut d'information** : un bilan ne dit pas quelle édition a été utilisée. |
| I-09 | `lib/constants.ts:638-642` | `MABC_BLOCK_TITLES` : les trois intitulés de domaines de la batterie motrice. | métadonnée libre (limite) | Ces intitulés figurent dans la documentation commerciale publique. Risque faible, à confirmer. |
| I-10 | `lib/constants.ts:644-645` | Deux constantes de **convention de notation de passation** (côté à renseigner pour les membres inférieurs, main préférée / non préférée), utilisées comme placeholders. | probablement protégé | Reproduit la logique de renseignement d'une feuille de passation. |
| I-11 | `lib/constants.ts:647-749` | `MABC_GROUPS` : **trente lignes d'épreuves**, ventilées en trois groupes d'âge × trois blocs de domaine, chacune avec sa clé et, pour dix d'entre elles, l'**unité de cotation attendue**. Les trois libellés de groupes (`:650`, `:684`, `:718`) reprennent les bornes d'âge publiées de la batterie. | **clairement protégé** | C'est la reconstitution de la structure de la feuille de passation de la batterie. Élément le plus exposé du dépôt. |
| I-12 | `lib/constants.ts:756-765` | `nsColor` : découpage en cinq bandes sur une échelle entière, avec quatre bornes en dur et cinq couleurs. Aucune source, aucune version, aucun instrument associé. | probablement protégé **si** repris d'un manuel ; sinon contenu propre | Voir §5 : appliqué indistinctement à toute valeur saisie, quel que soit l'instrument. |
| I-13 | `lib/constants.ts:767-781` | `SCORE_INTERPRETATION` : texte pédagogique + deux légendes de trois bandes, l'une en écarts-types, l'autre en notes standard, avec un vocabulaire interprétatif à trois niveaux. | probablement protégé si recopié ; sinon contenu propre du cabinet | Imprimé dans tout compte rendu psychomoteur dès qu'un test est déclaré (`apercu/page.tsx:450-482`). |
| I-14 | `components/GaussianCurve.tsx:68-104` | Courbe normale, bandes, pourcentages sous la courbe, graduations en écarts-types et percentiles, bande de cinq catégories. | **métadonnée libre** | Les propriétés de la loi normale relèvent des mathématiques, non du droit d'auteur. Le problème de cet objet est psychométrique (§4), pas juridique. |
| I-15 | `components/GaussianCurve.tsx:192-205` | Graduation d'une ligne « notes standard » de 1 à 19 positionnée par la relation `z = (NS − 10)/3`, câblée en dur. | métadonnée libre | Défaut psychométrique majeur, voir §4.4. |
| I-16 | `app/(app)/bilans/[id]/apercu/page.tsx:621-666` | `MabcTablePrint` : **rend la colonne « épreuve » dans le document imprimé**. Les intitulés de I-11 sortent du logiciel et entrent dans un document remis à la famille et transmis à des tiers. | **clairement protégé** — diffusion | Point le plus grave de l'inventaire : la reproduction quitte le poste du praticien. |
| I-17 | `app/(app)/bilans/[id]/apercu/page.tsx:387-445` | Rend les trois grilles de I-06/I-07 dans le document imprimé, en-têtes de bandes compris. | **clairement protégé** — diffusion | Idem. |
| I-18 | `app/(app)/bilans/[id]/BilanEditor.tsx:475-515`, `741-800`, `1060-1116` | Saisie : sélecteur de groupe d'âge, trois tableaux d'épreuves, trois grilles à cocher. | dérivé de I-06/I-07/I-11 | Disparaît si le contenu source sort du code. |
| I-19 | `supabase/migration_003.sql:3` | Commentaire de migration nommant la batterie. | métadonnée libre | Aucune. |
| I-20 | `app/(app)/parametres/BilanSectionsEditor.tsx:183` | Infobulle nommant la batterie. | métadonnée libre | Aucune. |

## 1.3 Ce qui n'est **pas** exposé aujourd'hui, et doit le rester

- **Aucune table normative** n'est présente dans le dépôt. Aucune conversion score brut → score dérivé n'est implémentée. Vérifié : `lib/constants.ts` ne contient aucun tableau de correspondance, et `lib/calc.ts` ne traite que la comptabilité. **[FAIT]** C'est le bon état : il doit être préservé explicitement, pas par hasard.
- **Aucune consigne de passation, aucun stimulus, aucun item de questionnaire** n'est stocké. **[FAIT]**
- **Aucun contenu protégé n'est transmis à un fournisseur de modèle de langage aujourd'hui.** La fonction de reformulation transmet exactement deux valeurs : le titre de la section et le texte libre de cette section (`app/(app)/bilans/ai-actions.ts:63-65`, appelée avec `label` et `content[fieldKey]` depuis `BilanEditor.tsx:266`, `383`). Le jsonb `tests` — qui porte les clés de lignes d'épreuves et les scores — n'est jamais envoyé. **[FAIT]**
  - **Réserve** : rien n'empêche le praticien de coller un intitulé d'épreuve ou un extrait de manuel dans un champ de texte, puis de cliquer sur « Reformuler ». Le périmètre est tenu par construction sur les données structurées, pas sur la saisie libre.

## 1.4 Lecture d'ensemble

Le dépôt contient **deux natures de risque distinctes**, qu'il ne faut pas confondre :

1. **Un risque de droits** (I-05 à I-07, I-10 à I-11, aggravé par la diffusion en I-16/I-17). Il se traite en retirant le contenu du code et en le remplaçant par des métadonnées et par des intitulés saisis par le praticien.
2. **Un risque psychométrique** (I-12 à I-15). Il ne disparaît pas si l'on retire le contenu éditeur : un seuil générique resterait faux même appliqué à un instrument libre. Il se traite par le modèle d'échelles et de bandes du §5.

Traiter le premier sans le second donnerait un produit conforme et faux.

---

# 2. Cadre des licences

## 2.1 Position de l'International Test Commission

**[FAIT]** *The ITC Guidelines on the Security of Tests, Examinations, and Other Assessments*, version 1.0 finale, 6 juillet 2014, référence de document `ITC-G-TS-20140706`, adoptée formellement par le Conseil de l'ITC lors de sa réunion de juillet 2014 à Saint-Sébastien. Rédigées sous la direction de David Foster, avec Eugene Burke et Casey Marks. Citation recommandée par le document lui-même : *International Test Commission (2014). International Guidelines on the Security of Tests, Examinations, and Other Assessments.*
Source : https://www.intestcom.org/files/guideline_test_security.pdf — consulté le 2026-09-11.

Points directement opposables à la conception d'un logiciel de bilan :

| Réf. dans le document | Contenu | Portée pour le produit |
|---|---|---|
| p. 7 | Le vol de contenu de test (*test theft*) est défini comme toute tentative de s'approprier le contenu d'un test **avant, pendant ou après** son usage prévu. | Recopier une grille depuis un carnet déjà acquis reste dans le périmètre visé. |
| p. 8 | Les éditeurs (*Test Publishers or Owners*) **possèdent le contenu du test et en autorisent l'usage pour des finalités spécifiques**. | L'achat du matériel n'emporte pas l'autorisation de le réimplémenter. |
| p. 9 | Le champ couvre explicitement les situations cliniques où l'évaluation conduit à des décisions de traitement. Les principes s'appliquent « également » aux passations papier-crayon, technologiques et hybrides. | Un bilan psychomoteur libéral est dans le périmètre. |
| p. 12, tableau 2 | Parmi les menaces recensées : capture électronique du contenu, transcription du contenu, obtention de matériel par un intervenant interne au programme. | Une saisie manuelle dans un logiciel tiers relève de la transcription. |
| p. 14, §7 | Le plan de sécurité doit couvrir le **stockage sécurisé et l'accès** au contenu de test, aux résultats et aux informations du sujet, ainsi que leur protection pendant les communications et les transferts de données. | Le registre d'instruments doit être conçu comme un actif sensible, pas comme une table de référence banale. |
| p. 14, §11 | Les accords de non-divulgation doivent faire reconnaître **le copyright et la propriété** du contenu, et les actes considérés comme frauduleux. | Un contrat d'intégration avec un éditeur est le seul chemin sûr pour aller au-delà des métadonnées. |
| p. 14, §12 | Le propriétaire du test doit établir juridiquement sa propriété dans les pays où le test est administré. | Confirme que la protection est territoriale : la position d'un éditeur français prime pour une pratique française. |

**Ce que l'ITC ne dit pas** : elle n'énonce aucune règle sur les *métadonnées* d'un instrument (nom, éditeur, plage d'âge, population normative). Le registre proposé au §3 se situe donc **hors du champ de sécurité décrit par l'ITC**, ce qui est précisément l'objectif de sa conception.

## 2.2 Ce qu'un éditeur autorise et interdit habituellement

### 2.2.1 Éditeur des deux instruments concernés, en France

**[FAIT]** Les deux batteries outillées dans le produit sont diffusées en France par **ECPA / Pearson France** (Pearson Clinical & Talent Assessment).
- Batterie motrice, 3ᵉ édition : https://www.pearsonclinical.fr/mabc-3 — consulté le 2026-09-11. Édition française 2025. Plage d'âge annoncée : 3 ans à 25 ans 11 mois. Trois groupes d'âge désignés GA1 / GA2 / GA3. Échantillon d'étalonnage français annoncé : 495 sujets. Durée de passation annoncée : 30 à 60 min (questionnaire 15-30 min).
- Questionnaire sensoriel, 2ᵉ version : https://www.pearsonclinical.fr/profil-sensoriel-2 — consulté le 2026-09-11. Plage d'âge annoncée : 7 mois à 14 ans 11 mois. **Plusieurs formulaires distincts**, avec des effectifs d'étalonnage français annoncés par formulaire (N = 226, 322 et 326 selon le formulaire).

> **Conséquence de conception, immédiate.** Le produit actuel n'enregistre ni l'édition, ni le formulaire, ni la langue de passation. Or le questionnaire sensoriel **n'a pas un seul formulaire** : les trois grilles codées en dur (`lib/constants.ts:533-581`) sont présentées comme uniques alors que le choix du formulaire dépend de l'âge et du répondant. Un bilan produit aujourd'hui ne permet pas de savoir quel formulaire a été employé. **[FAIT]**

### 2.2.2 Conditions d'utilisation publiées par cet éditeur

**[FAIT]** Document *Conditions d'utilisation des matériels psychométriques* + *Conditions générales de vente des ECPA*, publié par l'éditeur.
Source : https://www.pearsonclinical.fr/pub/media/wysiwyg/France/commande_condition_ecpa.pdf — consulté le 2026-09-11.
**Réserve de datation** : le document consulté mentionne des tarifs et des échéances de 2018. Il s'agit vraisemblablement d'une version antérieure à la version en vigueur. **La version applicable doit être demandée à l'éditeur avant toute décision.** [À INSTRUIRE]

Contenu vérifié, en synthèse :

- **Compétence.** La vente est réservée aux professionnels qualifiés. La liste des professions habilitées cite explicitement **les psychomotriciens**. Une attestation de titre est exigée à la première commande. L'éditeur renvoie aux *Standards for Educational and Psychological Tests* et indique que ces standards sont repris par l'European Test Publishers Group et par l'**ITC**, et qu'à chaque matériel diffusé est associé un type de titre ou de qualification nécessaire.
- **Propriété intellectuelle.** Les outils sont couverts par le droit d'auteur ; les droits restent la propriété de l'éditeur ou de ses fournisseurs. **Sauf autorisation écrite préalable, l'utilisateur s'interdit** : toute reproduction de tout ou partie des outils ; toute traduction, adaptation ou transformation **sur un autre support que celui prévu par l'éditeur** ; toute mise à disposition, transfert ou cession, même à titre gratuit, de tout ou partie des outils à des tiers non compétents.
- **Usage.** L'utilisateur habilité doit employer le test **dans sa version originale et dans sa globalité** afin de lui conserver sa validité et sa pertinence. Il s'engage à protéger les contenus en ne les divulguant pas auprès de tiers non compétents. L'éditeur mentionne que la divulgation dévalue le contenu du test.
- **Non-observation.** Le document indique que le non-respect de ces limitations peut entraîner des poursuites judiciaires.
- **Plateformes de l'éditeur.** Les CGV traitent séparément les passations et rapports en ligne et l'hébergement des données sur les plateformes propres à l'éditeur. C'est le canal par lequel une intégration numérique est prévue par l'éditeur lui-même.

**[FAIT]** Niveaux de qualification publiés par le même éditeur : quatre niveaux, dont un niveau A qui couvre les psychomotriciens et ergothérapeutes.
Source : https://www.pearsonclinical.fr/niveau-qualification — consulté le 2026-09-11.

### 2.2.3 Position d'un éditeur international comparable

**[FAIT]** Conditions de vente et d'usage publiées par la branche britannique du même groupe : https://www.pearsonclinical.co.uk/legal/terms-of-sale-use.html — consulté le 2026-09-11. Points saillants :
- interdiction expresse de reproduire les items, échelles, **algorithmes de cotation** et consignes ;
- l'achat confère un **droit d'usage qualifié, pas la propriété** : revente, sous-licence, transfert et distribution nécessitent un accord écrit ;
- **interdiction de saisir le contenu dans un support informatique, tel qu'un système ou un logiciel de cotation non édité par l'éditeur** ;
- extraction limitée de portions d'un rapport produit par le logiciel de l'éditeur, réduite au minimum nécessaire au compte rendu professionnel.

> Cette clause — « ne pas saisir le contenu dans un logiciel de cotation tiers » — est **la clause qui vise exactement ce que fait le produit aujourd'hui** avec I-11 et I-07. Elle provient d'une branche étrangère du même groupe et n'est pas, en l'état, la stipulation française applicable. Elle indique la position de l'éditeur, elle ne fonde pas à elle seule une conclusion juridique française. [À INSTRUIRE]

## 2.3 Fondements juridiques français mobilisables

**[FAIT]** Article L. 122-4 du Code de la propriété intellectuelle : « Toute représentation ou reproduction intégrale ou partielle faite sans le consentement de l'auteur ou de ses ayants droit ou ayants cause est illicite. Il en est de même pour la traduction, l'adaptation ou la transformation, l'arrangement ou la reproduction par un art ou un procédé quelconque. »
Source : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006278911 — consulté le 2026-09-11.
→ Le texte vise expressément la reproduction **partielle** et l'**adaptation par un procédé quelconque**. Transposer une grille papier en tableau HTML est une reproduction par un procédé, pas une création nouvelle. **[HYPOTHÈSE de qualification — à confirmer par un juriste.]**

**[FAIT]** Article L. 122-5 du même code : liste limitative des exceptions (copie privée, courte citation avec mention du nom de l'auteur et de la source, analyse, parodie, illustration à des fins d'enseignement et de recherche…). Ces exceptions « ne peuvent porter atteinte à l'exploitation normale de l'œuvre ni causer un préjudice injustifié aux intérêts légitimes de l'auteur ».
Source : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006278917 — consulté le 2026-09-11.
→ L'exception de courte citation suppose une **œuvre citante** et une citation **brève et incorporée à un propos**. Reproduire l'intégralité d'une grille de résultats comme formulaire de saisie ne ressemble à aucune des exceptions listées. **[HYPOTHÈSE — à confirmer.]**

**[FAIT]** Articles L. 341-1 et suivants du même code : droit *sui generis* du producteur de base de données, qui protège contre l'extraction et la réutilisation d'une partie **qualitativement ou quantitativement substantielle** du contenu, dès lors que la constitution, la vérification ou la présentation atteste d'un investissement substantiel. Durée initiale : quinze ans.
Source : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006279245 — consulté le 2026-09-11.
→ C'est le fondement le plus direct concernant une **table d'étalonnage** : la table est le produit d'un investissement de recueil, de vérification et de présentation. Recopier une table normative expose donc à deux fondements cumulés, droit d'auteur et droit du producteur de base de données. **[HYPOTHÈSE — à confirmer.]**

**[FAIT]** Article R. 4332-1 du Code de la santé publique : le bilan psychomoteur figure au premier rang des actes professionnels que le psychomotricien est habilité à accomplir, sur prescription médicale.
Source : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006914164 — consulté le 2026-09-11.
→ Conséquence de conception : **l'auteur du bilan est le psychomotricien**, le logiciel est un outil de rédaction. Toute sortie du logiciel qui ressemblerait à une conclusion émise par le logiciel est hors du cadre de cet article.

## 2.4 Sept interdits opérationnels

Formulés comme règles de conception, avec leur fondement et leur contrôle.

| # | Interdit | Fondement | Contrôle dans le produit |
|---|---|---|---|
| L-1 | **Copier des items, stimuli, consignes de passation, grilles ou feuilles de passation** dans le code, la base, un gabarit, un fichier de configuration ou une trame livrée. | ITC p. 8/12 ; CU éditeur §2 ; CPI L. 122-4. | Revue de code obligatoire sur toute constante contenant plus de trois libellés d'épreuve. Test de dépôt : voir §10, T-15. |
| L-2 | **Reproduire une table normative**, même partiellement, même « simplifiée », même sous forme de formule ajustée sur les données publiées. | CPI L. 341-1 (base de données) + L. 122-4 cumulés. | Aucune colonne du schéma §3 ne peut accueillir une table. Refus de la revue si une migration ajoute une table `*_norms`, `*_bareme`, `*_etalonnage`. |
| L-3 | **Reconstituer un algorithme de cotation propriétaire** : conversion brut → dérivé, pondération de sous-scores, règle d'arrêt, calcul d'un composite. | CU éditeur (branche UK, interdiction explicite de reproduire les *scoring algorithms*) ; CU France (interdiction d'adaptation/transformation). | Le moteur **n'exécute aucun calcul de score**. Il n'enregistre que la valeur et la source de cotation (§3.4). |
| L-4 | **Extraire par moissonnage un portail éditeur** (catalogue, fiches produit, ressources, espace client) pour alimenter le registre. | CPI L. 341-1 ; conditions d'utilisation des sites concernés, à lire au cas par cas. | Le peuplement du registre est **manuel**, avec `source_metadonnees_url` et `source_consultee_le` obligatoires. Aucun connecteur automatique. |
| L-5 | **Transmettre du contenu protégé à un modèle de langage**, quel que soit le fournisseur, y compris pour « aider à reformuler » ou « vérifier une cotation ». | ITC p. 14 §7 (protection pendant les transferts) ; CU éditeur (non-divulgation à des tiers non compétents) ; règle `.claude/rules/security-health-data.md`. | Le périmètre transmis reste **exclusivement** le texte rédigé par le praticien et le titre de section (`ai-actions.ts:63-65`). Aucun champ du registre, aucun résultat structuré, aucun intitulé issu du registre ne doit entrer dans un prompt. Avertissement à afficher avant la première reformulation. |
| L-6 | **Laisser croire que l'abonnement au SaaS confère une licence d'usage d'un test.** | CU éditeur §1 (compétence attestée) + §3 (usage dans la version originale) ; ITC p. 8. | Mention obligatoire, non désactivable, à l'ajout d'un instrument au registre : le logiciel n'attribue aucun droit sur l'instrument ; l'acquisition, la qualification et le respect des conditions de l'éditeur relèvent du praticien. Journalisée avec date et compte. |
| L-7 | **Faire sortir un contenu protégé dans un document diffusé** (PDF, impression, export, pièce jointe). | CU éditeur §2 (mise à disposition à des tiers non compétents) ; c'est le point I-16/I-17. | Le document remis ne peut contenir que des intitulés **saisis par le praticien** ou marqués `outil_libre_valide`. Contrôle au rendu, pas seulement à la saisie. |

## 2.5 Ce qui reste licite et suffit à un compte rendu

**[USAGE]** Un compte rendu de bilan cite couramment, sans reproduire le matériel : le nom de l'instrument et son édition, l'éditeur, la date de passation, le domaine évalué, le résultat obtenu par le patient, l'échelle employée, l'intervalle de confiance et l'appréciation clinique du professionnel. C'est exactement le contenu du registre proposé ci-dessous. **Le produit peut donc être entièrement fonctionnel sans aucun contenu protégé.** C'est le point le plus important de ce document.

---

# 3. Modèle de données du registre d'instruments

## 3.1 Principes du schéma

1. **Le registre stocke des désignations et des propriétés déclarées, jamais du matériel.** Toute colonne est conçue pour être publiable telle quelle sans reproduire un manuel.
2. **Le logiciel ne cote jamais.** Il enregistre une valeur et **la source qui l'a produite**.
3. **Deux portées** : `catalogue` (livré avec le produit, `user_id IS NULL`, lecture seule, versionné dans le dépôt) et `compte` (créé par le praticien, `user_id` renseigné). Le catalogue livré ne contient que ce qui est classé « métadonnée libre » au §1.
4. **Rien n'est actif par défaut.** Un instrument ajouté démarre en `reference_seule`.
5. **Figement.** Tout ce qui décrit l'instrument au moment de la passation est **recopié** dans l'enregistrement de passation. Modifier le registre ne réécrit jamais un bilan existant. Ce principe existe déjà dans le dépôt pour la facturation (`lib/types.ts:98-128`) : il est repris à l'identique, pour la même raison.
6. **Isolation.** Même modèle que l'existant : RLS PostgreSQL sur `user_id` pour les lignes de compte, lecture seule authentifiée pour le catalogue. Cohérent avec `DEC-001` et `DEC-003` (`docs/context/DECISIONS.md`).

## 3.2 Statuts de licence

Quatre statuts, du plus restrictif au plus permissif. **Le passage à un statut plus permissif est une action explicite, tracée, horodatée, nominative.** Le retour à un statut plus restrictif est automatique dès qu'une condition n'est plus remplie.

### `reference_seule` — défaut

> L'instrument est nommé, rien de plus.

| Le logiciel s'autorise | Le logiciel s'interdit |
|---|---|
| Citer nom, édition, éditeur, langue, date de passation, formulaire déclaré. | Créer une échelle rattachée à cet instrument. |
| Mentionner l'instrument dans la section « Tests utilisés » et dans le corps du compte rendu. | Stocker un résultat structuré, appliquer une bande, produire une couleur, tracer un graphique. |
| Afficher la plage d'âge annoncée et l'avertir si elle est dépassée. | Proposer un tableau pré-structuré d'épreuves. |
| Laisser le praticien écrire ses résultats en **texte libre**, non interprété. | Traiter ce texte libre comme une donnée. |

### `scores_saisis_par_le_praticien` — statut cible pour les deux batteries concernées

> Le praticien possède l'instrument et cote lui-même, hors du logiciel. Le logiciel n'est qu'un cahier.

| Le logiciel s'autorise | Le logiciel s'interdit |
|---|---|
| Enregistrer des **échelles** décrites en métadonnées : nom d'échelle donné par le praticien, type de résultat, moyenne, écart-type, bornes, sens. | **Fournir** les intitulés d'épreuves, de sous-tests, de sections ou de dimensions. Ces intitulés sont saisis par le praticien, pour son propre usage. |
| Enregistrer la valeur recopiée par le praticien, avec sa source de cotation. | Convertir un score brut en score dérivé, ou une échelle en une autre. |
| Appliquer un jeu de bandes **dont la source est déclarée par le praticien**, et afficher couleur et libellé. | Livrer un jeu de bandes pré-rempli repris d'un manuel. |
| Imprimer un tableau de résultats dont les libellés de lignes viennent de la saisie du praticien. | Imprimer un libellé venu du catalogue applicatif. |
| Reprendre d'une passation à l'autre les échelles créées par le praticien. | Partager ces échelles entre comptes. |

### `integration_editeur_autorisee`

> Un accord écrit existe. Ce que l'accord dit, et **rien de plus**.

| Le logiciel s'autorise | Le logiciel s'interdit |
|---|---|
| Exactement les usages énumérés dans `licence_perimetre` (texte libre recopié de l'accord). | Tout usage non énuméré, y compris « évident » ou « analogue ». |
| Afficher la référence de licence sur le document produit, si l'accord l'exige. | Fonctionner si `licence_reference`, `licence_verifiee_le` et `licence_verifiee_par` ne sont pas tous renseignés. |
| Consommer une API éditeur si l'accord la prévoit. | Stocker durablement le contenu renvoyé par cette API au-delà de ce que l'accord autorise. |

**Repli de sûreté** : `licence_expire_le` dépassée, ou l'un des trois champs de vérification vide → le statut effectif retombe à `scores_saisis_par_le_praticien`, avec un bandeau. Jamais l'inverse. **Aucun accord de ce type n'existe à ce jour** ; le statut est prévu, pas utilisé. **[FAIT — aucune trace de contrat dans le dépôt.]**

### `outil_libre_valide`

> Les conditions de diffusion autorisent explicitement la reproduction.

| Le logiciel s'autorise | Le logiciel s'interdit |
|---|---|
| Stocker et afficher les intitulés et la grille, dans le respect de l'attribution exigée. | Traiter comme libre un outil simplement « trouvé en ligne ». |
| Livrer l'outil dans le catalogue applicatif. | Se passer de `licence_url`, `licence_nom` et `source_consultee_le`. |
| Permettre au praticien de l'adapter, en conservant la trace de l'original. | Diffuser sans validation clinique préalable par un psychomotricien (`.claude/rules/clinical-safety.md`, dernière puce). |

> **Piège à écrire dans l'interface** : « librement accessible » ≠ « libre de droits ». Une épreuve reproduite dans un mémoire, un article ou un site associatif reste protégée. La charge de la preuve du caractère libre incombe à celui qui l'affirme.

## 3.3 Schéma proposé

Proposition, en PostgreSQL, cohérente avec les conventions du dépôt (`uuid` en clé, `user_id` + RLS, `jsonb` pour les structures ouvertes). **Non implémentée.**

```sql
-- ============================================================
--  REGISTRE D'INSTRUMENTS — MÉTADONNÉES UNIQUEMENT
--  INTERDIT dans ce schéma, sans exception :
--    items, stimuli, consignes de passation, feuilles de
--    cotation, tables d'étalonnage, algorithmes de conversion.
--  Toute migration ajoutant une colonne ou une table destinée à
--  l'un de ces contenus doit être refusée en revue.
-- ============================================================

create type licence_statut as enum (
  'reference_seule',
  'scores_saisis_par_le_praticien',
  'integration_editeur_autorisee',
  'outil_libre_valide'
);

create type resultat_type as enum (
  'brut',                -- score de comptage ou de durée, propre à l'épreuve
  'derive',              -- score transformé, échelle non standard nommée
  'note_standard',       -- échelle standardisée, m et sigma obligatoires
  'note_t',              -- idem, conventionnellement m=50 sigma=10
  'indice',              -- idem, conventionnellement m=100 sigma=15
  'percentile',          -- rang centile, ordinal non linéaire
  'ecart_type_z',        -- z / DS, m=0 sigma=1
  'age_developpement',   -- age equivalent, en mois
  'categorie'            -- catégorie interprétative nominale ou ordinale
);

create type sens_score as enum (
  'eleve_favorable',     -- un score élevé va dans le sens attendu
  'eleve_defavorable',   -- un score élevé signale une difficulté
  'bidirectionnel',      -- les deux extrêmes sont remarquables
  'non_oriente'          -- aucune orientation ne doit être supposée
);

-- ---------- 1. Instrument ----------
create table public.instruments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete cascade,
      -- NULL = entrée du catalogue applicatif, lecture seule.
  nom_court           text not null,          -- sigle ou désignation usuelle
  nom_complet         text,
  editeur             text,                   -- éditeur ou distributeur déclaré
  editeur_pays        text,                   -- ISO 3166-1 alpha-2
  version             text,                   -- « 3e édition », « v2 »…
  annee_publication   int,                    -- de la version employée
  langue_passation    text,                   -- BCP-47, ex. 'fr-FR'
  adaptation          text check (adaptation in
                        ('originale','adaptation','traduction')),
  adaptation_par      text,
  domaines            text[] not null default '{}',
      -- vocabulaire contrôlé DU PRODUIT (motricité globale, tonus…),
      -- jamais le découpage interne de l'instrument.
  age_min_mois        int,
  age_max_mois        int,
  duree_min_minutes   int,
  duree_max_minutes   int,
  modes_passation     text[] default '{}',    -- 'papier','plateforme_editeur',
                                              -- 'questionnaire_repondant'
  repondants_possibles text[] default '{}',   -- 'patient','parent','enseignant'…
  population_normative jsonb not null default '{}'::jsonb,
      -- { pays, effectif, annee_recueil, mode_echantillonnage,
      --   sous_groupes: [], limites_declarees: [] }
      -- Métadonnées de l'échantillon. JAMAIS la table de normes.
  qualification_requise text,                 -- niveau annoncé par l'éditeur
  qualification_source_url text,

  statut_licence      licence_statut not null default 'reference_seule',
  licence_perimetre   text,                   -- ce que l'accord autorise, mot à mot
  licence_reference   text,                   -- n° de contrat/licence (pas un secret)
  licence_url         text,                   -- pour outil_libre_valide
  licence_nom         text,                   -- ex. 'CC BY-NC-SA 4.0'
  licence_verifiee_le date,
  licence_verifiee_par text,
  licence_expire_le   date,

  source_metadonnees_url  text,
  source_consultee_le     date,
  avertissements_validite text[] default '{}',-- saisis ou repris d'une source citée
  notes_praticien     text,
  actif               boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint age_coherent
    check (age_min_mois is null or age_max_mois is null
           or age_min_mois < age_max_mois),
  constraint integration_documentee
    check (statut_licence <> 'integration_editeur_autorisee'
           or (licence_reference is not null
               and licence_verifiee_le is not null
               and licence_verifiee_par is not null)),
  constraint libre_documente
    check (statut_licence <> 'outil_libre_valide'
           or (licence_url is not null and licence_nom is not null
               and source_consultee_le is not null)),
  constraint catalogue_sans_licence_privee
    check (user_id is not null
           or statut_licence in ('reference_seule','outil_libre_valide'))
);

create unique index instruments_unicite on public.instruments
  (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
   lower(nom_court), coalesce(version,''), coalesce(langue_passation,''));

-- ---------- 2. Formulaire ----------
create table public.instrument_forms (
  id              uuid primary key default gen_random_uuid(),
  instrument_id   uuid not null references public.instruments(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  code            text not null,      -- désignation du formulaire
  repondant       text,               -- 'parent','enseignant','patient','examinateur'
  age_min_mois    int,
  age_max_mois    int,
  nb_items        int,                -- métadonnée de volume, PAS les items
  notes           text,
  actif           boolean not null default true,
  constraint form_age_coherent
    check (age_min_mois is null or age_max_mois is null
           or age_min_mois < age_max_mois)
);
-- Règle applicative (non exprimable en CHECK simple) : la plage d'âge d'un
-- formulaire doit être incluse dans celle de l'instrument. Contrôlée par
-- trigger ou en couche serveur, avec avertissement et non blocage.

-- ---------- 3. Échelle de résultat ----------
create table public.instrument_scales (
  id              uuid primary key default gen_random_uuid(),
  instrument_id   uuid not null references public.instruments(id) on delete cascade,
  form_id         uuid references public.instrument_forms(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  code            text not null,
  libelle         text not null,      -- SAISI par le praticien hors statut libre
  niveau          text not null check (niveau in
                    ('epreuve','sous_domaine','domaine','composite','total')),
  type_resultat   resultat_type not null,
  unite           text,               -- 'secondes','essais','erreurs','mois'
  moyenne         numeric,
  ecart_type      numeric,
  borne_min       numeric,
  borne_max       numeric,
  decimales       int not null default 0,
  sens            sens_score not null default 'non_oriente',
  sem             numeric,            -- erreur-type de mesure, si publiée
  ic_niveau_defaut numeric,           -- 0.90 ou 0.95
  conversions_publiees resultat_type[] not null default '{}',
      -- ce que le manuel documente comme conversion légitime. Vide = aucune.
  source          text,               -- référence de la source de ces métadonnées
  source_consultee_le date,
  ordre           int not null default 0,

  constraint standardisee_documentee check (
    type_resultat not in ('note_standard','note_t','indice','ecart_type_z')
    or (moyenne is not null and ecart_type is not null and ecart_type > 0)),
  constraint percentile_sans_sigma check (
    type_resultat <> 'percentile' or (moyenne is null and ecart_type is null)),
  constraint age_dev_en_mois check (
    type_resultat <> 'age_developpement' or unite = 'mois'),
  constraint bornes_coherentes check (
    borne_min is null or borne_max is null or borne_min < borne_max)
);
```

### Jeux de bandes — versionnés, sourcés, à vocabulaire unique

```sql
-- ---------- 4. Vocabulaire des bandes ----------
create table public.band_vocabularies (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  nom       text not null,
  usage     text not null check (usage in ('interne','document_remis')),
  valide_par text,                 -- le praticien qui l'assume
  valide_le  date,
  note      text
);

create table public.band_vocabulary_labels (
  vocabulaire_id uuid not null references public.band_vocabularies(id)
                 on delete cascade,
  cle            text not null,    -- 'b1'..'bN', clé stable
  texte          text not null,
  primary key (vocabulaire_id, cle),
  constraint un_seul_mot_par_bande unique (vocabulaire_id, texte)
);

-- ---------- 5. Jeu de bandes ----------
create table public.scale_band_sets (
  id            uuid primary key default gen_random_uuid(),
  scale_id      uuid not null references public.instrument_scales(id)
                on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  version       text not null,     -- 'v1', 'v2'… jamais écrasé, toujours ajouté
  origine       text not null check (origine in
                  ('manuel_editeur','publication_citee','convention_praticien')),
  source        text not null,     -- référence bibliographique ou motif
  source_consultee_le date,
  vocabulaire_id uuid not null references public.band_vocabularies(id),
  actif         boolean not null default false,
  valide_par    text,
  valide_le     date,
  created_at    timestamptz not null default now(),

  constraint origine_editeur_referencee check (
    origine <> 'manuel_editeur' or source is not null)
);
-- Règle applicative : origine = 'manuel_editeur' ne stocke QUE la référence.
-- Les bornes restent saisies par le praticien : le produit ne livre pas
-- de découpage repris d'un manuel.
-- Règle applicative : un seul band_set actif par (scale_id, user_id).

create table public.scale_bands (
  id              uuid primary key default gen_random_uuid(),
  band_set_id     uuid not null references public.scale_band_sets(id)
                  on delete cascade,
  ordre           int not null,
  borne_inf       numeric,          -- NULL = ouvert vers le bas
  borne_inf_incluse boolean not null default true,
  borne_sup       numeric,          -- NULL = ouvert vers le haut
  borne_sup_incluse boolean not null default false,
  libelle_cle     text not null,    -- résolu via band_vocabulary_labels
  couleur         text,             -- hexadécimal, ou NULL = pas de couleur
  unique (band_set_id, ordre),
  unique (band_set_id, libelle_cle),
  constraint bornes_ordonnees check (
    borne_inf is null or borne_sup is null or borne_inf < borne_sup)
);
-- Invariants vérifiés à l'enregistrement du jeu, PAS ligne à ligne :
--   (a) couverture continue de [borne_min, borne_max] de l'échelle ;
--   (b) aucun chevauchement, y compris aux bornes (inclusivités compatibles) ;
--   (c) aucune valeur de l'échelle sans bande ;
--   (d) chaque libelle_cle existe dans le vocabulaire du jeu.
-- Un jeu qui viole (a), (b), (c) ou (d) NE PEUT PAS passer actif.
```

### Passations et résultats

```sql
-- ---------- 6. Passation ----------
create table public.bilan_sessions (
  id              uuid primary key default gen_random_uuid(),
  bilan_id        uuid not null references public.bilans(id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users(id)
                  on delete cascade,
  date_passation  date not null,
  ordre           int not null default 1,     -- 1re, 2e… séance du même bilan
  examinateur     text,                       -- nom déclaré, comme bilans.author
  lieu            text,
  conditions      text,                       -- fatigue, bruit, interruptions
  amenagements    text[] default '{}',
  -- Âge FIGÉ à la date de passation, calculé une fois, jamais recalculé.
  age_annees      int,
  age_mois        int,
  age_jours       int,
  age_calcule_le  timestamptz,
  age_source_naissance date,   -- la date de naissance telle qu'elle était
  remarques       text,
  statut          text not null default 'realisee' check (statut in
                    ('planifiee','realisee','interrompue','annulee')),
  created_at      timestamptz not null default now(),
  unique (bilan_id, ordre)
);

-- ---------- 7. Emploi d'un instrument dans une passation ----------
create table public.session_instruments (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.bilan_sessions(id)
                  on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users(id)
                  on delete cascade,
  instrument_id   uuid references public.instruments(id) on delete set null,
  form_id         uuid references public.instrument_forms(id) on delete set null,
  -- FIGEMENT : recopié au moment de l'enregistrement, jamais relu du registre.
  instrument_nom_fige      text not null,
  instrument_version_figee text,
  instrument_editeur_fige  text,
  form_code_fige           text,
  statut_licence_fige      licence_statut not null,
  repondant       text,                        -- qui a rempli le questionnaire
  passation_complete boolean,
  motif_incompletude text,
  ecarts_protocole text,
  tranche_age_declaree text,
  tranche_age_source text check (tranche_age_source in
                      ('deduite_de_l_age','choisie_par_le_praticien')),
  tranche_age_justification text,
  created_at      timestamptz not null default now()
);

-- ---------- 8. Résultat ----------
create table public.session_results (
  id              uuid primary key default gen_random_uuid(),
  session_instrument_id uuid not null references public.session_instruments(id)
                        on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users(id)
                  on delete cascade,
  scale_id        uuid references public.instrument_scales(id) on delete set null,
  -- FIGEMENT de l'échelle
  scale_libelle_fige text not null,
  scale_type_fige    resultat_type not null,
  scale_moyenne_figee numeric,
  scale_sigma_fige    numeric,
  scale_unite_figee   text,
  scale_sens_fige     sens_score not null,

  statut          text not null check (statut in
                    ('saisi','non_passe','non_applicable','non_cotable',
                     'refus','interrompu')),
  valeur_saisie   text,               -- ce que le praticien a tapé, tel quel
  valeur_numerique numeric,           -- NULL si non analysable
  ic_borne_inf    numeric,
  ic_borne_sup    numeric,
  ic_niveau       numeric,

  source_cotation text not null check (source_cotation in
                    ('manuel_papier','logiciel_editeur','plateforme_editeur',
                     'calcul_praticien','non_cote')),
  source_cotation_reference text,     -- édition du manuel, nom du logiciel…

  -- Classement FIGÉ : ce qui a été affiché le jour où le document est sorti.
  band_set_id     uuid references public.scale_band_sets(id) on delete set null,
  band_id         uuid references public.scale_bands(id) on delete set null,
  band_libelle_fige text,
  band_couleur_figee text,
  classe_le       timestamptz,

  saisi_par       text,
  saisi_le        timestamptz not null default now(),
  modifie_le      timestamptz,
  verifie_par     text,
  verifie_le      timestamptz,

  constraint valeur_si_saisi check (
    statut <> 'saisi' or valeur_saisie is not null),
  constraint pas_de_valeur_si_absent check (
    statut = 'saisi' or valeur_numerique is null),
  constraint bande_exige_valeur check (
    band_id is null or valeur_numerique is not null),
  constraint ic_coherent check (
    (ic_borne_inf is null and ic_borne_sup is null)
    or (ic_borne_inf is not null and ic_borne_sup is not null
        and ic_borne_inf <= ic_borne_sup and ic_niveau is not null))
);
```

## 3.4 Le champ décisif : `source_cotation`

Il répond à la question « qui a calculé ce nombre ? » et il n'a pas d'équivalent aujourd'hui dans le dépôt.

| Valeur | Sens | Ce que le logiciel en déduit |
|---|---|---|
| `manuel_papier` | Le praticien a lu la table dans le manuel. | Rien. Il affiche la valeur et la source. |
| `logiciel_editeur` | Un logiciel de l'éditeur a produit le score. | Idem, plus la référence du logiciel sur le document si le praticien le souhaite. |
| `plateforme_editeur` | La plateforme en ligne de l'éditeur a produit le score. | Idem. |
| `calcul_praticien` | Le praticien a calculé lui-même (moyenne d'essais, conversion manuelle). | **Avertissement** : mention de calcul non standardisé, à assumer explicitement. |
| `non_cote` | La performance est décrite, non cotée. | Aucune bande, aucune couleur, aucun graphique. Le résultat reste une observation. |

**Aucune valeur de cette énumération ne désigne le logiciel Psychomotime.** C'est délibéré et c'est la traduction de L-3.

---

# 4. Types de résultats

## 4.1 Tableau de référence

| Type | Échelle | Moyenne | Écart-type | Unité | Nature de l'échelle |
|---|---|---|---|---|---|
| **Score brut** | propre à l'épreuve | aucune | aucun | secondes, essais réussis, erreurs, points | ordinale ou de comptage, non standardisée |
| **Score dérivé** | définie par l'instrument | déclarée | déclaré | sans unité | dépend de la transformation |
| **Note standard** (note échelonnée) | usuellement 1 à 19 **[USAGE]** | 10 | 3 | sans unité | intervalle, si normalisée |
| **Indice / composite** | usuellement ~40 à 160 **[USAGE]** | 100 | 15 | sans unité | intervalle, si normalisé |
| **Note T** | usuellement ~20 à 80 **[USAGE]** | 50 | 10 | sans unité | intervalle, si normalisée |
| **Percentile** | 1 à 99 | médiane = 50 | **non défini** | centile | **ordinale, non linéaire** |
| **Écart-type / z / DS** | ~ −4 à +4 | 0 | 1 | écart-type | intervalle |
| **Intervalle de confiance** | celle du score encadré | — | dérivé de l'erreur-type de mesure | celle du score | encadrement, pas un score |
| **Catégorie interprétative** | 3 à 7 classes, définies par l'instrument | — | — | libellé | nominale ou ordinale |
| **Âge de développement** | années;mois | — | — | mois | ordinale, **non métrique** |

> Les valeurs marquées **[USAGE]** sont des conventions fréquentes, pas des définitions. **C'est exactement pourquoi `moyenne` et `ecart_type` sont des colonnes obligatoires du registre** (contrainte `standardisee_documentee`) et non des constantes du code : une échelle nommée « note standard » par un éditeur peut avoir un autre paramétrage. Le logiciel ne doit jamais supposer.

## 4.2 Ce qui est comparable

| Comparaison | Licite ? | Condition |
|---|---|---|
| Deux scores de la même échelle, même instrument, même étalonnage | oui | Aucune. |
| Note standard ↔ z ↔ note T ↔ indice, **à l'intérieur d'un même étalonnage** | oui, **si** `conversions_publiees` le documente | Ce sont des transformations affines de la même position relative. Sans la mention du manuel, on ignore si la transformation est affine ou normalisée par aires. |
| z ↔ percentile | **seulement si la distribution est normale ou a été normalisée** | Information du manuel. Absente du dépôt, absente du registre tant qu'elle n'est pas renseignée. |
| Deux scores de même type, **instruments différents** | non, sauf comme repère qualitatif explicitement énoncé comme tel | Populations normatives, dates et constructions différentes. |
| Score brut d'une version à l'autre | **non** | Les items changent. |
| Âge de développement ↔ z, percentile, note standard | **jamais** | Aucune relation définie. Un même âge de développement n'a pas la même signification à deux âges chronologiques. |
| Catégorie interprétative d'un instrument ↔ celle d'un autre | **jamais** | Découpages et vocabulaires différents. |

## 4.3 Ce qui n'est JAMAIS licite

1. Moyenner des percentiles. La moyenne de deux rangs n'est pas le rang de la performance moyenne.
2. Soustraire deux percentiles pour mesurer un progrès. Dix points de percentile au centre valent quelques centièmes d'écart-type ; dix points en queue valent bien davantage.
3. Additionner ou moyenner des notes standard issues d'instruments différents pour produire un « score global de bilan ».
4. Convertir un score brut en score dérivé sans la table de l'éditeur (L-3).
5. Appliquer les bandes d'une échelle à une autre échelle (§5).
6. Traiter une catégorie interprétative comme une mesure et la reporter sur un axe numérique.
7. Traiter un intervalle de confiance comme une plage de valeurs possibles du score obtenu : il encadre le **score vrai estimé**, pas la performance du jour.
8. Interpréter une différence entre deux scores dont les intervalles de confiance se recouvrent comme un écart établi.

## 4.4 Pourquoi la courbe actuelle est fausse

Le composant `components/GaussianCurve.tsx` superpose quatre lignes sur un même axe : pourcentages sous la courbe (`:76-85`), écarts-types (`:87`, `:178-190`), notes standard de 1 à 19 (`:192-205`) et percentiles (`:88-96`, `:207-220`), plus une bande de cinq catégories (`:98-104`, `:222-249`). Il est imprimé dans tout compte rendu psychomoteur dès qu'un test est déclaré (`apercu/page.tsx:450`, `:483-493`). **[FAIT]**

Quatre erreurs distinctes, à traiter séparément.

**(a) Unité implicite imposée à tous les instruments.**
La ligne « notes standard » est positionnée par `X((ns - 10) / 3)` (`:194`, `:201`). Cette relation n'est vraie que pour une échelle de moyenne 10 et d'écart-type 3. Elle est fausse pour une note T, pour un indice, pour un score brut. Or la courbe est identique quel que soit l'instrument employé, et le produit accepte huit instruments (`lib/constants.ts:605-614`). Le document affirme donc une règle de conversion universelle qui n'existe pas.

**(b) Le percentile placé sur un axe linéaire.**
Les percentiles sont positionnés à l'abscisse de leur écart-type de référence (`:88-96`). C'est correct mathématiquement. C'est trompeur graphiquement : le lecteur voit trois lignes de graduations régulièrement espacées et en déduit l'équidistance. Entre 0 et +1 écart-type il y a environ 34 points de percentile ; entre +2 et +3 il y en a environ 2. Un rang centile est une échelle **ordinale non linéaire** ; le graduer comme un axe métrique induit une lecture fausse de l'ampleur des écarts.

**(c) La correspondance z ↔ percentile est affirmée sans sa condition.**
Elle n'est exacte que si la distribution de l'instrument est normale ou a été normalisée. Cette information est dans le manuel de chaque instrument. Le produit ne la détient pas, ne la demande pas — et l'imprime.

**(d) Une seule distribution pour un bilan qui en mobilise plusieurs.**
Une courbe unique par compte rendu suggère un référentiel commun. Chaque instrument a son étalonnage, sa population, sa date. **Il n'existe pas de « distribution du bilan ».**

### Représentation correcte proposée

1. **Un graphique par échelle, jamais par bilan.** L'axe porte l'échelle native (`instrument_scales.code`), avec `moyenne` et `ecart_type` affichés dans la légende.
2. **Aucun axe secondaire** tant que `conversions_publiees` ne le documente pas. Si la conversion est documentée, l'axe secondaire porte la mention de la source.
3. **Le percentile n'est jamais un axe.** Il s'affiche comme valeur ponctuelle à côté du score, en toutes lettres, jamais comme graduation.
4. **L'intervalle de confiance est une barre, pas un point.** Un score sans IC renseigné s'affiche comme un point accompagné de la mention « intervalle de confiance non renseigné » — l'absence est montrée, pas comblée.
5. **La légende porte** : nom de l'échelle, moyenne, écart-type, nom du jeu de bandes, sa version et sa source.
6. **La courbe normale reste possible comme pièce pédagogique séparée**, étiquetée « illustration de la loi normale », jamais superposée aux résultats du patient, jamais graduée simultanément en plusieurs échelles.
7. **Si l'échelle est de type `percentile`, `categorie` ou `age_developpement` : aucun graphique de distribution.** Un tableau, et rien d'autre.

---

# 5. Règle des seuils

## 5.1 Démonstration : un seuil ne peut pas être générique

La fonction `nsColor` (`lib/constants.ts:756-765`) découpe **toute** valeur saisie en cinq bandes sur les bornes 4 / 7 / 13 / 16. Elle est appliquée en deux endroits : à la frappe dans l'éditeur (`BilanEditor.tsx:1103`) et dans le document imprimé (`apercu/page.tsx:656`). **[FAIT]**

Cinq raisons, dont quatre sont démontrables dans le dépôt.

**(1) Les échelles n'ont pas la même métrique.**
La valeur 7 vaut −1 écart-type sur une échelle de moyenne 10 et d'écart-type 3 ; −4,3 écarts-types sur une note T ; elle n'existe pas sur un indice de moyenne 100 ; elle est un bon résultat sur un comptage « essais réussis sur 10 ». `nsColor` colore les quatre en orange, identiquement.

**(2) Le sens du score peut s'inverser.**
Sur une échelle de fréquence de comportements, un score élevé signale une difficulté. Colorer le haut en vert serait alors faux. C'est précisément le cas du questionnaire sensoriel outillé : ses bandes sont **bidirectionnelles**, les deux extrêmes sont remarquables. Le produit y échappe — il n'y applique aucune couleur (`apercu/page.tsx:423-438`, une seule couleur d'accent) — mais **par absence de règle, pas par règle**. D'où la colonne `sens` dans `instrument_scales`, sans valeur par défaut permissive (`'non_oriente'` = pas de couleur).

**(3) Le découpage appartient à l'instrument.**
Nombre de bandes, bornes et libellés sont des décisions d'étalonnage. Le produit en impose cinq (`nsColor`) et en imprime trois (`SCORE_INTERPRETATION`, `:771-780`) : **deux découpages différents pour la même échelle, sur la même page**.

**(4) L'inclusivité des bornes change le résultat — démonstration dans le produit.**
La légende imprimée énonce « entre 7 et 13 » pour la moyenne et « entre 5 et 7 » pour la zone de fragilité (`lib/constants.ts:777-778`) : la valeur 7 appartient aux deux. Le code tranche `n <= 7 → orange` (`:761`). Un seuil n'est complet que si son **opérateur de comparaison** est explicite. D'où `borne_inf_incluse` / `borne_sup_incluse` dans `scale_bands`.

**(5) Le vocabulaire n'est pas neutre, et le produit en emploie deux.**
La légende (`lib/constants.ts:772-780`) et la bande de catégories de la courbe (`GaussianCurve.tsx:98-104`) qualifient les **mêmes zones** avec des mots différents, à quelques centimètres l'un de l'autre sur le document remis. **[FAIT]**

## 5.2 Trois sources de vérité, trois réponses différentes

Le défaut est plus profond que la contradiction de vocabulaire déjà consignée dans `docs/clinical/CLINICAL_SAFETY.md` § C-2. Il existe aujourd'hui **trois autorités indépendantes** sur la même valeur :

| Autorité | Où | Ce qu'elle produit |
|---|---|---|
| `nsColor` | `lib/constants.ts:756-765` | la **couleur du chiffre** dans le tableau et dans le champ de saisie |
| `SCORE_INTERPRETATION` + `ZONE_TEXT` | `lib/constants.ts:767-781`, `apercu/page.tsx:28`, `:463-480` | le **texte de la légende** et la couleur de ses puces |
| `zoneColor` + `CATEGORIES` | `GaussianCurve.tsx:31-37`, `:98-104`, `:192-205` | la **couleur et le libellé sur la courbe** |

Confrontation des trois, valeur par valeur (calculée depuis le code) :

| Valeur | Couleur du tableau (`nsColor`) | Zone sur la courbe (`zoneColor` après `z=(v−10)/3`) | Légende imprimée | Verdict |
|---|---|---|---|---|
| 3 | rouge `#c0504d` | rouge `#b23b37` | « pathologique » | même zone, **deux rouges différents** |
| **4** | **rouge** `#c0504d` | **orange** `#d17a1e` (car `z = −2` et le test est `ds < -2`) | « pathologique » (≤ 4) | **contradiction** |
| 5 | orange `#d99b2b` | orange `#d17a1e` | « fragilité » | même zone, deux oranges |
| **7** | **orange** `#d99b2b` | **vert** `#5a8a37` (car `z = −1` et le test est `ds < -1`) | « moyenne » **et** « fragilité » | **triple contradiction** |
| 10 | vert `#4e7d2f` | vert `#5a8a37` | « moyenne » | même zone, deux verts |
| 13 | vert `#4e7d2f` | vert `#5a8a37` | « moyenne » | cohérent en zone |
| 16 | `#7ba653` | `#7ba653` | non couverte par la légende | cohérent |
| **17** | **`#5a8a37`** — or cette teinte est **le vert « Moyenne » de la courbe** | `#93b673` (« Très supérieur ») | non couverte | **la même teinte signifie « moyenne » et « très supérieur » sur la même page** |

Aucune de ces divergences n'est un défaut d'affichage : ce sont **trois implémentations concurrentes de la même règle métier**. Tant qu'elles coexistent, aucun correctif ponctuel ne tiendra.

## 5.3 Modèle proposé

- **Chaque échelle porte ses propres bandes** (`scale_band_sets` → `scale_bands`, §3.3). Il n'existe aucune bande globale, aucune constante de seuil dans le code.
- **Les bandes sont versionnées.** Corriger un découpage crée une `version` nouvelle ; l'ancienne reste, car des bilans y sont rattachés par `session_results.band_set_id`. Un compte rendu ancien continue de s'afficher comme il a été validé.
- **Les bandes sont sourcées.** `origine` distingue un découpage repris d'un manuel — auquel cas seule la **référence** est stockée, les bornes restant saisies par le praticien — d'une publication citée ou d'une convention assumée par le praticien.
- **Un vocabulaire unique par jeu de bandes.** `band_vocabularies` + contrainte `un_seul_mot_par_bande`. Le praticien choisit les libellés ; ils sont les mêmes partout.
- **Le logiciel ne tranche pas à la place du praticien.** Aucun vocabulaire n'est actif par défaut sur un document remis : `band_vocabularies.usage = 'document_remis'` exige `valide_par` et `valide_le`. Sans validation, le bloc de résultats s'imprime **sans libellé de bande** — le chiffre et l'échelle suffisent.
- **Pas de couleur sans règle.** `sens = 'non_oriente'` ou `couleur IS NULL` → aucune couleur. L'absence de couleur est un état légitime, pas une régression.

## 5.4 Contrat de test de l'invariant de rendu

### La fonction unique

```ts
type Classement =
  | {
      statut: "classe";
      bandId: string;
      libelle: string | null;   // null si le vocabulaire n'est pas validé
      couleur: string | null;   // null si aucune couleur n'est définie
      bandSetId: string;
      bandSetVersion: string;
      source: string;
      comparateur: string;      // ex. "-1 <= v < 1", reconstruit des bornes
    }
  | {
      statut: "non_classable";
      motif:
        | "valeur_non_numerique"
        | "hors_bornes_echelle"
        | "aucun_jeu_de_bandes_actif"
        | "jeu_de_bandes_invalide"
        | "echelle_non_orientee"
        | "resultat_non_saisi";
    };

function classer(bandSetId: string, valeur: number | null): Classement;
```

**Règle d'architecture, non négociable** : le formulaire, le tableau, le graphique et le PDF appellent `classer()` et **rien d'autre**. Aucune de ces quatre surfaces ne contient de borne, de couleur ni de libellé. C'est la disparition structurelle des trois autorités concurrentes du §5.2.

### Les tests qui garantissent l'invariant

| Réf. | Test | Critère de réussite |
|---|---|---|
| **T-01** | Pour chaque jeu de bandes de jeu d'essai, pour chaque bande : évaluer `borne_inf`, `borne_inf ± ε`, `borne_sup`, `borne_sup ± ε`, et le milieu. | La bande retournée est conforme aux inclusivités déclarées. `ε` plus petit que la précision de `decimales`. |
| **T-02** | **Invariant des quatre surfaces.** Pour chaque valeur d'un jeu d'essai couvrant toutes les bandes et leurs bornes : extraire la couleur et le libellé rendus par l'éditeur, le tableau, le graphique et le PDF. | **Égalité stricte des quatre couleurs et des quatre libellés.** Ce test échoue aujourd'hui sur les valeurs 4, 7 et 17 (§5.2) — c'est le test de non-régression de la refonte. |
| **T-03** | Couverture : aucune valeur de `[borne_min, borne_max]` échantillonnée au pas de la précision de l'échelle ne renvoie `aucun_jeu_de_bandes_actif` si un jeu est actif. | Aucun trou. |
| **T-04** | Recouvrement : pour chaque paire de bandes du même jeu, l'intersection des intervalles, inclusivités comprises, est vide. | Aucun chevauchement. |
| **T-05** | Vocabulaire : chaque `libelle_cle` du jeu existe dans le vocabulaire ; deux bandes n'ont jamais le même texte. | Contrainte `un_seul_mot_par_bande` + test applicatif. |
| **T-06** | Valeur non numérique (`"< 1"`, `"NC"`, `""`, `"7 ?"`) → `non_classable / valeur_non_numerique`, **et** aucune couleur, aucun point sur le graphique, aucune ligne de légende. | La valeur reste affichée telle que saisie. Elle n'est jamais silencieusement convertie. |
| **T-07** | `sens = 'non_oriente'` → `non_classable / echelle_non_orientee`, aucune couleur. | Le chiffre s'affiche nu. |
| **T-08** | Vocabulaire non validé pour un `usage = 'document_remis'` → `libelle = null` dans le PDF, libellé présent dans l'éditeur. | Différence assumée entre l'outil de travail et le document remis. |
| **T-09** | Jeu de bandes désactivé puis remplacé par une v2 → un résultat déjà classé conserve `band_libelle_fige` et `band_couleur_figee`. | Un compte rendu ancien ne change pas. |
| **T-10** | Aucune constante de seuil, de couleur de bande ou de libellé de bande hors du module de classement. | Recherche de littéraux hexadécimaux et de bornes numériques dans `app/`, `components/` : zéro occurrence liée à la cotation. |

---

# 6. Âge et dates

## 6.1 Le défaut actuel

`ageFromBirth` (`lib/format.ts:23-37`) calcule l'âge avec `new Date()` — l'instant du rendu. Elle est appelée dans le compte rendu imprimé (`apercu/page.tsx:307`) et dans l'éditeur (`BilanEditor.tsx:662`) **sans jamais recevoir `bilan_date`**, pourtant présente dans le même composant. Elle ne renvoie que des années et des mois, jamais des jours. **[FAIT]**

Le groupe d'âge de la batterie motrice est choisi à la main (`BilanEditor.tsx:481-497`, stocké en `tests.mabc3_group`, `lib/types.ts:292`) **sans aucun rapprochement avec la date de naissance**, disponible dans le même composant via `patientBirthDate`. **[FAIT]**

Conséquence : un bilan passé en février et réimprimé en septembre affiche un âge faussé de sept mois, sur un document dont toute la lecture repose sur des normes par classe d'âge.

## 6.2 Spécification du calcul

```
ageA(dateNaissance, datePassation) -> { annees, mois, jours }
```

**Règles.**

1. **Dates civiles uniquement.** `date` en base, jamais `timestamptz`. Aucune conversion vers UTC à aucun moment — c'est la source classique du décalage d'un jour. Comparaison sur les composantes (année, mois, jour), pas sur des millisecondes.
2. **Algorithme** : emprunt d'abord sur les jours, puis sur les mois.
   - `jours = jourP − jourN` ; si `jours < 0`, emprunter le **nombre de jours du mois précédant la date de passation**, et `mois −= 1`.
   - `mois = moisP − moisN (+ emprunt)` ; si `mois < 0`, `mois += 12` et `annees −= 1`.
3. **Cas limites explicitement testés** : 29 février en date de naissance avec passation une année non bissextile ; passation le jour de l'anniversaire (→ `jours = 0`) ; passation la veille ; naissance le 31 avec passation un mois de 30 jours ; changement d'heure légale (sans effet, puisqu'on ne manipule pas d'instants).
4. **Erreurs.**
   - `datePassation < dateNaissance` → **erreur bloquante** (B2). Aucun âge n'est produit.
   - `datePassation > aujourd'hui` → **erreur bloquante** (B2). Une passation future n'est pas une passation.
   - `dateNaissance` absente → aucun âge, aucun contrôle de tranche, **avertissement** A-13. Jamais d'âge par défaut.
5. **Figement.** `annees`, `mois`, `jours` sont écrits une fois dans `bilan_sessions`, avec `age_calcule_le` et `age_source_naissance`. Le document imprime **cet** âge, jamais un âge recalculé.
6. **Correction d'une date de naissance.** Elle ne réécrit jamais les âges figés. Elle lève un avertissement A-14 sur toutes les passations concernées, avec une action explicite « recalculer l'âge de cette passation » qui ré-horodate `age_calcule_le` et journalise le changement.
7. **Affichage.** Format `X ans Y mois Z jours` dans le contexte d'un instrument ; `X ans Y mois` ailleurs. Le nombre de jours est significatif pour les tranches serrées des premières années : il ne doit pas être supprimé du calcul, seulement, éventuellement, de l'affichage.

## 6.3 Plusieurs passations dans un même bilan

Le modèle actuel ne connaît **qu'une seule date** (`bilans.bilan_date`, `supabase/schema.sql:79`), alors que l'en-tête du compte rendu comporte un champ texte libre « Dates de passation » (`lib/constants.ts:209-213`) : la pluralité est déjà une réalité de la pratique, aujourd'hui hors du modèle. **[FAIT]**

Modèle proposé : `bilan_sessions` (§3.3), une ligne par séance, `ordre` unique par bilan.

- **L'âge est propre à la passation**, jamais au bilan.
- **Chaque instrument est rattaché à une passation**, pas au bilan (`session_instruments`).
- Le compte rendu affiche, pour le bilan : la plage des dates de passation ; et pour chaque instrument : sa date et l'âge correspondant.
- `bilans.bilan_date` devient la **date du compte rendu**, distincte des dates de passation. Renommage à trancher — il change le sens d'une colonne existante. [À INSTRUIRE — décision produit + migration.]
- **Avertissement A-15** si l'écart entre la première et la dernière passation dépasse un seuil que le praticien règle lui-même (le logiciel ne fixe pas ce seuil).

## 6.4 Cohérence âge / tranche annoncée

Trois contrôles distincts, à ne pas confondre.

| Réf. | Contrôle | Comportement |
|---|---|---|
| **A-01** | `age_at_session` hors de `[instruments.age_min_mois, age_max_mois]` | Avertissement visible dans l'éditeur, à côté de l'instrument. Le praticien peut le lever en saisissant une justification, qui est **conservée** (`session_instruments.tranche_age_justification`). Jamais bloquant. |
| **A-02** | `age_at_session` hors de la plage du **formulaire** choisi, alors qu'il est dans celle de l'instrument | Avertissement distinct, avec proposition du formulaire dont la plage correspond. Le choix reste au praticien. |
| **A-03** | `tranche_age_declaree` ≠ tranche déduite de l'âge | Avertissement, **avec les deux valeurs affichées côte à côte**. `tranche_age_source` enregistre si le choix a été déduit ou décidé. |

**Règles de forme, qui comptent autant que les contrôles :**

- Un avertissement n'est **jamais** un blocage silencieux, et **jamais** une correction automatique. Le logiciel ne change pas la tranche à la place du praticien. C'est l'application directe de `.claude/rules/clinical-safety.md`.
- Un avertissement levé **reste dans le dossier** avec sa justification, sa date et son auteur.
- Un avertissement **non levé** apparaît sur le document remis, en note, sauf décision explicite et tracée du praticien de ne pas l'y faire figurer.
- Aucun avertissement ne formule d'appréciation clinique. Il énonce un écart de fait : « âge à la passation : 6 ans 2 mois ; plage annoncée du formulaire : 7 mois – 5 ans 11 mois ». Il ne dit pas si c'est grave.

---

# 7. Comparaison longitudinale

## 7.1 Ce qui doit être signalé

Le produit ne propose aucune comparaison aujourd'hui. Si elle est ajoutée, chaque signalement ci-dessous est une **condition d'ouverture de la fonction**, pas une amélioration.

| Réf. | Situation détectée | Détection |
|---|---|---|
| C-01 | Version d'instrument différente | `instrument_version_figee` |
| C-02 | Formulaire différent | `form_code_fige` |
| C-03 | Répondant différent (parent puis enseignant, mère puis père) | `session_instruments.repondant` |
| C-04 | Examinateur différent | `bilan_sessions.examinateur` |
| C-05 | Échelle ou type de résultat différent | `scale_type_fige`, `scale_moyenne_figee`, `scale_sigma_fige` |
| C-06 | Jeu de bandes différent entre les deux mesures | `band_set_id` |
| C-07 | Étalonnage différent (pays, année de recueil) | `instruments.population_normative` figée |
| C-08 | Passation incomplète ou écarts de protocole déclarés sur l'une des deux | `passation_complete`, `ecarts_protocole` |
| C-09 | Conditions de passation notablement différentes | `bilan_sessions.conditions`, `amenagements` |
| C-10 | Intervalle court entre deux passations — **effet re-test** | écart entre `date_passation` |
| C-11 | Intervalles de confiance qui se recouvrent | `ic_borne_inf` / `ic_borne_sup` |
| C-12 | Sources de cotation différentes | `source_cotation` |
| C-13 | Changement de tranche d'âge normative entre les deux passations | `tranche_age_declaree` |

**Règle de comportement** : si **C-01, C-02, C-05 ou C-07** est vrai, la comparaison chiffrée n'est **pas affichée**. Les deux résultats sont présentés côte à côte, sans écart calculé, sans flèche, sans courbe d'évolution. Le rapprochement reste possible — il est clinique, il est écrit par le praticien.

Sur **C-10**, le logiciel n'invente aucun délai minimal. Le délai recommandé est une propriété de l'instrument (`avertissements_validite`, saisi par le praticien à partir du manuel) ou n'existe pas. Un seuil codé en dur serait la même erreur qu'un seuil de cotation générique.

## 7.2 Formulations d'avertissement

À reprendre mot à mot. Elles énoncent un fait et rendent la main. Elles ne qualifient jamais l'évolution.

> **C-01** — « Les deux passations n'ont pas été réalisées avec la même version de l'instrument ({v1}, le {d1} ; {v2}, le {d2}). Les scores ne sont pas directement comparables. L'écart chiffré n'est pas affiché. »

> **C-02** — « Le formulaire employé diffère entre les deux passations ({f1} puis {f2}). Les échelles peuvent ne pas recouvrir le même contenu. »

> **C-03** — « Le questionnaire a été renseigné par un répondant différent ({r1} puis {r2}). Un écart peut refléter une différence de point de vue autant qu'une évolution. »

> **C-04** — « Les deux passations ont été conduites par des examinateurs différents ({e1}, {e2}). »

> **C-05** — « Les deux résultats n'appartiennent pas à la même échelle ({t1}, moyenne {m1}, écart-type {s1} ; {t2}, moyenne {m2}, écart-type {s2}). Aucune comparaison chiffrée n'est possible sans conversion documentée. »

> **C-06** — « Les bandes d'interprétation appliquées ne sont pas les mêmes ({bs1} v{n1} ; {bs2} v{n2}). Un changement de catégorie peut venir du découpage, non du résultat. »

> **C-07** — « Les étalonnages de référence diffèrent ({p1}, recueil {a1} ; {p2}, recueil {a2}). La position relative n'est pas établie par rapport à la même population. »

> **C-08** — « Une des deux passations est déclarée incomplète ou comporte des écarts de protocole : {détail}. »

> **C-10** — « {n} jours séparent les deux passations. Un effet de re-test — familiarité avec les épreuves — ne peut pas être écarté. Le délai recommandé par l'instrument n'est pas renseigné dans le registre. »

> **C-11** — « Les intervalles de confiance des deux résultats se recouvrent ({a1}–{b1} et {a2}–{b2}, niveau {niv}). L'écart observé n'est pas établi. »

> **C-12** — « Les deux scores n'ont pas été cotés par le même moyen ({s1}, {s2}). »

**Règle de rédaction, applicable à tout avertissement du produit** : aucune de ces phrases ne contient « progrès », « régression », « amélioration », « aggravation », « normalisation », « rattrapage ». Ces mots appartiennent au praticien.

---

# 8. Ce que le moteur ne doit jamais faire

Liste opérationnelle. Chaque ligne est testable.

**Sur les scores**

1. **Inventer un score.** Aucune valeur n'est produite par le logiciel, quelle que soit la richesse du contexte.
2. **Convertir entre échelles sans autorisation.** Aucune conversion hors de `conversions_publiees`, et aucune conversion du tout en l'absence de `moyenne` et `ecart_type` figés.
3. **Calculer un score dérivé à partir d'un score brut.** C'est l'algorithme de l'éditeur (L-3).
4. **Agréger des scores d'instruments différents** en un indice, une moyenne, un « profil global » ou un pourcentage de réussite.
5. **Moyenner ou soustraire des percentiles.**
6. **Extrapoler hors de la plage d'étalonnage.** Un score obtenu à un âge hors plage n'est pas converti, il est signalé.
7. **Arrondir ou normaliser silencieusement** une valeur saisie. `valeur_saisie` conserve la frappe exacte ; `valeur_numerique` est une lecture, pas une substitution.

**Sur les données manquantes**

8. **Remplir une case vide**, par une valeur neutre, par la moyenne, par la valeur de la passation précédente, ou par zéro.
9. **Confondre « non passé », « non applicable », « non cotable », « refus », « interrompu » et « vide ».** Cinq statuts distincts, jamais repliés sur un seul.
10. **Convertir une absence en résultat normal** — y compris visuellement, en laissant une case blanche dans un tableau dont les autres cases sont colorées. Une absence porte son statut écrit.

**Sur l'interprétation**

11. **Conclure à une pathologie, un trouble ou un diagnostic.** Le bilan psychomoteur est un acte du psychomotricien (R. 4332-1 CSP) ; le diagnostic n'est pas un acte du logiciel.
12. **Présenter une catégorie interprétative comme un diagnostic.** Une bande est une position dans une distribution, pas un état de santé. Le vocabulaire du praticien doit pouvoir être purement descriptif.
13. **Produire une orientation, une préconisation, une prescription ou une durée de suivi.**
14. **Colorer une valeur sans jeu de bandes actif, sourcé et complet.**
15. **Afficher un libellé de bande non validé sur un document remis.**
16. **Qualifier une évolution** entre deux passations (§7.2).

**Sur la traçabilité et les droits**

17. **Modifier rétroactivement un résultat déjà porté sur un document validé.** Correction = nouvelle version, avec motif, auteur et date ; jamais une réécriture silencieuse.
18. **Relire le registre pour recomposer un résultat déjà enregistré.** Les champs figés font foi.
19. **Livrer, suggérer ou pré-remplir un intitulé d'épreuve, une grille ou un découpage repris d'un manuel**, quel que soit le statut de licence autre que `outil_libre_valide`.
20. **Transmettre à un modèle de langage** un champ du registre, un intitulé d'échelle, un résultat, une bande ou un libellé de bande.
21. **Laisser entendre que l'abonnement confère un droit sur un instrument** (L-6).
22. **Imprimer un bloc de résultats sur un bilan non validé sans mention visible de son statut.**

---

# 9. Flux, états, validations

## 9.1 Flux détaillé

```
A. PRÉPARATION (hors patient)
   A1  Le praticien ajoute un instrument au registre        -> reference_seule
   A2  Il renseigne les métadonnées + source + date de consultation
   A3  Il atteste avoir acquis l'instrument et être qualifié -> journalisé (L-6)
   A4  Il fait passer l'instrument à scores_saisis_par_le_praticien
   A5  Il crée ses échelles (libellé, type, m, sigma, sens, unité, bornes)
   A6  Il crée un vocabulaire de bandes, puis un jeu de bandes v1 sourcé
   A7  Il valide le vocabulaire pour l'usage « document remis »
       -> sans A7, les libellés n'apparaissent pas sur le PDF

B. PASSATION
   B1  Création d'une passation : date, examinateur, lieu, conditions
   B2  Calcul et figement de l'âge (annees/mois/jours)     -> erreurs B2 ci-dessous
   B3  Rattachement d'un instrument + formulaire            -> figement des métadonnées
   B4  Contrôles d'âge A-01 / A-02 / A-03                   -> avertissements
   B5  Saisie des résultats : statut, valeur, IC, source de cotation
   B6  Classement par classer()                             -> ou non_classable motivé

C. RÉDACTION
   C1  Le praticien écrit ses observations et son analyse (texte libre)
   C2  Reformulation assistée, facultative, sur le texte libre uniquement
   C3  Relecture : chaque résultat passe verifie_par / verifie_le

D. VALIDATION
   D1  Contrôles bloquants B1..B9                           -> refus si l'un échoue
   D2  Revue des avertissements non levés                   -> lever ou laisser
   D3  Validation : horodatée, nominative, irréversible sans nouvelle version

E. RESTITUTION
   E1  Document produit, portant son statut
   E2  Destinataire confirmé explicitement
   E3  Partage journalisé (qui, quoi, quand, à qui)
   E4  Correction ultérieure -> nouvelle version, jamais réécriture
```

## 9.2 États

| Objet | États | Transitions notables |
|---|---|---|
| Instrument (registre) | `brouillon` → `actif` → `retire` | `retire` conserve toutes les références figées. |
| Statut de licence | `reference_seule` → `scores_saisis_par_le_praticien` → `integration_editeur_autorisee` / `outil_libre_valide` | Montée : explicite, tracée, nominative. Descente : automatique si une condition tombe. |
| Jeu de bandes | `brouillon` → `valide` → `actif` → `remplace` | `actif` exige les invariants T-03/T-04/T-05. Un seul actif par échelle. |
| Passation | `planifiee` → `realisee` → `interrompue` / `annulee` | `annulee` conserve la ligne et ses résultats, marqués. |
| Résultat | `vide` → `saisi` → `classe` → `verifie` | Un résultat `non_classable` peut être `verifie` : il est alors publiable **sans** bande. |
| Bilan | `brouillon` → `relu` → `validé` → `partagé` → `corrigé` → `archivé` | Reprend la liste de `docs/clinical/CLINICAL_SAFETY.md`. Aujourd'hui : deux états seulement, sur un interrupteur réversible (`BilanEditor.tsx:882-895`). **[FAIT]** |

## 9.3 Erreurs bloquantes

| Réf. | Condition | Effet |
|---|---|---|
| **B1** | Un résultat chiffré existe sans date de passation. | Refus d'enregistrer la passation. |
| **B2** | `date_passation < date_naissance`, ou `> aujourd'hui`. | Refus. Aucun âge produit. |
| **B3** | `valeur_numerique` nulle sur une échelle numérique. | La saisie est **conservée**, mais aucune bande, aucune couleur, aucun point de graphique. |
| **B4** | Échelle `note_standard` / `note_t` / `indice` / `ecart_type_z` sans `moyenne` ou `ecart_type`. | Refus de créer l'échelle (contrainte SQL). Refus de tracer tout graphique. |
| **B5** | Jeu de bandes incomplet, chevauchant, ou dont un libellé manque au vocabulaire. | Refus de passer `actif`. |
| **B6** | Résultats structurés sur un instrument en `reference_seule`. | Refus d'enregistrer les résultats structurés. La saisie reste possible en texte libre. |
| **B7** | `integration_editeur_autorisee` sans les trois champs de vérification, ou `licence_expire_le` dépassée. | Repli automatique sur `scores_saisis_par_le_praticien` + bandeau. |
| **B8** | Impression du bloc résultats avec un résultat `non_cotable` non mentionné. | Refus d'imprimer le bloc tant que la mention n'est pas présente. |
| **B9** | Export ou partage d'un bilan dont le statut n'est pas `validé`. | Refus, ou apposition d'une mention de statut non désactivable. Décision produit. [À INSTRUIRE] |
| **B10** | Migration ajoutant une table ou une colonne destinée à des items, consignes ou tables normatives. | Refus en revue (L-1, L-2). Contrôle humain, non automatisable. |

## 9.4 Avertissements

Non bloquants, visibles, conservés, jamais corrigés automatiquement.

| Réf. | Condition |
|---|---|
| A-01 / A-02 / A-03 | Écarts d'âge et de tranche (§6.4). |
| A-04 | Étalonnage d'un pays différent de la langue de passation. |
| A-05 | Effectif normatif faible — la valeur est affichée telle quelle, aucun seuil n'est fixé par le logiciel. |
| A-06 | Conversion demandée absente de `conversions_publiees`. |
| A-07 | Intervalle de confiance non renseigné. |
| A-08 | Passation incomplète ou écarts de protocole déclarés. |
| A-09 à A-12 | Comparaison longitudinale (§7.1). |
| A-11 | Vocabulaire de bandes non validé alors que le bloc part dans un document remis. |
| A-12 | Échelle `sens = 'eleve_defavorable'` : rappel que la lecture des couleurs est inversée. |
| A-13 | Date de naissance absente : aucun âge, aucun contrôle de tranche. |
| A-14 | Date de naissance corrigée après une passation : âges figés à recalculer, explicitement. |
| A-15 | Écart important entre la première et la dernière passation d'un même bilan. |
| A-16 | Instrument dont l'année de publication est ancienne — valeur affichée, aucun seuil fixé par le logiciel. |

---

# 10. Critères de test

Aucun harnais de test n'existe dans le dépôt. **[FAIT — `docs/context/CURRENT_STATE.md`, section « Vérifications connues ».]** Les critères ci-dessous décrivent ce qu'il faudrait couvrir ; leur mise en place relève de `ingenieur-tests-qualite`.

**Toutes les données de test sont synthétiques et manifestement fictives** (règle 1 de `CLAUDE.md`).

| Réf. | Objet | Critère de réussite |
|---|---|---|
| T-01 à T-10 | Invariant de classement | §5.4. **T-02 est le test central de la refonte.** |
| T-11 | Calcul d'âge | 29 février ; jour d'anniversaire ; veille ; naissance le 31 avec passation en mois de 30 jours ; passation antérieure à la naissance (erreur) ; passation future (erreur) ; absence de date de naissance. Résultats attendus en années/mois/jours. |
| T-12 | Figement de l'âge | Modifier la date de naissance après figement ne change aucun âge. L'avertissement A-14 apparaît. Le recalcul explicite ré-horodate et journalise. |
| T-13 | Figement des métadonnées | Modifier ou retirer un instrument du registre ne change aucun bilan existant. Le nom, la version et l'éditeur figés restent affichés. |
| T-14 | Statuts de licence | Pour chacun des quatre statuts, vérifier la liste exacte des opérations autorisées et refusées (§3.2). Vérifier le repli B7. |
| T-15 | Absence de contenu protégé | Contrôle de dépôt : aucune constante de plus de trois libellés d'épreuve, aucun tableau de correspondance score/norme, aucun fichier `*_norms` / `*_bareme` / `*_etalonnage`. Complété par une revue humaine — l'automatisation ne sait pas reconnaître une grille. |
| T-16 | Périmètre transmis au LLM | Interception de l'appel sortant : les seules valeurs transmises sont le titre de section et le texte libre. Aucun champ du registre, aucun résultat, aucune bande. |
| T-17 | Distinction des absences | Les cinq statuts d'absence produisent cinq rendus distincts, dans l'éditeur et dans le PDF. Aucun ne produit une case blanche indistincte. |
| T-18 | Erreurs bloquantes | B1 à B9 : chacune déclenche un refus explicite, avec un message qui nomme la cause. Aucune n'est avalée silencieusement — défaut `MEN-007` du dépôt, à ne pas reproduire. |
| T-19 | Avertissements | Chaque avertissement est affiché, peut être levé avec justification, et la justification est conservée avec son auteur et sa date. Un avertissement non levé apparaît sur le document. |
| T-20 | Comparaison longitudinale | C-01, C-02, C-05 et C-07 suppriment l'écart chiffré. Les formulations du §7.2 apparaissent mot à mot. |
| T-21 | Isolation | Lecture et écriture sur le registre, les passations et les résultats d'un autre compte : refusées côté serveur, pas seulement masquées dans l'interface. Instruments de catalogue : lisibles par tout compte authentifié, non modifiables. |
| T-22 | Graphiques | Une échelle sans `moyenne`/`ecart_type` ne produit aucun graphique. Une échelle `percentile`, `categorie` ou `age_developpement` ne produit aucun graphique de distribution. Aucun graphique ne porte plus d'une échelle. |
| T-23 | Document et statut | Un bilan non validé ne s'imprime jamais sans mention de statut. |

---

# 11. Plan de sortie du contenu protégé

Ordre proposé, du plus urgent au moins urgent, par risque décroissant.

| Étape | Action | Éléments visés | Effet sur l'utilisateur |
|---|---|---|---|
| 1 | Retirer les intitulés d'épreuves et les grilles **du document imprimé** | I-16, I-17 | Les tableaux restent saisissables, mais le PDF n'affiche que les libellés saisis par le praticien. |
| 2 | Retirer le contenu du code, le remplacer par des échelles créées par le praticien | I-05 à I-07, I-10, I-11 | **Rupture.** Les bilans existants portent des clés de lignes (`tests.mabc3`, `tests.dunn`) qui n'auront plus de libellé. Migration de reprise obligatoire, avec choix du praticien. [À INSTRUIRE — décision produit.] |
| 3 | Supprimer la constante morte et les deux champs de profil inutilisés | I-01 | Aucun. |
| 4 | Remplacer `nsColor`, `SCORE_INTERPRETATION`, `ZONE_TEXT` et la logique de zones de la courbe par `classer()` | I-12, I-13, I-14, I-15 | Les couleurs changent. C'est le but. |
| 5 | Introduire `bilan_sessions`, l'âge figé et les contrôles de tranche | — | Le champ texte « Dates de passation » devient structuré. |
| 6 | Introduire le registre complet et les statuts de licence | — | Nouvelle section dans les Paramètres. |
| 7 | Encadrer l'usage de marque dans les titres de documents | I-04 | Titre du compte rendu sensoriel à revoir. |

**Point de bascule de l'étape 2** : c'est la seule étape qui dégrade l'expérience du praticien. Elle ne peut pas être décidée par un agent. Elle appelle un arbitrage explicite du propriétaire du produit, éclairé par les validations du §12.

---

# 12. Validations externes nécessaires

Aucune des conclusions de ce document n'est opposable sans les validations ci-dessous. Elles sont classées par urgence.

## 12.1 Éditeurs

| # | Destinataire | Question posée | Pourquoi elle est bloquante |
|---|---|---|---|
| E-1 | ECPA / Pearson France — service juridique ou service client professionnel | Quelle est la **version en vigueur** des conditions d'utilisation des matériels psychométriques ? Le document consulté le 2026-09-11 mentionne des échéances de 2018. | Toute l'analyse du §2.2.2 repose sur un document possiblement périmé. |
| E-2 | Même destinataire | La **saisie manuelle**, par un praticien qualifié, des intitulés d'épreuves et des grilles de restitution dans un logiciel de cabinet, pour son usage propre, est-elle couverte par les conditions d'utilisation ? Le cas échéant, à quelles conditions ? | Détermine si l'étape 2 du §11 est une obligation ou une précaution. |
| E-3 | Même destinataire | La **reproduction d'une grille de restitution dans le compte rendu remis à la famille et aux tiers** est-elle autorisée, et sous quelle mention ? | C'est le point I-16/I-17, le plus exposé. |
| E-4 | Même destinataire | Existe-t-il un **cadre d'intégration** (licence, API, partenariat) pour un logiciel de cabinet tiers, et à quelles conditions ? | Conditionne l'existence réelle du statut `integration_editeur_autorisee`. |
| E-5 | Même destinataire | L'usage du **nom commercial d'un instrument dans le titre d'un document** produit par un logiciel commercialisé appelle-t-il une autorisation ? | Point I-04. |

## 12.2 Juriste

| # | Objet | Question |
|---|---|---|
| J-1 | Qualification | La transposition d'une grille de passation en formulaire logiciel constitue-t-elle une reproduction ou une adaptation au sens de l'article L. 122-4 CPI ? |
| J-2 | Exceptions | Une exception de l'article L. 122-5 CPI est-elle mobilisable pour un usage professionnel interne en cabinet libéral ? |
| J-3 | Base de données | Le droit *sui generis* des articles L. 341-1 et suivants s'applique-t-il à une table d'étalonnage, et à partir de quel volume d'extraction ? |
| J-4 | Responsabilité | Qui répond d'une reproduction non autorisée : l'éditeur du logiciel, le praticien utilisateur, ou les deux ? Quelles mentions contractuelles sont nécessaires entre eux ? |
| J-5 | Commercialisation | Le passage d'un usage mono-utilisateur à une diffusion commerciale change-t-il la qualification ? |
| J-6 | Sous-traitance IA | La transmission de texte clinique à un fournisseur de modèle de langage appelle-t-elle, au-delà du RGPD, une mention spécifique vis-à-vis des conditions d'utilisation des éditeurs de tests ? |

**Responsable de validation** : conseil en propriété intellectuelle, saisi par le propriétaire du produit. **Aucune décision de ce document ne doit être présentée comme conforme avant J-1 à J-5.**

## 12.3 Psychomotricien en exercice

| # | Question |
|---|---|
| P-1 | Le vocabulaire des bandes doit-il être choisi par le praticien, ou un vocabulaire proposé par défaut est-il attendu ? Si oui, lequel, et pour quel destinataire ? |
| P-2 | Le terme employé aujourd'hui pour la bande basse est-il acceptable sur un document remis à une famille ? (Reprend `Q-202` et § C-3 de `CLINICAL_SAFETY.md`.) |
| P-3 | Un bilan sans couleur — chiffres nus, échelle nommée, intervalle de confiance — est-il lisible et utile, ou la couleur est-elle indispensable ? |
| P-4 | La saisie des intitulés d'épreuves par le praticien lui-même est-elle une charge acceptable, ou un motif d'abandon du produit ? **C'est la question qui décide de la faisabilité de l'étape 2 du §11.** |
| P-5 | Combien de passations dans un bilan, en pratique, et à quel intervalle ? |
| P-6 | L'âge doit-il s'afficher en années/mois/jours sur le document, ou en années/mois seulement ? |
| P-7 | Quels avertissements doivent figurer sur le document remis, et lesquels doivent rester dans l'outil de travail ? |
| P-8 | Y a-t-il des instruments réellement libres, employés en psychomotricité, qui justifieraient le statut `outil_libre_valide` et un contenu livré dans le catalogue ? |

**Responsable de validation** : psychomotricien en exercice, représentatif de la pratique libérale visée. Documenter la version examinée, les réserves et la décision (`docs/clinical/CLINICAL_SAFETY.md`, section « Validation métier »).

## 12.4 Produit

| # | Décision attendue |
|---|---|
| D-1 | Le registre est-il un catalogue livré + des entrées de compte, ou uniquement des entrées de compte ? |
| D-2 | `bilans.bilan_date` devient-elle la date du compte rendu, distincte des dates de passation ? Migration à prévoir. |
| D-3 | L'étape 2 du §11 est-elle engagée, et à quelle échéance ? |
| D-4 | Un bilan non validé peut-il être exporté, et avec quelle mention ? (B9) |
| D-5 | Que deviennent les données déjà saisies dans `tests.mabc3` et `tests.dunn` ? |

---

## Sources

- [ITC — *The ITC Guidelines on the Security of Tests, Examinations, and Other Assessments*, v1.0, 6 juillet 2014, réf. ITC-G-TS-20140706](https://www.intestcom.org/files/guideline_test_security.pdf) — consulté le 2026-09-11
- [International Test Commission — page des lignes directrices sur la sécurité des tests](https://www.intestcom.org/page/18) — consulté le 2026-09-11
- [Pearson France / ECPA — Conditions d'utilisation des matériels psychométriques et conditions générales de vente](https://www.pearsonclinical.fr/pub/media/wysiwyg/France/commande_condition_ecpa.pdf) — consulté le 2026-09-11 (version applicable à confirmer, voir E-1)
- [Pearson France / ECPA — Niveaux de qualification requis](https://www.pearsonclinical.fr/niveau-qualification) — consulté le 2026-09-11
- [Pearson Clinical Assessment UK — Terms of sale and use](https://www.pearsonclinical.co.uk/legal/terms-of-sale-use.html) — consulté le 2026-09-11
- [Pearson France — fiche produit de la batterie motrice, 3ᵉ édition](https://www.pearsonclinical.fr/mabc-3) — consulté le 2026-09-11
- [Pearson France — fiche produit du questionnaire sensoriel, 2ᵉ version](https://www.pearsonclinical.fr/profil-sensoriel-2) — consulté le 2026-09-11
- [Légifrance — Code de la propriété intellectuelle, article L. 122-4](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006278911) — consulté le 2026-09-11
- [Légifrance — Code de la propriété intellectuelle, article L. 122-5](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006278917) — consulté le 2026-09-11
- [Légifrance — Code de la propriété intellectuelle, article L. 341-1](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006279245) — consulté le 2026-09-11
- [Légifrance — Code de la santé publique, article R. 4332-1](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006914164) — consulté le 2026-09-11
