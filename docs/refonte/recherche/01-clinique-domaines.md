# Référentiel clinique — domaines, documents et cadre d'exercice

**Objet.** Alimenter un moteur de bilans **configurable par domaines activables**, et non une liste figée de « types de bilan » calqués sur des pathologies.
**Produit par** `expert-metier-psychomotricien`. **Date de rédaction : 2026-09-11.**
**Portée.** France, exercice libéral. Document de travail interne. Il ne constitue ni un avis juridique, ni une recommandation de conduite clinique pour une personne réelle.

## Conventions de marquage — à respecter dans toute reprise de ce document

| Marque | Signification | Ce qu'on peut en faire |
|---|---|---|
| 🟢 **FAIT** | Source officielle citée, URL et date de consultation indiquées. | Peut fonder une règle produit. Revérifier la version du texte avant implémentation. |
| 🔵 **USAGE** | Pratique professionnelle courante, documentée par des sources professionnelles non normatives. **Aucune valeur réglementaire.** | Doit être proposé comme option configurable, jamais imposé. À faire valider par une psychomotricienne en exercice. |
| 🟠 **HYPOTHÈSE** | Déduction de l'auteur de ce document, non sourcée. | Ne pas implémenter sans arbitrage explicite. |
| 🔴 **À INSTRUIRE** | Question ouverte, avec la source à consulter et le responsable de validation nommés. | Interdit d'en déduire une obligation. |

**Règle absolue de ce document :** aucune obligation réglementaire, déontologique, conventionnelle ou fiscale n'est affirmée sans citation. Quand la source manque, c'est écrit 🔴.

**Contenu protégé.** Ce document ne reproduit **aucun** item, consigne de passation, grille de cotation, table d'étalonnage ou seuil normatif d'un test édité. Les instruments ne sont évoqués que par la nature des données qu'ils produisent. Voir aussi le point de droit ouvert dans `docs/clinical/CLINICAL_SAFETY.md` (« Point de droit à instruire »), qui concerne le code actuel.

**Données.** Aucun exemple nominatif. Tous les extraits de formulation sont des gabarits génériques, sans référence à une personne.

---

## 1. Cadre professionnel français

### 1.1 Textes en vigueur

🟢 **FAIT — Article L4332-1 du code de la santé publique**, version en vigueur depuis le 22 juin 2000.
Texte : « Est considérée comme exerçant la profession de psychomotricien toute personne qui, non médecin, exécute habituellement des actes professionnels de rééducation psychomotrice, définis par décret en Conseil d'Etat pris après avis de l'Académie nationale de médecine. Les psychomotriciens exercent leur art sur prescription médicale. »
Source : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006689416 — consulté le 2026-09-11.

🟢 **FAIT — Article R4332-1 du code de la santé publique**, version en vigueur depuis le 8 août 2004.
Chapeau : « Les personnes remplissant les conditions définies aux articles L. 4332-2, L. 4332-4 et L. 4332-5 sont habilitées à accomplir, **sur prescription médicale et après examen neuropsychologique du patient par le médecin**, les actes professionnels suivants ».
Liste des actes :

| Alinéa | Acte |
|---|---|
| 1° | Bilan psychomoteur |
| 2° | Éducation précoce et stimulation psychomotrices |
| 3° | Rééducation des troubles du développement psychomoteur ou des désordres psychomoteurs au moyen de techniques spécifiques, portant sur : a) retards du développement psychomoteur ; b) troubles de la maturation et de la régulation tonique ; c) troubles du schéma corporel ; d) troubles de la latéralité ; e) troubles de l'organisation spatio-temporelle ; f) dysharmonies psychomotrices ; g) troubles tonico-émotionnels ; h) maladresses motrices et gestuelles, dyspraxies ; i) débilité motrice ; j) inhibition psychomotrice ; k) instabilité psychomotrice ; l) troubles de la graphomotricité, à l'exclusion de la rééducation du langage écrit |
| 4° | Contribution, par des techniques d'approche corporelle, au traitement des déficiences intellectuelles, des troubles caractériels ou de la personnalité, des troubles des régulations émotionnelles et relationnelles et des troubles de la représentation du corps d'origine psychique ou physique |

Source : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006914164 — consulté le 2026-09-11.

🟢 **FAIT — le « décret de compétences du 6 mai 1988 » est abrogé.** Le décret n° 88-659 du 6 mai 1988 a été en vigueur du 8 mai 1988 au 8 août 2004, puis abrogé par le décret n° 2004-802 du 29 juillet 2004 ; son contenu a été codifié à l'article R4332-1.
Source : https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000693097/ — consulté le 2026-09-11.

> **Conséquence produit.** De nombreux sites professionnels continuent de citer « le décret de 1988 ». Le produit ne doit **jamais** citer ce décret comme texte en vigueur. Toute aide contextuelle ou mention légale doit référencer **R4332-1 CSP**.

🟢 **FAIT — Article L4332-2 CSP** : l'exercice est réservé aux titulaires du diplôme d'État français de psychomotricien (L4332-3) ou d'une autorisation (L4332-4, L4332-5), sous condition d'enregistrement. **Le titre de psychomotricien est protégé.**
Source : https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072665/LEGISCTA000006171316/ — consulté le 2026-09-11.

### 1.2 Ce que le psychomotricien peut conclure — et ce qu'il ne peut pas

🟢 **FAIT, par lecture directe de R4332-1.** Le **bilan psychomoteur** est un acte professionnel du psychomotricien, nommément listé (1°). Il est donc pleinement de sa responsabilité : il en est l'auteur, l'interprète et le signataire.

🟢 **FAIT, par absence dans R4332-1.** Le texte ne mentionne **aucun** acte de diagnostic médical, de prescription, de cotation de sévérité nosographique ni d'orientation médicale. La liste est une liste d'actes de bilan, d'éducation, de rééducation et de contribution au traitement.

🔵 **USAGE — la notion de « diagnostic psychomoteur ».** Les organisations professionnelles (Fédération Française des Psychomotriciens, Conseil National Professionnel des Psychomotriciens) décrivent le psychomotricien comme élaborant un **diagnostic psychomoteur** à partir du bilan, contribuant au diagnostic médical.
Sources : https://fedepsychomot.com/qui-est-le-psychomotricien/ et https://cnp-psychomotriciens.fr/la-profession-2/ — consultés le 2026-09-11.

> **Ce que ce constat autorise et n'autorise pas.**
> - L'expression « diagnostic psychomoteur » **n'apparaît dans aucun texte du code de la santé publique** que j'ai consulté. C'est un vocabulaire professionnel, pas une catégorie juridique.
> - Elle désigne, dans l'usage, la **formulation raisonnée du fonctionnement psychomoteur** de la personne : ce qui est en difficulté, ce qui est préservé, comment les éléments s'articulent, et ce que cela entraîne dans la vie quotidienne.
> - Elle **ne désigne pas** l'attribution d'une étiquette nosographique (TSA, TDAH, TDC/dyspraxie, déficience intellectuelle…). Ces catégories relèvent d'une démarche diagnostique médicale, pluridisciplinaire.

🔴 **À INSTRUIRE — frontière juridique exacte entre « diagnostic psychomoteur » et exercice illégal de la médecine.**
Point : jusqu'où un écrit de psychomotricien peut-il conclure sans empiéter sur l'article L4161-1 CSP (exercice illégal de la médecine) ?
Sources à consulter : article L4161-1 CSP sur Légifrance ; jurisprudence éventuelle ; assureur en responsabilité civile professionnelle.
Responsable de validation : juriste santé. **Ne pas trancher dans le produit.**

### 1.3 Règles de conception qui découlent du cadre

| # | Règle | Fondement |
|---|---|---|
| R-1 | Un bilan est **toujours** rattachable à une prescription médicale (prescripteur, date, objet). Le champ peut rester vide, mais son absence doit être visible, pas silencieuse. | 🟢 R4332-1 conditionne les actes à la prescription médicale. |
| R-2 | Le document porte le nom, le titre exact « psychomotricien(ne) D.E. » et l'identifiant professionnel de l'auteur, relié au compte connecté. | 🟢 L4332-2 (titre protégé) + 🟢 exigence RPPS pour la facturation PCO (§ 6.4). |
| R-3 | Aucun champ, aucune aide de saisie, aucun gabarit ne doit **proposer** une conclusion nosographique. Le produit peut offrir un champ « hypothèses à soumettre au médecin », jamais un champ « diagnostic ». | 🟢 R4332-1 ne liste aucun acte diagnostique. Cohérent avec la règle 4 de `CLAUDE.md`. |
| R-4 | Le vocabulaire de R4332-1 (« débilité motrice », « dysharmonie », « instabilité ») **ne doit pas** être repris tel quel dans un document remis à une famille. C'est un vocabulaire de 1988 conservé par codification. | 🟠 HYPOTHÈSE de l'auteur, à valider. Le texte est en vigueur mais son usage rédactionnel est un choix éditorial, pas une obligation. |
| R-5 | La distinction patient / titulaire(s) de l'autorité parentale doit être portée par le modèle de données, pas par la mise en page. | 🟢 L1111-7 CSP, § 2.5. |

### 1.4 Absence d'ordre professionnel

🟢 **FAIT (par absence de texte).** Le chapitre II du titre III du livre III de la quatrième partie du CSP (articles L4332-1 à L4332-7) ne comporte **aucune disposition ordinale**, contrairement par exemple aux masseurs-kinésithérapeutes. Il n'existe pas de code de déontologie des psychomotriciens inscrit au CSP.
Source : https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072665/LEGISCTA000006171316/ — consulté le 2026-09-11.

