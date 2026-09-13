# Moteur de documents cliniques — analyse et plan

Trois relectures indépendantes, 2026-09-12 : pratique du métier, conception des
comptes rendus, modèle fonctionnel. Ce document consolide ce qu'elles disent,
et **ce que j'ai vérifié moi-même** — plusieurs de leurs affirmations étaient
fausses, et une l'était dans le sens favorable.

## 0. Le fait qui commande tout le reste

**Le moteur de bilans est le seul module resté sur le modèle v1.** La table
`bilans` est clé sur `user_id` : pas de rattachement au cabinet, pas de lien au
parcours de soin, pas de lien aux séances, pas de colonne de type.

Plus net : **la base de développement ne contient pas cette table**, et aucun
des dix fichiers de contrôle SQL ne la couvre. Dossiers, agenda, comptabilité,
attestations et transmissions sont passés au modèle de cabinet avec leurs
contrôles d'isolation. Le cœur clinique, non.

Constaté en production : sur 7 bilans, **3 ne sont rattachés à aucun dossier**,
et certains n'ont aucune clé `__type__` — ils retombent silencieusement sur
« psychomoteur ».

## 1. Les documents qui manquent

Par ordre de ce qu'ils coûtent, pas d'ordre chronologique.

| # | Document | Destinataire | Ce qu'il y a déjà en base |
|---|---|---|---|
| 1 | ~~**Note de séance**~~ **fait le 2026-09-13** | personne, usage propre | Branchée depuis la fiche du dossier ET depuis l'agenda. Garde de cohérence en base (`0021`) : même cabinet, même dossier, même séance. L'agenda dit quelles séances portent déjà une note. |
| 2 | ~~**Courrier de liaison**~~ **fait le 2026-09-13** | un professionnel nommé | Écrit depuis le dossier, remis, imprimable, annulable avec motif. Destinataire obligatoire, en deux groupes séparés. Instantané figé à la remise. L'état du consentement est DIT, pas exigé. Ne reprend rien d'un bilan. |
| 3 | ~~**Synthèse de suivi**~~ **fait le 2026-09-13** | prescripteur, famille, structure | Rédigée depuis le dossier, remise, imprimable, annulable avec motif. **Premier document dont une moitié est pré-remplie** : `public.follow_up_facts` relève les séances honorées, les rendez-vous non honorés, les séances annulées par le cabinet, l'ouverture du parcours et les objectifs tels qu'elle les a posés — la MÊME fonction sert l'écran et l'émission, qui la fige. L'émission REFUSE si elle n'a rien écrit. |
| 4 | ~~**Écrit de fin de prise en soin**~~ **fait le 2026-09-13** | prescripteur, famille, relais | UN objet, QUATRE natures (`fin_convenue`, `arret_a_la_demande`, `sans_nouvelle`, `relais`), et le discriminant appartient au DOCUMENT — pas au statut du parcours, que l'archivage écrit parfois lui-même. **Le parcours se clôt d'abord** : le brouillon s'écrit sur un parcours ouvert, la remise exige un parcours clos avec ses deux bornes. Un parcours portant un écrit remis ne se rouvre plus. Trois avertissements d'écran qui ne partent jamais avec le document. |
| 5 | **Écrit pour un tiers non soignant** (école, MDPH) | enseignant, MDPH | — |
| 6 | **Notice d'information** | la personne, à l'entrée | `patient_consents` trace `information_recue` |
| 7 | **Projet d'accompagnement imprimable** | famille, patient | `care_objectives` au complet |

**Deux incohérences internes, vérifiées** : le produit traçait un consentement
au partage professionnel et la remise d'une notice d'information — et **ne
savait produire ni l'un ni l'autre**. La première est levée depuis le
2026-09-13 : le courrier de liaison existe. La seconde reste ouverte.

**Correction d'une erreur de la relecture métier** : elle annonçait que
`patient_notes` n'avait pas d'`appointment_id`. C'est faux — la colonne a été
ajoutée par la migration `0005`, avec un index partiel. Le manque n'était donc
pas un modèle à construire : **c'était un fil à brancher**. Fait le 2026-09-13.

