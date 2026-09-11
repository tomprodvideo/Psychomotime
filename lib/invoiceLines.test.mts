/**
 * Lignes de prestation d'une facture — tests du lanceur intégré de Node.
 *
 *   npm test
 *   node --import ./scripts/test-hooks.mjs --test "lib/**\/*.test.mts"
 *
 * Données STRICTEMENT synthétiques et manifestement fictives : libellés
 * « d'essai », tarifs ronds choisis pour être reconnaissables dans une sortie.
 * Aucun tarif ni libellé réel de la praticienne n'entre ici (CLAUDE.md, règle 1).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { euro } from "@/lib/format";
import {
  invoiceLinesTotal,
  lineAmount,
  lineFromCatalog,
  normalizeDates,
  normalizeInvoiceLine,
  normalizeInvoiceLines,
  validateInvoiceLines,
} from "@/lib/invoiceLines";
import { toPrintable, type SharedInvoice } from "@/lib/invoiceShare";
import { buildInvoiceDocument, DEFAULT_SERVICE_LABEL } from "@/lib/invoiceDocument";
import type { InvoiceLine, ServiceCatalogItem } from "@/lib/types";

const NOW = new Date("2026-09-11T08:30:00.000Z");

/** Ligne canonique de test ; chaque cas n'en modifie que ce qui l'intéresse. */
function ligne(over: Partial<InvoiceLine> = {}): InvoiceLine {
  return normalizeInvoiceLine({
    id: "ligne-essai-1",
    catalog_id: null,
    label: "Prestation d'essai",
    pricing: "unitaire",
    unit_price: 10,
    quantity: 1,
    dates: [],
    date_render: "liste",
    intro: null,
    note: null,
    ...over,
  });
}

// ============================================================
//  Calcul
// ============================================================

test("un forfait vaut le prix unique, quel que soit le nombre de dates", () => {
  const troisDates = ligne({
    pricing: "forfait",
    unit_price: 90,
    quantity: 3,
    dates: ["2026-03-05", "2026-03-12", "2026-03-19"],
  });

  assert.equal(troisDates.amount, 90);
  // La quantité est ramenée à 1 : un forfait ne se multiplie pas.
  assert.equal(troisDates.quantity, 1);
  assert.equal(troisDates.dates.length, 3);

  // Une date de plus ou de moins ne bouge pas le montant.
  const uneDate = ligne({
    pricing: "forfait",
    unit_price: 90,
    quantity: 3,
    dates: ["2026-03-05"],
  });
  const aucuneDate = ligne({ pricing: "forfait", unit_price: 90, quantity: 3 });
  assert.equal(uneDate.amount, 90);
  assert.equal(aucuneDate.amount, 90);
});

test("à l'unité, le montant suit la quantité — 3 dates puis 4", () => {
  const trois = ligne({
    unit_price: 10,
    quantity: 3,
    dates: ["2026-03-05", "2026-03-12", "2026-03-19"],
    date_render: "par_date",
  });
  assert.equal(trois.amount, 30);
  assert.deepEqual(validateInvoiceLines([trois]), []);

  // Une 4e date sans toucher la quantité : le style « par_date » imprimerait
  // 4 montants sous un total qui n'en compte que 3. Refusé.
  const quatreDatesTroisSeances = ligne({
    unit_price: 10,
    quantity: 3,
    dates: ["2026-03-05", "2026-03-12", "2026-03-19", "2026-03-26"],
    date_render: "par_date",
  });
  assert.equal(quatreDatesTroisSeances.amount, 30);
  assert.deepEqual(validateInvoiceLines([quatreDatesTroisSeances]), [
    {
      code: "quantite-dates-incoherentes",
      index: 0,
      label: "Prestation d'essai",
      quantity: 3,
      dateCount: 4,
    },
  ]);

  // La quantité mise à 4 : le montant suit, et la ligne redevient valide.
  const quatre = ligne({
    unit_price: 10,
    quantity: 4,
    dates: ["2026-03-05", "2026-03-12", "2026-03-19", "2026-03-26"],
    date_render: "par_date",
  });
  assert.equal(quatre.amount, 40);
  assert.deepEqual(validateInvoiceLines([quatre]), []);
});