🔵 **USAGE.** Des chartes éthiques et déontologiques existent, portées par des associations professionnelles (par exemple l'AFPL), sans force obligatoire générale.
Source : https://a-f-p-l.fr/qui-sommes-nous/charte-ethique-deontologique/ — consulté le 2026-09-11.

> **Conséquence produit majeure.** Le logiciel ne peut invoquer « la déontologie des psychomotriciens » pour justifier une contrainte d'interface, parce qu'aucun texte opposable de ce nom n'existe. Les garde-fous du produit doivent être présentés comme des **choix de conception** motivés par la sécurité clinique, révisables par le praticien — pas comme des obligations. C'est une raison de plus pour que **tout soit configurable**.

---

## 2. Natures de documents produits en libéral

🔵 L'ensemble de cette section relève de l'**usage professionnel**. Aucun texte ne fixe la typologie ni le contenu des écrits du psychomotricien libéral, à **une exception près** : le contrat type PCO impose des transmissions (§ 6.5).

> **Principe transversal — 🟢 fondé sur L1111-7 CSP.** Le droit d'accès du patient porte sur « l'ensemble des informations concernant sa santé détenues, à quelque titre que ce soit, par des professionnels… qui sont formalisées ou ont fait l'objet d'échanges écrits », **à l'exclusion** des « informations mentionnant qu'elles ont été recueillies auprès de tiers n'intervenant pas dans la prise en charge thérapeutique ou concernant un tel tiers ».
> Source : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000042685313 — consulté le 2026-09-11.
> **Conséquence de conception :** le produit doit permettre de **marquer une information comme provenant d'un tiers**, parce que c'est le seul moyen technique de préparer un jour une communication de dossier conforme. Aujourd'hui ce marquage n'existe pas.

| # | Document | Destinataires typiques 🔵 | Niveau de détail 🔵 | Mentions attendues 🔵 | Ne doit jamais y figurer |
|---|---|---|---|---|---|
| D-1 | **Bilan initial** (compte rendu de bilan psychomoteur) | Prescripteur ; famille / titulaires de l'autorité parentale ; patient adulte. Autres professionnels **avec accord**. | Élevé. Démarche complète : demande, anamnèse retenue, conditions de passation, observations, résultats, analyse, conclusion, propositions. | Identité patient + date de naissance ; **date(s) de passation** distincte(s) de la date de rédaction ; âge **à la passation** ; prescripteur et date de prescription ; outils employés avec leur version ; auteur, titre, identifiant ; statut du document. | Diagnostic médical posé par l'auteur. Jugement de valeur sur la personne ou sa famille. Confidences d'un tiers non intervenant. Résultat chiffré sans mention de l'étalonnage. Score d'une épreuve non passée. |
| D-2 | **Bilan ciblé / complémentaire** | Idem D-1, souvent le prescripteur seul. | Moyen. Un ou deux domaines seulement, avec la raison explicite du ciblage. | Les mêmes que D-1, **plus** : la question posée, et la mention explicite des domaines **non** explorés. | Toute conclusion générale sur le fonctionnement psychomoteur alors que le bilan était ciblé. |
| D-3 | **Réévaluation comparative** | Prescripteur, famille, financeur éventuel (MDPH, structure). | Moyen à élevé. Structure **strictement parallèle** au bilan de référence. | Rappel de la date et des conditions du bilan de référence ; ce qui a été repassé à l'identique et ce qui ne l'a pas été ; intervalle écoulé ; ce qui s'est passé entre les deux. | Une comparaison chiffrée entre deux passations d'outils différents ou de versions différentes, sans réserve écrite. |
| D-4 | **Bilan de fin de prise en soin** | Prescripteur, famille, patient, professionnel prenant le relais. | Moyen. | Motif de la fin (objectifs atteints, déménagement, arrêt à l'initiative de la famille, orientation…), état à la sortie, ce qui reste ouvert, modalités de reprise éventuelle. | Un jugement sur la décision d'arrêt de la famille. Une conclusion présentée comme définitive sur l'avenir. |
| D-5 | **Synthèse de suivi** | Interne, ou prescripteur sur demande. | Faible à moyen. | Période couverte ; nombre de séances réalisées ; objectifs en cours ; évolution observée ; ajustements. | Détail des contenus de séance relevant de l'intimité. |
| D-6 | **Projet thérapeutique** | Famille et patient (co-construction), prescripteur. | Moyen. | Objectifs formulés en termes fonctionnels et observables, moyens envisagés, rythme prévu, échéance de réévaluation, part prise par la personne et l'entourage. | Objectifs non négociés. Engagement de résultat. |
| D-7 | **Compte rendu périodique** (attendu notamment en PCO) | Structure désignée / plateforme ; famille ; médecin. | Moyen. | Période, actes réalisés, évolution, poursuite ou non, éléments utiles à la coordination. | Information non nécessaire à la coordination — le partage se limite au strict utile. |
| D-8 | **Note clinique interne** | **Personne. Usage propre du praticien.** | Libre, brut, daté. | Date, auteur, contexte. Distinction nette entre ce qui est observé et ce qui est pensé. | Rien n'est interdit par nature, **mais** : une note interne reste une donnée de santé, potentiellement communicable si elle est formalisée (🟢 L1111-7). Le produit ne doit **pas** promettre qu'elle est inaccessible. 🔴 Régime exact d'accès aux notes personnelles du praticien libéral : **à instruire** auprès d'un DPO / juriste santé. |
| D-9 | **Courrier de liaison** | Un professionnel nommément identifié. | Faible. Ciblé sur une question. | Destinataire nommé, objet, base du partage (accord de la personne ou des titulaires de l'autorité parentale), date. | L'intégralité du bilan en pièce jointe par défaut. Le partage est justifié au cas par cas. |

### 2.1 Ce que cette typologie implique pour le moteur

🟠 **HYPOTHÈSE de conception, à arbitrer.** Ces neuf documents ne sont pas neuf « types » à figer. Ils se décrivent par **quatre attributs indépendants** :

1. **Nature** (initial / ciblé / réévaluation / fin / synthèse / projet / périodique / note / courrier) ;
2. **Domaines activés** (§ 4) — de 1 à 20 ;
3. **Destinataire principal** (interne / prescripteur / famille / structure / confrère), qui pilote le niveau de détail et les blocs affichés ;
4. **Rattachement** (bilan de référence, période couverte, parcours PCO éventuel).

C'est cette combinatoire qui remplace les deux « types de bilan » figés du produit actuel (`content.__type__`, voir `docs/context/DECISIONS.md` DEC-006). Un bilan sensoriel n'est pas un type : c'est un bilan dont le domaine « traitement sensoriel » est le seul activé.

---

## 3. Populations et tranches d'âge

🔵 Toute cette section relève de l'usage professionnel. Les bornes d'âge sont indicatives et **ne doivent pas** être codées en dur comme des règles de gestion. Elles servent à **proposer** des configurations par défaut, modifiables.

### 3.1 Nourrisson et petite enfance (0 – 3 ans environ)

- **Motifs d'adressage fréquents 🔵** : inquiétude sur le développement moteur (tenue de tête, retournements, station assise, marche) ; particularités du tonus ; difficultés d'installation, d'alimentation ou de sommeil impliquant le corps ; prématurité et suivi néonatal ; asymétries posturales ; réaction inhabituelle au toucher, aux bruits, aux textures ; peu d'engagement dans l'échange corporel.
- **Domaines habituellement explorés 🔵** : développement ; tonus/posture/régulation tonico-émotionnelle ; motricité globale ; traitement sensoriel ; relation/émotions/communication corporelle ; autonomie/participation/environnement.
- **Spécificités de l'anamnèse 🔵** : grossesse, naissance, période néonatale, alimentation, sommeil, portage, modes d'accueil, antécédents familiaux pertinents. **Rubriques particulièrement sensibles** — voir § 5.3.
- **Adaptations de passation 🔵** : observation en situation plus que passation d'épreuves ; présence indispensable du parent ; séances courtes, adaptées au rythme d'éveil ; le jeu et le portage sont le support ; les données sont majoritairement **qualitatives**.
- **Conséquence produit** : pour cette population, un bilan **sans aucun score** est la norme, pas l'exception. Le moteur ne doit pas laisser croire qu'un bloc « résultats chiffrés » vide est un bilan incomplet.

### 3.2 Enfant (3 – 11 ans environ)

- **Motifs d'adressage fréquents 🔵** : maladresse, chutes, difficultés de coordination ; écriture (lenteur, douleur, illisibilité, tenue de l'outil) ; repérage dans l'espace et dans le temps ; agitation ou au contraire retrait corporel ; difficultés dans les gestes du quotidien (habillage, lacets, couverts) ; orientation depuis une PCO au titre d'un TND ; difficultés scolaires avec composante gestuelle ou attentionnelle ; sensibilité sensorielle marquée.
- **Domaines habituellement explorés 🔵** : le spectre le plus large. Motricité globale, équilibre, coordinations, motricité fine, praxies, graphomotricité, schéma et vécu corporel, latéralité, espace/temps/rythme, visuoperceptif/visuoconstructif, attention et régulation de l'activité, traitement sensoriel, comportement pendant l'évaluation.
- **Spécificités de l'anamnèse 🔵** : développement, scolarité, activités extrascolaires, prises en charge en cours ou passées, vécu de l'enfant lui-même, retentissement au quotidien à la maison et à l'école.
- **Adaptations de passation 🔵** : plusieurs séances ; alternance d'épreuves exigeantes et de temps plus libres ; explicitation des consignes ; vérification de la compréhension ; l'enfant est un interlocuteur direct — recueillir sa propre formulation de la demande.
- **Conséquence produit** : c'est la population la plus outillée en instruments étalonnés. C'est aussi celle où le risque d'un **compte rendu réduit à un tableau de scores** est le plus élevé.

### 3.3 Adolescent (12 – 18 ans environ)

- **Motifs d'adressage fréquents 🔵** : poursuite ou reprise d'un suivi ancien ; gestion du corps en transformation ; difficultés d'organisation et de planification retentissant sur la scolarité ; douleurs et tensions ; rapport au corps, image du corps ; anxiété avec expression corporelle ; TND diagnostiqué tardivement ; adaptation aux aménagements scolaires et aux outils numériques.
- **Domaines habituellement explorés 🔵** : schéma et vécu corporel ; tonus et régulation tonico-émotionnelle ; coordinations et motricité fine ; graphomotricité et alternatives (clavier) ; attention/planification/régulation de l'activité ; autonomie/participation/environnement ; ressources et stratégies compensatoires.
- **Spécificités de l'anamnèse 🔵** : **l'adolescent doit être entendu seul à un moment du bilan.** Parcours scolaire, orientation, rapport aux pairs, sommeil, activités, usage des écrans, ce qu'il attend lui-même du bilan.
- **Adaptations de passation 🔵** : négocier explicitement le cadre et la restitution ; expliquer ce qui sera écrit et à qui ; certaines épreuves conçues pour l'enfant sont vécues comme infantilisantes — il faut pouvoir en écarter et le dire dans le compte rendu.
- **Conséquence produit — importante.** L'adolescent a un droit d'accès à ses informations de santé, et 🟢 L1111-7 CSP prévoit qu'un mineur peut demander que cet accès passe par un médecin, et qu'il peut s'opposer à la communication de certaines informations aux titulaires de l'autorité parentale (via L1111-5). Le produit doit donc **prévoir la possibilité d'un contenu à diffusion restreinte** — et non supposer que tout compte rendu va aux parents. 🔴 Modalités exactes applicables au psychomotricien libéral : **à instruire** (sources : L1111-5, L1111-5-1, L1111-7, R1111-6 CSP ; responsable : DPO ou juriste santé).

### 3.4 Adulte

- **Motifs d'adressage fréquents 🔵** : douleurs chroniques et tensions ; troubles anxieux avec manifestations corporelles ; suites de pathologie neurologique ; TND repéré à l'âge adulte ; rapport au corps ; difficultés d'organisation et de régulation ; accompagnement en santé mentale ; situation professionnelle avec exigence gestuelle.
- **Domaines habituellement explorés 🔵** : tonus et régulation tonico-émotionnelle ; schéma et vécu corporel ; coordinations et motricité fine ; espace/temps ; attention et régulation de l'activité ; autonomie/participation/environnement ; ressources et stratégies compensatoires.
- **Spécificités de l'anamnèse 🔵** : parcours de vie, parcours de soin, situation professionnelle et familiale au strict nécessaire, demande formulée par la personne elle-même.
- **Adaptations de passation 🔵** : beaucoup d'instruments étalonnés s'arrêtent avant l'âge adulte. **L'absence d'étalonnage adulte est la règle plutôt que l'exception.** Le bilan s'appuie davantage sur l'observation en situation, l'entretien et les échelles auto-rapportées.
- **Conséquence produit — écart déjà constaté.** Le produit actuel imprime « Enfant concerné » dans l'en-tête de tout bilan (voir `docs/context/GLOSSARY.md`). C'est incompatible avec cette population.

### 3.5 Personne âgée

- **Motifs d'adressage fréquents 🔵** : chutes et peur de tomber ; modification de l'équilibre et de la marche ; maladie neuro-évolutive ; repli, réduction des déplacements ; troubles du schéma corporel ; maintien à domicile ; troubles de l'orientation.
- **Domaines habituellement explorés 🔵** : équilibre ; motricité globale ; tonus ; schéma et vécu corporel ; espace/temps ; autonomie/participation/environnement ; ressources et stratégies compensatoires ; relation/émotions.
- **Spécificités de l'anamnèse 🔵** : lieu de vie et environnement matériel, aides en place, histoire des chutes, traitements en cours, fatigabilité, sensorialité (vue, audition), ce que la personne renonce à faire.
- **Adaptations de passation 🔵** : séances courtes ; attention à la fatigue et à la sécurité physique pendant les épreuves d'équilibre ; le refus de participer est une donnée, pas un échec ; consentement de la personne à recueillir explicitement, y compris sous mesure de protection juridique.
- **Conséquence produit** : la notion de **responsable légal** ne se réduit pas au parent d'un mineur. Tutelle, curatelle, habilitation familiale concernent l'adulte. Le modèle de données actuel (`patients.guardian`, liens « Parent, Mère, Père, Tuteur légal, Autre ») confond les deux régimes. 🔴 Régimes de protection juridique et leurs effets sur la communication d'un compte rendu : **à instruire** auprès d'un juriste.

---

## 4. Catalogue des domaines activables

> ### ⚠️ Règle fondatrice — à afficher dans le produit
>
> 🟠 **AUCUN domaine de cette liste n'est obligatoire pour tous les bilans.** Aucun texte n'impose de contenu minimal au bilan psychomoteur (🟢 R4332-1 nomme l'acte « bilan psychomoteur » sans en définir le contenu, vérifié le 2026-09-11).
> Le choix des domaines découle de la **demande**, de l'**âge**, du **contexte** et du **temps disponible**. Un bilan de 3 domaines n'est pas un bilan incomplet : c'est un bilan ciblé.
> Le moteur doit donc : (a) proposer des **présélections** par âge et par motif ; (b) permettre d'en retirer et d'en ajouter librement ; (c) permettre au praticien de **créer ses propres domaines** ; (d) ne jamais signaler un domaine désactivé comme une donnée manquante.

**Ancrage réglementaire.** Certains domaines correspondent à des rubriques nommées par 🟢 R4332-1 3° ; d'autres relèvent uniquement de la pratique contemporaine. La colonne « ancrage » le dit, car cela change ce que le produit peut affirmer.

| Domaine | Ancrage R4332-1 |
|---|---|
| Demande et retentissement fonctionnel | ❌ aucun — 🔵 usage |
| Anamnèse pertinente | ❌ aucun — 🔵 usage |
| Développement | ✅ 3° a) « retards du développement psychomoteur » |
| Tonus / posture / régulation tonico-émotionnelle | ✅ 3° b) et g) |
| Motricité globale | ⚠️ indirect — 3° h) « maladresses motrices et gestuelles » |
| Équilibre | ❌ aucun — 🔵 usage (mais « équilibration » figure au 3° comme technique) |
| Coordinations | ⚠️ indirect — 3° h) |
| Motricité fine | ⚠️ indirect — 3° h) |
| Praxies | ✅ 3° h) « dyspraxies » |
| Schéma et vécu corporel | ✅ 3° c) et 4° « troubles de la représentation du corps » |
| Latéralité | ✅ 3° d) |
| Espace / temps / rythme | ✅ 3° e) |
| Graphomotricité | ✅ 3° l) |
| Fonctions visuoperceptives et visuoconstructives | ❌ aucun — 🔵 usage |
| Traitement sensoriel | ❌ aucun — 🔵 usage |
| Attention / planification / régulation de l'activité | ⚠️ partiel — 3° j) « inhibition psychomotrice », k) « instabilité psychomotrice » |
| Comportement pendant l'évaluation | ❌ aucun — 🔵 usage méthodologique |
| Relation / émotions / communication corporelle | ✅ 4° |
| Autonomie / participation / environnement | ❌ aucun — 🔵 usage |
| Ressources et stratégies compensatoires | ❌ aucun — 🔵 usage |

