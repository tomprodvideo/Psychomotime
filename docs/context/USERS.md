# Utilisateurs et acteurs

Dernière mise à jour : 2026-09-11, par `/initialiser-projet`.
Ne conserver ici que les profils confirmés pour le produit.

## Modèle d’acteurs réellement implémenté

Le locataire du système est **le compte utilisateur**, pas le cabinet : toutes les tables portent un `user_id` référençant `auth.users`, et les politiques RLS s’écrivent `auth.uid() = user_id` (`supabase/schema.sql`). **Il n’existe aucune notion d’organisation, de cabinet ni de partage entre praticiens.**

Deux rôles seulement existent dans le système, plus le visiteur non authentifié :

| Rôle | Existence démontrée | Portée |
|---|---|---|
| Utilisateur authentifié (psychomotricien) | `auth.users` + RLS par `user_id` | Ses propres données, exclusivement. |
| Super-administrateur | `subscriptions.is_admin`, fonction `public.is_admin()` (`supabase/migration_004.sql`) | Gestion des abonnements. Portée exacte détaillée dans `docs/security/DATA_FLOWS.md`. |
| Visiteur non authentifié | — | Page de connexion uniquement (`lib/supabase/middleware.ts`). |

## Psychomotricien titulaire

- **Confirmé** : c’est l’utilisateur unique et le propriétaire de toutes ses données.
- Objectifs démontrés par le produit : tenir sa comptabilité libérale, rédiger et exporter ses bilans, conserver ses dossiers patients et ses documents.
- Droits : lecture et écriture pleines sur ses propres enregistrements ; aucun accès aux données d’un autre compte.
- Points de friction : à renseigner par entretien. Le dépôt montre des indices de charge de saisie (dictée vocale, reformulation IA, trames et modèles réutilisables) mais ne prouve pas quelle friction ils visent.

## Collaborateur, remplaçant ou associé

- **Hors périmètre actuel — confirmé par l’absence de modèle.** Aucune table d’organisation, aucun partage, aucune délégation.
- Conséquence : introduire ce profil est une refonte du modèle d’isolation, pas un ajout. Voir `Q-101` dans `OPEN_QUESTIONS.md`.

## Personnel administratif

- **Hors périmètre actuel — confirmé.** Aucun rôle intermédiaire n’existe : un compte voit tout son contenu, y compris les notes cliniques. Il n’y a pas de séparation possible entre accès administratif et accès clinique.

## Patient

- **Le patient n’est pas un utilisateur.** Il est une personne concernée dont les données sont enregistrées par le professionnel (`public.patients`).
- Aucun portail, aucun compte, aucun accès direct. Aucune action possible de sa part dans le produit.

## Responsable légal

- **Présent comme donnée, absent comme acteur.** Il est stocké dans le jsonb `patients.guardian` (`supabase/migration_006.sql`) : relation, nom, prénom, téléphone, e-mail, adresse.
- Il n’a ni compte, ni droit, ni accès. Le lien d’autorité n’est ni typé, ni daté, ni historisé.
- Le kit demande de modéliser patient et responsable légal comme des concepts distincts. Ce n’est pas le cas aujourd’hui : voir l’écart correspondant dans `docs/clinical/WORKFLOWS.md` et `Q-102`.

## Interlocuteur externe

- **Aucun.** Prescripteur, autre professionnel, établissement, école ou organisme : aucune entité, aucun flux d’échange, aucun partage sortant dans le dépôt. Le seul canal de transmission est l’impression ou l’export PDF, réalisé par le professionnel lui-même hors du système.

## Super-administrateur

- **Confirmé, avec une réserve.** Le rôle est attribué par une adresse e-mail codée en dur dans `supabase/migration_004.sql`. Ce point est traité dans `docs/security/THREAT_MODEL.md`.