test("le même écart est toléré au style « liste »", () => {
  // En liste, les dates sont groupées sous un montant unique : rien n'oblige
  // leur nombre à suivre la quantité (une séance peut couvrir deux dates).
  const l = ligne({
    unit_price: 10,
    quantity: 3,
    dates: ["2026-03-05", "2026-03-12", "2026-03-19", "2026-03-26"],
    date_render: "liste",
  });
  assert.deepEqual(validateInvoiceLines([l]), []);
});

test("une ligne à l'unité sans aucune date est refusée", () => {
  const sansDate = ligne({ unit_price: 10, quantity: 2, dates: [] });
  assert.deepEqual(validateInvoiceLines([sansDate]), [
    { code: "dates-manquantes", index: 0, label: "Prestation d'essai" },
  ]);

  // Un forfait, lui, peut n'en avoir aucune.
  const forfait = ligne({ pricing: "forfait", unit_price: 40, dates: [] });
  assert.deepEqual(validateInvoiceLines([forfait]), []);
});

test("le rang de la ligne fautive est rendu, pas seulement son existence", () => {
  const bonnes = ligne({ dates: ["2026-03-05"] });
  const mauvaise = ligne({ label: "Autre essai", dates: [] });
  const problems = validateInvoiceLines([bonnes, bonnes, mauvaise]);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].index, 2);
  assert.equal(problems[0].label, "Autre essai");
});

test("les dates sont triées, dédoublonnées, et le vide est rejeté", () => {
  assert.deepEqual(
    normalizeDates([
      "2026-03-19",
      "2026-03-05",
      "2026-03-19", // doublon
      "",
      null,
      undefined,
      "   ",
      "2026-03-12",
      "05/03/2026", // mauvais format : écarté, pas réécrit
      42,
    ]),
    ["2026-03-05", "2026-03-12", "2026-03-19"],
  );

  assert.deepEqual(normalizeDates(null), []);
  assert.deepEqual(normalizeDates("2026-03-05"), []);

  // Sur une ligne complète, c'est la liste dédoublonnée qui sert au contrôle
  // « une ligne par date » : trois entrées dont un doublon font deux dates.
  const l = ligne({
    quantity: 3,
    dates: ["2026-03-12", "2026-03-05", "2026-03-12"],
    date_render: "par_date",
  });
  assert.deepEqual(l.dates, ["2026-03-05", "2026-03-12"]);
  assert.deepEqual(validateInvoiceLines([l]), [
    {
      code: "quantite-dates-incoherentes",
      index: 0,
      label: "Prestation d'essai",
      quantity: 3,
      dateCount: 2,
    },
  ]);
});

test("la quantité est un entier supérieur ou égal à 1", () => {
  assert.equal(ligne({ quantity: 0 }).quantity, 1);
  assert.equal(ligne({ quantity: -5 }).quantity, 1);
  assert.equal(ligne({ quantity: 2.7 }).quantity, 2);
  assert.equal(ligne({ quantity: Number.NaN }).quantity, 1);
  assert.equal(ligne({ quantity: undefined }).quantity, 1);
});

test("le montant posté par le client est ignoré, jamais repris", () => {
  const forge = normalizeInvoiceLine({
    id: "ligne-essai-2",
    label: "Prestation d'essai",
    pricing: "unitaire",
    unit_price: 10,
    quantity: 2,
    dates: ["2026-03-05", "2026-03-12"],
    date_render: "liste",
    amount: 999, // valeur postée, sans effet
  });
  assert.equal(forge.amount, 20);

  const forfaitForge = normalizeInvoiceLine({
    id: "ligne-essai-3",
    label: "Forfait d'essai",
    pricing: "forfait",
    unit_price: 50,
    quantity: 9,
    amount: 450,
  });
  assert.equal(forfaitForge.amount, 50);
});