**Structure retenue pour chaque domaine.** Quatre registres distincts, qui doivent être **quatre champs séparés** dans le modèle de données — c'est la réponse proposée à `Q-203` :

1. **Observation** — ce qui a été vu, sans qualification.
2. **Résultat saisi** — ce qui est chiffré, avec l'outil, sa version, l'étalonnage et la date.
3. **Interprétation** — ce que le praticien en déduit, marqué comme tel.
4. **Retentissement / objectif** — ce que cela change au quotidien, et ce qui en découle.

---

### D01 — Demande et retentissement fonctionnel

- **Définition de travail 🔵.** Ce qui motive la venue, exprimé par chacun (personne concernée, entourage, prescripteur), et ce que la situation change concrètement dans la vie quotidienne.
- **Ce qui s'y observe 🔵.** Formulation spontanée de la demande ; écart éventuel entre la demande du prescripteur, celle de la famille et celle de la personne ; situations concrètes citées ; ce qui a déjà été essayé ; attentes vis-à-vis du bilan.
- **Populations 🔵.** Toutes. **C'est le seul domaine que je recommanderais d'activer par défaut partout** — 🟠 hypothèse à valider.
- **Formulations neutres 🔵.**
  - « La demande est adressée par {prescripteur}, au motif de : {citation}. »
  - « Les parents décrivent {situation observable}, survenant {fréquence / contexte}. »
  - « La personne indique attendre du bilan : {formulation reprise}. »
  - « Aucune demande n'a été formulée par la personne concernée elle-même. » ← information, pas jugement.
- **Pièges de rédaction.** Reformuler la plainte en diagnostic dès la première ligne. Faire disparaître le désaccord entre les demandes — c'est souvent l'information la plus utile. Écrire « les parents sont inquiets » là où il faudrait écrire ce qui les inquiète. Reprendre le vocabulaire médical du prescripteur comme s'il était établi.

---

### D02 — Anamnèse pertinente

- **Définition de travail 🔵.** Éléments d'histoire retenus **parce qu'ils éclairent la demande**. Voir § 5 pour l'adaptation et la minimisation.
- **Ce qui s'y observe 🔵.** Ce n'est pas un domaine d'observation mais de recueil. La source de chaque information doit être traçable (parent, dossier, personne elle-même, courrier).
- **Populations 🔵.** Toutes, avec des rubriques radicalement différentes selon l'âge.
- **Formulations neutres 🔵.**
  - « Selon les éléments rapportés par {source}, {fait}. »
  - « Un courrier de {profession} daté du {date} mentionne {élément}. »
  - « Cet élément n'a pas été abordé. » ← à préférer à un blanc.
- **Pièges de rédaction.** Recopier tout l'entretien. Mélanger sans distinction ce qui est rapporté et ce qui est constaté. Faire figurer des éléments relatifs à un tiers (santé d'un parent, situation familiale, conflit) sans nécessité — voir la restriction de 🟢 L1111-7 sur les informations concernant un tiers. Écrire une chronologie causale (« depuis {événement}, il… ») qui installe une explication non démontrée.

---

### D03 — Développement

- **Définition de travail 🔵.** Déroulement de l'acquisition des grandes étapes psychomotrices et leur situation par rapport aux repères d'âge usuels.
- **Ce qui s'y observe 🔵.** Repères rapportés (tenue de tête, retournements, position assise, déplacement, marche, propreté, premiers mots) ; qualité et non seulement date d'acquisition ; régressions éventuelles ; variabilité.
- **Populations 🔵.** Nourrisson et enfant principalement ; utile en rétrospectif chez l'adolescent et l'adulte, mais alors **déclaratif et ancien**, donc à marquer comme tel.
- **Formulations neutres 🔵.**
  - « La marche autonome est située par les parents autour de {âge}. »
  - « Les repères développementaux n'ont pas pu être précisés. »
  - « {Repère} est rapporté comme acquis, sans précision de date. »
- **Pièges de rédaction.** Traiter un souvenir parental comme une mesure. Comparer un repère rapporté à une norme sans dire que la source est déclarative. Écrire « retard de développement » : c'est une conclusion, et le terme figure certes au 🟢 R4332-1 3° a) mais comme indication de rééducation, pas comme qualification à poser dans un compte rendu remis. Chez l'adulte, présenter une anamnèse développementale ancienne comme une donnée fiable.

---

### D04 — Tonus, posture, régulation tonico-émotionnelle

- **Définition de travail 🔵.** État de tension musculaire de fond, capacité à l'ajuster à la tâche et à la situation, et manière dont l'état émotionnel se lit dans le corps.
- **Ce qui s'y observe 🔵.** Tonus de fond et d'action ; extensibilité, ballant ; qualité du relâchement ; posture assise et debout au fil de la séance ; syncinésies ; ajustement tonique dans la relation et le portage ; variations tonicoémotionnelles au fil des épreuves ; réactions de prestance.
- **Populations 🔵.** Toutes. Central chez le nourrisson, l'adulte anxieux et la personne âgée.
- **Formulations neutres 🔵.**
  - « En position assise à table, le buste s'affaisse progressivement au cours d'une épreuve de {durée}, avec redressement sur sollicitation verbale. »
  - « Des mouvements associés de la main controlatérale sont observés lors de {tâche}. »
  - « Le relâchement n'est pas obtenu dans le temps proposé. »
  - « Une variation de tension est observée au moment de {situation précise}. »
- **Pièges de rédaction.** Passer directement du tonus à l'émotion supposée (« l'hypertonie témoigne de son anxiété ») : le lien est une interprétation, à mettre dans le registre 3. Employer « hypotonique » / « hypertonique » comme une étiquette de personne plutôt que comme la description d'un état observé à un moment. Décrire un tonus sans dire dans quelle condition il a été apprécié.

---

### D05 — Motricité globale

- **Définition de travail 🔵.** Organisation et qualité des mouvements engageant l'ensemble du corps et les déplacements.
- **Ce qui s'y observe 🔵.** Marche, course, saut, montée et descente d'escalier ; passages au sol ; réception ; aisance et fluidité ; vitesse ; endurance ; adaptation à un obstacle ou à une consigne changeante ; sécurité du déplacement.
- **Populations 🔵.** Toutes, avec des contenus très différents.
- **Formulations neutres 🔵.**
  - « Le saut à pieds joints est réalisé avec réception sur un pied lors de {n} essais sur {N}. »
  - « La montée d'escalier se fait en alternant les pieds, avec appui sur la rampe. »
  - « La course est engagée ; le demi-tour s'accompagne d'un ralentissement marqué. »
- **Pièges de rédaction.** « Maladroit » — jugement global et stigmatisant ; décrire l'action. Conclure à partir d'un seul essai. Confondre refus, fatigue et incapacité. Décrire la motricité sans mentionner l'environnement (espace disponible, sol, chaussures) alors qu'il la conditionne.

---

### D06 — Équilibre

- **Définition de travail 🔵.** Maintien et récupération de la posture, en statique et en dynamique, avec et sans le contrôle visuel.
- **Ce qui s'y observe 🔵.** Appui unipodal ; marche sur ligne ; équilibre avec yeux fermés ; réactions parachutes et de rattrapage ; stratégies d'appui et de compensation ; stabilité en situation de double tâche ; appréhension.
- **Populations 🔵.** Toutes. Domaine à haute valeur chez l'enfant et chez la personne âgée, pour des raisons opposées.
- **Formulations neutres 🔵.**
  - « L'appui unipodal droit est tenu {durée} sur {n} essais ; à gauche, {durée}. »
  - « Les yeux fermés, la durée de tenue diminue de {X} secondes. »
  - « Des ajustements des bras sont observés pendant le maintien. »
  - « La personne demande à s'appuyer avant d'engager la tâche. »
- **Pièges de rédaction.** Écrire « troubles de l'équilibre » sans les conditions d'examen. Omettre les conditions de sécurité : chez la personne âgée, la manière dont l'épreuve a été sécurisée fait partie du résultat. Comparer une mesure à un étalonnage établi dans des conditions différentes.

---

### D07 — Coordinations

- **Définition de travail 🔵.** Organisation de plusieurs segments corporels ou de plusieurs informations dans une même action : coordinations bimanuelles, oculo-manuelles, oculo-pédestres, dissociations.
- **Ce qui s'y observe 🔵.** Lancer, rattraper, viser ; frapper une balle ; enchaîner deux gestes différents de chaque main ; dissocier un segment ; rythme et régularité d'un enchaînement ; réaction à une consigne qui change.
- **Populations 🔵.** Toutes ; particulièrement documenté chez l'enfant.
- **Formulations neutres 🔵.**
  - « Le rattrapage à deux mains est réussi {n} fois sur {N} à {distance}. »
  - « La dissociation des deux mains n'est pas maintenue au-delà de {n} répétitions ; les deux mains reprennent le même mouvement. »
  - « La vitesse d'exécution augmente et la régularité diminue au fil de l'épreuve. »
- **Pièges de rédaction.** Fusionner coordination, praxie et motricité fine en un seul commentaire : ce sont trois registres distincts et un même échec peut relever de l'un ou de l'autre. Conclure à un « trouble de la coordination » — étiquette proche d'une catégorie diagnostique médicale (TDC), voir § 8.

---

### D08 — Motricité fine

