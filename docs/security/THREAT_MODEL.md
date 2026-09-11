# Modèle de menaces

Renseigné le 2026-09-11 par `/initialiser-projet`. Chaque entrée du registre est démontrée par le code, sauf mention explicite d’hypothèse. Ce document ne conclut pas sur la conformité.

## Actifs principaux

- identité et moyens d’accès ;
- dossiers, notes et documents ;
- relations patient–professionnel–responsable légal ;
- données de facturation ;
- secrets et configurations ;
- journaux et sauvegardes ;
- prompts, sorties et traces d’IA.

## Frontières de confiance

- navigateur et API ;
- services internes ;
- base, stockage et files de travaux ;
- fournisseurs externes ;
- environnements de prévisualisation et production ;
- outils d’administration et de support.

**Frontière réelle de ce produit :** elle passe au niveau de PostgreSQL, pas du processus Next.js. Aucune clé `service_role` n’existe dans le code : le serveur n’a jamais plus d’autorité que l’utilisateur connecté. Voir `docs/architecture/ARCHITECTURE.md`.

## Scénarios prioritaires

1. Un utilisateur modifie un identifiant et accède au patient d’un autre cabinet.
2. Un rôle administratif accède à une note clinique non nécessaire.
3. Un lien ou fichier partagé reste accessible après révocation.
4. Une donnée clinique apparaît dans un log, une erreur, une URL ou un outil tiers.
5. Une relance asynchrone exécute deux fois une mutation sensible.
6. Une injection de prompt pousse une fonction IA à révéler un autre contexte.
7. Une prévisualisation Vercel utilise par erreur des secrets ou données de production.
8. Un compte compromis exporte massivement des dossiers sans alerte.

**Confrontation aux faits du dépôt :**

| # | Verdict |
|---|---|
| 1 | **Bloqué.** RLS stricte sur toutes les tables et sur le Storage. Les Server Actions filtrent par `id` seul, mais PostgreSQL tranche. |
| 2 | **Bloqué pour les données cliniques.** `is_admin()` n’est référencée que par 3 politiques, toutes sur `subscriptions`. Aucun bilan, aucune fiche patient n’est accessible à un administrateur. **Mais** il lit l’e-mail et le statut de tous les comptes. |
| 3 | **Partiellement couvert.** URL signées à durée courte (300 s / 120 s), bucket privé. Mais un PDF imprimé ou un CSV exporté échappe à toute révocation. |
| 4 | **Aucun log n’existe** — donc aucune fuite par log. En revanche, une donnée clinique **sort vers trois tiers** : API Anthropic, service de reconnaissance vocale du navigateur, messagerie personnelle via `mailto:`. Voir `DATA_FLOWS.md`. |
| 5 | **Déjà survenu.** Le commentaire de `lib/supabase/middleware.ts:46-50` documente des bilans « créés en rafale » par rejeu de redirection 307. Le correctif retenu — ne plus rediriger les mutations — est ce qui ouvre MEN-001. |
| 6 | **Surface réelle.** `sectionTitle` et `rawText` sont tous deux fournis par l’appelant et concaténés dans le message. Le prompt système contraint le style, pas le sujet. Aucun autre contexte n’est accessible au modèle : l’action ne lit pas la base. |
| 7 | **Inconnu, et déterminant.** Il n’est pas établi si `ANTHROPIC_API_KEY` est définie sur les environnements de prévisualisation. |
| 8 | **Non détectable.** Aucune journalisation, aucun quota, aucune alerte. Un export massif est indiscernable d’un usage normal. |

## Registre

