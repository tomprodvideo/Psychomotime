# Questions ouvertes

Renseigné le 2026-09-11 par `/initialiser-projet`. Chaque question porte sur un choix **déjà en vigueur dans le code mais jamais arbitré**. Aucune n’est tranchée à ce jour.

## Périmètre et produit

| ID | Question | Pourquoi elle compte | Options connues | Responsable | Échéance |
|---|---|---|---|---|---|
| Q-001 | Quel est le premier segment de cabinets ciblé ? | Influence organisations, rôles et tarification. Le code ne connaît **que** le praticien seul. | Individuel / partagé / structure | À renseigner | À renseigner |
| Q-002 | Quels modules forment la première version ? | Fixe le périmètre technique et d’audit. | 7 modules existent ; agenda, séances, objectifs, consentements et paiement sont absents | À renseigner | À renseigner |
| Q-003 | Le produit intégrera-t-il une IA en production ? | **Déjà répondu par le code : oui.** La reformulation de bilan appelle l’API Anthropic. La question devient : sous quel encadrement ? | Voir `Q-301` à `Q-303` | À renseigner | À renseigner |
| Q-004 | Quels pays et territoires sont ciblés ? | Influence les validations juridiques et métier. URSSAF, ADELI, SIRET et la rétrocession suggèrent la France, **sans que ce soit déclaré**. | France seule / francophonie | À renseigner | À renseigner |
| Q-005 | Le paiement sera-t-il implémenté, et quand ? | Les colonnes Stripe existent, **aucun code n’existe**. L’activation se fait à la main. Tant que c’est le cas, ces colonnes sont mortes et ne doivent pas figurer au registre des traitements. | Implémenter / retirer les colonnes / statu quo assumé | À renseigner | À renseigner |

## Modèle de données et organisation

| ID | Question | Pourquoi elle compte | Responsable |
|---|---|---|---|
| Q-101 | Le produit accueillera-t-il un jour un collaborateur, un remplaçant ou un cabinet ? | **La décision la plus coûteuse à différer.** Chaque politique RLS et chaque colonne de propriété sont écrites contre `user_id` ; rétrofitter une organisation impose de toutes les réécrire, plus une migration de données. | Produit |
| Q-102 | Un seul responsable légal par patient suffit-il ? | Il est aujourd’hui un objet jsonb unique, non partageable entre une fratrie, non typé, non daté, non historisé — et **jamais destinataire** d’un envoi. Garde alternée et double envoi sont inexprimables. À trancher avant d’accumuler des dossiers. | Produit + psychomotricienne |
| Q-103 | Le type de bilan doit-il devenir une colonne plutôt qu’une clé de jsonb ? | Aujourd’hui non indexable, non contraignable ; toute valeur inattendue retombe silencieusement sur `psychomoteur`. | Technique |
| Q-104 | Un document doit-il pouvoir être rattaché à un patient ? | La table `documents` ne porte aucun `patient_id` : une ordonnance scannée ne peut pas être classée dans le dossier concerné. | Produit |

## Pratique clinique — à soumettre à une psychomotricienne en exercice

Ces huit questions bloquent des choix de conception **déjà figés dans le code**. Elles sont détaillées dans `docs/clinical/WORKFLOWS.md`.

| ID | Question | Enjeu |
|---|---|---|
| Q-201 | Que doit signifier « finalisé » — verrouillage, horodatage, filigrane sur le PDF ? | Aujourd’hui : interrupteur réversible, bilan finalisé toujours modifiable, **statut invisible sur le document imprimé**. |
| Q-202 | Quels seuils et quel vocabulaire font foi dans un compte rendu diffusé ? | La légende imprimée **se contredit à la note 7** ; deux vocabulaires coexistent pour les mêmes bandes ; « zone dite “pathologique” » figure sur le document remis. |
| Q-203 | Un seul bloc de prose par domaine, ou des champs séparés observation / résultat / interprétation ? | **L’arbitrage le plus structurant du produit.** Tout le reste en dépend : IA, réutilisation, comparaison dans le temps. |
| Q-204 | L’absence de séance, d’objectif et d’agenda est-elle un périmètre assumé ? | Le produit outille l’évaluation, pas l’accompagnement. Question de feuille de route. |
| Q-205 | Les normes doivent-elles se lire sur l’âge à la date de passation ? Faut-il alerter si le groupe d’âge coché ne correspond pas ? | L’âge imprimé est aujourd’hui celui **du jour de consultation**, sur un document dont la lecture repose sur des normes par classe d’âge. |
| Q-206 | Les six instruments sans saisie chiffrée ont-ils besoin de champs de scores ? | Détermine si la section « Résultats chiffrés » doit devenir un vrai tableau de synthèse. |
| Q-207 | À qui s’adressent le compte rendu et la facture ? | Tous deux visent aujourd’hui le patient, jamais le responsable légal, y compris pour un mineur. |
| Q-208 | Faut-il une sauvegarde automatique de l’éditeur de bilan ? | Aucune n’existe, et aucun garde-fou à la fermeture : une passation saisie en séance peut être perdue intégralement. |

