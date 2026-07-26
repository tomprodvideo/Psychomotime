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
  address?: string;
  city?: string; // ville (ex. "Le Puy-en-Velay") pour l'en-tête
  siret?: string;
  adeli?: string;
  rpps?: string;
  business_email?: string;
  business_phone?: string;
  legal_mentions?: string;
  theme_color?: string; // couleur d'accent des bilans (hex)
  adaptation_templates?: AdaptationTemplate[]; // modèles d'adaptations réutilisables
}

export interface AdaptationTemplate {
  id: string;
  title: string;
  text: string;
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

export type BilanStatus = "brouillon" | "finalisé";

export interface MabcScore {
  p?: string; // performance
  ns?: string; // note standard
}

export interface BilanTests {
  used?: string[]; // ids des tests utilisés
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
