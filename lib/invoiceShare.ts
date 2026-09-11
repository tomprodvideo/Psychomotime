/**
 * Lien de consultation d'une facture.
 *
 * Le patient n'a pas de compte : le jeton contenu dans l'URL fait office de
 * clé. Il est donc traité comme un secret — long, imprévisible, et daté.
 */
import { randomBytes } from "node:crypto";

import type { InvoiceDateRender, ServicePricing } from "@/lib/types";

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

/**
 * Clés du profil du praticien qui sortent vers un document de facture.
 *
 * Cette liste est la définition de ce qu'un destinataire de facture peut voir du
 * cabinet. Tout le reste du profil (signature, trames, modèles, couleurs de
 * bilan, dépenses récurrentes…) n'a rien à y faire. Elle est tenue à la main,
 * volontairement : un étalement d'objet la rendrait caduque sans bruit.
 *
 * La fonction SQL `invoice_by_token` (supabase/migration_013.sql) construit la
 * même liste côté base. Les deux doivent rester alignées ; TypeScript ne peut
 * pas le vérifier.
 */
export const PRINTABLE_PROFILE_KEYS = [
  "logo_url",
  "address",
  "postal_code",
  "city",
  "business_phone",
  "business_email",
  "siret",
  "adeli",
  "legal_mentions",
] as const;

export type PrintableProfileKey = (typeof PRINTABLE_PROFILE_KEYS)[number];

/**
 * Ligne de prestation telle qu'elle sort vers un document de facture.
 *
 * `catalog_id` est ABSENT, et c'est le seul écart avec `InvoiceLine`. Il dit
 * de quelle entrée de catalogue la ligne est issue : c'est de la structure de
 * référentiel du cabinet, pas du contenu du document. Le porteur d'un jeton de
 * partage n'a rien à en connaître.
 *
 * Cette liste est tenue à la main, comme `PRINTABLE_PROFILE_KEYS` et pour la
 * même raison : un `Omit<InvoiceLine, "catalog_id">` suivrait automatiquement
 * tout champ ajouté plus tard à `InvoiceLine`, y compris un champ qui n'aurait
 * rien à faire sur une facture remise au patient.
 */
export type PrintableInvoiceLine = {
  id: string;
  label: string;
  pricing: ServicePricing;
  unit_price: number;
  quantity: number;
  dates: string[];
  amount: number;
  date_render: InvoiceDateRender;
  intro: string | null;
  note: string | null;
};

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
    /**
     * Lignes de prestation (migration 013). Facultatif : une base où la
     * migration n'est pas encore passée ne renvoie pas la clé, et la facture
     * se rend alors comme avant, sur `service_label` et `revenue_gross`.
     */
    lines?: PrintableInvoiceLine[] | null;
  };
  patient: { address: string | null } | null;
  settings: {
    display_name: string | null;
    profile: Record<PrintableProfileKey, string | null>;
  };
};

/**
 * Projection imprimable d'une facture lue en interne.
 *
 * La vue interne dispose de la facture complète, du patient complet et des
 * réglages complets. Le document, lui, ne doit connaître ni la rétrocession, ni
 * l'URSSAF, ni le net, ni le montant encaissé, ni le courriel ou le téléphone du
 * patient : non pas « interdits d'affichage », mais absents du chemin de code.
 *
 * D'où deux garde-fous :
 *   - les types des paramètres sont déjà étroits : la fonction ne peut pas lire
 *     ce qu'elle ne doit pas transmettre, le compilateur s'en charge ;
 *   - l'objet retourné est construit champ par champ. Un étalement (`...`)
 *     recopierait à l'exécution les colonnes internes, même si le type les
 *     masque : il est proscrit ici.
 *
 * Les appelants passent leurs objets complets ; seuls les champs listés sortent.
 */
export function toPrintable(
  // `SharedInvoice["invoice"]` tel quel : une `InvoiceLine` complète y est
  // acceptée (elle a tous les champs de `PrintableInvoiceLine`), mais le
  // paramètre étant typé sans `catalog_id`, le corps de la fonction ne PEUT
  // PAS le lire. La restriction est tenue par le compilateur, pas par la
  // discipline.
  invoice: SharedInvoice["invoice"],
  patient: { address: string | null } | null,
  settings: {
    display_name: string | null;
    profile?: Partial<Record<PrintableProfileKey, string | null | undefined>> | null;
  },
): SharedInvoice {
  // Une ligne de réglages ancienne peut ne pas porter de profil.
  const profile = settings.profile ?? {};

  return {
    invoice: {
      invoice_number: invoice.invoice_number,
      patient_name: invoice.patient_name,
      billing_month: invoice.billing_month,
      billing_year: invoice.billing_year,
      has_pco: invoice.has_pco,
      revenue_gross: invoice.revenue_gross,
      payment_method: invoice.payment_method,
      payment_date: invoice.payment_date,
      issue_date: invoice.issue_date,
      service_label: invoice.service_label,
      // Recomposées champ par champ, pour la raison dite plus haut : un
      // étalement recopierait `catalog_id` à l'exécution. Aucune remise en
      // ordre ici — les dates ont été triées à l'écriture, une facture émise
      // ne se recalcule pas à la lecture.
      lines: (invoice.lines ?? []).map((l) => ({
        id: l.id,
        label: l.label,
        pricing: l.pricing,
        unit_price: l.unit_price,
        quantity: l.quantity,
        dates: [...(l.dates ?? [])],
        amount: l.amount,
        date_render: l.date_render,
        intro: l.intro,
        note: l.note,
      })),
    },
    patient: patient ? { address: patient.address } : null,
    settings: {
      display_name: settings.display_name,
      profile: {
        logo_url: profile.logo_url ?? null,
        address: profile.address ?? null,
        postal_code: profile.postal_code ?? null,
        city: profile.city ?? null,
        business_phone: profile.business_phone ?? null,
        business_email: profile.business_email ?? null,
        siret: profile.siret ?? null,
        adeli: profile.adeli ?? null,
        legal_mentions: profile.legal_mentions ?? null,
      },
    },
  };
}
