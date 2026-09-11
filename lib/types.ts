export type ChargeMode = "retrocession" | "loyer";

export interface Subscription {
  user_id: string;
  email: string | null;
  status: string; // trialing | active | inactive | past_due | canceled
  is_admin: boolean;
  manual_override: boolean;
  trial_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface Access {
  active: boolean;
  isAdmin: boolean;
  status: string;
  trialEnd: string | null;
  trialDaysLeft: number | null;
}

export interface Profile {
  logo_url?: string; // image en base64 (data URL)
  address?: string; // rue
  postal_code?: string; // code postal
  city?: string; // ville
  siret?: string;
  adeli?: string;
  rpps?: string;
  business_email?: string;
  business_phone?: string;
  legal_mentions?: string;
  invoice_number_format?: string; // gabarit des numéros de facture
  recurring_expenses?: RecurringExpense[]; // dépenses récurrentes du cabinet
  service_catalog?: ServiceCatalogItem[]; // catalogue des prestations facturables
  theme_color?: string; // couleur d'accent des bilans (hex)
  bilan_font?: string; // 'sans' | 'serif'
  bilan_title_style?: string; // 'underline' | 'boxed' | 'plain'
  anamnese_note?: string; // texte par défaut après l'anamnèse
  anamnese_note_on?: boolean; // ajouter ce texte automatiquement
  gaussian_curve_url?: string; // courbe de Gauss personnalisée (data URL)
  conclusion_top?: boolean; // conclusion en tête (encadré grisé) au lieu du bas
  closing_note?: string; // formule de fin sous la signature
  signature_url?: string; // image de signature (data URL)
  adaptation_templates?: AdaptationTemplate[]; // modèles (bilan psychomoteur)
  adaptation_folders?: AdaptationFolder[]; // dossiers (bilan psychomoteur)
  adaptation_templates_sensoriel?: AdaptationTemplate[]; // modèles (bilan sensoriel)
  adaptation_folders_sensoriel?: AdaptationFolder[]; // dossiers (bilan sensoriel)
  bilan_sections?: BilanSectionConfig[]; // trame du bilan psychomoteur
  bilan_sections_sensoriel?: BilanSectionConfig[]; // trame du bilan sensoriel
  bilan_settings?: Partial<Record<"psychomoteur" | "sensoriel", BilanTypeSettings>>; // apparence par type
}

/** Dépense récurrente du cabinet (abonnement, assurance, loyer…). */
export interface RecurringExpense {
  id: string;
  label: string;
  amount: number;
  period: "mensuel" | "annuel";
  /** Décochée, la dépense reste enregistrée mais n'entre pas dans les calculs. */
  active: boolean;
}

/** Mode de tarification d'une prestation. */
export type ServicePricing = "forfait" | "unitaire";

/** Façon d'imprimer les dates de séance d'une ligne de facture. */
export type InvoiceDateRender =
  /** Les dates sont groupées sous le libellé, le montant est celui du bloc. */
  | "liste"
  /** Une ligne de tableau par date, chacune avec son montant. */
  | "par_date";

/**
 * Prestation du catalogue du cabinet (Paramètres), rangée dans
 * `settings.profile.service_catalog` sur le modèle de `recurring_expenses`.
 *
 * C'est un RÉFÉRENTIEL, pas une source de vérité pour les factures émises :
 * une ligne de facture en recopie les valeurs au moment de l'enregistrement et
 * ne les relit plus jamais (voir `InvoiceLine`).
 */
export interface ServiceCatalogItem {
  id: string; // uuid
  label: string;
  unit_price: number;
  pricing: ServicePricing;
  /** Style d'impression proposé par défaut aux lignes issues de cette entrée. */
  default_date_render: InvoiceDateRender;
  /** Phrase d'introduction imprimée au-dessus des dates. Peut être vide. */
  intro: string;
  /** Décochée, l'entrée reste enregistrée mais n'est plus proposée à la saisie. */
  active: boolean;
}

/**
 * Ligne de prestation d'une facture, stockée dans `invoices.lines` (jsonb,
 * migration 013).
 *
 * RÈGLE DE FIGEMENT — la raison d'être de ce type. `label`, `unit_price`,
 * `pricing` et `intro` sont COPIÉS du catalogue au moment de l'enregistrement
 * et ne sont plus jamais relus. Modifier, désactiver ou supprimer une entrée de
 * `service_catalog` ne change AUCUNE facture existante : une facture est un
 * document émis, son contenu ne bouge pas parce qu'un référentiel a bougé.
 *
 * `catalog_id` ne répond qu'à une seule question — « d'où vient cette ligne ? ».
 * Il ne doit JAMAIS servir à relire le catalogue pour recomposer la ligne, et
 * il ne sort pas vers le document (voir `PrintableInvoiceLine`).
 */
export interface InvoiceLine {
  id: string; // uuid propre à la ligne, sans portée hors de la facture
  /** PROVENANCE SEULE. Null si la ligne a été saisie hors catalogue. */
  catalog_id: string | null;
  label: string;
  pricing: ServicePricing;
  unit_price: number;
  /** Entier >= 1. Toujours 1 pour une ligne au forfait. */
  quantity: number;
  /** Dates de séance « YYYY-MM-DD », triées croissantes et distinctes. */
  dates: string[];
  /** Montant du bloc, recalculé côté serveur — jamais celui posté par le client. */
  amount: number;
  date_render: InvoiceDateRender;
  intro: string | null;
  note: string | null;
}

/** Réglages d'apparence propres à un type de bilan. */
export interface BilanTypeSettings {
  theme_color?: string;
  bilan_font?: string;
  bilan_title_style?: string;
  closing_note?: string;
  conclusion_top?: boolean;
  signature_url?: string;
  gaussian_curve_url?: string; // psychomoteur uniquement
}

/** Un élément de la trame du bilan (grand titre ou sous-titre), éditable dans les Paramètres. */
export interface BilanSectionConfig {
  id: string; // clé stable (sert au stockage du contenu) — ne pas changer
  title: string; // libellé (éditable)
  hint?: string;
  level?: "title" | "subtitle"; // grand titre (défaut) ou sous-titre
  boxed?: boolean; // pour les titres : encadré ou non
  domain?: boolean; // affiche le sélecteur de tests + tableaux M-ABC
  mabcBlocks?: ("equilibre" | "oculo" | "dexterite")[];
  kind?: "text" | "scores"; // 'scores' = section auto (interprétation + courbe)
}

export interface AdaptationFolder {
  id: string;
  name: string;
}

export interface AdaptationTemplate {
  id: string;
  title: string;
  text: string;
  folder?: string | null; // id du dossier (AdaptationFolder), sinon « Général »
}

export interface Settings {
  user_id: string;
  display_name: string | null;
  retrocession_rate: number;
  urssaf_rate: number;
  charge_mode: ChargeMode;
  monthly_rent: number;
  profile: Profile;
  created_at: string;
  updated_at: string;
}

export interface Guardian {
  relation?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface PatientDossier {
  prescripteur?: string | null;
  ordonnance_date?: string | null;
  referrer?: string | null;
  bilan_initial_date?: string | null;
  motif?: string | null;
  diagnostic?: string | null;
  hypothese?: string | null;
  accompagnement?: string | null;
  school?: string | null;
  autres_suivis?: string | null;
  complement?: string | null;
}

export interface Patient {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  guardian: Guardian;
  dossier: PatientDossier;
  created_at: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  patient_id: string | null;
  patient_name: string;
  invoice_number: string | null;
  billing_month: string | null;
  billing_year: number | null;
  has_pco: boolean;
  revenue_gross: number;
  revenue_gross_paid: number;
  payment_method: string | null;
  payment_date: string | null;
  issue_date: string | null;
  service_label: string | null;
  retrocession_amount: number;
  urssaf_amount: number;
  after_retro: number; // colonne générée
  net_revenue: number; // colonne générée
  notes: string | null;
  created_at: string;
  // Lien de consultation envoyé au patient (migration 011).
  share_token?: string | null;
  share_expires_at?: string | null;
  // Lignes de prestation (migration 013). Optionnel : une base où la migration
  // n'a pas encore été passée ne renvoie pas la colonne, et `revenue_gross`
  // reste alors la seule source du montant.
  lines?: InvoiceLine[];
}

export interface Expense {
  id: string;
  user_id: string;
  type: string;
  label: string | null;
  amount: number;
  expense_date: string | null;
  period_month: string | null;
  period_year: number | null;
  notes: string | null;
  created_at: string;
}

export interface DocFolder {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface DocumentFile {
  id: string;
  user_id: string;
  folder_id: string | null;
  name: string;
  storage_path: string;
  mime_type: string | null;
  size: number | null;
  created_at: string;
}

/** Patient réduit à ce qu'il faut pour l'afficher et l'imprimer sur une facture. */
export type PatientContact = Pick<
  Patient,
  "id" | "first_name" | "last_name" | "birth_date" | "email" | "phone" | "address"
>;

export type BilanStatus = "brouillon" | "finalisé";

export interface MabcScore {
  p?: string; // performance
  ns?: string; // note standard
}

export interface BilanTests {
  used?: string[]; // (déprécié) ancienne liste globale
  bySection?: Record<string, string[]>; // tests sélectionnés par section
  mabc3_group?: 1 | 2 | 3 | null;
  mabc3?: Record<string, MabcScore>; // clé de ligne -> score
  dunn?: Record<string, number>; // Dunn 2 : clé de ligne -> index de colonne (0-4)
}

export interface Bilan {
  id: string;
  user_id: string;
  patient_id: string | null;
  patient_name: string;
  title: string;
  bilan_date: string | null;
  author: string | null;
  status: BilanStatus;
  content: Record<string, string>;
  tests: BilanTests;
  created_at: string;
  updated_at: string;
}
