/**
 * Lien de consultation d'une facture.
 *
 * Le patient n'a pas de compte : le jeton contenu dans l'URL fait office de
 * clé. Il est donc traité comme un secret — long, imprévisible, et daté.
 */
import { randomBytes } from "node:crypto";

/** Durée de validité d'un lien, en jours. */
export const SHARE_TTL_DAYS = 90;

/** 32 octets aléatoires en base64url : imprévisible et sûr dans une URL. */
export function newShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export function shareExpiry(from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + SHARE_TTL_DAYS);
  return d.toISOString();
}

/** Forme des données rendues par la fonction SQL invoice_by_token. */
export type SharedInvoice = {
  invoice: {
    invoice_number: string | null;
    patient_name: string | null;
    billing_month: string | null;
    billing_year: number | null;
    has_pco: boolean | null;
    revenue_gross: number | null;
    payment_method: string | null;
    payment_date: string | null;
    issue_date: string | null;
    service_label: string | null;
  };
  patient: { address: string | null } | null;
  settings: {
    display_name: string | null;
    profile: {
      logo_url: string | null;
      address: string | null;
      postal_code: string | null;
      city: string | null;
      business_phone: string | null;
      business_email: string | null;
      siret: string | null;
      adeli: string | null;
      legal_mentions: string | null;
    };
  };
};