- **Définition de travail 🔵.** Précision, dextérité et ajustement des mouvements de la main et des doigts.
- **Ce qui s'y observe 🔵.** Préhension et prises digitales ; manipulation d'objets petits ; vitesse et précision ; opposition pouce-doigts ; force de préhension et son dosage ; découpage, boutonnage, laçage ; fatigabilité de la main.
- **Populations 🔵.** Toutes.
- **Formulations neutres 🔵.**
  - « La prise utilisée pour {objet} est {description factuelle de la prise}. »
  - « Le boutonnage est réalisé en {durée}, avec {n} reprises. »
  - « Une modification de la prise apparaît après environ {durée} d'activité. »
- **Pièges de rédaction.** Décrire une prise comme « mauvaise » : une prise est fonctionnelle ou non pour une tâche donnée, et le critère doit être écrit. Généraliser à partir d'une seule tâche. Confondre lenteur et imprécision.

---

### D09 — Praxies

- **Définition de travail 🔵.** Capacité à concevoir, programmer et réaliser un geste intentionnel, appris ou nouveau.
- **Ce qui s'y observe 🔵.** Gestes sur imitation, sur consigne verbale, avec objet et sans objet ; gestes symboliques ; construction ; habillage ; séquences gestuelles ; apprentissage d'un geste nouveau au cours de la séance ; capacité à corriger.
- **Populations 🔵.** Enfant surtout, mais pertinent à tout âge.
- **Formulations neutres 🔵.**
  - « Le geste est produit sur imitation, non sur consigne verbale seule. »
  - « La reproduction du modèle comporte {description de l'écart}, sans autocorrection spontanée. »
  - « Après démonstration supplémentaire, la réalisation évolue vers {description}. »
- **Pièges de rédaction.** **Écrire « dyspraxie ».** Le terme figure au 🟢 R4332-1 3° h) comme indication de rééducation, mais dans l'usage contemporain il renvoie à une catégorie diagnostique (TDC/TAC) qui relève d'une démarche médicale pluridisciplinaire. Le confondre est le piège numéro un de ce domaine. Ne pas distinguer les modalités de présentation (imitation / verbal / objet) alors que c'est précisément ce qui porte l'information.

---

### D10 — Schéma corporel et vécu corporel

- **Définition de travail 🔵.** Connaissance et représentation du corps (localisation, nomination, orientation sur soi et sur autrui) d'une part ; manière dont la personne investit, éprouve et parle de son corps d'autre part. **Deux registres, à ne pas fondre.**
- **Ce qui s'y observe 🔵.** Nomination et localisation de parties du corps ; imitation de postures ; représentation graphique du corps ; orientation droite/gauche sur soi et sur autrui ; verbalisations spontanées sur le corps ; investissement de certaines zones ; aisance ou évitement lors des propositions corporelles.
- **Populations 🔵.** Toutes. Registre du vécu corporel particulièrement sensible à l'adolescence et chez l'adulte.
- **Formulations neutres 🔵.**
  - « Les parties du corps proposées sont nommées ; la latéralisation sur autrui n'est pas établie. »
  - « La personne dit de son corps : {citation entre guillemets}. » ← citer plutôt que résumer.
  - « Les propositions impliquant {type de contact} ont été écartées à sa demande. »
- **Pièges de rédaction.** Interpréter un dessin du bonhomme comme une donnée sur la personnalité ou l'affectivité : c'est une inférence lourde, contestée, et elle n'a pas sa place dans un compte rendu remis sans réserve explicite. Écrire sur le vécu corporel d'un adolescent ce qu'il n'a pas accepté de voir écrit. Fondre le versant cognitif et le versant affectif en un paragraphe indistinct.

---

### D11 — Latéralité

- **Définition de travail 🔵.** Préférence et efficience latérales pour la main, l'œil, le pied ; homogénéité entre elles ; stabilité de l'usage.
- **Ce qui s'y observe 🔵.** Main utilisée spontanément selon les tâches ; changements de main en cours d'activité ; œil directeur ; pied d'appui et de frappe ; latéralité usuelle rapportée par l'entourage ; contrariété éventuelle.
- **Populations 🔵.** Enfant surtout ; utile chez l'adolescent et l'adulte en cas de plainte graphique.
- **Formulations neutres 🔵.**
  - « La main droite est utilisée pour {n} tâches sur {N} ; la main gauche pour {n}. »
  - « Un changement de main est observé au cours de {tâche}. »
  - « La latéralité manuelle n'apparaît pas fixée sur l'ensemble des tâches proposées. »
- **Pièges de rédaction.** Traiter une latéralité croisée comme une anomalie, ou lui attribuer un retentissement — 🔴 l'état des connaissances sur ce point est à instruire auprès d'une source scientifique. Conclure à partir de l'écriture seule. Employer « mal latéralisé », formulation dépréciative sur la personne.

---

### D12 — Espace, temps, rythme

- **Définition de travail 🔵.** Organisation des repères spatiaux (sur soi, entre objets, sur une feuille, dans un lieu) et temporels (succession, durée, séquence, rythme).
- **Ce qui s'y observe 🔵.** Orientation dans la pièce ; relations spatiales entre objets ; occupation de la feuille ; reproduction de structures rythmiques ; repérage dans la journée, la semaine, l'année ; estimation de durées ; séquençage d'une action ; adaptation à un tempo imposé.
- **Populations 🔵.** Toutes. Le temps est central chez la personne âgée ; le rythme chez l'enfant.
- **Formulations neutres 🔵.**
  - « Les structures rythmiques à {n} éléments sont reproduites ; au-delà, la structure n'est plus conservée. »
  - « Sur la feuille, {description de l'occupation spatiale}. »
  - « Les repères temporels de la journée sont énoncés dans l'ordre ; ceux de la semaine ne le sont pas. »
- **Pièges de rédaction.** Écrire « troubles de l'organisation spatio-temporelle » comme conclusion — expression du 🟢 R4332-1 3° e), mais qui, seule, n'informe personne. Confondre difficulté de repérage et difficulté de compréhension de la consigne. Ne pas distinguer espace corporel, espace graphique et espace environnant.

---

### D13 — Graphomotricité

- **Définition de travail 🔵.** Geste d'écriture et de tracé : installation, tenue de l'outil, qualité, vitesse, lisibilité, coût et endurance.
- **Ce qui s'y observe 🔵.** Installation et posture ; tenue du crayon ; pression sur le papier ; qualité du tracé ; vitesse ; lisibilité ; tenue de ligne ; gestion de l'espace de la feuille ; fatigue et douleur ; évolution de la qualité sur la durée ; usage éventuel d'un clavier ou d'un outil adapté.
- **Populations 🔵.** Enfant à partir de l'entrée dans l'écrit ; adolescent ; adulte en cas de plainte.
- **Formulations neutres 🔵.**
  - « La tenue de l'outil est {description factuelle}, stable sur la durée de la tâche. »
  - « La vitesse relevée est de {n} caractères en {durée}. »
  - « La personne signale une douleur à {localisation} après {durée} d'écriture. »
  - « La lisibilité diminue à partir de la {n}e ligne. »
- **Pièges de rédaction.** **Écrire « dysgraphie »** : c'est une conclusion qui engage, souvent utilisée ensuite comme justificatif d'aménagement scolaire. 🔴 Qui peut poser cette conclusion, et sous quelle responsabilité : **à instruire**. Juger l'esthétique du tracé plutôt que sa fonctionnalité. Oublier le coût (douleur, fatigue), qui est souvent le vrai motif. **Ne pas confondre avec le langage écrit :** 🟢 R4332-1 3° l) exclut expressément la rééducation du langage écrit du champ du psychomotricien.

---

### D14 — Fonctions visuoperceptives et visuoconstructives

- **Définition de travail 🔵.** Traitement de l'information visuelle non motrice (discrimination, figure-fond, constance, position) et reproduction de configurations spatiales.
- **Ce qui s'y observe 🔵.** Discrimination de formes ; repérage d'une figure dans un fond chargé ; copie de figures ; reproduction avec cubes ou assemblages ; stratégie d'exploration visuelle ; ordre de construction ; autocorrection.
- **Populations 🔵.** Enfant, adolescent, adulte.
- **Formulations neutres 🔵.**
  - « La copie de la figure est engagée par {élément} ; l'organisation d'ensemble {description}. »
  - « La cible n'est pas repérée dans la planche chargée dans le temps proposé. »
  - « L'exploration visuelle se fait de {description du trajet observé}. »
- **Pièges de rédaction.** ⚠️ **Frontière de champ.** Ce domaine chevauche celui du neuropsychologue et de l'orthoptiste. Un compte rendu de psychomotricien peut décrire ce qu'il observe et le relier au geste ; il ne doit pas conclure sur un fonctionnement cognitif visuel isolé, ni sur une fonction visuelle sensorielle. **Toujours mentionner qu'un avis complémentaire relève d'un autre professionnel**, plutôt que de conclure. Ne pas présenter un score de copie comme une mesure d'intelligence ou de mémoire.

---

### D15 — Traitement sensoriel

- **Définition de travail 🔵.** Manière dont la personne reçoit, module et répond aux informations sensorielles (tactile, vestibulaire, proprioceptive, auditive, visuelle, olfactive, gustative), et retentissement sur la vie quotidienne.
- **Ce qui s'y observe 🔵.** Réactions observées en séance à différentes stimulations ; recherche ou évitement ; comportements rapportés par l'entourage dans les situations du quotidien (repas, habillage, toilette, bruit, foule) ; questionnaires renseignés par l'entourage ou la personne ; stratégies déjà mises en place.
- **Populations 🔵.** Toutes. Très sollicité en petite enfance et dans le contexte TND.
- **Formulations neutres 🔵.**
  - « Lors de {situation}, la personne {réaction observée}, puis {suite}. »
  - « Les parents rapportent {comportement} dans la situation de {contexte}, {fréquence}. »
  - « Le questionnaire a été renseigné par {rôle du répondant}, le {date}. » ← la source du questionnaire est une donnée du résultat.
- **Pièges de rédaction.** **Présenter un questionnaire renseigné par un tiers comme une mesure objective de la personne.** C'est un recueil de perception. La mention du répondant et de la date est indispensable. Employer « trouble du traitement sensoriel » comme un diagnostic : 🔴 le statut nosographique de cette entité est discuté — **à instruire** auprès d'une source scientifique. Généraliser une observation de séance à tous les contextes de vie.
- **Note produit.** Le produit actuel traite le bilan sensoriel comme un **type** de bilan. Dans un moteur par domaines, c'est **ce domaine-ci**, activé seul ou avec d'autres. Voir `DEC-006`.

---

### D16 — Attention, planification, régulation de l'activité (dimension psychomotrice uniquement)

- **Définition de travail 🔵.** Manière dont la personne engage, maintient, module et arrête son activité **telle que cela se donne à voir dans le corps et l'action** : niveau d'activité motrice, capacité à différer, à s'arrêter, à organiser une tâche en plusieurs étapes.
- **Ce qui s'y observe 🔵.** Temps d'engagement dans une tâche ; interruptions et reprises ; déplacements non liés à la tâche ; manipulations parasites ; vitesse d'exécution et rapport vitesse/précision ; organisation du plan d'action ; réaction à une consigne d'arrêt ; effet d'un cadre ou d'un étayage.
- **Populations 🔵.** Toutes.
- **Formulations neutres 🔵.**
  - « Au cours d'une épreuve de {durée}, la personne quitte sa place à {n} reprises et y revient sur consigne verbale. »
  - « La tâche est engagée sans exploration préalable du matériel ; la première erreur apparaît à {étape}. »
  - « L'apport d'une consigne étape par étape modifie {description du changement}. » ← l'effet de l'étayage est une donnée majeure.
- **Pièges de rédaction.** ⚠️ **Frontière de champ — la plus délicate du catalogue.** L'attention et les fonctions exécutives sont un champ d'évaluation neuropsychologique. Le psychomotricien décrit ce qui s'observe dans l'activité corporelle ; il ne produit pas un profil attentionnel ni exécutif. **Écrire « TDAH », « déficit attentionnel », « impulsivité » est hors champ.** Employer « instable » ou « agité » : ces mots qualifient la personne. Décrire un comportement sans son contexte (durée, difficulté de la tâche, moment de la journée, présence du parent), ce qui le rend ininterprétable.

---

### D17 — Comportement pendant l'évaluation

- **Définition de travail 🔵.** Conditions réelles dans lesquelles les données ont été recueillies, et manière dont la personne s'est engagée. **C'est le domaine qui conditionne la lecture de tous les autres.**
- **Ce qui s'y observe 🔵.** Nombre et durée des séances ; qui était présent ; lieu ; moment ; état de la personne (fatigue, maladie, événement du jour) ; engagement, coopération, refus ; besoin de pauses ; compréhension des consignes ; réaction à l'erreur et à la réussite ; effet de l'encouragement ; épreuves écartées, interrompues ou passées hors conditions standard.
- **Populations 🔵.** Toutes. 🟠 **Ce domaine devrait être activé par défaut dès qu'un instrument étalonné est employé** — à valider.
- **Formulations neutres 🔵.**
  - « Le bilan s'est déroulé sur {n} séances, les {dates}, en présence de {rôle}. »
  - « L'épreuve {nom} a été interrompue à la demande de la personne ; les résultats partiels ne sont pas comparés à l'étalonnage. »
  - « L'épreuve a été proposée avec {modification}, hors conditions standard ; le score n'est pas interprétable au regard de l'étalonnage. »
  - « La personne a indiqué être fatiguée en début de séance. »
- **Pièges de rédaction.** Omettre les écarts aux conditions standard puis publier les scores comme s'ils étaient valides — c'est le défaut le plus lourd de conséquence d'un compte rendu. Écrire « peu coopérant », « opposant », « ne veut rien faire » : qualifications de la personne ; décrire ce qui s'est passé. Ne pas dire qui était présent.

---

### D18 — Relation, émotions, communication corporelle

- **Définition de travail 🔵.** Manière dont la personne entre en relation par le corps : regard, distance, contact, imitation, tour de rôle, expression des émotions, ajustement à l'autre.
- **Ce qui s'y observe 🔵.** Distance physique choisie ; regard adressé ; réaction à la proposition de contact ; imitation réciproque ; jeu partagé ; expression corporelle des émotions ; manière de demander de l'aide ; ajustement tonique dans l'interaction ; séparation d'avec l'accompagnant.
- **Populations 🔵.** Toutes. Ancrage 🟢 R4332-1 4°.
- **Formulations neutres 🔵.**
  - « La séparation d'avec {rôle de l'accompagnant} s'est faite {description}, sans sollicitation supplémentaire. »
  - « Le regard est adressé lors de {situations} ; il est moins présent lors de {situations}. »
  - « La proposition de {contact} a été déclinée ; une alternative a été acceptée. »