**Et ce branchement a révélé un défaut d'isolation**, trouvé en cherchant à
falsifier la garde qu'il ajoutait : `patient_notes` ne vérifiait pas que son
patient appartient à son cabinet. Démontré en exécution — un praticien du
cabinet A écrivait une note clinique nommant un dossier du cabinet B. C'était
la seule table de sa famille sans cette garde.

### Sur les tiers non soignants, un point sourcé qui tranche

Le certificat MDPH (Cerfa 15695\*01) est rempli et signé **par un médecin**.
Les seuls volets annexés prévus sont ORL et ophtalmologique, remplis par des
médecins spécialistes. **Aucun formulaire n'est prévu pour un psychomotricien.**
Ce qu'elle produit est une pièce jointe libre. *Le produit ne doit jamais
laisser croire qu'il remplit une pièce officielle.*

C'est aussi l'écrit où la sur-divulgation est la plus probable : anamnèse et
résultats chiffrés doivent être **exclus par défaut**, cochables un par un.

## 2. Le « type de bilan » confond quatre choses

Une seule clé de jsonb décide aujourd'hui du titre imprimé, de la trame, de la
bibliothèque de modèles et de l'apparence. Ce sont quatre choses de natures
différentes, et c'est ce qui force la duplication par suffixe
(`bilan_sections` / `bilan_sections_sensoriel`, et ainsi de suite).

**Le modèle retenu** — et ce n'est pas celui qu'on écrirait d'instinct :

- **la nature** (`kind`) : liste close, contrainte en base, comme
  `billing_documents.kind` et `attestations.kind` ;
- **la trame** (`template_id`) : une donnée du cabinet, en table.

**Ce que j'écarte : une table `bilan_types`.** C'est le mouvement évident, et
c'est un piège : une ligne « type » devrait posséder sa trame, son titre, sa
bibliothèque et son apparence — donc reproduire la duplication un niveau plus
bas. Et le besoin suivant — « une réévaluation qui reprend la trame du bilan
initial » — exigerait un type de plus recopiant tout.

### L'argument le plus fort n'est pas technique

`DEFAULT_SENSORY_SECTIONS` est l'architecture du Profil Sensoriel de Dunn 2,
**recopiée en dur dans le produit et distribuée avec lui**. Porter la trame en
table change qui détient et diffuse cette structure : elle devient une donnée
saisie par la praticienne dans son cabinet.

*Aucune conformité n'est affirmée ici.* C'est un changement de nature à
qualifier par un conseil en propriété intellectuelle — le point est ouvert
depuis l'audit d'origine (`R-04`).

### Fidélité du document remis : instantané, pas versionnage

Aujourd'hui, modifier sa trame modifie **les documents déjà remis** : l'aperçu
résout la trame vivante à chaque rendu. Deux mécanismes répondent ; ils ne
coûtent pas la même chose.

Le **versionnage** ajoute un circuit de publication — brouillon, publication,
« votre trame a évolué, que fait-on des documents en cours ? » — à un produit
qui compte un cabinet utilisateur.

L'**instantané à la validation** donne la même garantie pour une colonne
`jsonb`, avec un précédent éprouvé trois fois dans ce dépôt
(`billing_documents`, `attestations`, `0020`). C'est celui-là.

### L'invariant à ne jamais casser

Les identifiants de section sont **la clé de stockage du contenu écrit**. Ils
sont recopiés à l'identique, rendus immuables par déclencheur, et le préfixe
`__` leur est interdit — `__type__` et `__ia__` occupent déjà cet espace de
nommage. **C'est la seule décision irréversible au sens strict : un texte
orphelin ne se retrouve pas.**

## 3. Où part le temps, et ce qu'on peut légitimement reprendre

Par ordre décroissant, établi sur ce que le code rend possible ou impossible.

1. **La répétition d'un bilan à l'autre.** Quatorze sections rédigées de zéro.
2. **La recopie de scores.** Vingt saisies libres pour le M-ABC, sans aucun
   calcul et sans reprise d'un bilan à l'autre.
