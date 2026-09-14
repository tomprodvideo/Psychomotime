# Sécurité clinique

## Principe

Le produit soutient le travail du psychomotricien sans décider à sa place. Le professionnel reste l’auteur et le validateur des observations, conclusions, objectifs, documents et communications cliniques.

## Risques à contrôler

- contenu généré présenté comme certain ou validé ;
- confusion entre donnée absente, donnée normale et donnée non applicable ;
- attribution d’une note ou d’un document au mauvais patient ;
- perte de la version, de l’auteur ou du statut d’un contenu ;
- partage avec un destinataire non autorisé ;
- score ou interprétation calculé avec une version, une norme ou une saisie incorrecte ;
- automatisation qui masque une exception clinique ou une contradiction.

## Contrôles attendus

- états explicites : brouillon, généré, relu, validé, partagé, corrigé ou archivé ;
- confirmation du patient et du destinataire avant une action sensible ;
- distinction visuelle et technique des contenus générés ;
- conservation de la source et des modifications utiles à la traçabilité ;
- mécanisme de correction sans effacer silencieusement l’historique ;
- scénarios de test avec information manquante, contradictoire et attribuée au mauvais contexte.

---

## État réel de ces contrôles au 2026-09-11

Établi par lecture du code. Aucun de ces constats ne remet en cause les principes ci-dessus : ils mesurent l’écart entre ces principes et l’implémentation.

| Contrôle attendu | État | Preuve |
|---|---|---|
| États explicites du contenu | ⚠️ | Toujours deux états, `brouillon` et `finalisé`, sur un interrupteur réversible sans horodatage ni confirmation. Mais **le brouillon est désormais marqué sur le document**, écran et papier compris. Ni `généré`, ni `relu`, ni `validé`, ni `partagé`, ni `archivé`. |
| Distinction visuelle et technique des contenus générés | ⚠️ | **Traité dans l’éditeur** : date, modèle et texte d’avant sont consignés sous `content.__ia__`, une mention s’affiche, l’annulation est durable (`lib/bilans/provenance.ts`). **Pas sur le document imprimé** : à trancher. |
| Conservation de la source et des modifications | ❌ | Aucune table d’historique, aucune version. `updated_at` est écrasé à chaque enregistrement (`app/(app)/bilans/actions.ts:104`). |
| Correction sans effacement silencieux | ❌ | Un bilan `finalisé` est réécrit intégralement, sans trace. Le serveur accepte le statut posté par le client sans relire l’état en base (`app/(app)/bilans/actions.ts:101,107`). |
| Confirmation du destinataire | ❌ | Le partage se fait par `mailto:` vers `patients.email` uniquement. Le responsable légal n’est jamais destinataire. Aucun partage n’est enregistré. |
| Absence ≠ normal ≠ non applicable | ⚠️ | **Bien tenu au rendu** : les champs vides sont omis du document, jamais remplis d’une valeur neutre. **Non tenu à la saisie** : `""` devient `null` sans distinction, et une épreuve non passée est indiscernable d’une note non recopiée. |
| Scénarios de test correspondants | ❌ | Aucun test automatisé dans le dépôt. |

## Risques constatés, propres à ce produit

### C-1 — Un brouillon s’imprime à l’identique d’un document validé — **corrigé le 2026-09-12**

**Corrigé.** Un bandeau « Brouillon — document de travail » est posé en tête du
document tant que le bilan n’est pas finalisé, et il survit à l’impression. On
ne REFUSE pas d’imprimer, contrairement à la comptabilité : relire un bilan sur
papier pour l’annoter fait partie du travail.

Constat d’origine : le rendu d’aperçu et le PDF ne mentionnaient le statut **à aucun endroit** : zéro occurrence de `status`, `brouillon` ou `finalis` dans `app/(app)/bilans/[id]/apercu/page.tsx`. Un bilan en cours de rédaction sortait de l’imprimante avec la même mise en page et la même signature qu’un bilan achevé.

### C-2 — La légende des scores se contredit elle-même à la note 7 — **élevé**

`lib/constants.ts:775-779`, texte imprimé dans l’encadré « Résultats chiffrés » :

- « Moyenne : entre 7 et 13 »
- « Zone de fragilité : entre 5 et 7 »

**La note standard 7 appartient aux deux bandes.** Le code, lui, tranche en faveur de la fragilité : `nsColor` colore en orange tout `n ≤ 7` et ne passe au vert qu’à partir de 8 (`lib/constants.ts:759-761`). Un lecteur du compte rendu voit donc un 7 coloré comme une fragilité sous une légende qui le déclare moyen.