- **Pièges de rédaction.** Inférer un état affectif à partir d'un comportement corporel sans le marquer comme interprétation. Employer un vocabulaire nosographique du champ de la psychiatrie ou du TSA (« retrait autistique », « stéréotypies », « troubles du contact ») : hors champ et lourd de conséquences. Écrire sur la relation parent-enfant un jugement qui vise le parent. Ne pas distinguer ce qui relève d'une séance unique et ce qui est stable.

---

### D19 — Autonomie, participation, environnement

- **Définition de travail 🔵.** Ce que la personne fait réellement dans sa vie quotidienne, avec quelle aide, dans quel environnement matériel et humain, et à quel coût.
- **Ce qui s'y observe 🔵.** Actes de la vie quotidienne selon l'âge (habillage, repas, toilette, déplacements, transports, tâches scolaires ou professionnelles) ; niveau d'aide nécessaire et par qui ; aménagements en place ; accessibilité du lieu de vie ; participation aux activités choisies ; activités abandonnées ; fatigue induite ; ressources de l'entourage.
- **Populations 🔵.** Toutes. Central chez la personne âgée et dans tout dossier de compensation.
- **Formulations neutres 🔵.**
  - « L'habillage est réalisé seul, à l'exception de {élément}, pour lequel une aide est apportée par {rôle}. »
  - « La personne indique avoir cessé {activité} depuis {période}. »
  - « Le logement comporte {élément matériel pertinent}. »
- **Pièges de rédaction.** Décrire l'autonomie comme un attribut de la personne plutôt que comme le résultat d'une rencontre entre elle et son environnement. Juger l'aide apportée par l'entourage. Employer « dépendant », « ne sait pas faire » ; préférer « réalise avec {aide} » / « ne réalise pas seul à ce jour ». Omettre le coût en fatigue, qui est souvent l'information décisive.

---

### D20 — Ressources et stratégies compensatoires

- **Définition de travail 🔵.** Ce qui fonctionne, ce sur quoi la personne s'appuie, ce qu'elle a mis en place elle-même, et les leviers disponibles dans l'entourage.
- **Ce qui s'y observe 🔵.** Domaines préservés ; stratégies spontanées (verbalisation, ralentissement, découpage, appui visuel, aide demandée) ; capacité d'autocorrection ; sensibilité à l'étayage et type d'étayage efficace ; motivation, centres d'intérêt ; aménagements déjà efficaces ; ressources de l'entourage et des professionnels en place.
- **Populations 🔵.** Toutes. 🟠 **Domaine à recommander fortement par défaut** — un compte rendu qui n'énumère que des difficultés est à la fois incomplet et délétère pour la personne qui le lit. À valider.
- **Formulations neutres 🔵.**
  - « La personne verbalise spontanément les étapes avant d'agir sur {type de tâche}. »
  - « L'apport d'un repère visuel modifie {description}. »
  - « {Domaine} n'appelle pas d'observation particulière au regard de la demande. » ← à préférer à « normal ».
- **Pièges de rédaction.** Réduire cette rubrique à une formule de politesse en fin de document. Nommer des ressources qui n'ont pas été observées, pour adoucir. Confondre absence de difficulté constatée et compétence démontrée.

---

## 5. Anamnèse adaptative

### 5.1 Principe directeur

🟠 **HYPOTHÈSE de conception, à arbitrer.** Une seule règle gouverne l'anamnèse dans le produit :

> **On ne recueille que ce qui sert à comprendre la demande, et on doit pouvoir dire pourquoi.**

🟢 **Ancrage.** Ce principe recoupe la minimisation des données déjà posée par `docs/security/DATA_CLASSIFICATION.md` et par `.claude/rules/security-health-data.md`. Il ne découle **pas** d'un texte propre à la psychomotricité — aucun texte ne fixe le contenu d'une anamnèse psychomotrice (vérifié : R4332-1 ne dit rien du contenu du bilan).

**Conséquence produit.** Une trame d'anamnèse ne doit **jamais** être une liste exhaustive présentée par défaut. Elle doit être une **sélection contextuelle**, chaque rubrique pouvant être retirée sans que cela apparaisse comme un manque.

### 5.2 Rubriques selon l'âge et le motif — proposition de matrice

🔵 Usage professionnel, à valider. `●` = souvent pertinent · `○` = selon le motif · `—` = rarement pertinent.

| Rubrique | Nourrisson | Enfant | Adolescent | Adulte | Pers. âgée |
|---|:--:|:--:|:--:|:--:|:--:|
| Demande, par qui, depuis quand | ● | ● | ● | ● | ● |
| Prescription : prescripteur, date, objet | ● | ● | ● | ● | ● |
| Grossesse, naissance, période néonatale | ● | ○ | ○ | — | — |
| Développement psychomoteur précoce | ● | ● | ○ | ○ | — |
| Alimentation, sommeil | ● | ○ | ○ | ○ | ○ |
| Santé générale, antécédents médicaux utiles | ● | ● | ● | ● | ● |
| Vision, audition (dépistage fait ou non) | ● | ● | ○ | ○ | ● |
| Traitements en cours pouvant agir sur la vigilance ou la motricité | ○ | ○ | ○ | ● | ● |
| Modes d'accueil / scolarité / formation / emploi | ○ | ● | ● | ● | — |
| Aménagements ou adaptations en place | — | ● | ● | ● | ● |
| Prises en charge en cours et passées | ● | ● | ● | ● | ● |
| Bilans réalisés par d'autres professionnels | ○ | ● | ● | ● | ● |
| Activités, loisirs, centres d'intérêt | ○ | ● | ● | ● | ● |
| Journée type, retentissement au quotidien | ● | ● | ● | ● | ● |
| Lieu de vie, environnement matériel, aides | ○ | ○ | ○ | ○ | ● |
| Histoire des chutes | — | ○ | — | ○ | ● |
| Point de vue de la personne elle-même | — | ● | ● | ● | ● |
| Composition du foyer | ○ | ○ | ○ | ○ | ○ |
| Reconnaissance de handicap, dossier MDPH | ○ | ○ | ○ | ○ | ○ |

### 5.3 Rubriques sensibles — à ne recueillir que si nécessaires, et à marquer comme telles

🟠 Classement proposé par l'auteur, **à valider** par une psychomotricienne et par un DPO.

| Rubrique | Pourquoi elle est sensible | Traitement proposé dans le produit |
|---|---|---|
| Situation familiale, séparation, garde, conflit parental | Concerne des tiers. 🟢 L1111-7 exclut du droit d'accès les informations concernant un tiers n'intervenant pas dans la prise en charge — mais elles restent stockées, donc exposées. | Champ **non affiché par défaut**. Si renseigné : marquage « information relative à un tiers », **exclu par défaut de tout document exporté**. |
| Antécédents de santé des parents ou de la fratrie | Donnée de santé d'une personne qui n'est pas la patiente. | Idem. Exiger une justification écrite courte. |
| Origine, langue parlée à la maison, culture | Potentiellement une donnée sensible au sens du RGPD. Pertinente uniquement si elle conditionne la passation ou la compréhension des consignes. | Reformuler l'intention : « langue(s) de passation et compréhension des consignes », qui est l'information réellement utile. |
| Situation professionnelle et revenus des parents | Rarement nécessaire à la compréhension psychomotrice. | Ne pas proposer de champ. 🔴 Si une justification existe (accès aux soins, dossier de financement), **à instruire** avant d'ajouter. |
| Événements de vie difficiles, violences, placement | Très sensible, parfois indispensable. | Champ existant mais **jamais préaffiché**, jamais suggéré par une aide de saisie, exclu par défaut de l'export, et signalé comme relevant du secret partagé au cas par cas. 🔴 Articulation avec l'obligation de signalement : **à instruire** auprès d'un juriste. |
| Suivi psychologique ou psychiatrique | Donnée de santé de niveau très sensible. | Se limiter à « professionnels intervenant actuellement », sans détail de contenu, sauf nécessité écrite. |
| Sexualité, puberté | Rarement nécessaire. | Aucun champ dédié. Si abordé, relève de la note clinique interne, pas du compte rendu. |
| Croyances, pratiques religieuses | Donnée sensible RGPD. | Aucun champ. |

---

## 6. Contexte PCO / TND

> ⚠️ **Section à revérifier avant toute implémentation.** Le cadre réglementaire a été **profondément remanié en 2025**. Des textes de référence largement diffusés (fiches ministérielles, pages associatives, contrat type de 2019) décrivent encore l'état antérieur. Ce qui suit distingue explicitement l'ancien et le nouveau régime.

### 6.1 Ce qu'est une Plateforme de Coordination et d'Orientation

🟢 **FAIT — Article L2135-1 du code de la santé publique**, version en vigueur depuis le 31 décembre 2025 (modifié par la loi n° 2025-1403 du 30 décembre 2025).
Contenu : pour l'accompagnement des enfants présentant un trouble du neuro-développement et pour la réalisation d'un diagnostic, **un parcours de bilan et intervention précoce est pris en charge par l'assurance maladie**. Le dispositif intègre un programme de guidance parentale. Le parcours est organisé par des **structures désignées par arrêté du directeur général de l'agence régionale de santé**. **La prise en charge est conditionnée à une prescription médicale.**
Source : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053283065 — consulté le 2026-09-11.

🟢 **FAIT — origine du dispositif.** Le décret n° 2018-1297 du 28 décembre 2018 a créé le chapitre V du CSP relatif au parcours de bilan et intervention précoce pour les troubles du neuro-développement (articles R2135-1 à R2135-4), en application de la stratégie nationale autisme au sein des troubles du neuro-développement.
Source : https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000037879879 — consulté le 2026-09-11.