3. **La saisie brute** — c'est le travail, et c'est normal.
4. **L'attente au chargement.**
5. **La mise en forme : nulle.** Tous les champs sont des zones de texte nues.
   *Ne pas introduire d'éditeur riche : ce serait créer un coût là où il n'y en
   a pas.*

### Ce qui est déjà corrigé

- **Insertion au curseur** pour les modèles et la dictée — elles concaténaient
  en fin de champ, ce qui rendait un modèle inutilisable dès qu'un texte
  existait.
- **Le prescripteur** avait disparu du document remis depuis la bascule.
- **L'auteur imprimé** était celui des paramètres courants, pas celui du bilan.
- **La liste** téléchargeait toutes les images de tous les bilans.

### Ce qui peut être pré-rempli — des FAITS, jamais une interprétation

Motif de la demande, adresseur, prescripteur et date de prescription, cadre de
financement, destinataires prévus, dates de passation candidates *(proposées en
cases à cocher, jamais pré-cochées)*, nombre de séances honorées, instruments
et leurs avertissements de validité, objectifs et leur statut tel qu'**elle**
les a posés.

Chaque valeur porte son origine et reste modifiable.

### Ce que je refuse de proposer

**L'anamnèse pré-remplie depuis les notes de dossier.** Les notes portent
`third_party_information` et `third_party_source` — un marquage posé au titre du
droit d'accès, qui exclut les informations concernant un tiers. Les déverser
dans un document qui sort du cabinet ferait franchir à une information de tiers
une frontière que le modèle a été **conçu** pour tenir.

Au mieux : un panneau en lecture seule, reprise **une par une**, notes « tiers »
visuellement distinctes et exclues de toute reprise en masse.

## 4. Ce qui ne doit pas être automatisé

**La conclusion.** C'est là que le raisonnement se forme, et c'est le paragraphe
que le médecin, l'école et la MDPH lisent en premier. Ni génération, ni
assemblage depuis les sections, ni pré-remplissage. *Aujourd'hui le bouton
« Reformuler » y est comme ailleurs.*