**Vocabulaire divergent sur le même document.** Les bornes en DS concordent entre la légende et la courbe de Gauss, mais pas les mots : la légende dit « Zone de fragilité » et « Zone dite “pathologique” » là où la courbe imprimée dit « Faible » et « Très faible » (`components/GaussianCurve.tsx:98-103`). Deux vocabulaires pour les mêmes bandes, à quelques centimètres l’un de l’autre. La courbe abrège par ailleurs « Sup » entre « Moyenne » et « Très supérieur ».

*Précision méthodologique : la courbe trace des déviations standard, le tableau M-ABC des notes standard. Ce sont deux échelles ; seules la contradiction interne à la légende NS et la divergence de vocabulaire sont démontrées.*

### C-3 — « Zone dite “pathologique” » figure dans le document remis — **à valider**

Le terme est imprimé dans l’encadré d’interprétation (`lib/constants.ts:779`), sur un document lu par des familles et transmis à des tiers. Les guillemets et le « dite » atténuent. C’est un usage attesté dans des comptes rendus français, mais c’est un **choix éditorial du produit**, pas une évidence : à confirmer par une psychomotricienne en exercice.

### C-4 — L’âge imprimé est celui du jour de consultation, pas de la passation — **corrigé le 2026-09-12**

**Corrigé.** Les trois écrans qui affichent un âge — l’aperçu remis, l’éditeur
et le formulaire de création — emploient désormais `formatAgeAt` de
`lib/age.ts`, qui EXIGE une date de référence. Le document imprimé porte l’âge
« à la passation », et le dit.

`lib/age.ts` existait déjà, écrit pour ce défaut, et **n’était appelé nulle
part** : c’est le même motif que `lib/scales.ts`, construit au lot 3 et jamais
branché sur le document. Le module correct existe ; ce qui manque, c’est le fil.
`ageFromBirth`, sans appelant, a été retirée le 2026-09-14.

**Reste ouvert** : le groupe d’âge M-ABC est toujours choisi à la main, sans
aucun contrôle de cohérence avec la date de naissance, pourtant disponible dans
le même composant.

Constat d’origine : `ageFromBirth` lisait `new Date()` et ne recevait jamais
`bilan_date`. Un bilan passé en février et réimprimé en septembre affichait un
âge faussé de sept mois.

### C-5 — Le contenu reformulé devient indiscernable du texte du praticien — **partiellement corrigé le 2026-09-12**

L’intention est bonne : la consigne système interdit explicitement d’inventer une information, un chiffre ou un résultat, et impose de conserver les données factuelles (`app/(app)/bilans/ai-actions.ts:38-40`).

**Constat d’origine — six points, dont trois sont traités depuis :**

- **rien ne vérifie que la consigne a été respectée** : le texte renvoyé écrase le champ sans comparaison ni signalement ;
- ~~**rien ne conserve la provenance**~~ *(traité)* : après enregistrement, il était impossible de savoir qu’une section avait été reformulée ;
- ~~**l’annulation est éphémère**~~ *(traité)* : l’état de reprise était détruit à la première frappe dans le champ et perdu au rechargement ;
- **la consigne de style pousse à la suppression** (« sois SYNTHÉTIQUE », « supprime le remplissage », « le résultat doit être COURT ») en tension avec « ne perds aucune information factuelle » — sur des notes de passation, une réserve clinique nuancée est précisément ce qu’une optimisation de densité élimine ;
- **le prompt fait endosser au modèle l’identité professionnelle** (« Tu es psychomotricien(ne) diplômé(e) d’État expérimenté(e) »), alors que le texte sort sous la signature du praticien ;
- **aucune section n’est exclue**, y compris la conclusion.

**Ce qui est corrigé.** La provenance — date, modèle, texte d’avant, texte rendu
— est consignée dans la clé `__ia__` du jsonb du bilan (`lib/bilans/provenance.ts`).
Une mention s’affiche dans l’éditeur et distingue un texte intact d’un texte
repris en main. L’annulation survit au rechargement et n’est plus détruite par
la première frappe. Un contrôle interdit que la mention contienne « relu »,
« validé » ou « vérifié » : le produit sait qu’un modèle a écrit, pas qu’un
humain a jugé.

**Ce qui reste ouvert**, et qui relève d’arbitrages du lot 6 : la consigne de
style pousse toujours à la concision là où elle demande de ne rien perdre ; le
prompt fait endosser au modèle l’identité professionnelle ; aucune section n’est
exclue de la reformulation, pas même la conclusion ; et la provenance
n’apparaît pas sur le document imprimé — à trancher.