🔵 **USAGE — en langage courant**, la « PCO » est la structure désignée qui reçoit l'adressage médical, organise le parcours, met en relation la famille avec des professionnels libéraux conventionnés avec elle, et coordonne les retours. Le terme « PCO » n'est pas le terme du code, qui parle de « structure désignée ».

### 6.2 Ce qui a changé en 2025 — rupture majeure

🟢 **FAIT — Décret n° 2025-770 du 5 août 2025** relatif à l'organisation des parcours mentionnés aux articles L. 2134-1, L. 2135-1 et L. 2136-1 CSP.
- Il **abroge** les articles R2135-1 à R2135-4 et **remplace** le chapitre V par un nouveau chapitre IV commun aux trois parcours (articles R2134-1 à R2134-4).
- Trois parcours harmonisés : L2134-1 (troubles durables du jeune enfant), **L2135-1 (troubles du neuro-développement)**, L2136-1 (polyhandicap, paralysie cérébrale).
- **Durée** : un an, renouvelable une fois, pour les parcours L2134-1 et L2135-1.
- **Âge** : prescription avant le 7e anniversaire (L2134-1) et **avant le 12e anniversaire (L2135-1)**.
- **Professionnels** : professionnels libéraux des articles L4331-1 (ergothérapeutes) et **L4332-1 (psychomotriciens)**, ainsi que les psychologues.
- **Rémunération** : « Les professionnels libéraux […] sont rémunérés par des forfaits, versés par l'assurance maladie au prorata des bilans et séances effectués. »
- **Interdiction formelle** : « Ces professionnels ne peuvent demander aux patients un paiement direct des bilans ou des séances. »
- **Entrée en vigueur** : le lendemain de la publication au Journal officiel, soit le 7 août 2025.
Source : https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000052049923 — consulté le 2026-09-11.

🟢 **FAIT — Arrêté du 19 décembre 2025** (JO du 23 décembre 2025) fixant les principes communs aux parcours L2134-1, L2135-1 et L2136-1 inscrits dans le cadre du **service de repérage, de diagnostic et d'intervention précoce**, et le cahier des charges des structures désignées.
Éléments retenus : structuration territoriale de l'offre ; respect des recommandations de bonnes pratiques ; **suppression du reste à charge pour les familles** ; conventions de partenariat ; transmission des comptes rendus à la structure, à la famille et aux professionnels accompagnants.
Source : https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053143303 — consulté le 2026-09-11.

