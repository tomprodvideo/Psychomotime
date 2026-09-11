# Flux de données

Documenter chaque flux réel avec le tableau suivant.

Renseigné le 2026-09-11 par `/initialiser-projet`, à partir du code. **FLUX-009 et FLUX-010 ajoutés le 2026-09-11** à la suite des commits `889517f` et `a090dc2`, qui introduisent un prestataire d'envoi d'e-mail et une page de consultation accessible sans compte. « Conservation » désigne ce que **le dépôt implémente** : la recherche exhaustive de `retention|purge|archiv|cron|anonymis|conservation` sur `app/`, `lib/`, `components/` et `supabase/` ne retourne **aucune occurrence**. Aucune durée de conservation n’est donc implémentée, pour aucun flux.

| ID | Source | Destination | Données | Finalité | Déclencheur | Chiffrement | Conservation | Sous-traitant | Validation |
|---|---|---|---|---|---|---|---|---|---|
| FLUX-001 | Navigateur | Rendu serveur du front | Session, formulaires, contenu clinique | Affichage et mutations | Navigation, Server Actions | HTTPS | Aucune implémentée | Hébergeur du front (Vercel probable, à confirmer) | **Le serveur du front traite le contenu clinique, il ne fait pas que router.** Journaux d’exécution à vérifier côté hébergeur. |
| FLUX-002 | Front (serveur et navigateur) | Supabase PostgreSQL | Toutes les tables : patients, bilans, factures, charges, réglages, abonnements, documents | Persistance | Chaque lecture/écriture | HTTPS + RLS | Aucune implémentée | Supabase | Clé **anonyme** uniquement, aucune `service_role` dans le code. L’isolation repose entièrement sur la RLS. |
| FLUX-003 | Navigateur | Supabase Storage, bucket privé `documents` | Fichiers déposés, contenu non contraint | Stockage documentaire | Dépôt, prévisualisation, téléchargement | HTTPS, bucket privé | Aucune implémentée | Supabase | Chemin `<user_id>/<uuid>.<ext>` : pas d’identifiant sensible dans le chemin. URL signées à durée courte (300 s en aperçu, 120 s en téléchargement). 10 Mo par fichier. |
| FLUX-004 | Server Action `reformulateText` | **API Anthropic** | **Le texte clinique intégral d’une section de bilan**, plus le titre de la section | Reformulation rédactionnelle | Clic sur « Reformuler » | HTTPS | Non maîtrisée par le produit | **Anthropic** | Détaillé ci-dessous. |
| FLUX-005 | Navigateur (micro) | **Service de reconnaissance vocale du navigateur** | **Parole clinique dictée**, concernant un patient identifié | Dictée | Clic sur « Dicter à la voix » | Dépend du navigateur | Inconnue | **Fournisseur du navigateur, non identifié ni contractualisé** | Détaillé ci-dessous. |
| FLUX-006 | Navigateur (`mailto:`) | Messagerie personnelle du praticien | **Objet : « Bilan psychomoteur - \<nom du patient\> »**, corps : nom, date, praticien | Transmission du compte rendu | Clic sur « Envoyer par email » | Dépend du client mail | Inconnue | **Fournisseur de messagerie du praticien, sous-traitant de fait non identifié** | Le nom du patient associé à la mention d’un bilan transite en clair dans un objet d’e-mail. Destinataire = `patients.email`, **jamais** celui du responsable légal. La pièce jointe n’est pas gérée. **Ce même mécanisme existe pour la facture** (`comptabilite/[id]/facture/InvoiceActions.tsx`), avec un objet de la forme « Facture \<n°\> - Séance de psychomotricité » : **la nature de l’acte y figure en clair**. Ce chemin subsiste en parallèle de FLUX-009, qui est plus protecteur. |
| FLUX-007 | Navigateur | Poste local (fichier CSV) | Prénom, nom, montants, périodes | Export comptable | Clic sur « Exporter » | Aucun | Hors système | Aucun | Fichier non chiffré, non tracé. |
| FLUX-008 | Navigateur | Imprimante ou PDF local | **Bilan intégral**, fiche patient, facture | Restitution | `window.print()` | Aucun | Hors système | Aucun | Aucune trace d’export. Le statut brouillon/finalisé n’apparaît pas sur le document. |
| FLUX-009 | Server Action `sendInvoiceEmail` | **API Resend**, puis boîte du patient | Adresse e-mail du patient, numéro de facture, nom du praticien, **URL de consultation porteuse d’un jeton d’accès**. Ni le nom du patient, ni la nature de l’acte, ni pièce jointe. | Mise à disposition de la facture | Bouton enveloppe d’une ligne, ou « Envoyer les factures » | HTTPS | Non maîtrisée | **Resend (États-Unis)** | Détaillé ci-dessous. |
| FLUX-010 | **Navigateur du patient, sans compte** | Rendu serveur du front, puis Supabase via `invoice_by_token` | **Nom du patient, adresse postale, nature de l’acte, montant**, coordonnées du praticien | Consultation et téléchargement de la facture | Ouverture du lien reçu | HTTPS | Aucune implémentée | Hébergeur du front, Supabase | Détaillé ci-dessous. |

