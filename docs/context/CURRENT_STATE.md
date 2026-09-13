# État courant

Dernière mise à jour : 2026-09-13. Dépôt sur `main`, synchronisé avec `origin/main`.

Ce document ne contient que ce que le dépôt et la base DÉMONTRENT. Ce qui est
supposé est marqué comme tel. Il a été entièrement réécrit : la version
précédente décrivait le produit d'avant la refonte et était devenue trompeuse —
or elle est chargée dans le contexte de chaque session.

## Ce que le produit est aujourd'hui

Une refonte est en cours, lot par lot, sur une base PostgreSQL neuve. **Le
locataire n'est plus le compte : c'est le CABINET** (`practices` +
`practice_members`, cinq rôles). C'est le changement structurant dont tout le
reste découle.

Vingt-six migrations (`0000` à `0025`) sont appliquées en production —
projet Supabase `sisummvlowhtfgiatwwf`, vérifié après chaque application.
Depuis `0023`, la vérification ne se contente plus de compter les objets :
**les empreintes des huit fonctions déployées sont comparées une à une à
celles de la base locale éprouvée.** C'est ce contrôle qui a montré, sur cette
migration, que la divergence venait de la base LOCALE — laissée sur une
mutation par le harnais de falsification — et non de la production.

| Lot | Objet | État |
|---|---|---|
| L0 | Socle d'identité, cabinets, rôles, RLS, bascule depuis la v1 | livré |
| L1 | Dossier patient, entourage, parcours de prise en soin | livré |
| L2 | Agenda, séances, présences | livré |
| L3 | Registre d'instruments et règle de cotation unique | partiel — le moteur de bilans reste sur le modèle v1 |
| L5 | Moteur comptable, charges, attestations | livré |
| L7 | Transmissions par lien | livré |
| L8 | Design, accessibilité, performance | largement fait — performance, **quinze** manquements WCAG corrigés, socle de formulaire, cinq jetons employés, `Bouton` et `Statut`, aucun bouton `disabled` restant, **une coque unique pour les neuf documents imprimables** avec rappel de page répété ; non vérifié hors Chrome |
| L4 | Écrits cliniques : note, courrier, synthèse, fin de prise en soin, écrit pour un tiers | 5 des 7 écrits manquants livrés |
| L6, L9 | IA, préparation à la production | à faire |

## Ce qui est solide, et pourquoi on peut le dire

- **L'isolation entre cabinets est éprouvée par des contrôles qui échouent
  quand on la casse.** Douze fichiers SQL, rejoués à chaque `npm run verify`.
  Chaque garde ajoutée est FALSIFIÉE : on la désarme et on vérifie que le
  contrôle échoue. Cette discipline a trouvé, à répétition, des contrôles qui
  validaient leur propre mise en scène.
- **La falsification est devenue un outil, et ses plans sont versionnés.**
  `npm run falsifier supabase/falsifications/<plan>.json` désarme chaque garde
  une par une et exige qu'un contrôle tombe. Il ferme trois pièges que
  l'écriture à la main laissait ouverts : une mutation dont le motif ne
  correspond plus ne prouve rien et est signalée comme telle ; la base est
  reconstruite après coup, sans quoi elle reste sur la dernière mutation ; le
  fichier est restauré même en cas d'erreur. **Cinquante-trois gardes
  démontrées sur `0023`.**
- **Les montants sont des entiers de centimes, les taux des points de base.**
  Aucun flottant monétaire dans le schéma.
- **Une pièce émise est immuable**, s'annule par un avoir, et son statut ne se
  pose plus à la main : il se constate (`0018`).
- **Les documents figent leur contenu à l'émission.** Une pièce se relit avec
  les mentions de son époque.
- **Le partage par lien ne stocke jamais le jeton**, seulement son empreinte.
  Révocable, tracé, borné dans le temps par la base.
- **Les lectures sont cloisonnées à coût constant** (`0019`) : l'appartenance
  est calculée une fois par requête, plus une fois par ligne.