🔴 **À INSTRUIRE — calendrier de déploiement.** Une source secondaire (cabinet d'avocats) indique un déploiement du service de repérage, de diagnostic et d'intervention précoce avant le 1er janvier 2027.
Source secondaire : https://accens-avocats.com/blog/2026/07/21/le-service-de-reperage-de-diagnostic-et-dintervention-precoce-handicap-doit-etre-deploye-avant-le-1er-janvier-2027/ — consulté le 2026-09-11.
**Cette date n'a pas été vérifiée sur une source primaire.** À confirmer sur Légifrance et auprès de l'ARS compétente avant d'en tirer une règle produit.

🔴 **À INSTRUIRE — articulation entre l'ancien et le nouveau contrat type.** L'arrêté du 16 avril 2019 relatif au contrat type (modifié par arrêté du 24 août 2021 puis par arrêté du 13 décembre 2024) apparaissait encore en vigueur lors de la consultation, alors que l'arrêté du 19 décembre 2025 fixe un nouveau cadre. **Lequel s'applique, et à partir de quand, n'a pas été établi ici.**
Sources : https://www.legifrance.gouv.fr/loda/id/JORFTEXT000038423672/ — consulté le 2026-09-11.
Responsable : la psychomotricienne utilisatrice, à partir du contrat qu'elle a réellement signé avec sa structure désignée. **C'est la source la plus fiable pour le produit.**

### 6.3 Qui paie, et selon quel circuit

🟢 **FAIT — le payeur a changé au 1er juin 2024.** Auparavant, les PCO versaient les rémunérations. Depuis cette date, **ce sont les caisses d'assurance maladie qui versent directement** aux professionnels libéraux non conventionnés (ergothérapeutes, psychomotriciens, psychologues).
Circuit en trois étapes :
1. **Immatriculation RPPS** auprès de l'ARS, via esante.gouv.fr — remplace l'ancien numéro ADELI.
2. **Enregistrement au FNPS** (fichier national des professionnels de santé) auprès de la caisse, avec RPPS, attestation de coopération avec une PCO, RIB professionnel, SIRET, pièce d'identité.
3. **Facturation** : transmission **mensuelle** des formulaires de facturation aux PCO, qui les relaient à l'Assurance Maladie.
En cas d'exercice dans plusieurs PCO ou cabinets : un seul enregistrement FNPS, auprès de la caisse du lieu d'exercice principal, avec transmission de toutes les attestations de coopération.
Source : https://www.ameli.fr/etablissement/exercice-professionnel/facturation-prise-charge/remuneration-des-professionnels-liberaux-dans-les-pco-les-etapes-cles — page mise à jour le 26 juin 2024, consultée le 2026-09-11.

> **Conséquence produit — le champ ADELI existant est obsolète pour ce circuit.** Le produit stocke un champ ADELI dans `settings.profile`. Le circuit PCO exige un **RPPS**. 🟠 Il faut au minimum ajouter le RPPS ; le remplacement pur et simple d'ADELI est à arbitrer.

### 6.4 Montants — état antérieur, à revérifier

🟢 **FAIT au 2026-09-11 pour ce qui est du document cité, mais daté.** Fiche technique « Forfait d'intervention précoce », handicap.gouv.fr, **mars 2025** — donc **antérieure** au décret du 5 août 2025 et à l'arrêté du 19 décembre 2025.

| Profession | Bilan | Bilan + interventions |
|---|---|---|
| Ergothérapeute | 140 € | 1 500 € |
| **Psychomotricien** | **140 €** | **1 500 €** |
| Psychologue | 120 € (bilan simple) / 300 € (bilan neuropsychologique complet) | 1 500 € (≈ 35 séances) / 512 € (≈ 12 séances en sus des bilans) |

Précisions du même document :
- Le forfait « bilan et interventions précoces » comprend la partie bilan ou évaluation **et en moyenne 35 séances d'interventions de 45 minutes**, à réaliser sur une période de douze mois, renouvelable une fois.
- « Le nombre, la durée et la fréquence des séances pourront varier pour s'adapter aux capacités de l'enfant. »
- **« Ces forfaits s'entendent comme incluant la rédaction des comptes rendus de bilan et d'intervention et les temps de coordination avec la plateforme, ainsi que les coûts de déplacement quel que soit le lieu d'exercice. »**
- Le forfait « ne peut être versé qu'aux professionnels qui ont effectué une démarche de contractualisation avec la plateforme ».
Source : https://handicap.gouv.fr/sites/handicap/files/2025-04/TND-fiche-technique-forfait-intervention-2025.pdf — consultée le 2026-09-11.

🔴 **À INSTRUIRE — ces montants sont-ils toujours en vigueur après les textes de 2025 ?** Source à consulter : arrêté relatif au contrat type en vigueur, sur Légifrance, et le contrat signé par la praticienne. **Ne pas coder ces montants en dur.**

### 6.5 Conséquences sur le document

🟢 **FAIT — le compte rendu est contractuellement attendu.** Le contrat type (arrêté du 16 avril 2019 et ses modifications) prévoit la transmission par le psychomotricien d'un compte rendu de bilan à la plateforme, ainsi que des comptes rendus périodiques, avec pour destinataires la plateforme, la famille, le médecin traitant et les autres professionnels avec l'accord de la famille.
Source : https://www.legifrance.gouv.fr/loda/id/JORFTEXT000038423672/ — consulté le 2026-09-11.
⚠️ **Réserve de méthode.** Les détails de périodicité et de délai relevés lors de cette consultation (comptes rendus au moins trimestriels, délai d'accueil) proviennent d'une lecture automatisée de la page. **Ils doivent être revérifiés ligne à ligne sur le texte source, et confrontés au contrat réellement signé, avant d'être transformés en règle produit.**

🟢 **FAIT — arrêté du 19 décembre 2025** : les comptes rendus sont adressés à la structure, à la famille et aux professionnels accompagnants (médecin traitant, PMI, éducation nationale), avec partage sécurisé et intégration au dossier médical partagé.
Source : https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053143303 — consulté le 2026-09-11.

**Conséquences opérationnelles pour le moteur de bilans :**

| # | Conséquence | Statut |
|---|---|---|
| P-1 | Un bilan peut être **rattaché à un parcours PCO** : structure désignée, date de prescription, échéance du parcours, renouvellement éventuel. Ce rattachement est une propriété du bilan, pas une case sur une facture. | 🟠 proposition |
| P-2 | Le compte rendu PCO a **au moins trois destinataires** (structure, famille, médecin) et non un seul. Le `mailto:` unique vers `patients.email` du produit actuel ne couvre pas ce besoin. | 🟢 fondé sur l'arrêté du 19/12/2025 |
| P-3 | Le document doit permettre d'identifier qu'il s'inscrit dans un parcours financé, sans pour autant que ce statut administratif contamine le contenu clinique. | 🟠 proposition |
| P-4 | La **rédaction du compte rendu est incluse dans le forfait** : elle n'est pas facturable en sus. Le produit ne doit pas proposer de ligne de facturation distincte pour un compte rendu en contexte PCO. | 🟢 fiche mars 2025, à revérifier |
| P-5 | Le renouvellement du parcours suppose de produire un **document de fin de période** justifiant la poursuite. | 🔵 usage, à confirmer sur le contrat type |

### 6.6 Conséquences sur la facturation

🟢 **FAIT — interdiction du paiement direct.** « Ces professionnels ne peuvent demander aux patients un paiement direct des bilans ou des séances » (décret n° 2025-770). La disposition équivalente figurait déjà à l'ancien R2135-2.
Source : https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000052049923 — consulté le 2026-09-11.

> **⚠️ Écart critique avec le produit actuel.** `has_pco` est aujourd'hui une simple case à cocher sur une facture, sans conséquence documentée (voir `docs/context/GLOSSARY.md`). Or :
> - une prestation réalisée dans le cadre d'un parcours **ne doit pas donner lieu à une facture adressée à la famille** ;
> - elle donne lieu à un **formulaire de facturation transmis à la PCO**, qui le relaie à l'Assurance Maladie (§ 6.3), **mensuellement** ;
> - le payeur n'est ni le patient, ni le responsable légal : c'est la caisse.
>
> 🟠 **Proposition** : le rattachement à un parcours PCO devrait **changer le circuit de facturation**, pas seulement cocher une case. Au minimum, le produit devrait empêcher — ou signaler — l'émission d'une facture nominative adressée à la famille pour un acte rattaché à un parcours.
> 🔴 **À instruire** : la forme exacte du formulaire de facturation attendu par les PCO, et si le produit peut le produire. Source : la PCO partenaire de la praticienne.

🟢 **FAIT hors PCO — la psychomotricité libérale n'est pas conventionnée.** Les psychomotriciens libéraux n'exercent pas en secteur conventionné ; les séances ne sont pas remboursées par l'Assurance Maladie au titre du droit commun, même sur prescription médicale. Des voies existent hors droit commun : aide financière individuelle sur critères, financement via structures spécialisées, forfait PCO, contrats complémentaires.
Sources : forum officiel Ameli, réponses de conseillers — https://forum-assures.ameli.fr/questions/1763011-psychomotricite et https://forum-assures.ameli.fr/questions/3673731-remboursement-sceances-psychomotricien — consultés le 2026-09-11.
🔴 **Source primaire à obtenir** : absence d'inscription à la NGAP et absence de convention nationale, à confirmer auprès de l'Assurance Maladie. Un forum, même officiel, n'est pas une source primaire.

🔴 **À INSTRUIRE, hors de mon champ** : régime de TVA, qualification URSSAF de l'activité, obligations de facturation et mentions légales. Responsable : expert-comptable. Ne pas déduire de règle produit de cette section.

---

## 7. Structure de compte rendu configurable

> **Avertissement de lecture.** « Obligatoire » signifie ici **obligatoire par choix de conception du produit**, parce que son absence crée un risque d'erreur d'attribution, de mésinterprétation ou de perte de traçabilité. **Aucune de ces mentions n'est imposée par un texte**, sauf là où c'est explicitement écrit 🟢. Le praticien doit pouvoir déplacer et renommer les blocs ; il ne doit pas pouvoir supprimer un bloc marqué « obligatoire » sans confirmation explicite.

| # | Bloc | Niveau | Justification |
|---|---|---|---|
| B-01 | **Nature du document** (bilan initial, réévaluation, synthèse…) et **statut** (brouillon / validé) | **Obligatoire** | Un brouillon qui s'imprime à l'identique d'un document validé est le risque C-1 déjà constaté dans `CLINICAL_SAFETY.md`. Le lecteur doit savoir ce qu'il tient. |
| B-02 | **Identification du patient** : nom, date de naissance, **âge à la date de passation** | **Obligatoire** | Prévention de l'erreur d'attribution. L'âge à la passation, et non à l'impression, conditionne toute lecture d'un résultat rapporté à un étalonnage par classe d'âge (risque C-4 constaté). |
| B-03 | **Identification de l'auteur** : nom, titre « psychomotricien(ne) D.E. », identifiant professionnel, coordonnées | **Obligatoire** | 🟢 Le titre est protégé (L4332-2). 🟢 Le RPPS est requis pour le circuit PCO (§ 6.3). L'auteur doit être relié au compte connecté, pas saisi en texte libre. |
| B-04 | **Dates** : date(s) de passation, date de rédaction, date de validation | **Obligatoire** | Trois dates distinctes, aujourd'hui confondues. Sans elles, ni la comparaison dans le temps ni la lecture des normes ne sont fiables. |
| B-05 | **Prescription** : prescripteur, date, objet | **Recommandé (fort)** | 🟢 R4332-1 conditionne les actes à une prescription médicale. Tracer la prescription documente que l'acte s'inscrit dans le cadre. Recommandé et non obligatoire, car la donnée peut manquer au moment de la rédaction — son absence doit alors être **visible**. |
| B-06 | **Demande et motif** | **Recommandé (fort)** | Sans la question posée, un compte rendu n'est pas lisible. Correspond au domaine D01. |
| B-07 | **Conditions de réalisation** : nombre et durée des séances, lieu, personnes présentes, état de la personne, écarts aux conditions standard | **Obligatoire dès qu'un instrument étalonné est employé** | C'est ce qui rend un score interprétable ou non. Un score publié sans ses conditions est une affirmation non qualifiée. Correspond au domaine D17. |
| B-08 | **Anamnèse retenue**, avec la source de chaque élément | **Optionnel** | Peut légitimement être absent : bilan ciblé, adulte connu, réévaluation. Sa présence par défaut incite à la sur-collecte, contre le principe du § 5.1. |
| B-09 | **Outils et supports employés**, avec version, et **ce qui n'a pas été passé** | **Recommandé (fort)** | Sans la version de l'outil, aucune comparaison ultérieure n'est valide. La liste des épreuves **non** passées évite qu'une absence soit lue comme une normalité. |
| B-10 | **Blocs par domaine activé** (§ 4), chacun avec observation / résultat / interprétation / retentissement séparés | **Obligatoire — au moins un** | C'est le cœur du document. Le nombre et le choix des domaines sont libres ; aucun domaine n'est imposé. |
| B-11 | **Résultats chiffrés**, avec pour chaque valeur : l'outil, l'échelle employée, l'étalonnage de référence et l'intervalle de confiance si disponible | **Optionnel** | Un bilan sans aucun chiffre est un bilan valide — c'est même la norme chez le nourrisson et souvent chez l'adulte. Rendre ce bloc obligatoire pousse à chiffrer pour remplir. |
| B-12 | **Légende d'interprétation des scores** | **Obligatoire si B-11 est présent, interdit sinon** | Un chiffre sans légende est ininterprétable ; une légende sans chiffre induit en erreur. Le produit actuel imprime deux vocabulaires contradictoires pour les mêmes bandes (risque C-2). **Une seule échelle, un seul vocabulaire, des bornes disjointes.** |
| B-13 | **Ressources et points d'appui** | **Recommandé (fort)** | 🟠 Un compte rendu exclusivement déficitaire est lu par la personne concernée et par sa famille. Correspond au domaine D20. À valider. |
| B-14 | **Synthèse / analyse**, explicitement marquée comme l'interprétation du professionnel | **Recommandé (fort)** | C'est l'apport propre du psychomotricien. Doit être typographiquement distinguée des observations. |
| B-15 | **Conclusion psychomotrice**, sans étiquette nosographique | **Recommandé (fort)** | 🟢 R4332-1 ne comporte aucun acte de diagnostic médical. La conclusion formule le fonctionnement psychomoteur et ses conséquences, pas une catégorie. |
| B-16 | **Propositions** : suivi, aménagements, orientations vers d'autres professionnels, réévaluation | **Optionnel** | Peut être absent d'une réévaluation intermédiaire ou d'un bilan demandé pour avis. |
| B-17 | **Limites du bilan** : ce qui n'a pas pu être exploré, incertitudes, réserves | **Recommandé (fort)** | 🟠 Fortement recommandé : c'est le bloc qui empêche de lire le document comme exhaustif. Aujourd'hui absent du produit. |
| B-18 | **Destinataires et modalités de restitution** | **Optionnel** | Utile dès qu'il y a plusieurs destinataires, ce qui est systématique en PCO (§ 6.5, P-2). |
| B-19 | **Signature, lieu, date de validation** | **Obligatoire pour un document validé** | Distinguer la signature graphique de l'acte de validation horodaté. La validation doit être un événement daté et traçable, pas un interrupteur réversible (question `Q-201`). |
| B-20 | **Mention de provenance d'un contenu assisté** | **Obligatoire si un contenu généré subsiste** | 🟢 Règle 5 de `CLAUDE.md`. Aujourd'hui non implémentée (risque C-5). |
| B-21 | **Rattachement à un parcours financé** (PCO ou autre) | **Optionnel** | Nécessaire uniquement en contexte de parcours. Voir § 6.5, P-3. |

### 7.1 Règles de rendu transverses

🟠 Propositions de conception, à arbitrer :

1. **Un bloc vide ne s'imprime pas.** Déjà bien tenu dans le produit actuel — à préserver explicitement.
2. **Un domaine désactivé n'apparaît nulle part**, ni comme titre, ni comme mention « non évalué » — sauf si le praticien choisit de le signaler.
3. **Distinguer à l'impression** : « non exploré » (domaine désactivé), « exploré, sans particularité au regard de la demande », « non réalisable » (épreuve interrompue ou hors conditions). Trois états, trois rendus. Aujourd'hui indistincts.
4. **Le statut du document est visible sur chaque page** tant qu'il n'est pas validé.
5. **Aucun bloc n'est généré automatiquement à partir d'un autre.** Une synthèse dérivée de scores sans intervention du praticien contreviendrait à la règle 4 de `CLAUDE.md`.

---

## 8. Vocabulaire à bannir ou encadrer

🟠 Ce tableau est une **proposition éditoriale** de l'auteur. Aucune de ces interdictions ne découle d'un texte. Elle doit être validée par une psychomotricienne en exercice **avant** d'être appliquée aux aides de saisie du produit.

### 8.1 Termes qui laissent croire à un diagnostic

| À bannir dans un document remis | Pourquoi | Remplacement proposé |
|---|---|---|
| « Diagnostic : … » | 🟢 R4332-1 ne liste aucun acte de diagnostic médical. Le mot engage une autorité que le texte ne donne pas. | « Conclusion psychomotrice » / « Éléments contributifs, à soumettre au médecin prescripteur ». |
| « dyspraxie », « TDC », « TAC » | Catégories diagnostiques médicales, issues d'une démarche pluridisciplinaire. (Le terme figure certes au 🟢 R4332-1 3° h, mais comme **indication de rééducation**, pas comme conclusion à poser.) | « difficultés praxiques observées sur {tâches} » + description. |
| « dysgraphie » | Idem. Souvent utilisée ensuite comme justificatif d'aménagement. | « difficultés graphomotrices » + éléments objectivés (vitesse, lisibilité, douleur, endurance). |
| « TDAH », « déficit attentionnel », « impulsivité » | Hors champ (§ D16). | Description du comportement observé, avec durée, contexte et effet de l'étayage. |
| « autisme », « traits autistiques », « retrait autistique » | Diagnostic médical. | Description des observations relationnelles et corporelles, sans inférence catégorielle. |
| « déficience intellectuelle », « retard mental », « QI » | Hors champ du psychomotricien. | Ne pas employer. Renvoyer à l'évaluation compétente. |
| « trouble du traitement sensoriel » | 🔴 Statut nosographique discuté — à instruire. | « particularités observées dans la réception et la modulation des informations {modalités} ». |
| « trouble de … » en général | Le mot « trouble » fait basculer une observation dans le registre nosographique. | « difficultés », « particularités », « écart observé », selon ce qui est démontré. |

### 8.2 Termes qui laissent croire à une certitude ou à une norme non fondée

| À bannir ou encadrer | Pourquoi | Remplacement proposé |
|---|---|---|
| « normal » / « anormal » | Sous-entend une norme universelle. Il n'existe qu'un **étalonnage**, propre à un outil, une version et une population de référence. | « se situe dans la moyenne de l'étalonnage de {outil}, version {v}, pour la classe d'âge {x} » / « s'écarte de … ». |
| « pathologique », **« zone dite "pathologique" »** | Qualifie la personne. Présent aujourd'hui dans la légende imprimée du produit (risque C-3). | Nommer la position statistique : « score situé à {n} écarts-types sous la moyenne de l'étalonnage ». |
| « déficitaire », « déficit » | Affirme un manque constitutif à partir d'une mesure ponctuelle. | « performance inférieure à {référence} sur cette épreuve, à cette date, dans ces conditions ». |
| « échec », « test raté », « réussi » | Vocabulaire scolaire, vécu comme un jugement. | « l'item n'est pas réussi dans les conditions standard » / « la tâche n'a pas été menée à terme ». |
| « faible », « très faible », « bon niveau » | Vocabulaire évaluatif. Le produit fait aujourd'hui coexister ce vocabulaire avec un autre pour les mêmes bandes (risque C-2). | Choisir **un seul** vocabulaire pour l'ensemble du document et le documenter dans la légende B-12. |
| « il est » / « elle est » + adjectif | Attribue un trait à la personne. | « lors de {situation}, {comportement observé} ». |
| « toujours », « jamais », « systématiquement » | Généralise à partir de quelques observations. | « à {n} reprises sur {N} », « dans les situations de {type} ». |
| « il n'y a pas de trouble » | Confond absence d'observation et preuve d'absence. | « les observations réalisées ne mettent pas en évidence {élément}, dans les limites de ce bilan ». |
| Un chiffre sans son échelle | Une note standard et une déviation standard ne se lisent pas sur la même échelle. Le produit imprime aujourd'hui les deux sur la même page. | Toujours accoler l'échelle, l'outil et la version. |

### 8.3 Termes datés ou stigmatisants

| À bannir | Pourquoi | Remplacement proposé |
|---|---|---|
| **« débilité motrice »** | Figure au 🟢 R4332-1 3° i) — vocabulaire de 1988 conservé par codification. Aujourd'hui perçu comme insultant. **Ne jamais l'imprimer.** | Décrire ce qui est observé. |
| « instabilité psychomotrice », « inhibition psychomotrice » | 🟢 R4332-1 3° j) et k). Qualifient la personne, pas la situation. | « niveau d'activité motrice observé en {contexte} » / « engagement dans l'activité ». |
| « dysharmonie psychomotrice » | 🟢 R4332-1 3° f). Terme d'école, peu lisible pour une famille. | Décrire l'hétérogénéité constatée entre domaines, en la nommant explicitement. |
| « troubles caractériels » | 🟢 R4332-1 4°. Jugement moral. | Ne pas employer. |
| « immature », « bébé », « puéril » | Jugement. | « à ce jour, {comportement} est observé dans {situations} ». |
| « refuse », « s'oppose », « ne veut pas » | Prête une intention. | « n'a pas engagé la tâche proposée », « a décliné la proposition », « a demandé à arrêter ». |
| « maladroit » | Qualification globale et dépréciative. | Décrire le geste et ses conditions. |
| « mal latéralisé » | Sous-entend une bonne latéralisation. | « latéralité manuelle non fixée sur l'ensemble des tâches proposées ». |
| « handicapé », « dépendant » | Réduit la personne à une catégorie. | « personne en situation de handicap », « réalise avec {type d'aide} ». |
| « la maman », « le papa » dans un écrit professionnel | 🟠 Registre affectif inadapté à un document remis à des tiers. À valider — l'usage est courant et pas nécessairement à proscrire. | « la mère », « le père », ou « les titulaires de l'autorité parentale » selon le contexte juridique. |
| « tuteur » employé comme synonyme de parent | « Tuteur » désigne une mesure de protection judiciaire. Le produit fait aujourd'hui cette confusion (voir `GLOSSARY.md`). | « titulaire(s) de l'autorité parentale » pour un mineur ; « représentant légal » avec le régime précisé pour un majeur protégé. |

### 8.4 Formulations à conserver et à encourager

🟠 À valider. Le produit devrait proposer ces tournures dans ses aides de saisie plutôt que des termes techniques :

- « À cette date, dans ces conditions, … »
- « Selon les éléments rapportés par {source}, … »
- « Cette observation est à confirmer sur d'autres temps d'évaluation. »
- « Cet élément ne permet pas de conclure. »
- « Ce point relève d'un avis {profession}, que je propose de solliciter. »
- « Ce bilan n'a pas exploré {domaine}. »
- « Je formule l'hypothèse que … ; elle reste à confronter à {élément}. »

---

## 9. Ce qui exige une validation par un psychomotricien en exercice

Chaque ligne est bloquante pour une décision de conception. Aucune ne peut être tranchée par l'analyse documentaire seule.

### Cadre et vocabulaire

| # | Point à valider | Section |
|---|---|---|
| V-01 | La formulation retenue pour « diagnostic psychomoteur » : ce qu'une conclusion de bilan peut et ne peut pas affirmer, dans la pratique réelle. | § 1.2 |
| V-02 | La règle R-4 : faut-il proscrire le vocabulaire de R4332-1 (« débilité motrice », « dysharmonie », « instabilité ») dans les documents remis ? | § 1.3, § 8.3 |
| V-03 | L'ensemble du tableau de vocabulaire du § 8, terme par terme. Certains remplacements proposés peuvent être maladroits ou inutilement lourds en pratique. | § 8 |
| V-04 | Le sort de « zone dite "pathologique" » et de la coexistence de deux vocabulaires pour les mêmes bandes dans le produit actuel. Reprend `Q-202`. | § 8.2 |
| V-05 | Faut-il écrire « la mère / le père » plutôt que « la maman / le papa » ? Question de registre, pas de droit. | § 8.3 |

### Documents

| # | Point à valider | Section |
|---|---|---|
| V-06 | La typologie des neuf natures de documents : y en a-t-il en trop, en manque, ou mal nommés ? | § 2 |
| V-07 | La décomposition en quatre attributs (nature / domaines / destinataire / rattachement) plutôt qu'en types figés. **Arbitrage le plus structurant de la refonte.** | § 2.1 |
| V-08 | Le statut des notes cliniques internes : le produit doit-il les distinguer techniquement du contenu du bilan ? | § 2, D-8 |
| V-09 | Le niveau « obligatoire / recommandé / optionnel » de chacun des 21 blocs du § 7, et leur ordre par défaut. | § 7 |
| V-10 | Les cinq règles de rendu transverses, notamment la distinction à trois états « non exploré / sans particularité / non réalisable ». | § 7.1 |
| V-11 | Faut-il un bloc « limites du bilan » (B-17) par défaut ? | § 7 |

### Domaines

| # | Point à valider | Section |
|---|---|---|
| V-12 | La liste des 20 domaines : découpage, intitulés, fusions ou scissions souhaitables. | § 4 |
| V-13 | Pour chaque domaine : les formulations neutres proposées sont-elles utilisables telles quelles en séance ? | § 4 |
| V-14 | Le principe des quatre registres séparés (observation / résultat / interprétation / retentissement) plutôt qu'un bloc de prose. Reprend `Q-203`. **Décision structurante.** | § 4 |
| V-15 | Les domaines à proposer par défaut selon l'âge et le motif. Les présélections proposées ici ne sont que des points de départ. | § 3, § 4 |
| V-16 | Les frontières de champ signalées sur D14 (visuoperceptif) et D16 (attention) : sont-elles correctement placées ? | § 4 |
| V-17 | Faut-il activer par défaut D01 (demande), D17 (conditions de passation) et D20 (ressources) ? | § 4 |
| V-18 | Le praticien doit-il pouvoir créer ses propres domaines, et avec quelles limites ? | § 4 |

### Anamnèse et populations

| # | Point à valider | Section |
|---|---|---|
| V-19 | La matrice de rubriques d'anamnèse par tranche d'âge. | § 5.2 |
| V-20 | La liste des rubriques sensibles et leur traitement (non affichées par défaut, exclues de l'export). Est-ce praticable ? | § 5.3 |
| V-21 | Les motifs d'adressage fréquents par population : reflètent-ils la patientèle réelle du cabinet ? | § 3 |
| V-22 | Les adaptations de passation par population, notamment la place du parent et l'entretien seul avec l'adolescent. | § 3 |

### Parcours financés

| # | Point à valider | Section |
|---|---|---|
| V-23 | **Le contrat PCO réellement signé** : c'est la source la plus fiable pour établir les obligations documentaires effectives, les délais et les montants en vigueur. Aucune analyse documentaire ne peut s'y substituer. | § 6.2, § 6.5 |
| V-24 | La conséquence P-4 : la rédaction du compte rendu est-elle bien incluse dans le forfait, sans facturation distincte ? | § 6.5 |
| V-25 | Le circuit de facturation PCO réel : quels formulaires, quelle périodicité, transmis à qui. | § 6.3, § 6.6 |
| V-26 | La proposition de faire du rattachement PCO un changement de circuit de facturation plutôt qu'une case à cocher. | § 6.6 |
| V-27 | Les destinataires effectifs d'un compte rendu PCO, et comment ils sont transmis aujourd'hui. | § 6.5, P-2 |
| V-28 | Le RPPS doit-il remplacer ou compléter le champ ADELI existant ? | § 6.3 |

### Points renvoyés à d'autres compétences

| # | Point | Responsable |
|---|---|---|
| V-29 | Frontière juridique « diagnostic psychomoteur » / exercice illégal de la médecine (L4161-1 CSP). | Juriste santé |
| V-30 | Régime d'accès aux notes personnelles du praticien libéral. | DPO ou juriste santé |
| V-31 | Droits d'accès et d'opposition du mineur (L1111-5, L1111-7), applicabilité au psychomotricien libéral. | DPO ou juriste santé |
| V-32 | Régimes de protection juridique du majeur et effets sur la communication d'un compte rendu. | Juriste |
| V-33 | Durée de conservation du dossier en exercice libéral. 🟢 L'article R1112-7 CSP (20 ans) vise les **établissements de santé**, non les libéraux — ne pas l'appliquer par analogie sans validation. Reprend `Q-403`. Source : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000036658351 — consulté le 2026-09-11. | DPO ou juriste |
| V-34 | Articulation entre l'arrêté contrat type de 2019 (modifié) et l'arrêté du 19 décembre 2025 ; calendrier du service de repérage, de diagnostic et d'intervention précoce. | ARS / structure désignée |
| V-35 | Montants des forfaits en vigueur après les textes de 2025. | Assurance Maladie / structure désignée |
| V-36 | Absence de convention nationale et de nomenclature pour les psychomotriciens libéraux : source primaire à obtenir. | Assurance Maladie |
| V-37 | Obligation de signalement et son articulation avec les rubriques sensibles de l'anamnèse. | Juriste |
| V-38 | Reproduction des intitulés d'épreuves et grilles de batteries éditées dans le code (point déjà ouvert dans `CLINICAL_SAFETY.md`). | Conseil en propriété intellectuelle |
| V-39 | Régime de TVA, qualification URSSAF, mentions obligatoires de facturation. | Expert-comptable |

---

## Annexe A — Sources consultées

Toutes consultées le **2026-09-11**.

### Sources primaires — Légifrance

| Texte | URL |
|---|---|
| Article L4332-1 CSP (définition de la profession, prescription médicale) | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006689416 |
| Article R4332-1 CSP (actes professionnels) | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006914164 |
| Articles L4332-1 à L4332-7 CSP (chapitre Psychomotricien) | https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072665/LEGISCTA000006171316/ |
| Décret n° 88-659 du 6 mai 1988 (abrogé le 8 août 2004) | https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000693097/ |
| Article L2135-1 CSP (parcours de bilan et intervention précoce) | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053283065 |
| Décret n° 2018-1297 du 28 décembre 2018 | https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000037879879 |
| Ancien chapitre V, articles R2135-1 à R2135-4 (abrogés) | https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072665/LEGISCTA000037970809/ |
| Décret n° 2025-770 du 5 août 2025 | https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000052049923 |
| Arrêté du 19 décembre 2025 (principes communs, cahier des charges) | https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053143303 |
| Arrêté du 16 avril 2019 (contrat type), modifié 24 août 2021 et 13 décembre 2024 | https://www.legifrance.gouv.fr/loda/id/JORFTEXT000038423672/ |
| Article L1111-7 CSP (accès aux informations de santé) | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000042685313 |
| Article R1112-7 CSP (conservation en établissement de santé) | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000036658351 |

### Sources institutionnelles

| Source | URL |
|---|---|
| Ameli — Rémunération des professionnels libéraux dans les PCO (maj 26/06/2024) | https://www.ameli.fr/etablissement/exercice-professionnel/facturation-prise-charge/remuneration-des-professionnels-liberaux-dans-les-pco-les-etapes-cles |
| handicap.gouv.fr — Fiche technique « Forfait d'intervention précoce », mars 2025 | https://handicap.gouv.fr/sites/handicap/files/2025-04/TND-fiche-technique-forfait-intervention-2025.pdf |
| Ameli — Guide des structures coordinatrices PCO-TND | https://www.ameli.fr/sites/default/files/Documents/Guide-structures-coordinatrices-PCO-TND.pdf |
| HAS — Troubles du neurodéveloppement : repérage et orientation des enfants à risque (mars 2020) | https://www.has-sante.fr/jcms/p_3161334/fr/troubles-du-neurodeveloppement-reperage-et-orientation-des-enfants-a-risque |

### Sources professionnelles — non normatives

| Source | URL |
|---|---|
| Fédération Française des Psychomotriciens | https://fedepsychomot.com/qui-est-le-psychomotricien/ |
| Conseil National Professionnel des Psychomotriciens | https://cnp-psychomotriciens.fr/la-profession-2/ |
| AFPL — Charte éthique et déontologique | https://a-f-p-l.fr/qui-sommes-nous/charte-ethique-deontologique/ |
| Forum officiel Ameli — remboursement de la psychomotricité | https://forum-assures.ameli.fr/questions/1763011-psychomotricite |

### Réserves de méthode

1. Les pages Légifrance ont été lues via un outil de récupération et de synthèse automatique. **Les textes cités doivent être revérifiés mot à mot sur Légifrance avant toute implémentation.** Les libellés de R4332-1, L4332-1 et des dispositions du décret n° 2025-770 ont été retenus comme cités ci-dessus ; les détails du contrat type PCO (périodicité, délais) sont explicitement marqués comme non vérifiés.
2. Le cadre PCO a changé en août et décembre 2025. Plusieurs sources institutionnelles accessibles décrivent encore l'état antérieur. **Le contrat signé par la praticienne est la référence opérationnelle.**
3. Aucune norme, aucun item, aucune consigne et aucune table d'étalonnage d'un test édité n'a été consulté ni reproduit.
4. Ce document ne contient aucune donnée de patient, de responsable légal ou de professionnel identifiable.