## Flux à rechercher

- navigateur vers API ;
- API vers base et stockage de documents ;
- e-mail, SMS, calendrier et paiement ;
- logs, erreurs, analytics et support ;
- sauvegardes et restauration ;
- exports et partages ;
- fournisseur d’IA et éventuels sous-traitants.

**Résultat de cette recherche au 2026-09-11 :**

- **Aucun analytics, aucune télémétrie, aucun outil de suivi d’erreur, aucun `console.log`** dans `app/`, `lib/` et `components/`. Aucune donnée clinique ne part vers un outil de mesure d’audience ou de support. C’est un point fort.
- **Aucun paiement.** Les colonnes `stripe_customer_id` et `stripe_subscription_id` existent, mais il n’y a **aucune dépendance Stripe dans `package.json`**, aucun SDK, aucun webhook. **Stripe n’est pas un sous-traitant aujourd’hui et ne doit pas figurer au registre.**
- **E-mail : un prestataire existe désormais** — voir FLUX-009. Avant les commits `889517f` et `a090dc2`, aucun envoi n’était effectué par le produit lui-même.
- **Aucun SMS, aucun calendrier, aucune messagerie sécurisée.**
- **Aucune journalisation applicative** : ni accès, ni export, ni action d’administration, ni appel IA. Aucune table d’audit dans `supabase/`.
- **Sauvegardes et restauration** : hors dépôt, à documenter auprès de Supabase — leur rétention conditionne la réalité de tout effacement.

## FLUX-004 — Détail du flux IA

Pour chaque flux IA, préciser le contenu exact envoyé, la région, la rétention, l’utilisation éventuelle pour entraînement, la suppression, les identifiants transmis et le mécanisme de validation humaine.

