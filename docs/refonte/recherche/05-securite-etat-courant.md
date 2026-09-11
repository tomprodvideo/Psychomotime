# Sécurité — état courant avant refonte

**Date :** 2026-09-11 · **Mode :** lecture seule · **Base :** `main` @ `d8af516`
**Méthode :** lecture de code, exécution de `npm test` et `npm audit`, une requête de
métadonnée publique GitHub. Aucun test d'intrusion, aucune donnée patient lue.

---

## 0. Constat préalable qui reclasse le reste

`Q-501` — « le dépôt GitHub est-il public ou privé ? » — était posé comme non déterminable.
**Il est déterminable, et la réponse est : public.**

```
curl -s https://api.github.com/repos/tomprodvideo/Psychomotime
→ HTTP 200, "private": false
```

Un dépôt privé renverrait 404 sans authentification. Deux constats changent de gravité
(B-1 et B-9) ; le reste du rapport en est indépendant.

---

## 1. Autorisation — inventaire exhaustif des Server Actions

21 actions dans 7 fichiers. **Toutes sont des endpoints HTTP atteignables sans passer par
la page.** Une seule route handler existe (`app/facture/[token]/pdf/route.ts`), publique
par conception.

> **12 actions sur 21 sans contrôle de session explicite.
> 21 sur 21 sans contrôle d'abonnement.
> 0 sur 21 avec un filtre `user_id` sur la mutation elle-même.**

Précision, pour ne pas surévaluer : l'absence de contrôle de session **n'ouvre pas d'accès
horizontal**. Sans cookie, `auth.uid()` est `NULL` et la RLS refuse tout. Les conséquences
réelles sont l'échec silencieux, le contournement d'abonnement, et `sendInvoiceEmail` qui
émet un jeton et un e-mail sans garde applicative.

| Action exemplaire | Pourquoi |
|---|---|
| `saveInvoice` — `comptabilite/actions.ts:154` | Session vérifiée, **appartenance du patient revérifiée** avant d'écrire la référence (l.182-199), erreurs distinguées (l.279-298). C'est le modèle à généraliser. |

---

## 2. RLS — la propriété la plus solide du produit

**Aucune table sans RLS. Aucune table sans politique.** 9 tables plus `storage.objects`.

La politique `sub self cancel` (`migration_005.sql:11-16`) est remarquablement écrite : son
`with check` impose simultanément `status='canceled'`, `manual_override=false` et
`is_admin=false`. Auto-activation et auto-promotion impossibles au niveau base.

### Fonctions `security definer` — bornage

| Fonction | Bornage | Verdict |
|---|---|---|
| `handle_new_user()` | trigger, `search_path` figé | ⚠️ borné, **mais accorde `is_admin` sur comparaison d'e-mail** |
| `is_admin()` | aucun paramètre, `auth.uid()` seul | ✅ |
| `delete_my_account()` | `where id = auth.uid()`, `revoke public` + `grant authenticated` | ✅ |
| `invoice_by_token(text)` | **seule surface `anon`** : longueur ≥ 20, index unique → ≤ 1 ligne, expiration, liste blanche `jsonb_build_object`, **`p.user_id = i.user_id`**, `search_path` figé, aucun SQL dynamique | ✅ bornée |
| `next_invoice_seq(text,int)` | **`security invoker`**, refus explicite si `auth.uid()` NULL | ✅ bon choix |

### Divergences schéma ↔ migrations

- `schema.sql` **ne décrit que 5 tables sur 9**. Ce n'est pas le schéma courant.
- `migrations_en_attente.sql` annonce « 004 à 007 » ; **008 à 013 en sont absentes**.
- Aucun mécanisme ne dit ce qui est réellement appliqué. Le code compense par des replis
  sur colonne manquante (`PGRST204`/`42703`).

---

## 3. Le lien public de facture

| Propriété | État |
|---|---|
| Entropie | ✅ **256 bits** — `randomBytes(32).toString("base64url")` |
| Stockage | ❌ **En clair** — `migration_011.sql:11` |
| Expiration | ⚠️ 90 j, **mais `NULL` = éternel** |
| Révocation | ❌ **Inexistante** — aucun chemin de code ne remet le jeton à `NULL` |
| Rotation | ❌ le jeton valide est **réutilisé** à chaque renvoi |
| Rate limiting | ❌ **Aucun**, nulle part dans le produit |
| Indexation | ✅ `noindex` + `X-Robots-Tag` |
| Cache | ⚠️ **Asymétrique** : PDF `private, no-store` ; **page HTML sans en-tête explicite** |
| Referrer | ⚠️ aucune politique ; le jeton est dans l'URL et la page charge une image distante |
| Projection | ✅ champ par champ, des deux côtés |