### C-6 — Un bilan peut se détacher de toute fiche patient — **corrigé le 2026-09-12**

**Corrigé.** Le lien ne tombe plus que si le nom saisi s’éloigne vraiment de
celui du dossier choisi (`lib/bilans/rattachement.ts`, contrôlé et falsifié) :
corriger un accent, ajouter un second prénom ou retirer un trait d’union
conserve le rattachement. Un nom entièrement différent le rompt — c’est
légitime, un bilan peut concerner quelqu’un sans dossier — et **l’écran le dit
dans les deux cas**, ce qui n’existait pas.

Constat d’origine : saisir un nom en texte libre effaçait l’identifiant patient à
chaque frappe. Le bilan disparaissait de la fiche, perdait date de naissance et
âge, et aucune réconciliation n’était proposée. C’était le risque d’attribution
listé plus haut, atteignable en deux frappes.

### C-7 — Perte de saisie en séance — **corrigé le 2026-09-12**

**Corrigé.** Enregistrement périodique au bout de trente secondes tant qu’il
reste des modifications, et avertissement à la fermeture de l’onglet. La
sauvegarde va au SERVEUR, où la donnée est déjà : écrire un brouillon dans le
stockage local aurait déposé des notes cliniques sur un poste parfois partagé,
survivant à la déconnexion.

**L’enregistrement automatique ne vaut que pour un brouillon.** Un bilan
finalisé se modifie déjà sans laisser de trace (§ C-4) ; l’enregistrer tout seul
ferait changer le document remis sans que personne n’ait cliqué.

Constat d’origine : aucune sauvegarde automatique, aucun garde-fou à la fermeture
d’onglet. L’indicateur « Modifications non enregistrées » était purement passif.

### C-8 — Supprimer une section de trame orpheline le texte des bilans existants — **corrigé le 2026-09-12**

**Corrigé.** La suppression demande confirmation et dit ce qu’elle fait
réellement : le texte n’est pas effacé, il cesse d’apparaître — y compris sur
les documents remis — et remettre le titre le fait réapparaître. La mention
figure aussi en permanence sous l’éditeur de trame.

Constat d’origine : le contenu restait dans le jsonb sans plus jamais être
affiché, ni dans l’éditeur ni à l’aperçu — invisible sans avoir été effacé, la
pire des deux situations. L’avertissement ne couvrait que le renommage et le
déplacement, jamais le seul geste qui fait disparaître quelque chose.

## Ce qui est bien tenu, à préserver

- **Les champs vides sont omis du document, jamais remplis d’une valeur neutre** (`apercu/page.tsx`, `fiche/page.tsx`). L’absence de donnée n’est jamais convertie en résultat normal.
- **Les tests sont déclarés par section**, pas globalement : on rattache un instrument au domaine où il a servi.
- **Le produit n’affirme plus à la place du praticien quels tests ont été passés.** Une constante figeait autrefois trois tests comme « principaux » ; elle est aujourd’hui du code mort, remplacée par une section « Tests psychomoteurs utilisés » remplie à la main. C’était le bon arbitrage — la constante morte reste à retirer pour qu’elle ne revienne pas.
- **Les clés de sections sont stables** au renommage et au déplacement, et l’interface le signale.
- **Aucun terme stigmatisant sur la personne** dans le code applicatif ; les aides de saisie sont cadrées sur des faits observables.

## Point de droit à instruire — hors champ clinique

Les intitulés d’épreuves du M-ABC ventilés par groupe d’âge (`lib/constants.ts:647-749`) et les bandes de classification ainsi que l’architecture du Profil Sensoriel de Dunn 2 (`lib/constants.ts:514-581`) sont recopiés en dur dans le code. Ce sont des matériels édités sous licence. **Aucune obligation ni aucune autorisation n’est affirmée ici** : le point, la source à vérifier — les éditeurs des deux batteries — et le responsable de validation — un conseil compétent en propriété intellectuelle — doivent être tranchés avant toute diffusion commerciale.

## Validation métier

Chaque parcours clinique doit être relu par un psychomotricien en exercice représentatif du segment visé. Documenter la version examinée, les réserves et la décision.

Les huit questions à soumettre en priorité sont consignées dans `docs/clinical/WORKFLOWS.md` et instruites dans `docs/context/OPEN_QUESTIONS.md` (`Q-201` à `Q-208`). Aucune n’a été validée à ce jour.
