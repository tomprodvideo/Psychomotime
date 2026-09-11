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
| États explicites du contenu | ❌ | Deux états seulement, `brouillon` et `finalisé`, sur un interrupteur réversible sans horodatage ni confirmation (`app/(app)/bilans/[id]/BilanEditor.tsx:884-889`). Ni `généré`, ni `relu`, ni `validé`, ni `partagé`, ni `corrigé`, ni `archivé`. |
| Distinction visuelle et technique des contenus générés | ❌ | Le texte reformulé remplace le champ sans marqueur. Rien en base ne conserve la provenance : `content` est un `Record<string, string>` (`lib/types.ts:224`). |
| Conservation de la source et des modifications | ❌ | Aucune table d’historique, aucune version. `updated_at` est écrasé à chaque enregistrement (`app/(app)/bilans/actions.ts:104`). |
| Correction sans effacement silencieux | ❌ | Un bilan `finalisé` est réécrit intégralement, sans trace. Le serveur accepte le statut posté par le client sans relire l’état en base (`app/(app)/bilans/actions.ts:101,107`). |
| Confirmation du destinataire | ❌ | Le partage se fait par `mailto:` vers `patients.email` uniquement. Le responsable légal n’est jamais destinataire. Aucun partage n’est enregistré. |
| Absence ≠ normal ≠ non applicable | ⚠️ | **Bien tenu au rendu** : les champs vides sont omis du document, jamais remplis d’une valeur neutre. **Non tenu à la saisie** : `""` devient `null` sans distinction, et une épreuve non passée est indiscernable d’une note non recopiée. |
| Scénarios de test correspondants | ❌ | Aucun test automatisé dans le dépôt. |

## Risques constatés, propres à ce produit

### C-1 — Un brouillon s’imprime à l’identique d’un document validé — **élevé**

Le rendu d’aperçu et le PDF ne mentionnent le statut **à aucun endroit** : zéro occurrence de `status`, `brouillon` ou `finalis` dans `app/(app)/bilans/[id]/apercu/page.tsx`. Un bilan en cours de rédaction sort de l’imprimante avec la même mise en page et la même signature qu’un bilan achevé. Correction attendue : filigrane ou bandeau tant que `status !== 'finalisé'`.

### C-2 — La légende des scores se contredit elle-même à la note 7 — **élevé**

`lib/constants.ts:775-779`, texte imprimé dans l’encadré « Résultats chiffrés » :

- « Moyenne : entre 7 et 13 »
- « Zone de fragilité : entre 5 et 7 »

**La note standard 7 appartient aux deux bandes.** Le code, lui, tranche en faveur de la fragilité : `nsColor` colore en orange tout `n ≤ 7` et ne passe au vert qu’à partir de 8 (`lib/constants.ts:759-761`). Un lecteur du compte rendu voit donc un 7 coloré comme une fragilité sous une légende qui le déclare moyen.

**Vocabulaire divergent sur le même document.** Les bornes en DS concordent entre la légende et la courbe de Gauss, mais pas les mots : la légende dit « Zone de fragilité » et « Zone dite “pathologique” » là où la courbe imprimée dit « Faible » et « Très faible » (`components/GaussianCurve.tsx:98-103`). Deux vocabulaires pour les mêmes bandes, à quelques centimètres l’un de l’autre. La courbe abrège par ailleurs « Sup » entre « Moyenne » et « Très supérieur ».

*Précision méthodologique : la courbe trace des déviations standard, le tableau M-ABC des notes standard. Ce sont deux échelles ; seules la contradiction interne à la légende NS et la divergence de vocabulaire sont démontrées.*

### C-3 — « Zone dite “pathologique” » figure dans le document remis — **à valider**

Le terme est imprimé dans l’encadré d’interprétation (`lib/constants.ts:779`), sur un document lu par des familles et transmis à des tiers. Les guillemets et le « dite » atténuent. C’est un usage attesté dans des comptes rendus français, mais c’est un **choix éditorial du produit**, pas une évidence : à confirmer par une psychomotricienne en exercice.

### C-4 — L’âge imprimé est celui du jour de consultation, pas de la passation — **moyen**

`ageFromBirth` utilise `new Date()` (`lib/format.ts:26`) et est appelé sans jamais recevoir `bilan_date`. Un bilan passé en février et réimprimé en septembre affiche un âge faussé de sept mois, sur un document dont toute la lecture repose sur des normes par classe d’âge. Le groupe d’âge M-ABC est par ailleurs choisi à la main sans aucun contrôle de cohérence avec la date de naissance, pourtant disponible dans le même composant.

### C-5 — Le contenu reformulé devient indiscernable du texte du praticien — **élevé**

L’intention est bonne : la consigne système interdit explicitement d’inventer une information, un chiffre ou un résultat, et impose de conserver les données factuelles (`app/(app)/bilans/ai-actions.ts:38-40`). Mais :

- **rien ne vérifie que la consigne a été respectée** : le texte renvoyé écrase le champ sans comparaison ni signalement ;
- **rien ne conserve la provenance** : après enregistrement, il est impossible de savoir qu’une section a été reformulée ;
- **l’annulation est éphémère** : l’état de reprise est détruit à la première frappe dans le champ et perdu au rechargement ;
- **la consigne de style pousse à la suppression** (« sois SYNTHÉTIQUE », « supprime le remplissage », « le résultat doit être COURT ») en tension avec « ne perds aucune information factuelle » — sur des notes de passation, une réserve clinique nuancée est précisément ce qu’une optimisation de densité élimine ;
- **le prompt fait endosser au modèle l’identité professionnelle** (« Tu es psychomotricien(ne) diplômé(e) d’État expérimenté(e) »), alors que le texte sort sous la signature du praticien ;
- **aucune section n’est exclue**, y compris la conclusion.

Ce point contredit la règle 5 de `CLAUDE.md`. Correction minimale possible sans migration : conserver le texte source, la date et le modèle dans une clé dédiée du jsonb `content`, afficher la mention dans l’éditeur, et rendre l’annulation durable.

### C-6 — Un bilan peut se détacher de toute fiche patient — **moyen**

Saisir un nom en texte libre efface l’identifiant patient (`app/(app)/bilans/nouveau/NouveauBilanForm.tsx:105-115`). Le bilan disparaît alors de la fiche du patient, perd date de naissance et âge, et aucune réconciliation n’est proposée ensuite. C’est le risque d’attribution listé plus haut, atteignable en deux frappes.

### C-7 — Perte de saisie en séance — **élevé**

Aucune sauvegarde automatique, aucun garde-fou à la fermeture d’onglet : recherche de `beforeunload`, `autosave`, `setInterval` et `localStorage` dans `app/`, `lib/` et `components/` → aucune occurrence. L’indicateur « Modifications non enregistrées » est purement passif.

### C-8 — Supprimer une section de trame orpheline le texte des bilans existants — **moyen**

Le contenu reste dans le jsonb mais n’est plus jamais affiché, ni dans l’éditeur ni à l’aperçu. L’avertissement affiché à l’utilisateur ne couvre que le renommage et le déplacement, pas la suppression.

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
