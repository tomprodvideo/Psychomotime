# Glossaire métier

Ce glossaire doit être revu par un psychomotricien en exercice. Les définitions servent à harmoniser le produit et ne constituent pas des définitions réglementaires.

## Termes du cadre

| Terme | Définition de travail | Statut |
|---|---|---|
| Anamnèse | Recueil structuré d’informations utiles à la compréhension de la situation et de la demande. | À valider |
| Bilan psychomoteur | Démarche d’évaluation conduite par le professionnel, pouvant comprendre entretien, observations, épreuves, analyse et restitution. | À valider |
| Compte rendu | Document rédigé et validé par le professionnel à partir des éléments du bilan ou du suivi. | À valider |
| Séance | Rencontre planifiée ou réalisée, avec statut, participants et notes éventuelles. | **Sans objet dans le produit** — aucune entité séance n’existe. |
| Objectif thérapeutique | Objectif individualisé défini et réévalué par le professionnel. | **Sans objet dans le produit** — seul existe un champ texte libre « Accompagnement et objectifs » sur la fiche patient. |
| Note clinique | Contenu professionnel sensible lié à l’évaluation ou au suivi. | À valider |
| Responsable légal | Personne dont le lien et les droits vis-à-vis du patient doivent être établis et historisés. | **À valider — écart constaté** : voir ci-dessous. |
| Brouillon IA | Contenu généré non validé, modifiable et distingué d’un document professionnel final. | Confirmé comme principe produit — **mais non implémenté** : voir `docs/clinical/CLINICAL_SAFETY.md` § C-5. |

## Termes réellement employés dans le produit

Relevés dans le code au 2026-09-11. Ils doivent être confrontés à la pratique avant d’être figés.

| Terme | Sens dans le produit | Statut |
|---|---|---|
| **Bilan sensoriel** | Second type de bilan, dont la trame est calée sur le Profil Sensoriel de Dunn 2. Trame, modèles et réglages distincts du bilan psychomoteur. | À valider |
| **Trame** | Liste ordonnée et éditable des sections d’un bilan, propre à chaque type. Stockée dans `settings.profile`, pas en table. | À valider |
| **Modèle** | Fragment de texte réutilisable, rangé en dossiers, insérable dans un paragraphe. Anciennement « Modèle d’adaptations ». | À valider |
| **Brouillon / Finalisé** | Les deux seuls statuts d’un bilan. **La bascule est réversible, non horodatée, et n’apparaît pas sur le document imprimé.** | **À trancher** — voir `Q-201` |
| **Note standard (NS)** | Échelle de cotation employée par certaines épreuves. Le produit la colore automatiquement selon des seuils figés dans le code. | **À valider — contradiction constatée**, voir `docs/clinical/CLINICAL_SAFETY.md` § C-2 |
| **Déviation standard (DS)** | Échelle employée par la courbe de Gauss imprimée. **Échelle distincte de la note standard** : les deux coexistent sur la même page. | À valider |
| **Zone de fragilité / Zone dite « pathologique »** | Vocabulaire de la légende d’interprétation imprimée dans le compte rendu. | **À trancher** — voir `Q-202` |
| **Faible / Très faible** | Vocabulaire de la courbe de Gauss, pour **les mêmes bandes** que ci-dessus. Deux vocabulaires cohabitent sur un même document. | **À trancher** — voir `Q-202` |
| **Rétrocession** | Part du revenu brut reversée, selon un taux paramétrable. Alternative au mode « loyer ». | Confirmé par le code |
| **URSSAF** | Montant estimé, calculé sur le revenu après rétrocession, selon un taux paramétrable. | Confirmé par le code |
| **PCO** | Case à cocher sur une facture. Le produit n’en documente ni le sens ni la conséquence. Vraisemblablement « Plateforme de Coordination et d’Orientation ». | **À confirmer** — qualification à trancher : donnée comptable ou information de santé |
| **Mode loyer** | Mode de charge alternatif : la rétrocession est nulle et un loyer mensuel est saisi à la place. | Confirmé par le code |

## Écarts de vocabulaire à arbitrer

- **« Tuteur / Parent » contre « Responsable légal ».** L’interface emploie « Tuteur / Parent », avec les liens « Parent, Mère, Père, Tuteur légal, Autre ». Le terme « Responsable légal » retenu par ce glossaire **n’apparaît nulle part dans le code**. « Tuteur » au sens strict désigne une mesure de protection judiciaire ; l’employer comme synonyme de parent est une approximation. **À valider par une psychomotricienne, et à harmoniser dans un sens ou dans l’autre.**
- **« Diagnostic ».** Champ de texte libre du dossier patient, distinct de « Hypothèse diagnostique ». Le psychomotricien ne pose pas de diagnostic médical. Si ce champ sert à recopier un diagnostic posé ailleurs, l’intitulé devrait le dire et mentionner la source. **À valider.**
- **« Enfant concerné ».** Mention figée dans l’en-tête de tout bilan imprimé, alors que l’un des instruments outillés couvre un groupe d’âge allant jusqu’à l’âge adulte. Un bilan de jeune adulte s’imprime avec cette mention. **À corriger ou à assumer.**
- **« Bilan psychomoteur » dans l’enveloppe d’un bilan sensoriel.** L’objet et le corps de l’e-mail pré-rempli, ainsi que le titre serveur par défaut, annoncent « Bilan psychomoteur » quel que soit le type. Le titre du document, lui, est correct.
- **« Séance de psychomotricité »** est le libellé de prestation par défaut d’une facture, y compris pour facturer un bilan. **À valider.**

Ajouter les termes propres aux outils, grilles ou parcours réellement retenus sans reproduire de contenu protégé sans autorisation.

**Point de vigilance sur cette dernière phrase :** les intitulés d’épreuves et les grilles de deux batteries éditées sous licence sont aujourd’hui recopiés en dur dans le code. Ce glossaire ne les reproduit pas. Voir `docs/clinical/CLINICAL_SAFETY.md`, section « Point de droit à instruire ».
