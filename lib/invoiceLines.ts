/**
 * Lignes de prestation d'une facture.
 *
 * Module PUR : ni React, ni accès base, ni entrée/sortie, ni horloge. Tout ce
 * qui décide d'un montant de facture vit ici, hors du transport, pour être
 * testable sans Supabase ni Next.
 *
 * Trois règles y sont tenues, dans cet ordre d'importance :
 *
 * 1. FIGEMENT. Aucune fonction de ce module ne lit
 *    `settings.profile.service_catalog`. Une ligne porte déjà ses `label`,
 *    `unit_price`, `pricing` et `intro`, copiés du catalogue au moment où elle
 *    a été créée. Le catalogue peut changer, disparaître, être désactivé :
 *    une facture émise ne bouge pas. `lineFromCatalog` est le SEUL point du
 *    code où le catalogue est lu, et il ne l'est qu'à la création d'une ligne.
 *
 * 2. LE SERVEUR RECALCULE. `amount` et le total ne sont jamais repris du
 *    client : `normalizeInvoiceLines` les reconstruit à partir de
 *    `unit_price`, `pricing` et `quantity`. Un montant posté est ignoré.
 *
 * 3. PAS DE SUBSTITUT SILENCIEUX. Une donnée manquante qui rend la ligne
 *    incohérente est REFUSÉE (`validateInvoiceLines`), jamais remplacée par une
 *    valeur plausible : facturer trois séances quand une seule date est saisie
 *    produirait un document faux sans que personne ne le voie.
 */
import { round2 } from "@/lib/calc";
import type {
  InvoiceDateRender,
  InvoiceLine,
  ServiceCatalogItem,
  ServicePricing,
} from "@/lib/types";

/** Forme exigée d'une date de séance. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const PRICINGS: ServicePricing[] = ["forfait", "unitaire"];
const DATE_RENDERS: InvoiceDateRender[] = ["liste", "par_date"];

function asPricing(v: unknown): ServicePricing {
  return PRICINGS.includes(v as ServicePricing) ? (v as ServicePricing) : "forfait";
}

function asDateRender(v: unknown): InvoiceDateRender {
  return DATE_RENDERS.includes(v as InvoiceDateRender)
    ? (v as InvoiceDateRender)
    : "liste";
}

/** Nombre exploitable, ou 0. `NaN` et `Infinity` ne doivent pas atteindre un montant. */
function asNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Texte non vide, ou null. Une chaîne d'espaces est une absence. */
function asText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s === "" ? null : s;
}

/**
 * Dates de séance remises en ordre : triées croissantes, dédoublonnées.
 *
 * Sont écartées : `null`, les valeurs non textuelles, les chaînes vides et
 * celles qui ne sont pas au format « YYYY-MM-DD ». Ce dernier point est une
 * exigence du format déclaré du champ, pas un confort : une chaîne d'un autre
 * format se trierait n'importe où et s'imprimerait telle quelle sur un document
 * remis au patient. Une date écartée n'est pas remplacée — elle disparaît, et
 * `validateInvoiceLines` refuse alors la ligne si elle en avait besoin.
 *
 * Le tri lexicographique d'un « YYYY-MM-DD » est le tri chronologique.
 */
export function normalizeDates(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const kept = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const d = raw.trim();
    if (!ISO_DAY.test(d)) continue;
    kept.add(d);
  }
  return [...kept].sort();
}