- **Les instantanés des quatre documents sont désormais PROUVÉS immuables.**
  La garde existait sur les quatre ; rien ne la démontrait sur trois d'entre
  eux — désarmer la ligne qui protège `snapshot` ne faisait échouer aucun
  contrôle. Trouvé en falsifiant la synthèse, corrigé sur la pièce comptable,
  l'attestation et le courrier au passage.
- **L'accord de partage DÉCIDE sur l'écrit destiné à un tiers non soignant
  (`0025`), alors qu'il se contente d'informer sur les trois autres.** Ce
  n'est pas une incohérence : la présomption d'échange au sein d'une équipe de
  soins, qui fondait « dire sans exiger », n'existe pas face à une école ou à
  un organisme évaluateur. Trois états — accord, dérogation motivée et
  journalisée à part, refus ferme sur un retrait. [SOURCE à vérifier par un
  juriste ; la qualification d'un destinataire donné n'est pas faite ici.]
- **La synthèse de suivi (`0023`) est le premier document dont une moitié est
  pré-remplie.** La ligne est tenue en base : `public.follow_up_facts` relève
  des FAITS — comptes de séances, objectifs tels qu'elle les a posés — et la
  MÊME fonction sert l'écran avant la remise et l'émission qui les fige. Aucune
  phrase d'évolution n'est produite, et l'émission **refuse** tant qu'elle n'a
  rien écrit.

## Vérifications connues

`npm run verify` enchaîne : `lint`, `typecheck`, 134 contrôles unitaires
(20 fichiers), 12 fichiers de contrôle SQL, un contrôle de concurrence sur la
numérotation, le **rejeu complet de la bascule v1 → cible** sur une base
jetable, et les **budgets de performance**.

| Date | Vérification | Résultat |
|---|---|---|
| 2026-09-13 | `npm run verify` après la coque imprimée | tout passe — 161 contrôles unitaires, 14 fichiers SQL, budgets tenus |
| 2026-09-13 | PDF Chrome 152, relus par `pdftotext` : deux mécanismes de rappel | `position: fixed` : 0 page sur 4 ; boîtes de marge `@page` : 4 sur 4 |
| 2026-09-13 | PDF d'un écrit pour un tiers réel, migré | rappel sur 8 pages sur 8, bandeau présent, barre d'écran absente |
| 2026-09-13 | PDF avec un nom hostile injecté dans le rappel | imprimé à la lettre, corps du document intact |
| 2026-09-13 | Falsification des gardes d'échappement et des mentions | 6 mutations, 6 détectées — dont une refaite, qui plantait au lieu de viser sa garde |
| 2026-09-13 | `npm run verify` après le lot design | tout passe — 148 contrôles unitaires, 14 fichiers SQL, budgets tenus |
| 2026-09-13 | Contrastes et gris recalculés à la main, aplats composités | 8 échecs 1.4.3 (AA) trouvés et corrigés ; échelle de gris de la courbe rendue monotone |
| 2026-09-13 | Rendu monochrome de la courbe vérifié à l'écran, avant et après | les cinq bandes se lisent en dégradé croissant, frontières tracées |
| 2026-09-13 | Jetons et utilitaires vérifiés dans le CSS produit | 6 variables, 8 utilitaires émis |
| 2026-09-13 | `npm run verify` | tout passe — 134 contrôles unitaires, 12 fichiers SQL |
| 2026-09-13 | `npm run build` | succès |
| 2026-09-13 | `npm run falsifier` sur `0023`, `0024`, `0025` et le schéma v1 | 158 gardes, 158 détectées |
| 2026-09-13 | Empreintes des fonctions déployées comparées à la base locale | 22 sur 22 identiques |
| 2026-09-13 | Analyseur de sécurité Supabase après `0023`, `0024` et `0025` | aucune erreur ; trois avertissements connus |
| 2026-09-12 | `npm run verify` | tout passe |
| 2026-09-12 | `npm run build` | succès |
| 2026-09-12 | Budgets à 400 puis 2 000 dossiers, sous RLS | aucune requête d'écran au-dessus de 1 ms |
| 2026-09-12 | Analyseur de sécurité Supabase | aucune erreur ; trois avertissements connus et assumés |
| 2026-09-13 | En-têtes de protection sur TOUTE réponse | `DENY` en cadre, `no-referrer`, `nosniff` partout ; `no-store` sur les routes rendues à la demande |
| 2026-09-12 | Page publique en production, sans compte | refus neutre d'un jeton inconnu, quatre en-têtes de protection posés |
| 2026-09-12 | `/documents` sans session, en production | redirige vers `/login` |