### L'invariant « aucune donnée interne n'atteint le document public »

Deux barrières existent — la liste blanche SQL (`jsonb_build_object` explicite) et
`toPrintable` en TypeScript, qui reconstruit champ par champ avec l'étalement `...`
proscrit et le motif documenté. Rétrocession, URSSAF, net, encaissé, notes, `user_id` et
`share_token` sont **absents du chemin de code**, pas masqués à l'affichage.

**Le mécanisme est testé — mais pas là où il faut.** `npm test` : 27 tests, 27 passés, dont
deux visent explicitement l'invariant et sont rigoureux (clés, valeurs, **et forme formatée
en euros**).

**La faille de couverture, précise :**

```ts
// app/facture/[token]/page.tsx:26-32
const { data } = await supabase.rpc("invoice_by_token", { p_token: token });
const shared = data as SharedInvoice;      // ← cast non vérifié
const doc = buildInvoiceDocument(shared);
```

**Le rendu public n'appelle jamais `toPrintable`.** Il caste le retour SQL. Sur le chemin
anonyme, **seule la liste blanche SQL protège**. Or le test compare `toPrintable` à une
**transcription manuelle** de ce que le SQL est supposé renvoyer : **élargir la liste SQL
seule ne fait échouer aucun test.** Le risque est avéré, pas théorique — la migration 012 a
dû corriger après coup une jointure non cloisonnée sur cette même fonction.

Reste : `i.lines` est renvoyé tel quel par la base, donc avec `catalog_id`. `toPrintable`
le retire, le rendu public ne passe pas par lui — **`catalog_id` est donc présent dans la
réponse brute servie à `anon`**. Impact faible, remédiation proposée en commentaire non appliquée.

---

## 4. Appel IA

| Question | Réponse |
|---|---|
| Données envoyées | Titre de section + **contenu libre de la section** |
| Identité exclue ? | ⚠️ par **signature étroite + discipline du site d'appel**, pas par un filtre |
| Notes = donnée ou instruction ? | ❌ **comme instruction** — concaténation directe, sans délimiteur ni neutralisation |
| Contrôle de session | ✅ en tête, avant toute lecture de configuration |
| Contrôle d'abonnement | ❌ |
| Rate limiting | ❌ — seul le `RateLimitError` **du fournisseur** est capté |
| Erreur fournisseur masquée ? | ❌ **message brut renvoyé au navigateur** |

---

## 5. Fichiers, secrets, entrées

**Storage — le module le mieux conçu.** Bucket privé, `file_size_limit` appliqué côté
serveur, chemin `<user_id>/<uuid>.<ext>` avec nom d'origine anonymisé, autorité réelle =
politique `(storage.foldername(name))[1] = auth.uid()::text`, URL signées 120–300 s.
**Faiblesse : aucun `allowed_mime_types`** — l'attribut `accept` est cosmétique.

**Secrets — aucun secret versionné, confirmé.** Aucun fichier d'environnement suivi ;
aucun motif de clé sur les fichiers suivis ; `service_role` n'apparaît que dans la prose
documentaire ; aucune variable secrète préfixée `NEXT_PUBLIC_*`.

**Entrées.** Aucune injection SQL (PostgREST paramétré partout). Aucun
`dangerouslySetInnerHTML`, `innerHTML`, `eval`. Validation excellente sur les lignes de
facture (montant posté par le client **ignoré**, recalculé serveur, testé) ; **absente
ailleurs** : `content`/`tests` des bilans sont du JSON avalé sans schéma, `status` accepté
du client sans relecture en base. **Aucune en-tête de sécurité** : ni CSP, ni HSTS, ni
X-Frame-Options, ni Referrer-Policy.

---

## 6. Dépendances — `npm audit`

```
moderate 2 · high 6 · critical 1 · total 9   (506 paquets)
```

Le détail de **`next` 16.2.9** est ce qui compte : trois advisories touchent directement
l'architecture de ce produit.

- **`GHSA-955p-x3mx-jcvp`** — divulgation non authentifiée des endpoints de Server
  Functions (`<16.2.11`). C'est l'ingrédient qui rend praticable l'appel direct des actions.
- **`GHSA-6gpp-xcg3-4w24`** — contournement de middleware/proxy en App Router (`<16.2.11`).
  **`proxy.ts` est le seul garde-fou de route du produit.**
