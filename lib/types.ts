export type ChargeMode = "retrocession" | "loyer";

export interface Settings {
  user_id: string;
  display_name: string | null;
  retrocession_rate: number;
  urssaf_rate: number;
  charge_mode: ChargeMode;
  monthly_rent: number;
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
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
  created_at: string;
  updated_at: string;
}
