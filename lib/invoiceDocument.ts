/**
 * Modèle de document d'une facture.
 *
 * Module PUR : ni React, ni accès base, ni entrée/sortie. Il transforme la
 * projection imprimable d'une facture (`SharedInvoice`) en un modèle neutre de
 * tout rendu, consommé par les trois rendus existants :
 *   - la page interne          app/(app)/comptabilite/[id]/facture/page.tsx
 *   - la page publique         app/facture/[token]/page.tsx
 *   - le PDF                   lib/invoicePdf.tsx
 *
 * Ce que le modèle garantit :
 *
 * 1. il ne contient que ce qui s'imprime — aucun montant interne (rétrocession,
 *    URSSAF, net, encaissé) ne peut y entrer, puisque l'entrée est déjà la
 *    projection étroite construite par `toPrintable` ;
 * 2. nombres et dates y sont déjà des chaînes : `euro()` et `frDate()` ne sont
 *    appelés qu'ici, une seule fois par valeur ;
 * 3. une valeur absente est RETIRÉE du modèle, jamais remplacée par un
 *    substitut (« — », « N/A ») : une donnée absente ne doit pas ressembler à
 *    une donnée renseignée (docs/clinical/CLINICAL_SAFETY.md). Les deux replis
 *    d'affichage qui existent aujourd'hui (« — » pour un nom de destinataire
 *    vide, « Psychomotricien(ne) » pour un nom de praticien absent) restent donc
 *    dans chaque rendu, inchangés ;
 * 4. aucune couleur n'y est un jeton Tailwind. À ce jour aucune couleur de la
 *    facture ne dépend de la donnée : le modèle n'en porte donc aucune.
 *
 * Divergence connue et VOLONTAIREMENT conservée à cette étape : le titre
 * « FACTURE » est #1d5854 (brand-700) à l'écran et #2f8a82 (brand-500, codé en
 * dur) dans le PDF. Le choix est visible par l'utilisatrice, il fera l'objet
 * d'une étape séparée. Quand il sera tranché, la couleur retenue viendra ici,
 * en hexadécimal résolu, et les trois rendus la liront.
 *
 * `buildInvoiceDocument` est pure et déterministe : l'horloge est injectée par
 * `options.now`, elle n'est lue que pour le dernier repli de la date d'émission.
 */
import type { PrintableInvoiceLine, SharedInvoice } from "@/lib/invoiceShare";
import { euro, frDate } from "@/lib/format";

/** Libellé de prestation appliqué quand la facture n'en porte aucun. */
export const DEFAULT_SERVICE_LABEL = "Séance de psychomotricité";

/** Fragment d'un bloc de texte. */
export type InvoiceDocumentSegment = {
  text: string;
  /** Fragment atténué (période de facturation, « (PCO) »). Chaque rendu applique
   *  sa propre couleur secondaire : le modèle ne porte aucune couleur. */
  muted: boolean;
};

/**
 * Bloc de texte imprimé, exposé en fragments et jamais en chaîne unique.
 *
 * Les rendus posent les fragments côte à côte ; ils ne doivent PAS les
 * concaténer. Deux raisons, toutes deux mesurées :
 *   - un fragment peut être atténué et l'autre non (« Séance… — Mars 2026 ») ;
 *     le HTML l'enveloppe dans un `<span>`, react-pdf dans un `<Text>` imbriqué ;
 *   - même sans atténuation, react-pdf ne crêne pas une chaîne unique comme deux
 *     fragments voisins : il applique la paire de crénage qui enjambe la
 *     frontière. Concaténer « Règlement : » et « Virement » déplace la ligne,
 *     alignée à droite, de 0,4 pt.
 *
 * `segments` n'est jamais vide : un bloc sans rien à imprimer n'est pas produit.
 * `multiline` signale des retours à la ligne à préserver — le HTML pose
 * `whitespace-pre-line`, react-pdf respecte les « \n » nativement.
 */
export type InvoiceDocumentText = {
  segments: InvoiceDocumentSegment[];
  multiline: boolean;
};

/** Ligne de prestation du tableau. */
export type InvoiceDocumentLine = {
  /** Cellule « Désignation » : libellé, puis suffixes atténués (période, PCO). */
  designation: InvoiceDocumentText;
  /** Montant déjà formaté. */
  amount: string;
};