/** Quantité facturée : entier >= 1. Toujours 1 au forfait. */
export function normalizeQuantity(pricing: ServicePricing, input: unknown): number {
  if (pricing === "forfait") return 1;
  const n = Math.floor(asNumber(input));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/**
 * Montant d'un bloc.
 *
 * - `forfait`   : le prix unique, quel que soit le nombre de dates. Trois
 *                 séances au forfait valent le forfait, pas trois fois.
 * - `unitaire`  : prix unitaire × quantité.
 *
 * `round2` est appliqué dans les deux cas. Au forfait c'est l'identité pour
 * tout prix à deux décimales ; c'est ce qui garantit qu'aucun flottant à
 * dix-septième décimale n'entre dans le jsonb, où la contrainte SQL
 * `round(revenue_gross,2) = round(invoice_lines_total(lines),2)` le relirait en
 * `numeric` exact.
 */
export function lineAmount(
  line: Pick<InvoiceLine, "pricing" | "unit_price" | "quantity">,
): number {
  const unit = asNumber(line.unit_price);
  if (line.pricing === "forfait") return round2(unit);
  return round2(unit * normalizeQuantity("unitaire", line.quantity));
}

/** Total d'une facture : somme des montants de bloc. */
export function invoiceLinesTotal(lines: InvoiceLine[]): number {
  return round2(lines.reduce((sum, l) => sum + asNumber(l.amount), 0));
}

/**
 * Remet une ligne reçue du client dans sa forme canonique.
 *
 * Ce qui vient du client et qui est CONSERVÉ : `id`, `catalog_id`, `label`,
 * `pricing`, `unit_price`, `intro`, `note`, `date_render`. Ce sont les valeurs
 * figées de la ligne ; le serveur n'a aucune autorité pour les corriger, et
 * surtout pas en allant les relire dans le catalogue.
 *
 * Ce qui est RECALCULÉ : `quantity` (forcée à 1 au forfait), `dates` (triées et
 * dédoublonnées) et `amount` (déduit de `unit_price` et `quantity`).
 */
export function normalizeInvoiceLine(raw: unknown): InvoiceLine {
  const o = (raw ?? {}) as Record<string, unknown>;
  const pricing = asPricing(o.pricing);
  const quantity = normalizeQuantity(pricing, o.quantity);
  const unit_price = asNumber(o.unit_price);

  return {
    id: typeof o.id === "string" && o.id.trim() !== "" ? o.id.trim() : "",
    catalog_id: asText(o.catalog_id),
    label: typeof o.label === "string" ? o.label.trim() : "",
    pricing,
    unit_price,
    quantity,
    dates: normalizeDates(o.dates),
    amount: lineAmount({ pricing, unit_price, quantity }),
    date_render: asDateRender(o.date_render),
    intro: asText(o.intro),
    note: asText(o.note),
  };
}

/**
 * Lignes reçues d'un formulaire : JSON, tableau déjà décodé, ou rien.
 *
 * Une charge illisible donne un tableau vide — jamais une exception, et jamais
 * une ligne inventée. L'appelant distingue ensuite « le client ne gère pas les
 * lignes » de « le client en a envoyé zéro » ; ce module ne le fait pas à sa
 * place.
 */
export function normalizeInvoiceLines(raw: unknown): InvoiceLine[] {
  let value = raw;
  if (typeof value === "string") {
    const s = value.trim();
    if (s === "") return [];
    try {
      value = JSON.parse(s);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.map(normalizeInvoiceLine);
}

/** Motif de refus d'une ligne, sans montant ni donnée de dossier. */
export type InvoiceLineProblem =
  /** Une ligne facturée à l'unité sans aucune date de séance exploitable. */
  | { code: "dates-manquantes"; index: number; label: string }
  /** Style « une ligne par date » alors que quantité et nombre de dates diffèrent. */
  | {
      code: "quantite-dates-incoherentes";
      index: number;
      label: string;
      quantity: number;
      dateCount: number;
    };

/**
 * Contrôles qui ne peuvent pas être rattrapés par un recalcul.
 *
 * À appliquer sur des lignes DÉJÀ normalisées : les dates y ont été triées et
 * dédoublonnées, donc « trois dates dont deux identiques » se présente ici
 * comme deux dates, et c'est bien ce qu'il faut comparer à la quantité.
 */
export function validateInvoiceLines(lines: InvoiceLine[]): InvoiceLineProblem[] {
  const problems: InvoiceLineProblem[] = [];

  lines.forEach((line, index) => {
    // Facturer « à l'unité » sans dire quelles séances, c'est un document que
    // ni le patient ni un contrôle ne peuvent rapprocher de quoi que ce soit.
    if (line.pricing === "unitaire" && line.dates.length === 0) {
      problems.push({ code: "dates-manquantes", index, label: line.label });
    }

    // « Une ligne par date » imprime un montant par date : si les deux nombres
    // divergent, la somme des lignes imprimées ne fait plus le total affiché.
    if (line.date_render === "par_date" && line.quantity !== line.dates.length) {
      problems.push({
        code: "quantite-dates-incoherentes",
        index,
        label: line.label,
        quantity: line.quantity,
        dateCount: line.dates.length,
      });
    }
  });

  return problems;
}

/**
 * Crée une ligne À PARTIR du catalogue. Unique point de lecture du catalogue.
 *
 * C'est ici, et seulement ici, que se fait la copie : après cet appel la ligne
 * est autonome. `catalog_id` garde la provenance, rien de plus — il ne sert
 * jamais à retrouver le tarif ou le libellé d'origine.
 *
 * `intro` est copiée telle quelle, y compris vide (`""` devient `null` : une
 * phrase vide n'est pas une phrase).
 */
export function lineFromCatalog(
  item: ServiceCatalogItem,
  id: string,
  overrides?: { quantity?: number; dates?: string[]; note?: string | null },
): InvoiceLine {
  return normalizeInvoiceLine({
    id,
    catalog_id: item.id,
    label: item.label,
    pricing: item.pricing,
    unit_price: item.unit_price,
    quantity: overrides?.quantity,
    dates: overrides?.dates ?? [],
    date_render: item.default_date_render,
    intro: item.intro,
    note: overrides?.note ?? null,
  });
}
