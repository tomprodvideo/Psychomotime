# Psychomotime

Application web pour psychomotricien(ne) libéral(e) : **comptabilité** (factures, calculs
automatiques rétrocession / URSSAF / net, loyers) et **bilans psychomoteurs**
(modèle structuré + texte libre, export PDF).

Construit avec **Next.js 16**, **React 19**, **Tailwind CSS** et **Supabase**
(base de données PostgreSQL + authentification).

---

## Mise en route (3 étapes)

### 1. Créer les tables dans Supabase

- Ouvrez votre projet Supabase → **SQL Editor** → **New query**
- Copiez tout le contenu de [`supabase/schema.sql`](supabase/schema.sql)
- Cliquez sur **Run**

Cela crée les tables (patients, factures, bilans, charges, paramètres),
la sécurité par utilisateur (RLS) et la création automatique du profil.

### 2. Renseigner la clé Supabase

Dans le fichier `.env.local` à la racine, collez votre clé **anon / publishable**
(Supabase → **Project Settings** → **API Keys**) :

```bash
NEXT_PUBLIC_SUPABASE_URL=https://sisummvlowhtfgiatwwf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...        # votre clé
```

> Astuce : pour une connexion immédiate sans email de confirmation, désactivez
> « Confirm email » dans Supabase → **Authentication** → **Sign In / Providers** → Email.

### 3. Lancer l'application

```bash
npm install      # si ce n'est pas déjà fait
npm run dev
```

Ouvrez http://localhost:3000, créez votre compte (onglet « Créer un compte »),
puis connectez-vous.

---

## Fonctionnalités

- **Tableau de bord** : revenu net de l'année, URSSAF estimée, patients, derniers bilans.
- **Comptabilité** : tableau des factures façon tableur, calcul automatique de la
  rétrocession, de l'URSSAF et du revenu net ; totaux ; filtre par année ; suivi
  des loyers/charges ; case PCO ; moyen et date de paiement.
- **Patients** : fiches (prénom, nom, naissance, contact, notes), historique des
  factures et bilans.
- **Bilans psychomoteurs** : éditeur structuré par domaines (anamnèse, tonus,
  motricité globale/fine, latéralité, schéma corporel, espace, temps, graphisme,
  attention, affect, conclusion, projet) ; statut brouillon/finalisé ; aperçu
  imprimable et export PDF (via Imprimer).
- **Paramètres** : taux de rétrocession, mode loyer fixe, taux URSSAF, nom affiché.

## Calculs

- `rétrocession = revenu brut × taux` (ou `0` en mode loyer)
- `après rétro = revenu brut − rétrocession`
- `URSSAF = après rétro × taux URSSAF`
- `revenu net = après rétro − URSSAF`

Les montants sont enregistrés à la saisie : modifier un taux plus tard ne change
pas les factures déjà créées (historique préservé). Chaque montant reste modifiable
à la main (bouton Auto / Manuel).

## Déploiement en ligne (optionnel)

Hébergez gratuitement sur [Vercel](https://vercel.com) : importez le dépôt GitHub,
ajoutez les deux variables d'environnement (`NEXT_PUBLIC_SUPABASE_URL` et
`NEXT_PUBLIC_SUPABASE_ANON_KEY`), déployez.