export type InvoiceDocument = {
  /** Bloc d'identité du praticien. */
  issuer: {
    /** Absent si aucun logo n'est enregistré. Chaque rendu reste libre de le refuser. */
    logoUrl?: string;
    /** Absent si le compte n'a pas de nom : chaque rendu applique son propre repli. */
    name?: string;
    /** Lignes d'identité, dans l'ordre d'impression. Une ligne sans contenu est absente. */
    lines: InvoiceDocumentText[];
  };
  header: {
    /** « FACTURE ». */
    title: string;
    /** « N° … ». Absent si la facture n'a pas de numéro. */
    number?: InvoiceDocumentText;
    /** « Date : … ». Toujours présent : la date d'émission a un repli en cascade. */
    date: InvoiceDocumentText;
  };
  billedTo: {
    /** « Facturé à ». */
    label: string;
    /** Absent si la facture ne porte aucun nom : chaque rendu applique son repli. */
    name?: string;
    /** Adresse du destinataire. Absente si non renseignée. */
    address?: InvoiceDocumentText;
  };
  table: {
    designationHeader: string;
    amountHeader: string;
    /**
     * Lignes imprimées, dans l'ordre. Jamais vide.
     *
     * Une facture héritée (`lines` absent ou vide) en produit exactement une,
     * dérivée de `service_label` comme auparavant. Une facture à blocs en
     * produit une par bloc au style « liste », et une par date au style
     * « par_date ».
     */
    lines: InvoiceDocumentLine[];
    /**
     * @deprecated Première ligne seulement — `lines[0]`.
     *
     * Conservé le temps que les trois rendus passent à `lines`. Sur une facture
     * à plusieurs blocs, un rendu qui lit encore `line` n'imprime QUE le
     * premier, sous un total qui vaut la somme de tous : le document serait
     * faux. Les rendus doivent basculer sur `lines` dans la même livraison que
     * la saisie multi-lignes.
     */
    line: InvoiceDocumentLine;
  };
  total: {
    label: string;
    amount: string;
    /** « Règlement : … ». Absent si aucun mode de règlement n'est enregistré. */
    note?: InvoiceDocumentText;
  };
  /** Mentions légales du praticien. Absentes si non renseignées. */
  legalMentions?: InvoiceDocumentText;
};

const segment = (text: string): InvoiceDocumentSegment => ({ text, muted: false });

/** Bloc d'une seule valeur. Rien n'est produit s'il n'y a rien à imprimer. */
function valueBlock(
  value: string | null | undefined,
  multiline = false,
): InvoiceDocumentText | undefined {
  return value ? { segments: [segment(value)], multiline } : undefined;
}

/**
 * Bloc « libellé + valeur ». Rien n'est produit sans valeur : le libellé seul
 * ne s'imprime jamais. Les deux restent deux fragments (voir le crénage).
 */
function labelledBlock(
  label: string,
  value: string | null | undefined,
): InvoiceDocumentText | undefined {
  return value ? { segments: [segment(label), segment(value)], multiline: false } : undefined;
}

/** Date du jour au format ISO court, comme les trois rendus le faisaient. */
function isoDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Suffixes de NIVEAU FACTURE : période de facturation, puis « (PCO) ».
 *
 * Ils n'appartiennent à aucun bloc en particulier. Ils sont posés sur la
 * PREMIÈRE ligne imprimée, et sur elle seule — c'est ce qui fait qu'une facture
 * à un seul bloc « liste » sans date s'imprime exactement comme la facture à
 * ligne unique d'aujourd'hui. Les répéter sur chaque ligne laisserait croire
 * que la période qualifie le bloc.
 */
function invoiceSuffixes(
  invoice: SharedInvoice["invoice"],
): InvoiceDocumentSegment[] {
  const out: InvoiceDocumentSegment[] = [];
  if (invoice.billing_month) {
    out.push({
      text: ` — ${invoice.billing_month}${invoice.billing_year ? ` ${invoice.billing_year}` : ""}`,
      muted: true,
    });
  }
  if (invoice.has_pco) {
    out.push({ text: " (PCO)", muted: true });
  }
  return out;
}

/** Un bloc porte des retours à la ligne dès qu'un de ses fragments en contient. */
function asDesignation(segments: InvoiceDocumentSegment[]): InvoiceDocumentText {
  return { segments, multiline: segments.some((s) => s.text.includes("\n")) };
}

/**
 * Lignes imprimées d'UN bloc de prestation.
 *
 * Deux styles, tels que la ligne les a figés à l'enregistrement :
 *
 *   - « liste »    : une seule ligne de tableau. Les dates sont groupées sous
 *                    le libellé, le montant est celui du bloc.
 *   - « par_date » : une ligne de tableau par date, chacune portant le prix
 *                    unitaire. Le serveur a déjà refusé l'enregistrement si la
 *                    quantité ne suivait pas le nombre de dates, sans quoi la
 *                    somme des lignes imprimées ne ferait plus le total.
 *
 * L'introduction n'est PAS atténuée : c'est une phrase écrite par la
 * praticienne, au même titre que le libellé. Les dates et la note le sont,
 * comme la période de facturation l'est déjà — ce sont des accessoires du
 * libellé, pas le libellé.
 *
 * Une date illisible est retirée, jamais remplacée par un substitut.
 */