Ensuite : déduire une interprétation d'un score ; qualifier une donnée brute à
la frappe *(`nsColor` le fait déjà, avec des seuils qu'elle ne règle pas)* ;
proposer des étiquettes diagnostiques ; pré-remplir une formule de normalité
dans un domaine vide ; signaler un bilan comme « incomplet » parce qu'il n'a
aucun chiffre — **chez le nourrisson comme souvent chez l'adulte, un bilan sans
aucun score est la norme** ; produire une phrase d'évolution entre deux
passations ; marquer un objectif « atteint » parce qu'un score a monté.

## 5. Le plan, dans l'ordre

**Palier A — quelques heures, aucune migration.** Insertion au curseur *(fait)*.
Variables résolues à l'insertion. Rattachement des modèles aux sections.
Prescripteur *(fait)*. Auteur *(fait)*. Projection de liste *(fait)*.

> **Piège nommé, à ne jamais commettre :** ne pas dériver `{{pronom}}` de
> `patients.norm_reference_sex`. Le commentaire de la migration `0002` dit que
> cette colonne est le sexe de référence **pour l'étalonnage d'un instrument, et
> rien d'autre**. L'employer pour accorder une phrase, c'est lui donner un
> second usage non déclaré. Le pronom employé dans les écrits est un champ
> distinct, saisi, éventuellement vide.

**Palier B — une à trois journées, aucune migration.** Panneau « bilan
précédent » en lecture seule, reprise paragraphe par paragraphe et estampillée.
Pré-remplissage des faits de contexte. Variantes nommées de modèles. Panneau
« notes du dossier », reprise unitaire.

> La trace d'origine existe déjà : `lib/bilans/provenance.ts` et
> `sectionsGenereesNonRetouchees`, écrits pour l'assistant, se généralisent à
> « repris d'un bilan antérieur » et « issu d'un modèle ». À la finalisation, la
> liste devient « ces sections vous ont été proposées et vous ne les avez pas
> modifiées » — c'est **le** garde-fou contre l'observation ancienne devenue
> fausse, et il est déjà écrit et contrôlé.

**Palier C — migrations, dans cet ordre.** `0021` crée les trois tables sans
rien déplacer. `0022` reprend les bilans v1 selon la méthode de `0003` et
`0011`. Puis la bascule de l'interface **en un seul commit** — pendant la
transition, les deux tables portent les mêmes identifiants, et un écran lisant
l'une pendant qu'un autre lit l'autre fait apparaître un bilan deux fois ou
disparaître d'une liste.

### Ce qui n'a pas besoin d'être fait

Le versionnage des trames. Le partage de trames entre cabinets. Un catalogue de
domaines — *n'ajoutez même pas une colonne « en prévision »*. La reprise des
scores vers le registre d'instruments : elle est **bloquée par une dépendance
humaine**, le registre étant vide et seule la praticienne pouvant le remplir.
Et **trancher `Q-203`** : la bascule ne l'exige pas, et la migration est la même
quelle que soit la réponse.

## 6. Ce que le code ne peut pas décider

| # | Question | Qui | Bloque |
|---|---|---|---|
| D-a | `Q-201` — ce que « validé » signifie : verrouillage, horodatage, correction par remplacement ? | psychomotricienne | **tout le palier C** |
| D-b | Trois natures au départ, ou neuf ? *(Neuf dont sept inutilisées, c'est sept écrans vides et sept décisions prises à l'aveugle.)* | psychomotricienne | `0021` |
| D-c | Un document validé sans dossier patient est-il légitime ? | psychomotricienne | `0021` |
| D-d | Les modèles restent-ils cloisonnés par type, ou une seule bibliothèque à dossiers ? *(Probablement un effet de bord du suffixe.)* | psychomotricienne | `0021` |
| D-e | Les bilans finalisés repris : validés d'office avec instantané reconstitué, ou à revalider ? | propriétaire | `0022` |
| D-f | Un lien partagé suit-il le document remplacé, ou le remplaçant ? | psychomotricienne | `0021` |
| D-g | `Q-303` — la conclusion reste-t-elle reformulable ? | psychomotricienne | palier A |
| D-h | La structure Dunn 2 devenue donnée du cabinet : ce que cela change, ou non | conseil en propriété intellectuelle | non |
| D-i | Faut-il EXIGER un accord de partage avant de remettre un courrier ou une synthèse, ou seulement le DIRE ? *(Le produit dit, aujourd'hui. Une synthèse emporte les objectifs, donc davantage qu'un courrier.)* | psychomotricienne | non |
| D-j | Le vocabulaire IMPRIMÉ des statuts d'objectif. « Abandonné » se lit comme un constat sur une personne dans un document que liront une famille ou un financeur ; le document imprime « Non poursuivi ». Faut-il imprimer les objectifs non poursuivis ? | psychomotricienne | non |
| D-k | Le motif d'une annulation reste réécrivable après coup sur l'**attestation** (`0016`) et le **courrier** (`0022`). La synthèse (`0023`) le fige. **Écart assumé et consigné** : le figer sur les deux autres demande une migration, et c'est la même décision pour les trois. | psychomotricienne | non |
| D-q | Faut-il une cinquième nature de fin — « à l'initiative de la praticienne » (cessation d'activité, déménagement, cadre devenu intenable) ? Non ajoutée « en prévision ». | psychomotricienne | non |
| D-r | Plusieurs écrits de fin pour un même parcours — un au médecin, un à la famille — est-ce l'usage ? Aucune unicité n'est posée en base : elle bloquerait ce cas légitime. Un avertissement d'écran reste à ajouter. | psychomotricienne | non |
| D-s | Reprise après un écrit de fin remis : nouveau parcours, ou réouverture ? **`0024` tranche pour le nouveau parcours** — un parcours portant un écrit remis ne se rouvre plus. Réversible : retirer la garde ne détruit aucune donnée. | psychomotricienne | non |
| D-n | Le défaut d'impression des objectifs doit-il DÉPENDRE du destinataire ? Le produit ne distingue aujourd'hui aucune catégorie (prescripteur, famille, structure, financeur) ; en créer une engage une qualification juridique. La case existe, son défaut est « imprimer ». | psychomotricienne + juriste/DPO | non |
| D-o | Un écrit concernant un mineur peut-il être remis sans identifier le titulaire de l'autorité parentale qui le reçoit ? Le modèle porte `patient_contacts.role` et `legal_basis` ; la synthèse ne les lit pas. | juriste/DPO + psychomotricienne | non |
| D-p | Faut-il journaliser l'OUVERTURE de la page d'impression ? C'est le seul geste du parcours qui produit une copie hors du système. **Non fait** : Next.js préfetche les liens, et une trace d'impression qui n'a pas eu lieu est pire qu'aucune trace. Il faudrait un bouton d'impression explicite. | DPO | non |
| D-m | Le non-dit est-il conservé ? Une synthèse remise sans les rendez-vous non honorés ne les garde plus dans son instantané — un document ne conserve pas ce qu'il n'a pas dit. Si la praticienne veut retrouver ce qu'elle n'a PAS dit, c'est une décision produit, et elle est réversible. | psychomotricienne | non |
| D-l | La périodicité d'une synthèse. Elle se lit dans le contrat signé ; le produit n'en impose aucune et propose six mois comme commodité de saisie. | psychomotricienne | non |