**Le rejeu de la bascule a trouvé, avant la production, des défauts que la base
de développement ne pouvait pas voir** : un changement de type de retour
impossible, une réécriture de politiques butant sur les tables v1. Il vaut la
peine de le garder.

## Ce qui n'est pas encore fait, et qu'il ne faut pas supposer acquis

- **Le moteur de bilans est toujours celui de la v1**, clé sur `user_id`, hors
  du modèle « cabinet ». Sa bascule est bloquée par `Q-201` — ce que « validé »
  doit signifier — qui est une décision de la praticienne.

  **Cinq des huit écarts cliniques de `docs/clinical/CLINICAL_SAFETY.md` sont
  corrigés** depuis le 2026-09-12 : le brouillon porte un bandeau qui s'imprime,
  l'âge est calculé à la date de passation, la saisie est enregistrée toutes les
  trente secondes, un bilan ne se détache plus de son dossier sur une frappe, et
  supprimer une section n'orpheline plus son texte. *Cette rubrique affirmait le
  contraire jusqu'au 2026-09-13 ; elle est chargée dans le contexte de chaque
  session et a induit deux analyses en erreur.*

  **Restent ouverts, et aucun ne dépend de `Q-201`** : la légende des scores se
  contredit à la note 7 et à −1 DS — `Q-202`, une question fermée dont la
  réponse aligne d'un coup quatre surfaces — le vocabulaire « zone dite
  pathologique » figure sur un document remis à des familles (`Q-202` aussi),
  la cohérence entre groupe d'âge coché et date de naissance n'est pas montrée
  au point de décision (`Q-205`), et les bilans déjà orphelins restent à
  RÉPARER — leur état est désormais visible, le rattachement après coup ne
  l'est pas encore.

  **Corrigé le 2026-09-13** : l'objet et le corps du courriel sortant
  annonçaient « bilan psychomoteur » quel que soit le type ; un bilan sensoriel
  partait sous un intitulé faux, alors que le titre imprimé, lui, était correct.
  Et `saveBilan` acceptait un `patient_id` posté sans vérifier qu'il appartient
  à l'appelant — une clé étrangère ne regarde pas à qui appartient la ligne
  qu'elle pointe.
- **L'isolation de `public.bilans` est démontrée depuis le 2026-09-13.** Elle
  naît dans le schéma v1, appliqué seulement par la voie `cutover` : la base de
  contrôle courante est bâtie à partir des seules migrations, et la couverture
  RLS générique ne pouvait pas voir une table qui n'y est pas. Sa politique
  était correcte — elle n'avait simplement jamais été falsifiée, dans un dépôt
  où cent gardes l'ont été sur les deux dernières migrations. Les contrôles
  vivent maintenant dans `supabase/cutover/verifications.sql.check`, avec leur
  plan de falsification.
- **Aucun parcours de bout en bout automatisé** (L9), aucun contrôle visuel.
- **Aucune fonction IA n'a été revue** depuis la refonte.
- **Le socle de formulaire existe depuis le 2026-09-13** : `components/Champ.tsx`
  et `components/SectionDossier.tsx`. Le style de champ était redéclaré **33
  fois dans 29 fichiers**, en trois variantes divergentes dont les plus
  récentes étaient celles des derniers écrans écrits — la dérive était active.
  Il n'en reste **aucune** déclaration locale. Le reste du socle — `Bouton`,
  `Statut`, jetons sémantiques — n'est pas fait.
