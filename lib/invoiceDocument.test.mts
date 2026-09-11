/**
 * Modèle de document d'une facture — tests du lanceur intégré de Node.
 *
 *   npm test
 *   node --import ./scripts/test-hooks.mjs --test "lib/**\/*.test.mts"
 *
 * Données STRICTEMENT synthétiques et manifestement fictives : aucune donnée
 * réelle de patient ni de praticien n'entre ici (CLAUDE.md, règle 1).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { euro } from "@/lib/format";
import {
  PRINTABLE_PROFILE_KEYS,
  toPrintable,
  type SharedInvoice,
} from "@/lib/invoiceShare";
import {
  buildInvoiceDocument,
  DEFAULT_SERVICE_LABEL,
  type InvoiceDocument,
} from "@/lib/invoiceDocument";

/** Horloge figée : le modèle ne doit dépendre d'aucune horloge réelle. */
const NOW = new Date("2026-09-11T08:30:00.000Z");

/** Montants internes, choisis distincts pour être repérables dans le modèle. */
const MONTANTS_INTERNES = {
  retrocession_amount: 11.11,
  urssaf_amount: 22.22,
  after_retro: 33.33,
  net_revenue: 44.44,
  revenue_gross_paid: 55.55,
};

/** Facture complète, telle que la vue interne la lit (`select("*")`). */
const FACTURE_INTERNE = {
  id: "00000000-0000-4000-8000-000000000001",
  user_id: "00000000-0000-4000-8000-0000000000ff",
  patient_id: "00000000-0000-4000-8000-000000000002",
  patient_name: "Alex Exemple",
  invoice_number: "F-TEST-0001",
  billing_month: "Mars",
  billing_year: 2026,
  has_pco: true,
  revenue_gross: 60,
  payment_method: "Virement",
  payment_date: "2026-03-28",
  issue_date: "2026-03-25",
  service_label: null,
  notes: "Note interne fictive",
  created_at: "2026-03-25T10:00:00.000Z",
  share_token: "jeton-fictif-de-test-0000000000000000",
  share_expires_at: "2026-06-23T10:00:00.000Z",
  ...MONTANTS_INTERNES,
};

/** Fiche patient complète, telle que la vue interne la lit. */
const PATIENT_INTERNE = {
  id: "00000000-0000-4000-8000-000000000002",
  user_id: "00000000-0000-4000-8000-0000000000ff",
  first_name: "Alex",
  last_name: "Exemple",
  birth_date: "2015-02-03",
  email: "alex.exemple@exemple.test",
  phone: "00 00 00 00 01",
  address: "2 impasse des Essais\n00000 Villefictive",
  notes: "Notes cliniques fictives, ne doivent jamais sortir sur une facture",
  guardian: { relation: "Parent", first_name: "Dominique", last_name: "Exemple" },
  dossier: { motif: "Motif fictif" },
  created_at: "2026-01-05T09:00:00.000Z",
};