Douze questions de plus, sur la trame et sur la pratique, sont dans les rapports
d'agents : elles s'ajoutent à `Q-201`–`Q-208` et aux dix questions d'attestation,
toutes ouvertes depuis le 2026-09-11.

## 7. Ce que personne n'a vérifié

- **Le poids relatif des postes de temps** s'appuie sur ce que le code rend
  possible, pas sur une observation. *Trois bilans réels chronométrés
  trancheraient en une séance ce qu'on ne peut qu'argumenter.*
- **La latence de frappe de l'éditeur** est une hypothèse mécaniquement
  plausible : rien n'a été profilé.
- **L'attestation distingue encore « introuvable » de « existe ailleurs ».**
  `issue_attestation` et `cancel_attestation` (`0016`) rendent `P0002 —
  Attestation introuvable.` si l'identifiant n'existe pas, et `42501 — Seul un
  praticien du cabinet peut signer…` s'il existe dans un autre cabinet. Le
  courrier et la synthèse ont la bonne forme (`... is null or not is_member`).
  **Non corrigé** : la reprendre demanderait de recopier une fonction de 150
  lignes dans une migration, pour une différence de message sur un identifiant
  qui ne sort jamais de son cabinet. À faire quand `0016` sera touchée pour
  autre chose. Mesuré par la relecture de sécurité du rang 3.
- **La catégorie du destinataire n'est pas modélisée.** Le document part chez
  un prescripteur, une famille ou un financeur sans que rien ne les distingue,
  et l'instantané ne fige que le rôle du contact AU DOSSIER — qui peut être
  « aucun ». L'article L1110-4 CSP présume autorisé l'échange au sein d'une
  équipe de soins et requiert le consentement hors de celle-ci : **la
  qualification d'un destinataire donné n'est pas faite ici** et revient à un
  juriste. [D-n]
- **La disposition exacte invoquée pour les comptes rendus en parcours financé
  n'est pas vérifiée.** L'arrêté du 19 décembre 2025 existe et est identifiable
  (JORFTEXT000053143303), mais ni la transmission de comptes rendus à la
  structure, à la famille et aux professionnels accompagnants, ni sa
  périodicité n'ont été lues à la source. Le marquage `[SOURCE — à vérifier]`
  en tête de `0023` reste. **La lecture se fait sur le cahier des charges et
  sur SON contrat, pas ici.**
- **Le statut d'un objectif imprimé est celui du jour de la remise**, pas celui
  de la fin de période : on ne sait pas reconstituer un statut passé. Le
  document le dit dans son titre de rubrique plutôt que de le laisser croire.
  *Historiser les statuts d'objectif lèverait la limite — ce n'est pas fait.*
- **`practices.timezone` existe et n'est lu nulle part** — `Europe/Paris` est
  écrit en dur partout. Une date de validation calculée en UTC décale d'un jour
  tout ce qui se valide après 22 h en été.
