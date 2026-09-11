# Matrice de tests

| Domaine | Scénario | Niveau | Priorité | Données | Preuve | Statut |
|---|---|---|---|---|---|---|
| Autorisation | Accès à un patient d’une autre organisation refusé | intégration/API | critique | synthétiques | À renseigner | à faire |
| Dossier | Brouillon et contenu validé restent distingués | intégration/UI | haute | synthétiques | À renseigner | à faire |
| Responsable légal | Droits distincts selon la relation confirmée | intégration | haute | synthétiques | À renseigner | à faire |
| Documents | Lien révoqué inutilisable | intégration | haute | synthétiques | À renseigner | à faire |
| Agenda | Double traitement sans double mutation | intégration | moyenne | synthétiques | À renseigner | à faire |
| IA | Le contenu généré exige une validation explicite | intégration/UI | critique | synthétiques | À renseigner | à faire |
| IA | Injection de prompt et fuite inter-contexte refusées | sécurité | critique | synthétiques | À renseigner | à faire |
| Logs | Aucun secret ni contenu clinique dans les traces | sécurité | haute | synthétiques | À renseigner | à faire |

Adapter la matrice aux fonctionnalités réellement présentes. Un test ne doit jamais introduire de donnée réelle.