- **Onze styles de champ en ligne subsistent dans six fichiers**, tous en
  comptabilité sauf deux. Neuf sont une variante appauvrie de `CHAMP` — sans
  focus ni transition ; les deux autres recopient `CHAMP` mot pour mot pour
  lui ajouter une largeur. **Ces deux-là sont un défaut de l'API de `Champ`,
  pas de la discipline** : il n'accepte pas de largeur. Les *constantes
  nommées*, elles, ont bien toutes disparu.
- **Aucune durée de conservation n'est tranchée**, pour aucune donnée.
- **Les erreurs de formulaire ne sont toujours pas liées à leur champ.** Le
  composant `Champ` existe et sait le faire — `aria-invalid`,
  `aria-describedby` avec l'erreur AVANT l'aide, état invalide sur trois
  canaux — mais rien ne le nourrit : les actions serveur rendent une chaîne
  unique, `{ ok, error }`, sans dire QUEL champ a échoué. C'est ce contrat
  qu'il faut élargir avant de brancher quoi que ce soit ; le composant, lui,
  accepte déjà `erreur` en propriété facultative.
- **Les trois points qui ne se tranchaient qu'en exécution ont été MESURÉS le
  2026-09-13**, en rendant les composants réels sur un jeu fictif :

  · `2.5.8` — **conforme, rien à corriger.** Cinq cibles sur six font 16 à
    20 px de haut, sous le minimum de 24, mais l'exception d'espacement
    s'applique : aucun conflit à 1029 px comme à 375 px, cercles de 24 px
    calculés par paires.

  · `2.4.11` — **conforme, rien à corriger.** Une cible ENTIÈREMENT visible,
    posée au milieu de la bande couverte par la barre d'actions fixe de
    l'éditeur de bilan, est quand même dégagée au focus : `scroll-padding-bottom:
    7rem` traite les 112 derniers pixels comme un endroit où une cible de focus
    n'a pas le droit de se poser. Le cas strict passe.

  · **Tirage monochrome — CORRIGÉ le 2026-09-13.** Le bandeau d'annulation
    survit : le trait tireté et le mot en capitales portent le sens, la couleur
    n'était que le troisième canal. Le défaut était sur la courbe de Gauss, et
    la mesure d'origine le sous-estimait : elle ne couvrait que deux bandes sur
    cinq et manquait le plus grave. **L'échelle de gris n'était pas monotone.**
    Composités à leur opacité réelle, les cinq aplats donnaient 125 → 174 →
    165 → 202 → 224 : « Faible » s'imprimait PLUS CLAIR que « Moyenne ». Sur
    une courbe où le clair se lit comme « tout va bien », la bande de fragilité
    paraissait plus rassurante que la bande moyenne — une information fausse,
    pas une information perdue. S'y ajoutaient **sept échecs calculés de 1.4.3
    (AA)** : trois étiquettes de bande en blanc (4,10 / 2,23 / 2,45:1) et
    quatre des cinq teintes d'axe (3,22 / 4,10 / 2,83 / 2,29:1) à 8,5 px.
    Clarté des cinq teintes ajustée à teinte et saturation constantes, encre
    unique vérifiée sur blanc et sur chacun des aplats, **frontières de
    classification tracées** et **intervalle en DS écrit dans chaque bande**.
    Aucun seuil déplacé, aucun mot de classification changé : `Q-202` reste
    ouverte et n'avait pas à être tranchée.

  · **Un défaut plus grave a été trouvé au passage, et il ne tenait pas à la
    couleur.** `app/(app)/comptabilite/[id]/document/page.tsx` ne traitait
    qu'UN statut sur sept — le brouillon, qu'elle refuse d'imprimer. Une
    facture annulée par avoir, un devis refusé, expiré ou remplacé se
    réimprimaient sans aucune marque. Le produit marquait l'annulation sur
    l'attestation et sur les quatre écrits cliniques, mais pas sur la seule
    pièce qui sert à se faire rembourser. **Corrigé le 2026-09-13** : chaque
    mention dit la conséquence et, quand il y en a un, le recours.
- **`Bouton` et `Statut` existent depuis le 2026-09-13** — 24 et 12 appels.

  **`Statut` : les quatorze rendus de pastille sont ramenés à six tons.** Le
  même rôle était peint à deux forces de teinte selon l'écran — `brand-50` ici
  et `brand-100` là pour « c'est fait », `amber-50` et `amber-100` pour
  « vérifiez », `slate-100` et `slate-200` pour « rien n'est engagé » — et une
  seconde teinte de vert servait à « accepté » sans rien distinguer. Le
  rattachement d'un état à un ton reste chez le domaine ; `Statut` ne connaît
  que les tons. `libelle` est obligatoire par le typage : WCAG 1.4.1 est tenu
  par construction, plus par discipline.

  **Le désaccord rose/ambre est PRÉSERVÉ, pas résolu.** Les cartes de la
  comptabilité et des écrits cliniques gardent chacune leur ton, avec le
  commentaire qui dit pourquoi elles n'ont pas été alignées. Vérifié à l'écran
  côte à côte. La question reste posée à `expert-metier-psychomotricien`.

  **`Bouton` n'emploie jamais `disabled`** — le typage l'interdit. Un élément
  `disabled` sort de l'ordre de tabulation : on ne peut pas l'atteindre pour
  savoir pourquoi il est éteint, et s'il portait le focus au moment où il
  s'éteint, le focus retombe sur `body`. Il emploie `aria-disabled` et exige un
  MOTIF pour éteindre.

  **Deux motifs vivaient dans un `title`, sur un bouton `disabled`** —
  `BarreActions.tsx` et `ActionsAttestation.tsx`. La phrase existait ; ni le
  clavier, ni le doigt, ni l'impression ne pouvaient l'atteindre, et un bouton
  `disabled` ne se survole pas. Dont celui-ci, qui pèse lourd : « Cochez au
  moins une séance ou un règlement : sans cela, l'attestation n'affirme rien. »
  **Cette rubrique affirmait que ce motif d'anti-usage avait disparu du
  produit. C'était faux** — corrigé le 2026-09-13. Deux motifs de refus
  restaient cachés dans une infobulle, tous deux dans l'éditeur de bilan :
  « Dictée non disponible (utilisez Chrome ou Safari) » et « Écrivez
  d'abord ». Le relevé s'arrêtait au premier `>` d'une balise, et
  `onClick={() => …}` en contient un AVANT d'atteindre le `title`. Refait avec
  un analyseur qui respecte les accolades : ce sont les deux seuls. Ils sont
  maintenant atteignables.

  **Le déplacement de garantie a été MESURÉ, pas supposé.** `aria-disabled`
  n'empêche rien seul : le refus passe par un gestionnaire de clic. Éprouvé
  dans le navigateur avec un compteur — bouton actif : compte ; bouton empêché :
  rien ; `type="submit"` empêché : ni son `onClick`, ni la soumission. Et un
  bouton inerte reçoit le focus, son motif se lisant par `aria-describedby`.
  Non couvert, et dit comme tel : une soumission déclenchée par programme —
  il n'en existe aucune dans le produit.

  **Plus aucun bouton du produit n'emploie `disabled`** — migration terminée le
  2026-09-13, 93 au départ. Ce qui garde `disabled`, et doit le garder : six
  `<input>` et un `<textarea>`. Sur un champ de saisie, `aria-disabled` seul
  laisserait taper dans un champ qui ne sera pas soumis, ce qui serait pire.
  La pagination de la liste des dossiers reçoit une propriété nommée
  `disabled` mais rend alors un `<span>`, pas un bouton.

  Soixante-dix boutons ont été migrés **sans en redessiner un seul** : la
  variante `libre` n'apporte que le comportement, l'apparence reste celle de
  l'appelant. La dette d'apparence et la dette de comportement sont deux
  dettes ; les solder dans le même diff rendait l'une et l'autre illisibles.
  Soixante sont passés par une transformation automatique, simulée avant
  écriture ; dix exigeaient un motif écrit à la main.

  **Mesuré dans le navigateur, sur le scénario même que la migration vise** :
  « Descendre » sur l'avant-dernière section la rend dernière, et son bouton
  s'éteint sous le focus. Le focus y RESTE, au lieu de retomber sur `body`, et
  le motif « déjà la dernière » est annoncé. Les deux formulaires publics
  — connexion et mot de passe oublié — gardent un vrai bouton de soumission,
  contrôlé dans le DOM sans rien soumettre.

  **Le motif peut être annoncé sans être affiché** (`motifMasque`), dans deux
  cas seulement : la cause est visible juste à côté — un champ vide, une
  position en tête de liste — ou le contrôle se répète à chaque section.
  Mesuré : aucun écart ni aucune hauteur ajoutés dans une rangée flex.

  **L'opacité ne délave plus l'information.** Quatre valeurs coexistaient
  (30, 40, 50, 60). Il n'en reste qu'une, et elle n'est plus appliquée au
  bouton qui LANCE l'action : son libellé « Émission en cours… » est
  l'information, et une opacité à 70 % le faisait tomber de 6,00:1 à 3,18:1.
  Les autres boutons de la barre, réellement inactifs, s'estompent.

  **Un défaut livré au tour précédent, trouvé en préparant celui-ci.** Le
  libellé d'attente par défaut était « Enregistrement en cours… » : pendant
  une seule action, les boutons Supprimer, Émettre et Créer un avoir de la
  pièce comptable l'affichaient tous à la fois. Sept boutons concernés. Sans
  libellé explicite, un bouton garde désormais le nom de son action.

  **Cinq boutons disaient « … » pendant l'attente** — un lecteur d'écran
  annonce « points de suspension, bouton ». Corrigé : chacun dit l'action en
  cours.
- **Cinq jetons sémantiques existent** — `avis`, `arret`, `encre-faible`, et
  depuis l'unification des documents imprimés `--container-document` et
  `--text-document` — et chacun est EMPLOYÉ : un jeton posé sans emploi est du
  décor. `--color-trait` reste écarté : sa migration toucherait ~70 fichiers
  sans changer un pixel.

- **Les neuf documents imprimables partagent une seule coque depuis le
  2026-09-13** (`components/Imprimable.tsx`). Il y en avait neuf et non sept,
  en TROIS variantes : la revue de conception n'avait relevé ni la fiche patient
  dans son tableau, ni la page publique ouverte par un tiers depuis un lien.

  **Le rappel de page se répète réellement**, mesuré dans des PDF produits par
  Chrome 152 et relus page par page : 8 pages sur 8 pour un écrit pour un tiers
  réel, avec « page N sur M ». Il ne se répétait nulle part avant : les quatre
  blocs présentés comme des rappels s'imprimaient une fois, en fin de document,
  et trois documents n'en avaient aucun — dont l'attestation, dont le propre
  commentaire disait qu'elle déborde souvent sur une seconde page.

  **Deux affirmations de la revue de conception étaient fausses, et la mesure
  l'a montré avant que l'une d'elles ne soit implémentée.** Sa proposition —
  un élément en `position: fixed; bottom: -16mm` — n'imprime le rappel sur
  AUCUNE page : le décalage négatif le sort de la zone imprimée. Et les boîtes
  de marge de `@page` avec `counter(page)`, qu'elle disait indisponibles dans
  les navigateurs exportateurs, fonctionnent dans Chrome. **Non vérifié** :
  Safari et Firefox. Là où elles ne sont pas prises en charge, le rappel
  n'apparaît pas — la page retombe sur l'état d'avant, sans chevauchement.

  **Le nom de la personne est injecté dans une feuille CSS**, ce qui exigeait
  un échappement sûr par construction : liste blanche, tout ce qui n'est ni
  lettre ASCII ni chiffre devient un échappement hexadécimal
  (`lib/impression/rappel.ts`). Éprouvé dans un PDF avec un nom contenant
  `"; } body{display:none} </style><script>` : imprimé à la lettre, le corps du
  document intact. Six contrôles, trois gardes falsifiées une à une. La relecture
  du PDF a trouvé un défaut que la relecture du code avait manqué : une espace
  qui suit un échappement hexadécimal est absorbée, « Zoé « » s'imprimait
  « Zoé« ».

  **Une divergence réelle entre les deux rendus d'une même pièce a été fermée.**
  La page publique ne marquait que l'annulation par avoir et le remplacement :
  **un devis refusé ou expiré, transmis par lien, s'y affichait comme valide**,
  alors que la base lui transmettait bien son statut (`'etat', d.status`,
  migration `0020`). Corrigé en TypeScript seul, sans migration : les deux pages
  appellent maintenant la même fonction (`lib/impression/mentions.ts`, sept
  contrôles). Les deux anciennes fonctions de la page publique sont supprimées
  — c'était la version divergente, et la laisser invitait à la réutiliser.

  **Ce que la coque unifie** : le cadre, le corps de 13 px (facture et
  attestation étaient à 14), des marges resserrées sur téléphone — c'est là
  qu'une famille ouvre un lien —, une barre qui reste visible sur un long
  document, et un bouton d'impression. Les quatre écrits cliniques n'en avaient
  AUCUN ; il en existait trois versions ailleurs, dont une importée d'une
  fonctionnalité à l'autre. Le bandeau d'état passe en trait PLEIN pour une
  annulation (les écrits cliniques la traçaient en tireté, le signal d'un état
  transitoire) ; le trait d'avis imprimé est en ambre 600, parce que le jeton
  d'écran s'imprime au gris 215, presque invisible.

  **Ce qu'elle ne décide pas, délibérément** : la taille du titre de chaque
  document — une facture garde sa nature en grand, un écrit clinique la sienne
  à la taille du texte, ce sont deux genres —, et la place d'une signature
  manuscrite sur les écrits cliniques, qui est une question pour la
  praticienne. La page publique n'a pas de bouton d'impression, par choix
  antérieur de n'y charger aucun JavaScript pour cela ; vérifié dans la page
  servie : aucune référence au composant du bouton, contre deux quand il est
  affiché.

## Risques ouverts

Le registre complet est dans `docs/refonte/00-PILOTAGE.md`. Les deux qui
appellent une décision du propriétaire, et qu'aucun travail technique ne peut
lever :

1. **R-01 — aucun des quatre fournisseurs n'est certifié hébergeur de données
   de santé**, et l'échéance réglementaire citée dans le dossier de recherche
   est proche. Décision utilisateur.
2. **R-02 — un compte rendu de bilan reste dans l'historique Git d'un dépôt
   public.** Le retirer de l'arbre n'a pas suffi : le blob demeure accessible.
   L'effacer exigerait de réécrire l'historique, donc un push forcé, que les
   règles du dépôt interdisent. Qualification par le propriétaire requise.

## Prochaine action

Appliquer `0023` en production, puis poursuivre les écrits manquants : rang 4
(écrit de fin de prise en soin), rang 5 (écrit pour un tiers non soignant),
rang 6 (notice d'information), rang 7 (projet d'accompagnement imprimable).
Reste ensuite l'accessibilité WCAG 2.2 AA du lot 8, puis L6, et L9 en dernier.