test("le total d'une facture est la somme des blocs, arrondie au centime", () => {
  const a = ligne({ unit_price: 10, quantity: 3, dates: ["2026-03-05"] });
  const b = ligne({ pricing: "forfait", unit_price: 24 });
  assert.equal(invoiceLinesTotal([a, b]), 54);

  // Sommes flottantes : le total ne doit pas traîner de décimale parasite.
  const c = ligne({ pricing: "forfait", unit_price: 0.1 });
  const d = ligne({ pricing: "forfait", unit_price: 0.2 });
  assert.equal(invoiceLinesTotal([c, d]), 0.3);

  assert.equal(invoiceLinesTotal([]), 0);
});

test("une charge de lignes illisible donne zéro ligne, jamais une exception", () => {
  assert.deepEqual(normalizeInvoiceLines(undefined), []);
  assert.deepEqual(normalizeInvoiceLines(null), []);
  assert.deepEqual(normalizeInvoiceLines(""), []);
  assert.deepEqual(normalizeInvoiceLines("["), []);
  assert.deepEqual(normalizeInvoiceLines("{}"), []);
  assert.deepEqual(normalizeInvoiceLines('{"label":"x"}'), []);

  const depuisJson = normalizeInvoiceLines(
    JSON.stringify([{ label: "Essai", pricing: "forfait", unit_price: 12 }]),
  );
  assert.equal(depuisJson.length, 1);
  assert.equal(depuisJson[0].amount, 12);
  // Un mode de tarification inconnu retombe sur le forfait, qui ne multiplie
  // rien : le repli ne peut pas gonfler une facture.
  assert.equal(
    normalizeInvoiceLines([{ pricing: "au-kilo", unit_price: 10, quantity: 8 }])[0]
      .amount,
    10,
  );
});

// ============================================================
//  Figement
// ============================================================

test("une ligne copie le catalogue puis s'en détache définitivement", () => {
  const entree: ServiceCatalogItem = {
    id: "catalogue-essai-1",
    label: "Séance d'essai",
    unit_price: 10,
    pricing: "unitaire",
    default_date_render: "liste",
    intro: "Séances réalisées aux dates suivantes :",
    active: true,
  };

  const l = lineFromCatalog(entree, "ligne-essai-4", {
    quantity: 2,
    dates: ["2026-03-12", "2026-03-05"],
  });

  assert.equal(l.catalog_id, "catalogue-essai-1");
  assert.equal(l.label, "Séance d'essai");
  assert.equal(l.unit_price, 10);
  assert.equal(l.pricing, "unitaire");
  assert.equal(l.intro, "Séances réalisées aux dates suivantes :");
  assert.equal(l.date_render, "liste");
  assert.equal(l.amount, 20);
  assert.deepEqual(l.dates, ["2026-03-05", "2026-03-12"]);

  // Le catalogue bouge : tarif doublé, libellé réécrit, entrée désactivée.
  entree.unit_price = 20;
  entree.label = "Séance d'essai (nouveau tarif)";
  entree.intro = "Autre phrase";
  entree.active = false;

  // La ligne déjà émise n'en sait rien, et une renormalisation n'y change rien :
  // aucune fonction du module ne relit le catalogue.
  const relue = normalizeInvoiceLine(l);
  assert.deepEqual(relue, l);
  assert.equal(relue.unit_price, 10);
  assert.equal(relue.label, "Séance d'essai");
  assert.equal(relue.amount, 20);
});

test("une ligne hors catalogue est possible et n'a pas de provenance", () => {
  const l = ligne({ catalog_id: null, label: "Saisie libre d'essai" });
  assert.equal(l.catalog_id, null);
  // Une chaîne vide n'est pas une provenance.
  assert.equal(ligne({ catalog_id: "" }).catalog_id, null);
});

test("lineAmount seule applique les mêmes règles", () => {
  assert.equal(lineAmount({ pricing: "forfait", unit_price: 90, quantity: 3 }), 90);
  assert.equal(lineAmount({ pricing: "unitaire", unit_price: 10, quantity: 3 }), 30);
  assert.equal(
    lineAmount({ pricing: "unitaire", unit_price: 33.333, quantity: 3 }),
    100,
  );
});

// ============================================================
//  Document
// ============================================================

