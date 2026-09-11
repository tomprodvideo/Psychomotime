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
import type { SharedInvoice } from "@/lib/invoiceShare";
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
    /** Une facture ne porte aujourd'hui qu'une seule ligne de prestation. */
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

  const amount = euro(invoice.revenue_gross ?? 0);

  const designation: InvoiceDocumentSegment[] = [
    segment(invoice.service_label ?? DEFAULT_SERVICE_LABEL),
  ];
  if (invoice.billing_month) {
    designation.push({
      text: ` — ${invoice.billing_month}${invoice.billing_year ? ` ${invoice.billing_year}` : ""}`,
      muted: true,
    });
  }
  if (invoice.has_pco) {
    designation.push({ text: " (PCO)", muted: true });
  }

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
      line: { designation: { segments: designation, multiline: false }, amount },
    },
    total: {
      label: "Total à payer",
      amount,
      note: paymentNote,
    },
    legalMentions: valueBlock(profile.legal_mentions, true),
  };
}