| ID | Menace | Probabilité | Impact | Contrôles existants | Action | Responsable | Statut |
|---|---|---|---|---|---|---|---|
| **MEN-001** | **Relais LLM non authentifié — CORRIGÉ le 2026-09-11.** `reformulateText` ne vérifiait aucune session ; le proxy ne redirige pas les requêtes mutatives ; et le garde CSRF de Next 16.2.9 laisse passer une requête sans en-tête `Origin` avec un simple avertissement (`node_modules/next/dist/server/app-render/action-handler.js:398-402`). **Vérifié en exécution** : sur le serveur de production local, un POST sans cookie et sans `Origin` atteignait bien l’action (HTTP 200). **Vérifié également** : l’identifiant d’action est servi publiquement dans un chunk sous `/_next/static/`, que le proxy exclut de son matcher — récupérable sans session (HTTP 200). Ce n’était donc pas de l’obscurité, mais une absence de contrôle. | **Élevée** (l’identifiant est publiquement récupérable) | **Critique** — dépense non plafonnée, LLM généraliste facturé au compte, aucune trace | **Contrôle de session en tête de l’action** (`app/(app)/bilans/ai-actions.ts`), placé avant toute autre vérification pour ne rien révéler de la configuration à un appelant non authentifié | **Fait.** Preuve : le même POST non authentifié renvoie désormais `{"error":"Session expirée…"}` et **l’API Anthropic n’est pas appelée**. Reste ouvert : `MEN-003`, le contrôle d’abonnement, qui est une seconde décision | — | **corrigé** |
| **MEN-002** | **Table future sans politique RLS.** La clé anonyme est dans le bundle navigateur et PostgREST expose toute table de `public`. Une table sans RLS serait en lecture-écriture pour tout Internet, sans aucune défense en profondeur. `migration_004.sql` active la RLS **avant** de définir ses politiques. La CI ne couvre ni `supabase/**` ni `app/**`. | Moyenne | **Critique** | Convention, non outillée | Bloc SQL idempotent en fin de chaque migration, levant une exception si une table de `public` n’a pas la RLS ou aucune politique | À désigner | **ouvert** |
| **MEN-003** | **Contournement de l’abonnement.** `getAccess()` n’est appelé que dans 3 pages, dans aucune Server Action. Un compte expiré ou résilié conserve l’accès complet en écriture. | Élevée | Moyen (commercial, non confidentiel) | Aucun | Même point d’insertion que MEN-001 | À désigner | **ouvert** |
| **MEN-004** | **Corps administrateur auto-extensible.** `sub admin update` autorise la mise à jour de **toute colonne de toute ligne** de `subscriptions`. La Server Action n’écrit que 3 champs et revérifie le rôle, mais elle **n’est pas le point d’application** : la même session peut écrire directement via PostgREST et accorder `is_admin` à n’importe quel compte. Aucune trace n’en subsiste. | Faible | Élevé | RLS bornée au seul rôle admin | Restreindre la politique aux colonnes de gestion d’abonnement, sur le modèle de `sub self cancel` qui, lui, est correctement borné | À désigner | **ouvert** |
| **MEN-005** | **Privilège adossé à une adresse e-mail publiée.** L’adresse figure **16 fois dans 4 fichiers versionnés et poussés**, dont `lib/data.ts:75` (code applicatif) et `app/(app)/layout.tsx:71` (affichée à tout compte bloqué). Le trigger d’inscription accorde `is_admin` sur la seule comparaison de cet e-mail — **un attribut fourni par la personne qui s’inscrit**. *Hypothèse à vérifier* : si aucune ligne ne porte cette adresse sur un environnement donné (prévisualisation, base restaurée, nouveau projet, ou compte supprimé par `delete_my_account()` qui **libère l’adresse**) **et** que la confirmation d’e-mail est désactivée — hypothèse que le code envisage explicitement — une simple inscription produit un compte administrateur. | À déterminer : dépend de la visibilité du dépôt et du réglage de confirmation d’e-mail, **tous deux hors dépôt** | **Critique si les deux conditions sont réunies** | Aucun | 1. Vérifier la visibilité du dépôt. 2. Sortir l’identité de l’admin du code ; amorcer le premier administrateur par un `UPDATE` manuel sur l’`user_id`. 3. Ne jamais dériver un privilège d’un attribut fourni à l’inscription. 4. Remplacer le `mailto:` par une adresse de fonction | À désigner | **ouvert** |
| **MEN-006** | **Repli qui échoue en mode ouvert.** Si la lecture de `subscriptions` échoue pour quelque raison que ce soit, `lib/data.ts:72-80` renvoie `active: true` **pour tous les comptes**. | Faible | Moyen | Aucun | Restreindre le repli au seul code « relation absente », ou l’inverser : refuser et journaliser | À désigner | **ouvert** |
| **MEN-007** | **Échec d’enregistrement affiché comme un succès.** `saveBilan` jette l’erreur et retourne `void` ; le client enchaîne `setDirty(false); setSavedAt(true)` sans condition. Un bilan non enregistré affiche « enregistré » et perd son indicateur de modification. Motif répété sur 18 des 20 mutations. | **Élevée** | Élevé — perte de contenu clinique | Aucun | Faire retourner `{ error? }` aux mutations et brancher l’interface. **Le motif correct existe déjà** dans `login/actions.ts` et `ai-actions.ts` | À désigner | **ouvert** |
| **MEN-008** | **Perte silencieuse sur repli de schéma.** Sur colonne manquante, les actions rejouent l’écriture sans le champ : `guardian` et `dossier` abandonnés pour un patient, `tests` — les cotations — pour un bilan. L’interface annonce le succès. | Moyenne | Élevé | Le repli lui-même, qui est la cause | Conserver le repli mais le rendre **visible** : retourner un avertissement et l’afficher | À désigner | **ouvert** |
| **MEN-009** | **Un compte rendu de bilan est versionné dans Git.** `CR bilan psychomoteur.pdf`, 8 pages, 356 Ko, est suivi par Git et **déjà présent sur `origin/main`**, depuis le commit `fb8a44f`. Le retirer de l’index ne suffirait pas : l’historique le conserve. Le fichier n’a **pas** été ouvert lors de cette analyse. | Certaine (le fait est établi) | **Critique si le PDF contient des données réelles** | Aucun | **Décision du propriétaire du dépôt**, pas d’un agent : vérifier le contenu et la visibilité du dépôt, puis arbitrer la réécriture d’historique et son coût | Propriétaire du dépôt | **ouvert** |
| **MEN-010** | **Audio clinique vers un service tiers du navigateur.** L’API Web Speech ne garantit pas une reconnaissance locale ; selon le navigateur, l’audio est transmis aux serveurs de son fournisseur. L’utilisateur n’en est pas informé. | À déterminer selon le navigateur | Élevé | Aucun | Vérifier la spécification W3C et la documentation de chaque navigateur ciblé ; informer l’utilisateur ou retirer la fonction | DPO + décision produit | **ouvert** |
| **MEN-011** | **Contenu clinique vers l’API Anthropic sans encadrement documenté.** Aucun identifiant direct n’est transmis — abstention délibérée à préserver — mais le texte libre contient couramment des identifiants indirects, et la consigne demande de **conserver** les données factuelles. Ni rétention, ni région, ni accord de sous-traitance dans le dépôt. Aucune provenance conservée en base. | Certaine à chaque usage | Élevé | Prompt système interdisant l’invention ; abstention de transmettre l’identité | Contractualiser et documenter ; marquer la provenance en base | DPO + `responsable-ia-clinique` | **ouvert** |
| **MEN-012** | **Collision de numéros de facture — largement corrigé le 2026-09-11 par `supabase/migration_010.sql`.** Un compteur par compte et par portée (`invoice_counters`, RLS `auth.uid() = user_id`) réserve le rang suivant de façon **atomique** via un upsert qui verrouille la ligne ; `next_invoice_seq()` est `security invoker`, refuse explicitement un appel sans session, et son exécution est retirée à `public`. **Risque résiduel** : il n’existe toujours aucun index unique sur `invoices(user_id, invoice_number)` — un numéro saisi à la main peut encore doubler un numéro réservé. | Faible | Moyen (comptable et fiscal) | **Compteur atomique en base** | Ajouter `create unique index … on public.invoices(user_id, invoice_number) where invoice_number is not null` pour fermer le cas de la saisie manuelle | À désigner | **largement traité** |
| **MEN-013** | **Aucune journalisation.** Ni accès, ni export, ni action d’administration, ni appel IA. Zéro `console.*` dans le code applicatif, aucune table d’audit. Un export massif est indiscernable d’un usage normal. | Certaine | Élevé | Aucun | Journaliser dans les actions qui détectent déjà une erreur — **codes et identifiants uniquement, jamais de contenu clinique** | À désigner | **ouvert** |
| **MEN-014** | **La suppression d’un patient laisse le bilan intégral.** `on delete set null` sur `patient_id`, tandis que `patient_name`, `content` et `tests` subsistent. Ce n’est pas « un nom qui reste » : c’est le bilan entier, nom compris, toujours listé et ouvrable. L’interface ne le dit pas. | Certaine | Élevé | Aucun | Distinguer deux opérations nommées — archiver et effacer — et trancher le sort du bilan. Voir `docs/context/OPEN_QUESTIONS.md` | DPO + professionnel | **ouvert** |
| **MEN-015** | **Effacement de compte incomplet.** La purge du bucket est plafonnée à 1000 fichiers ; au-delà, le reliquat devient orphelin. Ni le `remove` ni le `rpc` ne sont testés : en cas d’échec, l’utilisateur est déconnecté exactement comme en cas de succès et croira ses données effacées. Aucune preuve de suppression n’est produite. | Faible | Élevé | Confirmation par saisie de « SUPPRIMER » | Paginer la purge, contrôler les erreurs, produire une trace | À désigner | **ouvert** |

## Trois corrections prioritaires

1. **MEN-001 et MEN-003** — porter le contrôle d’accès au niveau des Server Actions. Un garde commun en tête de chaque `actions.ts`, et `auth.getUser()` en tête de `reformulateText`. C’est la correction au meilleur rapport effort/impact du dépôt.
2. **MEN-009 et MEN-005** — trancher le sort du PDF versionné et sortir l’identité de l’administrateur du code. Ces deux points appellent une décision du propriétaire, pas une correction technique unilatérale.
3. **MEN-007 et MEN-008** — cesser d’afficher un succès sur un échec. Le motif correct existe déjà dans le dépôt ; il s’agit de l’appliquer aux mutations.

Aucune de ces corrections ne touche à la RLS, qui tient correctement l’isolation entre comptes.