## Fonction IA et données

| ID | Question | Enjeu | Responsable |
|---|---|---|---|
| Q-301 | La reformulation doit-elle conserver les notes brutes et marquer sa provenance dans le dossier ? | Aujourd’hui le texte source est détruit à la première retouche et rien n’indique jamais qu’une section a été réécrite. Contredit la règle 5 de `CLAUDE.md`. | Produit + `responsable-ia-clinique` |
| Q-302 | Le modèle doit-il être instruit comme « psychomotricien(ne) diplômé(e) d’État », alors que le texte sort sous la signature du praticien ? | Endossement d’identité professionnelle par un outil de réécriture. | Psychomotricienne |
| Q-303 | La conclusion doit-elle rester reformulable comme les autres sections ? | C’est l’endroit où le raisonnement est le plus serré et le moins paraphrasable sans perte. | Psychomotricienne |
| Q-304 | Faut-il maintenir la dictée vocale ? | L’API du navigateur ne garantit pas une reconnaissance locale : de la parole clinique peut être transmise au fournisseur du navigateur, non contractualisé, **sans que l’utilisateur en soit informé**. | DPO + produit |
| Q-305 | Le modèle de repli économique doit-il être mis à jour ? | Le modèle employé, `claude-opus-4-8`, est valide et actuel. Mais le commentaire du code propose `claude-sonnet-4-6` comme repli : c’est la génération précédente, et `claude-sonnet-5` est à la fois plus récent et moins cher. | Technique |

## Protection des données — à faire trancher par un DPO ou un juriste

| ID | Question | Responsable |
|---|---|---|
| Q-401 | **Qui est responsable de traitement pour les données patients ?** Le produit est un SaaS destiné à des professionnels tiers, mais son modèle d’isolation est celui d’un outil mono-utilisateur. **Cette réponse commande tout le reste** : registre, contrats, documentation client, charge de réponse aux demandes de droits. | DPO ou juriste |
| Q-402 | Que doit signifier « supprimer un patient » ? Deux intentions incompatibles cohabitent derrière un seul bouton : retirer une personne de la patientèle active, et effacer ses données. Le code implémente la première tout en affichant le vocabulaire de la seconde — **le bilan intégral survit, nom compris**. | DPO + professionnelle |
| Q-403 | Durées de conservation, base active et archivage. **Aucune n’est implémentée, pour aucun traitement.** | DPO |
| Q-404 | Conservation des factures portant l’identité du patient après effacement du dossier : sur quelle base, quelle durée, quel régime d’accès ? | Expert-comptable + juriste |
| Q-405 | Qualification de `has_pco` et du libellé de prestation : information de santé ou donnée purement comptable ? | DPO |
| Q-406 | Qualification de la signature manuscrite numérisée du professionnel, stockée en base64. | DPO |
| Q-407 | Information et, le cas échéant, recueil d’accord pour la reformulation par un modèle tiers et pour la dictée vocale. | DPO |
| Q-408 | Modalités d’exercice des droits par le patient et le responsable légal en l’absence de portail, et articulation avec l’autorité parentale. | DPO |
| Q-409 | Une analyse d’impact est-elle requise, et sur quel périmètre ? Trois caractéristiques usuellement examinées sont réunies : données de santé, personnes mineures, recours à un modèle de langage tiers sur du contenu clinique. | DPO |
| Q-410 | Régime d’hébergement de données de santé applicable, et statut de chaque prestataire. | DPO ou juriste compétent |

## Sécurité et exploitation