- **Contenu exact envoyé** : `Section du bilan : « <titre> ».\n\nNotes brutes à reformuler :\n<texte intégral de la section>`. Modèle `claude-opus-4-8`, `max_tokens: 2000`, aucune métadonnée, aucun identifiant de session ni d’utilisateur.
- **Identifiants transmis — directs : aucun.** `patient_name`, `birth_date`, `patient_id`, `guardian`, adresse et e-mail ne sont **jamais** passés, alors que le composant appelant en dispose. **C’est une abstention délibérée, à conserver et à documenter comme telle.**
- **Identifiants transmis — indirects : à présumer présents.** Le texte envoyé est de la rédaction clinique libre, où le prénom, l’âge, la classe ou l’école apparaissent couramment. La consigne système demande de « conserver toutes les données factuelles » : elle **préserve** les identifiants rencontrés au lieu de les neutraliser. Rien dans le code ne détecte, n’avertit ni ne masque un identifiant avant l’envoi. **Le contenu doit être qualifié comme donnée de santé se rapportant à une personne identifiable — ni anonyme, ni pseudonymisée de façon contrôlée.**
- **Rétention, région, entraînement** : non maîtrisés par le produit et **non contractualisés dans le dépôt**. À vérifier pour le compte réellement utilisé auprès de la source primaire du fournisseur, et à inscrire dans un accord de sous-traitance. La variable `ANTHROPIC_API_KEY` ne dit rien du type de compte ni des options souscrites.
- **Journalisation** : aucune, ni des prompts, ni des sorties, ni des appels. Les messages d’erreur sont génériques et ne recopient pas le contenu — bon point.
- **Mécanisme de validation humaine** : **insuffisant.** Le texte renvoyé **remplace** le champ sans comparaison ni signalement ; aucune provenance n’est conservée en base ; l’annulation est détruite à la première frappe et perdue au rechargement. Après enregistrement, il est impossible de savoir qu’une section a été produite par un traitement automatisé — ce qui empêche notamment de répondre précisément à une personne qui le demanderait. Voir `docs/clinical/CLINICAL_SAFETY.md` § C-5.
- **Contrôle d’accès** : **aucun.** La Server Action ne vérifie ni la session ni l’abonnement, et le proxy ne redirige pas les requêtes mutatives. Voir `docs/security/THREAT_MODEL.md` § MEN-002.

## FLUX-005 — Détail du flux de dictée

- Le code n’appelle **aucun** service tiers : il utilise l’API navigateur `window.SpeechRecognition || window.webkitSpeechRecognition`, en `fr-FR`, mode continu.
- **Mais l’API Web Speech ne garantit pas une reconnaissance locale.** Selon le navigateur et sa version, l’audio peut être transmis aux serveurs du fournisseur du navigateur. L’audio concerné est de la parole clinique portant sur un patient identifié, souvent mineur.
- Conséquences à documenter : le fournisseur du navigateur devient un destinataire de fait, non identifié et non contractualisé ; le comportement n’est pas maîtrisable par le code ; **l’utilisateur n’est pas informé** — le bouton annonce seulement « Dicter à la voix », et l’absence de prise en charge se traduit par un repli silencieux.
- **Source primaire à vérifier** : la spécification W3C Web Speech API et la documentation de chaque navigateur ciblé. **Responsable de validation** : DPO, plus une décision produit sur le maintien de la fonction.
- C’est le flux le plus discret et le moins maîtrisé du produit — davantage que l’appel IA, qui est explicite et circonscrit.

## FLUX-009 — Détail du flux e-mail

- **Prestataire** : Resend. **Statut au 2026-09-11 : implémenté mais inactif.** L’envoi est refusé tant que `RESEND_API_KEY` et `INVOICE_FROM_EMAIL` ne sont pas renseignées (`lib/email.ts`). **Si ces variables ont été définies dans Vercel, le flux est actif : à confirmer auprès du praticien**, le dépôt ne peut pas en témoigner.
- **Contenu exact envoyé** : `to` = `patients.email` ; `subject` = `Votre facture n° <numéro>` ; corps = formule d’adresse, l’URL de consultation, la mention d’expiration à 90 jours, et `settings.display_name` ; `replyTo` = `profile.business_email`. **Aucune pièce jointe.** Le code de `lib/email.ts` sait joindre un fichier, mais `sendInvoiceEmail` ne s’en sert pas.
- **Identifiants transmis — directs** : l’adresse e-mail du patient et le nom du praticien. **Le nom du patient et la nature de l’acte ne sont pas transmis** : c’est une abstention délibérée, prise pour éviter que le contenu clinique n’entre chez le prestataire. À conserver comme telle.
- **Point le plus important : le message contient un jeton d’accès en clair.** L’URL transmise ouvre la facture sans authentification, laquelle porte le nom du patient, son adresse et la nature de l’acte. Resend conserve le contenu des messages et ses journaux : **le prestataire détient donc une clé d’accès fonctionnelle à une donnée de santé pendant 90 jours**, même si cette donnée ne figure pas dans le message. Retirer le nom de l’objet réduit l’exposition, il ne la supprime pas.
- **Région et conservation** : **les données sont stockées aux États-Unis.** La région choisie pour un domaine d’expédition détermine d’où le message part, pas où il est conservé ; aucun réglage ne déplace ce stockage vers l’Union européenne. Durée de conservation non maîtrisée par le produit.
- **Base des transferts** : DPA article 28 pré-signé à l’inscription, certification EU-US Data Privacy Framework, clauses contractuelles types. **Sources primaires à vérifier pour le compte réellement utilisé** : `resend.com/security/gdpr`, `resend.com/legal/dpa`.
- **HDS** : **Resend n’est pas certifié hébergeur de données de santé.** Le RGPD et le HDS sont deux exigences distinctes. Une nuance reste ouverte : la simple transmission n’est pas nécessairement de l’hébergement, mais la conservation du contenu et des journaux dépasse le transit. **Ne pas trancher ici.**
- **Responsable de validation** : `responsable-protection-donnees` et `auditeur-donnees-sante-hebergement`, avec avis juridique compétent. **Aucune conclusion de conformité ne doit être tirée de cette fiche.**
- **Journalisation** : aucune côté produit. Ni l’envoi, ni le destinataire, ni l’échec ne sont tracés en base. Impossible de savoir a posteriori quelle facture a été envoyée à qui, ni quand.
- **Question ouverte** : ce flux n’a pas été inscrit au registre au moment de son introduction, et aucun accord de sous-traitance n’est référencé dans le dépôt.