/** Facture partagée d'essai ; `lines` et le brut sont fournis par le cas. */
function facture(
  lines: InvoiceLine[],
  over: Partial<SharedInvoice["invoice"]> = {},
): SharedInvoice {
  return {
    invoice: {
      invoice_number: "F-ESSAI-0002",
      patient_name: "Camille Exemple",
      billing_month: "Mars",
      billing_year: 2026,
      has_pco: true,
      revenue_gross: invoiceLinesTotal(lines),
      payment_method: null,
      payment_date: null,
      issue_date: "2026-03-31",
      service_label: null,
      lines,
      ...over,
    },
    patient: null,
    settings: {
      display_name: "Camille Fictif",
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
}

const BLOC_SEANCES = normalizeInvoiceLine({
  id: "ligne-essai-a",
  catalog_id: "catalogue-essai-1",
  label: "Séance d'essai",
  pricing: "unitaire",
  unit_price: 10,
  quantity: 3,
  dates: ["2026-03-19", "2026-03-05", "2026-03-12"],
  date_render: "liste",
  intro: "Séances réalisées aux dates suivantes :",
  note: null,
});

const BLOC_REUNIONS = normalizeInvoiceLine({
  id: "ligne-essai-b",
  catalog_id: "catalogue-essai-2",
  label: "Réunion fictive",
  pricing: "forfait",
  unit_price: 24,
  quantity: 1,
  dates: ["2026-03-27", "2026-03-20"],
  date_render: "liste",
  intro: "",
  note: null,
});

test("une facture à deux blocs imprime deux lignes dont le total est la somme", () => {
  const source = facture([BLOC_SEANCES, BLOC_REUNIONS]);
  assert.equal(source.invoice.revenue_gross, 54);

  const doc = buildInvoiceDocument(source, { now: NOW });

  assert.deepEqual(doc.table.lines, [
    {
      designation: {
        segments: [
          { text: "Séance d'essai", muted: false },
          // Période et « (PCO) » sont de niveau facture : première ligne seule.
          { text: " — Mars 2026", muted: true },
          { text: " (PCO)", muted: true },
          { text: "\nSéances réalisées aux dates suivantes :", muted: false },
          { text: "\n05/03/2026, 12/03/2026, 19/03/2026", muted: true },
        ],
        multiline: true,
      },
      amount: euro(30),
    },
    {
      designation: {
        segments: [
          { text: "Réunion fictive", muted: false },
          { text: "\n20/03/2026, 27/03/2026", muted: true },
        ],
        multiline: true,
      },
      amount: euro(24),
    },
  ]);

  // Le total imprimé est bien la somme des blocs.
  assert.equal(doc.total.amount, euro(54));
  assert.equal(
    euro(
      doc.table.lines.reduce(
        (s, l) => s + (l === doc.table.lines[0] ? 30 : 24),
        0,
      ),
    ),
    doc.total.amount,
  );

  // Repli des rendus non encore migrés : le PREMIER bloc, pas un agrégat.
  assert.deepEqual(doc.table.line, doc.table.lines[0]);
});

test("le style « une ligne par date » imprime un montant par date", () => {
  const bloc = normalizeInvoiceLine({
    id: "ligne-essai-c",
    catalog_id: null,
    label: "Atelier d'essai",
    pricing: "unitaire",
    unit_price: 12,
    quantity: 2,
    dates: ["2026-04-09", "2026-04-02"],
    date_render: "par_date",
    intro: "Interventions fictives :",
    note: "Note d'essai",
  });

  const doc = buildInvoiceDocument(
    facture([bloc], { billing_month: null, billing_year: null, has_pco: false }),
    { now: NOW },
  );

  assert.deepEqual(doc.table.lines, [
    {
      designation: {
        segments: [
          { text: "Atelier d'essai", muted: false },
          { text: " — 02/04/2026", muted: true },
          { text: "\nInterventions fictives :", muted: false },
        ],
        multiline: true,
      },
      amount: euro(12),
    },
    {
      designation: {
        segments: [
          { text: "Atelier d'essai", muted: false },
          { text: " — 09/04/2026", muted: true },
          { text: "\nNote d'essai", muted: true },
        ],
        multiline: true,
      },
      amount: euro(12),
    },
  ]);

  // Deux lignes à 12 € sous un total de 24 € : la somme imprimée est lisible.
  assert.equal(doc.total.amount, euro(24));
});

test("un bloc sans libellé garde le libellé de prestation par défaut", () => {
  const doc = buildInvoiceDocument(
    facture([normalizeInvoiceLine({ pricing: "forfait", unit_price: 15 })], {
      billing_month: null,
      billing_year: null,
      has_pco: false,
    }),
    { now: NOW },
  );
  assert.deepEqual(doc.table.lines, [
    {
      designation: {
        segments: [{ text: DEFAULT_SERVICE_LABEL, muted: false }],
        multiline: false,
      },
      amount: euro(15),
    },
  ]);
});

test("une facture héritée sans ligne rend exactement comme avant", () => {
  const heritee = facture([], {
    revenue_gross: 60,
    service_label: "Prestation héritée d'essai",
  });

  // Même facture, vue par une base où la migration 013 n'est pas passée : la
  // fonction SQL ne renvoie alors aucune clé `lines`.
  const sansColonne: SharedInvoice = {
    ...heritee,
    invoice: { ...heritee.invoice, lines: undefined },
  };

  const avecTableauVide = buildInvoiceDocument(heritee, { now: NOW });
  const sansCle = buildInvoiceDocument(sansColonne, { now: NOW });

  assert.deepEqual(avecTableauVide, sansCle);
  assert.equal(avecTableauVide.table.lines.length, 1);
  assert.deepEqual(avecTableauVide.table.line, avecTableauVide.table.lines[0]);
  assert.deepEqual(avecTableauVide.table.lines[0], {
    designation: {
      segments: [
        { text: "Prestation héritée d'essai", muted: false },
        { text: " — Mars 2026", muted: true },
        { text: " (PCO)", muted: true },
      ],
      multiline: false,
    },
    amount: euro(60),
  });
  // `lines = []` avec un brut non nul est un état légal et permanent.
  assert.equal(avecTableauVide.total.amount, euro(60));
});

test("un bloc unique en liste sans date rend comme la facture héritée", () => {
  // Invariant qui tient tout le modèle : ce qui s'imprimait hier doit encore
  // s'imprimer pareil quand la même prestation devient un bloc.
  const heritee = buildInvoiceDocument(
    facture([], { revenue_gross: 60, service_label: "Prestation d'essai" }),
    { now: NOW },
  );
  const enBloc = buildInvoiceDocument(
    facture([
      normalizeInvoiceLine({
        id: "ligne-essai-d",
        label: "Prestation d'essai",
        pricing: "forfait",
        unit_price: 60,
      }),
    ]),
    { now: NOW },
  );

  assert.deepEqual(enBloc.table, heritee.table);
  assert.deepEqual(enBloc, heritee);
});

test("aucun montant interne n'atteint le modèle, lignes comprises", () => {
  const MONTANTS_INTERNES = {
    retrocession_amount: 13.13,
    urssaf_amount: 26.26,
    after_retro: 40.87,
    net_revenue: 14.61,
    revenue_gross_paid: 51.51,
  };

  // Facture interne complète, telle que la vue interne la lit — `select("*")`.
  const interne = {
    id: "00000000-0000-4000-8000-00000000000a",
    user_id: "00000000-0000-4000-8000-0000000000fe",
    patient_id: "00000000-0000-4000-8000-00000000000b",
    patient_name: "Camille Exemple",
    invoice_number: "F-ESSAI-0002",
    billing_month: "Mars",
    billing_year: 2026,
    has_pco: true,
    revenue_gross: 54,
    payment_method: null,
    payment_date: null,
    issue_date: "2026-03-31",
    service_label: null,
    notes: "Note interne fictive",
    created_at: "2026-03-31T10:00:00.000Z",
    share_token: "jeton-fictif-de-test-1111111111111111",
    share_expires_at: "2026-06-29T10:00:00.000Z",
    lines: [BLOC_SEANCES, BLOC_REUNIONS],
    ...MONTANTS_INTERNES,
  };

  const projection = toPrintable(interne, null, {
    display_name: "Camille Fictif",
    profile: { adeli: "009999998" },
  });

  // La provenance ne sort pas : aucune ligne projetée ne porte `catalog_id`.
  assert.equal(projection.invoice.lines?.length, 2);
  for (const l of projection.invoice.lines ?? []) {
    assert.deepEqual(Object.keys(l).sort(), [
      "amount",
      "date_render",
      "dates",
      "id",
      "intro",
      "label",
      "note",
      "pricing",
      "quantity",
      "unit_price",
    ]);
  }

  const serialise = JSON.stringify(
    buildInvoiceDocument(projection, { now: NOW }),
  );

  for (const [colonne, montant] of Object.entries(MONTANTS_INTERNES)) {
    assert.ok(!serialise.includes(colonne), `colonne ${colonne} présente`);
    assert.ok(!serialise.includes(String(montant)), `valeur ${montant} présente`);
    assert.ok(
      !serialise.includes(euro(montant)),
      `montant formaté ${euro(montant)} présent`,
    );
  }

  for (const interdit of [
    "catalog_id",
    "catalogue-essai-1",
    "catalogue-essai-2",
    interne.notes,
    interne.share_token,
    interne.user_id,
    interne.patient_id,
  ]) {
    assert.ok(!serialise.includes(interdit), `donnée interne présente : ${interdit}`);
  }
});

test("la projection recopie les dates plutôt que de partager le tableau", () => {
  const source = [normalizeInvoiceLine({ ...BLOC_SEANCES })];
  const projection = toPrintable(
    { ...facture(source).invoice, lines: source },
    null,
    { display_name: null, profile: null },
  );

  projection.invoice.lines?.[0].dates.push("2030-01-01");
  assert.deepEqual(source[0].dates, [
    "2026-03-05",
    "2026-03-12",
    "2026-03-19",
  ]);
});

test("chaîne de décision du serveur, telle que saveInvoice l'exécute", () => {
  // Ce que le formulaire posterait dans le champ « lines » : une chaîne JSON.
  const poste = JSON.stringify([
    {
      id: "ligne-essai-e",
      catalog_id: "catalogue-essai-1",
      label: "Séance d'essai",
      pricing: "unitaire",
      unit_price: 10,
      quantity: 3,
      dates: ["2026-03-19", "2026-03-05", "2026-03-12", "2026-03-05"],
      date_render: "liste",
      intro: "Séances réalisées aux dates suivantes :",
      note: null,
      amount: 9999, // montant forgé côté client
    },
    {
      id: "ligne-essai-f",
      catalog_id: null,
      label: "Réunion fictive",
      pricing: "forfait",
      unit_price: 24,
      quantity: 5,
      dates: ["2026-03-20"],
      date_render: "liste",
      intro: null,
      note: null,
      amount: 120, // montant forgé côté client
    },
  ]);

  const lignes = normalizeInvoiceLines(poste);
  assert.deepEqual(validateInvoiceLines(lignes), []);

  // Le brut retenu par le serveur : la somme recalculée, pas 9999 + 120, et
  // pas davantage le `revenue_gross` que le formulaire aurait pu poster.
  assert.equal(invoiceLinesTotal(lignes), 54);
  assert.equal(lignes[0].amount, 30);
  assert.equal(lignes[1].amount, 24);
  assert.equal(lignes[1].quantity, 1); // forfait : quantité ramenée à 1
  assert.deepEqual(lignes[0].dates, ["2026-03-05", "2026-03-12", "2026-03-19"]);

  // Deux envois identiques donnent exactement le même résultat : rejouer la
  // requête n'ajoute ni ligne, ni centime.
  assert.deepEqual(normalizeInvoiceLines(poste), lignes);
  assert.equal(invoiceLinesTotal(normalizeInvoiceLines(poste)), 54);

  // Un champ « lines » absent du formulaire n'est pas un tableau vide : c'est
  // « ce client ne gère pas les lignes ». saveInvoice distingue les deux sur
  // la présence du champ, pas sur son contenu.
  assert.deepEqual(normalizeInvoiceLines(null), []);
  assert.deepEqual(normalizeInvoiceLines("[]"), []);
});