| ID | Question | Responsable |
|---|---|---|
| Q-501 | **Le dépôt GitHub est-il public ou privé ?** Détermine l’ampleur de `MEN-005` et de `MEN-009`. Non déterminable depuis le dépôt local. **À vérifier en premier.** | Propriétaire du dépôt |
| Q-502 | **Que faire du compte rendu de bilan versionné dans Git ?** Le fichier est suivi et déjà poussé. Le retirer de l’index ne suffit pas. Arbitrage entre réécriture d’historique et son coût. | Propriétaire du dépôt |
| Q-503 | La confirmation d’e-mail est-elle activée sur chaque environnement Supabase ? Condition du scénario de prise de contrôle décrit en `MEN-005`. Le `README` suggère de la désactiver par commodité. | Exploitant |
| Q-504 | `ANTHROPIC_API_KEY` est-elle définie sur les environnements de prévisualisation ? Déterminant pour la gravité de `MEN-001`. | Exploitant |
| Q-505 | L’inscription doit-elle rester libre en self-service sur une application de données de santé ? Aujourd’hui : toute adresse, mot de passe à 6 caractères minimum, 7 jours d’essai automatiques. | Produit |
| Q-506 | Comment connaître l’état réel du schéma de production ? Les replis silencieux sur colonne manquante **masquent** la dérive au lieu de la révéler, et ne pourront être retirés qu’une fois un journal de migrations en place. | Technique |
| Q-507 | **Quelle horloge fait foi pour « la date du jour » ?** Celle du CABINET — `practices.timezone`, défaut `Europe/Paris` —, appliquée dans le code côté application comme côté base. **Côté application, corrigé et gardé le 2026-09-14** : un jour se calcule par `dateCivile(instant, fuseau du cabinet)`, un instant s'affiche par `frJourDe` ou par un formateur qui porte `timeZone`, un jour civil ne passe par aucun fuseau ; `lib/dates.architecture.test.mts` interdit sept formes du défaut dans `app/`, `lib/` et `components/`. La dette avait été déclarée soldée le même jour alors que le garde-fou n'en surveillait qu'une : années et mois comptables, journée de l'accueil, période d'une synthèse, heures de rendez-vous, jour d'une séance — jusque dans les dates de prestation d'une facture — restaient calculés dans le fuseau du processus ; corrigés. **Côté base, `0027` — appliquée en production le 2026-09-15, empreintes et droits vérifiés** : quatre écrits cliniques, pièce comptable, archivage, découpage, notes et règlements au jour du cabinet ; `realised_sessions`, `follow_up_facts` et `issue_attestation` dans son fuseau, calculé à l'écriture (`practices.effective_timezone`). **Mesuré le 2026-09-14 : la base de production tourne en `UTC`** ; `0026` y est appliquée. **Reste ouvert** : (1) les dates déjà enregistrées ne sont pas réécrites — un écrit, un règlement ou une note datés de la veille entre minuit et deux heures le restent ; les données actuelles sont déclarées fictives, aucune reprise n'est prévue, **à revoir avant toute donnée réelle** ; (2) PostgreSQL et le navigateur jugent un nom de fuseau chacun avec leur base : `'UTC+3'` ou `'+05:00'` passent en base et retombent sur le défaut à l'écran — sans effet tant qu'aucun écran ne permet de saisir ce fuseau ; (3) la page d'administration, rattachée à aucun cabinet, affiche ses dates dans le fuseau par défaut : choix d'affichage, réversible ; (4) le fuseau d'exécution des fonctions Vercel n'a pas été lu — aucune forme surveillée n'en dépend plus, mais le garde-fou ne voit ni des options de formateur passées par une variable, ni un instant rangé sous un nom qui ne finit pas par `_at`. | Technique + exploitant |

---

## Décisions utilisateur qui changeraient matériellement le produit

Ramenées à cinq. Les autres questions sont des précisions ou des vérifications ; celles-ci réorientent le produit.

1. **Q-501 et Q-502 — le dépôt et le PDF.** Seul point à traiter avant tout le reste, parce qu’il porte sur des données potentiellement réelles déjà publiées.
2. **Q-101 — un praticien ou plusieurs ?** Décision d’architecture la plus coûteuse à différer.
3. **Q-203 — un bloc de prose ou des champs séparés par registre ?** Commande la structure du bilan, donc de l’IA, de la réutilisation et du suivi dans le temps.
4. **Q-401 — qui est responsable de traitement ?** Commande tout le volet protection des données.
5. **Q-204 — évaluation seule, ou accompagnement aussi ?** Détermine si séances, objectifs et agenda entrent en feuille de route.