- **`GHSA-2xp9-vwfh-vxw4`** — **critique**, RCE non authentifiée via l'API d'optimisation
  d'images avec AVIF (`<16.3.3`). Le code n'utilise que `<img>`, mais `/_next/image` reste
  actif par défaut.

Correctif : `next@16.3.5`. **Aucune dépendance abandonnée.**

---

## A. Propriétés à préserver impérativement

1. **La liste blanche SQL de `invoice_by_token`** — seul contrôle sur le chemin anonyme.
   Une réécriture qui « simplifie » en `to_jsonb(i)` publierait tout. Aucun test ne s'y opposerait.
2. **Le cloisonnement `p.user_id = i.user_id`** — corrige une fuite réelle. Une ligne de
   jointure, invisible en revue rapide, dans une fonction réécrite à chaque migration.
3. **RLS sur 9 tables sur 9 + stockage.** Toute nouvelle table sans politique est publique
   sur Internet : la clé anon est distribuée au navigateur.
4. **L'absence totale de clé `service_role`.** La tentation de l'introduire pour un webhook
   ou un cron supprimerait d'un coup la garantie centrale.
5. **La politique `sub self cancel`** — trois conditions conjointes au niveau base.
6. **`security invoker` sur `next_invoice_seq`** — le réflexe « ça échoue, passons en
   definer » la transformerait en primitive d'écriture inter-comptes.
7. **`saveInvoice` revérifie l'appartenance du patient** — complément applicatif du point 2.
8. **Le montant posté par le client est ignoré**, recalculé serveur, vérifié par contrainte SQL.
9. **Les 27 tests existants** — `CURRENT_STATE.md` affirme encore « aucun test automatisé » : périmé.
10. **Le stockage** — bucket privé, chemin épinglé, nom anonymisé, URL courtes.
11. **Le refus de faire transiter la santé par l'e-mail.**
12. **Aucun analytics, aucune télémétrie** — à préserver *en tant que propriété* quand la
    journalisation sera ajoutée.

## B. Vulnérabilités confirmées

| ID | Constat | Gravité |
|---|---|---|
| B-1 | **`CR bilan psychomoteur.pdf` versionné dans un dépôt GitHub public**, 356 Ko, présent dans l'arbre de `origin/main`. **Le fichier n'a pas été ouvert** : son contenu reste à qualifier par le propriétaire. Si réel : incident de données de santé, et un `git rm` ne suffit pas — le blob reste accessible par son SHA. | **critique** |
| B-2 | **L'abonnement n'est appliqué nulle part côté serveur.** Un layout ne s'exécute pas lors d'une Server Action. Plus direct : `DocumentsClient.tsx` appelle Supabase **depuis le navigateur**, et aucune politique RLS ne référence `subscriptions` — tout porteur d'une session garde un CRUD complet via l'API REST. | élevée |
| B-3 | **Next.js 16.2.9** : 1 critique, 6 hautes, dont deux visant l'architecture. | élevée |
| B-4 | **Le jeton de facture est un secret porteur, en clair, irrévocable, et diffusé au navigateur.** `select("*")` renvoie `share_token` et l'objet complet est passé en props à un composant client : **tous les jetons de toutes les factures sont sérialisés dans la charge RSC de `/comptabilite`** à chaque chargement. | élevée |
| B-5 | **Le message d'erreur brut du fournisseur IA atteint le navigateur.** Le bon motif (`SAVE_FAILED_MESSAGE`) existe déjà dans le dépôt. | moyenne |
| B-6 | **Les notes cliniques sont concaténées dans le prompt comme instruction**, sans délimiteur ni neutralisation, et la sortie remplace le champ sans validation ni provenance. | moyenne |
| B-7 | **Repli permissif : une erreur de lecture des abonnements accordait l'accès et le rôle admin.** Un incident de base devenait un octroi d'accès généralisé. — **corrigé le 2026-09-11**, `lib/data.ts` + `lib/subscription.ts`. | moyenne |
| B-8 | **18 mutations sur 21 signalent « enregistré » après un échec.** Sur du contenu clinique, c'est un défaut de fiabilité du dossier. | moyenne |
| B-9 | **Le privilège administrateur est adossé à une adresse e-mail en clair dans un dépôt public.** L'exploitation directe est peu probable, mais publier l'adresse **désigne la cible**, et l'inscription est ouverte. | moyenne |

## C. Manques structurels