/** Réglages complets, tels que `getSettings()` les renvoie. */
const REGLAGES_INTERNES = {
  user_id: "00000000-0000-4000-8000-0000000000ff",
  display_name: "Lou Fictif",
  retrocession_rate: 0.2,
  urssaf_rate: 0.22,
  charge_mode: "retrocession" as const,
  monthly_rent: 0,
  profile: {
    logo_url: "data:image/png;base64,AAAA",
    address: "1 rue de l'Exemple\nBâtiment B",
    postal_code: "00000",
    city: "Villefictive",
    business_phone: "00 00 00 00 00",
    business_email: "cabinet@exemple.test",
    siret: "000 000 000 00000",
    adeli: "009999999",
    legal_mentions: "Mentions fictives.\nTVA non applicable.",
    // Champs du profil qui ne doivent jamais atteindre un document de facture.
    signature_url: "data:image/png;base64,BBBB",
    theme_color: "#123456",
    bilan_sections: [{ id: "s1", title: "Section fictive" }],
  },
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

/**
 * Même facture, telle que la fonction SQL `invoice_by_token` la renvoie à la
 * page publique. Recopiée à la main d'après supabase/migration_012.sql.
 */
const FACTURE_PARTAGEE: SharedInvoice = {
  invoice: {
    invoice_number: "F-TEST-0001",
    patient_name: "Alex Exemple",
    billing_month: "Mars",
    billing_year: 2026,
    has_pco: true,
    revenue_gross: 60,
    payment_method: "Virement",
    payment_date: "2026-03-28",
    issue_date: "2026-03-25",
    service_label: null,
    // Facture héritée : aucune ligne. C'est un état légal et permanent.
    lines: [],
  },
  patient: { address: "2 impasse des Essais\n00000 Villefictive" },
  settings: {
    display_name: "Lou Fictif",
    profile: {
      logo_url: "data:image/png;base64,AAAA",
      address: "1 rue de l'Exemple\nBâtiment B",
      postal_code: "00000",
      city: "Villefictive",
      business_phone: "00 00 00 00 00",
      business_email: "cabinet@exemple.test",
      siret: "000 000 000 00000",
      adeli: "009999999",
      legal_mentions: "Mentions fictives.\nTVA non applicable.",
    },
  },
};

/** Parcourt le modèle et applique un contrôle à chaque valeur terminale. */
function eachValue(
  value: unknown,
  visit: (v: string | number | boolean | null, chemin: string) => void,
  chemin = "",
): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => eachValue(v, visit, `${chemin}[${i}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      eachValue(v, visit, chemin ? `${chemin}.${k}` : k);
    }
    return;
  }
  if (value === undefined) return;
  visit(value as string | number | boolean | null, chemin);
}

test("le modèle d'une facture complète est celui attendu", () => {
  const doc = buildInvoiceDocument(FACTURE_PARTAGEE, { now: NOW });

  const plein = (...textes: string[]) => ({
    segments: textes.map((text) => ({ text, muted: false })),
    multiline: false,
  });

  // Sans ligne, le tableau garde exactement la ligne unique d'avant la
  // migration 013, et `line` reste le premier élément de `lines`.
  const ligneHeritee = {
    designation: {
      segments: [
        { text: DEFAULT_SERVICE_LABEL, muted: false },
        { text: " — Mars 2026", muted: true },
        { text: " (PCO)", muted: true },
      ],
      multiline: false,
    },
    amount: euro(60),
  };

  const attendu: InvoiceDocument = {
    issuer: {
      logoUrl: "data:image/png;base64,AAAA",
      name: "Lou Fictif",
      lines: [
        { ...plein("1 rue de l'Exemple\nBâtiment B"), multiline: true },
        plein("00000 Villefictive"),
        // Libellé et valeur restent deux fragments : voir la note de crénage.
        plein("Tél. ", "00 00 00 00 00"),
        plein("cabinet@exemple.test"),
        plein("SIRET : ", "000 000 000 00000"),
        plein("N° ADELI : ", "009999999"),
      ],
    },
    header: {
      title: "FACTURE",
      number: plein("N° ", "F-TEST-0001"),
      date: plein("Date : ", "25/03/2026"),
    },
    billedTo: {
      label: "Facturé à",
      name: "Alex Exemple",
      address: {
        ...plein("2 impasse des Essais\n00000 Villefictive"),
        multiline: true,
      },
    },
    table: {
      designationHeader: "Désignation",
      amountHeader: "Montant",
      lines: [ligneHeritee],
      line: ligneHeritee,
    },
    total: {
      label: "Total à payer",
      amount: euro(60),
      note: plein("Règlement : ", "Virement", " le 28/03/2026"),
    },
    legalMentions: {
      ...plein("Mentions fictives.\nTVA non applicable."),
      multiline: true,
    },
  };

  assert.deepEqual(doc, attendu);
  // Les montants sont des chaînes déjà formatées, pas des nombres.
  assert.match(doc.total.amount, /^60,00\s?€$/u);
  assert.equal(doc.table.line.amount, doc.total.amount);
});

test("vue interne et vue publique produisent le même document", () => {
  const projection = toPrintable(
    FACTURE_INTERNE,
    PATIENT_INTERNE,
    REGLAGES_INTERNES,
  );

  // La projection interne reproduit exactement ce que renvoie la fonction SQL.
  assert.deepEqual(projection, FACTURE_PARTAGEE);

  const interne = buildInvoiceDocument(projection, { now: NOW });
  const publique = buildInvoiceDocument(FACTURE_PARTAGEE, { now: NOW });
  assert.deepEqual(interne, publique);
});

test("aucun montant interne n'atteint le modèle", () => {
  const projection = toPrintable(
    FACTURE_INTERNE,
    PATIENT_INTERNE,
    REGLAGES_INTERNES,
  );

  // La projection ne porte QUE les champs imprimables : la liste fait foi.
  assert.deepEqual(Object.keys(projection.invoice).sort(), [
    "billing_month",
    "billing_year",
    "has_pco",
    "invoice_number",
    "issue_date",
    "lines",
    "patient_name",
    "payment_date",
    "payment_method",
    "revenue_gross",
    "service_label",
  ]);
  assert.deepEqual(Object.keys(projection.patient ?? {}), ["address"]);
  assert.deepEqual(
    Object.keys(projection.settings.profile).sort(),
    [...PRINTABLE_PROFILE_KEYS].sort(),
  );

  const serialise = JSON.stringify(
    buildInvoiceDocument(projection, { now: NOW }),
  );

  // Ni les valeurs brutes, ni leur forme formatée, ni le nom des colonnes.
  for (const [colonne, montant] of Object.entries(MONTANTS_INTERNES)) {
    assert.ok(!serialise.includes(colonne), `colonne ${colonne} présente`);
    assert.ok(!serialise.includes(String(montant)), `valeur ${montant} présente`);
    assert.ok(
      !serialise.includes(euro(montant)),
      `montant formaté ${euro(montant)} présent`,
    );
  }

  // Ni les autres données du dossier qui ne s'impriment pas sur une facture.
  for (const interdit of [
    PATIENT_INTERNE.email,
    PATIENT_INTERNE.phone,
    PATIENT_INTERNE.birth_date,
    PATIENT_INTERNE.notes,
    PATIENT_INTERNE.guardian.first_name,
    REGLAGES_INTERNES.profile.signature_url,
    REGLAGES_INTERNES.profile.theme_color,
    FACTURE_INTERNE.notes,
    FACTURE_INTERNE.share_token,
    String(REGLAGES_INTERNES.retrocession_rate),
    String(REGLAGES_INTERNES.urssaf_rate),
  ]) {
    assert.ok(!serialise.includes(interdit), `donnée interne présente : ${interdit}`);
  }
});

test("une valeur absente est retirée, jamais remplacée par un substitut", () => {
  const minimale: SharedInvoice = {
    invoice: {
      invoice_number: null,
      patient_name: "",
      billing_month: null,
      billing_year: null,
      has_pco: false,
      revenue_gross: null,
      payment_method: null,
      payment_date: null,
      issue_date: null,
      service_label: null,
      lines: [],
    },
    patient: null,
    settings: {
      display_name: null,
      profile: {
        logo_url: null,
        address: null,
        postal_code: null,
        city: null,
        business_phone: null,
        business_email: null,
        siret: null,
        adeli: null,
        legal_mentions: null,
      },
    },
  };

  const doc = buildInvoiceDocument(minimale, { now: NOW });

  assert.deepEqual(doc.issuer.lines, []);
  assert.equal(doc.issuer.logoUrl, undefined);
  assert.equal(doc.issuer.name, undefined);
  assert.equal(doc.header.number, undefined);
  assert.equal(doc.billedTo.name, undefined);
  assert.equal(doc.billedTo.address, undefined);
  assert.equal(doc.total.note, undefined);
  assert.equal(doc.legalMentions, undefined);
  assert.equal(doc.table.lines.length, 1);
  assert.deepEqual(doc.table.line.designation, {
    segments: [{ text: DEFAULT_SERVICE_LABEL, muted: false }],
    multiline: false,
  });
  // La ligne de date s'imprime toujours ; sans date exploitable elle se réduit
  // à son libellé, jamais à un fragment vide.
  assert.deepEqual(doc.header.date.segments.length, 2);

  // Aucun substitut, aucune valeur vide et aucun `null` dans le modèle.
  eachValue(doc, (v, chemin) => {
    assert.notEqual(v, null, `valeur nulle en ${chemin}`);
    assert.notEqual(v, "", `chaîne vide en ${chemin}`);
    if (typeof v === "string") {
      assert.ok(!/^(—|-|N\/A|null|undefined)$/u.test(v.trim()), `substitut en ${chemin}`);
    }
  });
});

test("le modèle est pur : même entrée, même sortie, horloge injectée", () => {
  const sansDate: SharedInvoice = {
    ...FACTURE_PARTAGEE,
    invoice: { ...FACTURE_PARTAGEE.invoice, issue_date: null, payment_date: null },
  };

  // Repli en cascade : à défaut de date d'émission et de règlement, l'horloge.
  const texteDate = (d: InvoiceDocument) =>
    d.header.date.segments.map((s) => s.text).join("");

  assert.equal(
    texteDate(buildInvoiceDocument(sansDate, { now: NOW })),
    "Date : 11/09/2026",
  );
  // Repli intermédiaire : la date de règlement.
  assert.equal(
    texteDate(
      buildInvoiceDocument(
        {
          ...FACTURE_PARTAGEE,
          invoice: { ...FACTURE_PARTAGEE.invoice, issue_date: null },
        },
        { now: NOW },
      ),
    ),
    "Date : 28/03/2026",
  );
  // Une date d'émission présente ignore l'horloge.
  assert.equal(
    texteDate(
      buildInvoiceDocument(FACTURE_PARTAGEE, {
        now: new Date("2030-01-01T00:00:00.000Z"),
      }),
    ),
    "Date : 25/03/2026",
  );

  assert.deepEqual(
    buildInvoiceDocument(sansDate, { now: NOW }),
    buildInvoiceDocument(sansDate, { now: NOW }),
  );
});

test("le libellé de prestation et ses suffixes restent des segments distincts", () => {
  const doc = buildInvoiceDocument(
    {
      ...FACTURE_PARTAGEE,
      invoice: {
        ...FACTURE_PARTAGEE.invoice,
        service_label: "Bilan psychomoteur",
        billing_year: null,
        has_pco: false,
      },
    },
    { now: NOW },
  );

  assert.deepEqual(doc.table.line.designation, {
    segments: [
      { text: "Bilan psychomoteur", muted: false },
      { text: " — Mars", muted: true },
    ],
    multiline: false,
  });
});
