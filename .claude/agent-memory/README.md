# Mémoire projet des agents

Chaque sous-dossier correspond au champ `memory: project` d’un agent. Son `MEMORY.md` contient uniquement des apprentissages stables, utiles à de futures sessions et propres à ce projet.

## À conserver

- conventions ou préférences confirmées ;
- particularités métier vérifiées ;
- emplacements difficiles à retrouver ;
- pièges récurrents et méthode de vérification ;
- liens vers les décisions et ADR de référence.

## À exclure

- données réelles de patient ou de professionnel ;
- secrets, jetons et valeurs de configuration ;
- contenu clinique ;
- copie du code ou de documents déjà faciles à retrouver ;
- hypothèse non confirmée présentée comme un fait.

Les décisions partagées restent dans `docs/context/DECISIONS.md` et les ADR. Les fichiers mémoire doivent les référencer plutôt que les dupliquer.