## FLUX-010 — Détail de la consultation sans compte

- **Mécanisme** : `supabase/migration_011.sql` ajoute `invoices.share_token` et `invoices.share_expires_at`, plus une fonction `invoice_by_token(text)` déclarée `security definer` et exécutable par le rôle `anon`.
- **La RLS est délibérément contournée** : le patient n’a pas de compte. Le jeton est la seule barrière. **C’est le seul endroit du produit où l’isolation ne repose pas sur `auth.uid()`.**
- **Restrictions codées dans la fonction** : une seule ligne rendue ; jeton d’au moins 20 caractères ; expiration vérifiée en base. Les champs rendus sont énumérés un par un — `user_id`, `share_token`, la rétrocession, l’URSSAF, le net et le montant encaissé sont exclus, et le profil du praticien est recomposé champ par champ pour ne pas exposer les autres réglages.
- **Le jeton est une clé porteuse** : 32 octets aléatoires en base64url, valable 90 jours, transmis dans l’URL. Quiconque obtient le lien accède à la facture. Il figure dans l’historique du navigateur du patient et chez le prestataire d’e-mail (FLUX-009).
- **Aucune révocation** n’est exposée dans l’interface : seules l’expiration et la suppression de la facture coupent l’accès.
- **Aucune journalisation** des consultations : impossible de savoir si, quand et combien de fois un lien a été ouvert.
- **Mesures présentes** : `robots: noindex, nofollow` sur la page, en-tête `X-Robots-Tag` et `Cache-Control: private, no-store` sur le PDF.
- **Vérification manquante — à traiter en priorité** : cette fonction **n’a été testée ni avec des données synthétiques, ni avec le jeton d’un autre praticien**. `security-health-data.md` impose de tester les identifiants appartenant à une autre organisation. **Responsables** : `auditeur-securite-applicative` et `ingenieur-base-donnees`.

## Sorties de données de santé hors de Supabase — récapitulatif

Six sorties, toutes démontrées : **FLUX-004** (API Anthropic), **FLUX-001** (rendu serveur du front, qui traite le contenu clinique en mémoire), **FLUX-006** (`mailto:`, bilan et facture), **FLUX-007 / FLUX-008** (poste local, hors traçabilité), **FLUX-009** (Resend, qui ne reçoit pas la donnée clinique mais en détient la clé d’accès) et **FLUX-010** (navigateur du patient, sans authentification).

Les deux dernières sont récentes et **aucune n’a fait l’objet d’une revue de sécurité ni d’un test d’isolation**.