1. **Aucun rate limiting, nulle part** — ni connexion, ni inscription, ni IA, ni e-mail, ni lien public.
2. **Aucune MFA ; mot de passe minimum 6 caractères**, aucune complexité, aucun corpus compromis.
3. **Aucune récupération de compte ni changement d'e-mail.** Mot de passe perdu = compte perdu.
4. **Aucune gestion de session** au-delà du défaut : pas de révocation, pas de liste
   d'appareils, **pas de ré-authentification avant `deleteAccount`**, qui détruit tout sur un simple POST.
5. **Aucune en-tête de sécurité.**
6. **Aucune journalisation.** Zéro `console.*`. **Aucune consultation d'une facture publique
   n'est traçable** : en cas de fuite, impossible de savoir si elle a été exploitée.
7. **Aucune révocation ni rotation du lien**, et aucune confirmation du destinataire avant envoi.
8. **Aucun contrôle MIME côté serveur** sur le bucket.
9. **Aucune validation de schéma** sur les JSON entrants, avec `bodySizeLimit` à 6 Mo.
10. **Aucune séparation d'environnements démontrable, aucun suivi de migrations.**
11. **Aucune CI de sécurité** : ni `npm audit`, ni `npm test`, ni `tsc`, ni lint sur `app/**`.
12. **Aucune durée de conservation, aucun export utilisateur, aucune trace de suppression.**

## D. Exigences pour la cible — critères testables

**D1 Autorisation.** D1.1 toute mutation vérifie la session avant toute autre opération —
test : appel sans cookie → erreur typée, jamais un succès. D1.2 filtre explicite sur le
propriétaire **en plus** de la RLS — test : RLS désactivée sur base de test, mutation sur
une ressource d'autrui → **zéro ligne**. D1.3 aucune table sans RLS ni politique — test de
catalogue en CI. D1.4 abonnement vérifié **côté base** — test : compte `inactive` refusé
sur un `INSERT` direct via l'API REST. D1.5 toute fonction `security definer` sans
paramètre, ou bornée par `auth.uid()`, ou documentée avec sa démonstration.

**D2 Lien public.** D2.1 **une seule source de vérité** pour la liste des champs publiables
— test : ajouter un champ au SQL seul **fait échouer la suite**. *C'est le test qui manque
aujourd'hui.* D2.2 jeton stocké haché. D2.3 le jeton ne sort jamais vers un composant
client. D2.4 expiration obligatoire, révocation immédiate — 404 sur la page **et** le PDF.
D2.5 invariant testé **par le chemin public**, avec valeurs sentinelles. D2.6 chaque
consultation journalisée sans donnée de santé.

**D3 Identité.** Mot de passe ≥ 12 caractères vérifié contre un corpus compromis ; MFA
disponible et exigible ; récupération et changement d'e-mail avec confirmation sur
l'ancienne **et** la nouvelle adresse ; ré-authentification avant suppression de compte et
changement d'identifiants ; sessions listables et révocables.

**D4 Abus.** Limitation de débit sur connexion, inscription, récupération, IA, e-mail et
lien public ; quota IA par compte et par période.

**D5 IA.** Liste blanche explicite des données transmises, identité structurée absente par
construction ; contenu utilisateur délimité et déclaré non exécutable ; aucun message
fournisseur au navigateur ; provenance générée conservée, distinguée et réversible durablement.

**D6 Plateforme.** Aucune haute ni critique en production (`npm audit --omit=dev
--audit-level=high` bloquant en CI) ; en-têtes de sécurité sur toutes les réponses ;
`Cache-Control: private, no-store` sur toute réponse portant une donnée personnelle ;
détection de secrets en CI, historique compris ; `allowed_mime_types` et validation du type
réel ; migrations suivies — une base neuve reconstruite depuis les seules migrations est
structurellement identique à la production ; journal d'audit **sans contenu clinique**.

---

## Limites de l'audit

**Non couvert :** le contenu de `CR bilan psychomoteur.pdf` n'a pas été ouvert (mandat) ;
**l'état réel de la base de production n'a pas été interrogé** — tout le chapitre RLS décrit
le SQL *versionné*, et les migrations étant appliquées à la main sans suivi, rien ne
démontre que la production corresponde ; aucune vérification en exécution des contournements
B-2 et B-3 ; advisories non rejouées ; ni la configuration Supabase Auth, ni les variables
Vercel, ni les environnements de prévisualisation ne sont observables depuis le dépôt.
Aucune analyse juridique.
