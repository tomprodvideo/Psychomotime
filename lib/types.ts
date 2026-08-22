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
  theme_color?: string; // couleur d'accent des bilans (hex)
  bilan_font?: string; // 'sans' | 'serif'
  bilan_title_style?: string; // 'underline' | 'boxed' | 'plain'
  anamnese_note?: string; // texte par défaut après l'anamnèse
  anamnese_note_on?: boolean; // ajouter ce texte automatiquement
  gaussian_curve_url?: string; // courbe de Gauss personnalisée (data URL)
  conclusion_top?: boolean; // conclusion en tête (encadré grisé) au lieu du bas
  closing_note?: string; // formule de fin sous la signature
  signature_url?: string; // image de signature (data URL)
  adaptation_templates?: AdaptationTemplate[]; // modèles réutilisables
  adaptation_folders?: AdaptationFolder[]; // dossiers de modèles
  bilan_sections?: BilanSectionConfig[]; // trame du bilan personnalisée
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