function documentLinesForBlock(
  line: PrintableInvoiceLine,
  suffixes: InvoiceDocumentSegment[],
): InvoiceDocumentLine[] {
  const label = line.label || DEFAULT_SERVICE_LABEL;
  const intro = line.intro?.trim();
  const note = line.note?.trim();
  const dates = (line.dates ?? []).map(frDate).filter((d) => d !== "");

  if (line.date_render === "par_date" && dates.length > 0) {
    const unit = euro(line.unit_price);
    return dates.map((d, i) => {
      const segments: InvoiceDocumentSegment[] = [segment(label)];
      if (i === 0) segments.push(...suffixes);
      segments.push({ text: ` — ${d}`, muted: true });
      if (i === 0 && intro) segments.push({ text: `\n${intro}`, muted: false });
      if (i === dates.length - 1 && note) {
        segments.push({ text: `\n${note}`, muted: true });
      }
      return { designation: asDesignation(segments), amount: unit };
    });
  }

  // « liste », et repli d'un « par_date » qui n'a plus aucune date exploitable :
  // mieux vaut un bloc unique correct qu'un tableau vide.
  const segments: InvoiceDocumentSegment[] = [segment(label), ...suffixes];
  if (intro) segments.push({ text: `\n${intro}`, muted: false });
  if (dates.length > 0) {
    segments.push({ text: `\n${dates.join(", ")}`, muted: true });
  }
  if (note) segments.push({ text: `\n${note}`, muted: true });

  return [{ designation: asDesignation(segments), amount: euro(line.amount) }];
}

export function buildInvoiceDocument(
  source: SharedInvoice,
  options?: { now?: Date },
): InvoiceDocument {
  const { invoice, patient, settings } = source;
  const profile = settings.profile;

  // Repli en cascade de la date d'émission. Il fait bouger la date affichée des
  // anciennes factures sans `issue_date` d'une impression à l'autre : défaut
  // connu et assumé, conservé tel quel ici (voir docs/context/DECISIONS.md).
  const issueDate =
    invoice.issue_date ?? invoice.payment_date ?? isoDay(options?.now ?? new Date());
  const issueDateText = frDate(issueDate);

  // Le total reste `revenue_gross`, colonne réelle et seule source du montant
  // dû. Le serveur l'a recalculé comme la somme des blocs à l'enregistrement, et
  // une contrainte SQL le vérifie : le modèle n'a pas à refaire l'addition.
  const amount = euro(invoice.revenue_gross ?? 0);

  const suffixes = invoiceSuffixes(invoice);

  // `?? []` couvre une base où la migration 013 n'est pas encore passée : la
  // clé `lines` est alors absente de la réponse de `invoice_by_token`.
  const blocks = invoice.lines ?? [];

  const tableLines: InvoiceDocumentLine[] =
    blocks.length > 0
      ? blocks.flatMap((b, i) => documentLinesForBlock(b, i === 0 ? suffixes : []))
      : // Facture héritée : la ligne unique d'aujourd'hui, au fragment près.
        [
          {
            designation: {
              segments: [
                segment(invoice.service_label ?? DEFAULT_SERVICE_LABEL),
                ...suffixes,
              ],
              multiline: false,
            },
            amount,
          },
        ];

  const issuerLines = [
    valueBlock(profile.address, true),
    valueBlock([profile.postal_code, profile.city].filter(Boolean).join(" ")),
    labelledBlock("Tél. ", profile.business_phone),
    valueBlock(profile.business_email),
    labelledBlock("SIRET : ", profile.siret),
    labelledBlock("N° ADELI : ", profile.adeli),
  ].filter((l): l is InvoiceDocumentText => l !== undefined);

  const paymentNote = invoice.payment_method
    ? {
        segments: [
          segment("Règlement : "),
          segment(invoice.payment_method),
          ...(invoice.payment_date
            ? [segment(` le ${frDate(invoice.payment_date)}`)]
            : []),
        ],
        multiline: false,
      }
    : undefined;

  return {
    issuer: {
      logoUrl: profile.logo_url || undefined,
      // `??` et non `||` : une chaîne vide n'est pas une absence. Les trois
      // rendus appliquent ensuite leur repli avec `??`, qui ne rattrape que
      // null/undefined — un `||` ici substituerait « Psychomotricien(ne) » au
      // nom vide, là où l'ancien code imprimait un nom vide.
      name: settings.display_name ?? undefined,
      lines: issuerLines,
    },
    header: {
      title: "FACTURE",
      number: labelledBlock("N° ", invoice.invoice_number),
      // Cette ligne s'imprime toujours, même sans date exploitable — son libellé
      // seul reste alors, comme aujourd'hui, mais aucun fragment vide n'entre
      // dans le modèle.
      date: {
        segments: issueDateText
          ? [segment("Date : "), segment(issueDateText)]
          : [segment("Date : ")],
        multiline: false,
      },
    },
    billedTo: {
      label: "Facturé à",
      name: invoice.patient_name || undefined,
      address: valueBlock(patient?.address, true),
    },
    table: {
      designationHeader: "Désignation",
      amountHeader: "Montant",
      lines: tableLines,
      // Repli des rendus qui n'ont pas encore basculé sur `lines`.
      line: tableLines[0],
    },
    total: {
      label: "Total à payer",
      amount,
      note: paymentNote,
    },
    legalMentions: valueBlock(profile.legal_mentions, true),
  };
}
