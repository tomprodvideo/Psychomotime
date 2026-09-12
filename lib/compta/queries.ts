import { createClient } from "@/lib/supabase/server";
import type { PracticeContext } from "@/lib/dossier/types";
import { patientName } from "@/lib/dossier/types";
import type {
  Charge,
  Recurrence,
  BillingDocument,
  BillingLine,
  CatalogItem,
  DocumentKind,
  DocumentSnapshot,
  DocumentStatus,
  Payment,
} from "./types";
import type { DocumentListItem, Totaux } from "./totaux";
import { calculerTotaux, totauxVides } from "./totaux";

export type { DocumentListItem, Totaux } from "./totaux";
export { calculerTotaux } from "./totaux";

/**
 * Lectures du moteur comptable.
 *
 * DEUX PARTIS PRIS, et ils se tiennent.
 *
 * 1. **Pas de pagination sur la période, mais une période obligatoire.** Un
 *    écran de comptabilité affiche des TOTAUX, et un total de page n'a aucun
 *    sens : « 12 450 € encaissés » ne peut pas vouloir dire « sur les vingt-cinq
 *    lignes que vous voyez ». On charge donc tout ce que la période contient, et
 *    si le plafond de sécurité est atteint, l'écran le DIT au lieu d'afficher
 *    des totaux partiels comme s'ils étaient complets.
 *
 * 2. **Le solde vient de la base.** `public.document_balance_cents` est le
 *    calcul de référence : elle seule voit toutes les affectations et tous les
 *    avoirs, y compris ceux qui tombent hors de la période affichée. Les soldes
 *    de liste sont recomposés à partir des mêmes termes, chargés explicitement.
 */

/** Plafond de sécurité. Atteint, il est signalé, jamais franchi en silence. */
const PLAFOND = 2000;

export interface DocumentFilters {
  /** Bornes sur la date d'émission. Un brouillon n'en a pas : voir `brouillons`. */
  du?: string;
  au?: string;
  kind?: DocumentKind;
  patientId?: string;
  /** Recherche sur le numéro. */
  recherche?: string;
  /** Inclure les brouillons, qui n'ont pas de date d'émission. */
  brouillons?: boolean;
}

export interface DocumentListResult {
  items: DocumentListItem[];
  totaux: Totaux;
  /** Vrai si le plafond a été atteint : les totaux sont alors incomplets. */
  tronque: boolean;
  /**
   * Motif d'échec de la lecture, ou `null`.
   *
   * IL FAUT QU'IL EXISTE. La version précédente convertissait une erreur de
   * lecture en résultat VIDE, indiscernable d'une période réellement sans
   * pièce : l'écran affichait une comptabilité à zéro et l'export produisait un
   * fichier bien formé, à 0 €, sans le moindre avertissement — fichier ensuite
   * transmis à un expert-comptable. C'est le symétrique en lecture du défaut
   * que `ecritureReussie` corrige en écriture.
   */
  erreur: string | null;
}

type LigneBrute = {
  id: string;
  kind: DocumentKind;
  status: DocumentStatus;
  number: string | null;
  issued_on: string | null;
  period_start: string | null;
  total_cents: number;
  patient_id: string | null;
  rectifies_id: string | null;
  snapshot: DocumentSnapshot | null;
  patients: {
    first_name: string;
    last_name: string;
    preferred_name: string | null;
  } | null;
};

const COLONNES_LISTE =
  "id, kind, status, number, issued_on, period_start, total_cents, " +
  "patient_id, rectifies_id, snapshot, " +
  "patients(first_name, last_name, preferred_name)";

/**
 * Les pièces d'une période, avec leurs soldes et les totaux de l'ensemble.
 */
export async function listDocuments(
  practice: PracticeContext,
  filtres: DocumentFilters = {},
): Promise<DocumentListResult> {
  const supabase = await createClient();

  let requete = supabase
    .from("billing_documents")
    .select(COLONNES_LISTE)
    .eq("practice_id", practice.practiceId);

  // Un brouillon n'a pas de date d'émission : le filtrer par période le ferait
  // disparaître de tous les écrans, y compris de celui où on l'a laissé.
  if (filtres.du && filtres.au) {
    requete = filtres.brouillons
      ? requete.or(
          `and(issued_on.gte.${filtres.du},issued_on.lte.${filtres.au}),status.eq.brouillon`,
        )
      : requete.gte("issued_on", filtres.du).lte("issued_on", filtres.au);
  } else if (!filtres.brouillons) {
    requete = requete.not("status", "eq", "brouillon");
  }

  if (filtres.kind) requete = requete.eq("kind", filtres.kind);
  if (filtres.patientId) requete = requete.eq("patient_id", filtres.patientId);
  if (filtres.recherche?.trim()) {
    requete = requete.ilike("number", `%${filtres.recherche.trim()}%`);
  }

  const { data, error } = await requete
    .order("issued_on", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(PLAFOND + 1);

  if (error) {
    console.error("[compta] lecture des pièces refusée :", error);
    return {
      items: [],
      totaux: totauxVides(),
      tronque: false,
      erreur:
        "La lecture des pièces a échoué. Les montants affichés ne sont pas ceux de votre comptabilité.",
    };
  }

  const brutes = (data ?? []) as unknown as LigneBrute[];
  const tronque = brutes.length > PLAFOND;
  const retenues = tronque ? brutes.slice(0, PLAFOND) : brutes;
  const ids = retenues.map((d) => d.id);

  const [affectations, avoirs] = await Promise.all([
    sommeAffectations(ids),
    sommeAvoirs(ids),
  ]);

  const items: DocumentListItem[] = retenues.map((d) => {
    const encaisse = affectations.get(d.id) ?? 0;
    const avoir = avoirs.get(d.id) ?? 0;
    const nomLie = d.patients ? patientName(d.patients) : null;
    const nomFige = d.snapshot?.patient?.nom?.trim() || null;
    return {
      id: d.id,
      kind: d.kind,
      status: d.status,
      number: d.number,
      issued_on: d.issued_on,
      period_start: d.period_start,
      total_cents: d.total_cents,
      patient_id: d.patient_id,
      patient_nom: nomLie ?? nomFige,
      patient_detache: !d.patient_id && Boolean(nomFige),
      encaisse_cents: encaisse,
      avoirs_cents: avoir,
      solde_cents: d.total_cents - encaisse - avoir,
      rectifies_id: d.rectifies_id,
      repris_de_v1: d.snapshot?.origine === "reprise_v1",
    };
  });

  return { items, totaux: calculerTotaux(items), tronque, erreur: null };
}

async function sommeAffectations(ids: string[]): Promise<Map<string, number>> {
  const somme = new Map<string, number>();
  if (ids.length === 0) return somme;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_allocations")
    .select("document_id, amount_cents")
    .in("document_id", ids);
  if (error) {
    console.error("[compta] lecture des affectations refusée :", error);
    return somme;
  }
  for (const a of (data ?? []) as { document_id: string; amount_cents: number }[]) {
    somme.set(a.document_id, (somme.get(a.document_id) ?? 0) + a.amount_cents);
  }
  return somme;
}

/** Avoirs émis rectifiant les pièces données. Un avoir brouillon ne défait rien. */
async function sommeAvoirs(ids: string[]): Promise<Map<string, number>> {
  const somme = new Map<string, number>();
  if (ids.length === 0) return somme;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("billing_documents")
    .select("rectifies_id, total_cents")
    .eq("kind", "avoir")
    .neq("status", "brouillon")
    .in("rectifies_id", ids);
  if (error) {
    console.error("[compta] lecture des avoirs refusée :", error);
    return somme;
  }
  for (const a of (data ?? []) as {
    rectifies_id: string;
    total_cents: number;
  }[]) {
    somme.set(a.rectifies_id, (somme.get(a.rectifies_id) ?? 0) + a.total_cents);
  }
  return somme;
}

/* ==========================================================================
 *  Une pièce
 * ========================================================================== */

export interface ReglementAffecte {
  allocation_id: string;
  payment_id: string;
  amount_cents: number;
  received_on: string;
  method: Payment["method"];
  reference: string | null;
}

export interface DocumentComplet {
  document: BillingDocument;
  lignes: BillingLine[];
  reglements: ReglementAffecte[];
  /** Solde calculé par la base : la référence. */
  solde_cents: number;
  /** Pièces qui rectifient celle-ci. */
  rectifications: {
    id: string;
    kind: DocumentKind;
    number: string | null;
    issued_on: string | null;
    total_cents: number;
    status: DocumentStatus;
  }[];
  /** Nom du patient lié, ou celui figé dans l'instantané. */
  patient_nom: string | null;
  patient_id: string | null;
}

export async function getDocument(
  practice: PracticeContext,
  id: string,
): Promise<DocumentComplet | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("billing_documents")
    .select("*, patients(first_name, last_name, preferred_name)")
    .eq("practice_id", practice.practiceId)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[compta] lecture de la pièce refusée :", error);
    return null;
  }

  const brut = data as unknown as BillingDocument & {
    patients: {
      first_name: string;
      last_name: string;
      preferred_name: string | null;
    } | null;
  };

  const [lignesRes, reglementsRes, soldeRes, rectifsRes] = await Promise.all([
    supabase
      .from("billing_lines")
      .select("*")
      .eq("document_id", id)
      .order("position", { ascending: true }),
    supabase
      .from("payment_allocations")
      .select("id, payment_id, amount_cents, payments(received_on, method, reference)")
      .eq("document_id", id),
    supabase.rpc("document_balance_cents", { p_document_id: id }),
    supabase
      .from("billing_documents")
      .select("id, kind, number, issued_on, total_cents, status")
      .eq("rectifies_id", id),
  ]);

  if (lignesRes.error) {
    console.error("[compta] lecture des lignes refusée :", lignesRes.error);
  }

  const reglements: ReglementAffecte[] = (
    (reglementsRes.data ?? []) as unknown as {
      id: string;
      payment_id: string;
      amount_cents: number;
      payments: {
        received_on: string;
        method: Payment["method"];
        reference: string | null;
      } | null;
    }[]
  )
    .filter((r) => r.payments)
    .map((r) => ({
      allocation_id: r.id,
      payment_id: r.payment_id,
      amount_cents: r.amount_cents,
      received_on: r.payments!.received_on,
      method: r.payments!.method,
      reference: r.payments!.reference,
    }))
    .sort((a, b) => a.received_on.localeCompare(b.received_on));

  const nomLie = brut.patients ? patientName(brut.patients) : null;
  const nomFige = brut.snapshot?.patient?.nom?.trim() || null;

  return {
    document: brut,
    lignes: (lignesRes.data ?? []) as unknown as BillingLine[],
    reglements,
    solde_cents:
      typeof soldeRes.data === "number"
        ? soldeRes.data
        : brut.total_cents -
          reglements.reduce((s, r) => s + r.amount_cents, 0),
    rectifications: (rectifsRes.data ?? []) as DocumentComplet["rectifications"],
    patient_nom: nomLie ?? nomFige,
    patient_id: brut.patient_id,
  };
}

/* ==========================================================================
 *  Catalogue
 * ========================================================================== */

export async function listCatalog(
  practice: PracticeContext,
  options: { inactifs?: boolean } = {},
): Promise<CatalogItem[]> {
  const supabase = await createClient();
  let requete = supabase
    .from("service_catalog_items")
    .select("*")
    .eq("practice_id", practice.practiceId);
  if (!options.inactifs) requete = requete.eq("active", true);

  const { data, error } = await requete
    .order("position", { ascending: true })
    .order("label", { ascending: true });

  if (error) {
    console.error("[compta] lecture du catalogue refusée :", error);
    return [];
  }
  return (data ?? []) as CatalogItem[];
}

/* ==========================================================================
 *  Règlements
 * ========================================================================== */

export interface PaymentListItem extends Payment {
  affecte_cents: number;
  /** Ce qui n'est affecté à aucune pièce : un trop-perçu, ou un acompte. */
  libre_cents: number;
  pieces: { document_id: string; number: string | null; amount_cents: number }[];
}

export async function listPayments(
  practice: PracticeContext,
  filtres: { du?: string; au?: string } = {},
): Promise<PaymentListItem[]> {
  const supabase = await createClient();
  let requete = supabase
    .from("payments")
    .select(
      "*, payment_allocations(document_id, amount_cents, billing_documents(number))",
    )
    .eq("practice_id", practice.practiceId);

  if (filtres.du) requete = requete.gte("received_on", filtres.du);
  if (filtres.au) requete = requete.lte("received_on", filtres.au);

  const { data, error } = await requete
    .order("received_on", { ascending: false })
    .limit(PLAFOND);

  if (error) {
    console.error("[compta] lecture des règlements refusée :", error);
    return [];
  }

  return ((data ?? []) as unknown as (Payment & {
    payment_allocations: {
      document_id: string;
      amount_cents: number;
      billing_documents: { number: string | null } | null;
    }[];
  })[]).map((p) => {
    const affecte = p.payment_allocations.reduce(
      (s, a) => s + a.amount_cents,
      0,
    );
    return {
      ...p,
      affecte_cents: affecte,
      libre_cents: p.amount_cents - affecte,
      pieces: p.payment_allocations.map((a) => ({
        document_id: a.document_id,
        number: a.billing_documents?.number ?? null,
        amount_cents: a.amount_cents,
      })),
    };
  });
}

/* ==========================================================================
 *  Réglages comptables du cabinet
 * ========================================================================== */

export interface ReglagesCompta {
  gabarit_numero: string;
  retrocession_points_de_base: number;
  urssaf_points_de_base: number;
  mode_de_charge: "retrocession" | "loyer";
  loyer_mensuel_centimes: number;
}

export const REGLAGES_PAR_DEFAUT: ReglagesCompta = {
  gabarit_numero: "{AAAA}-{NNN}",
  retrocession_points_de_base: 0,
  urssaf_points_de_base: 0,
  mode_de_charge: "retrocession",
  loyer_mensuel_centimes: 0,
};

/**
 * Les réglages en vigueur.
 *
 * `practice_settings` est DATÉE : plusieurs versions coexistent, et c'est la
 * plus récente qui vaut. Elles ne sont pas remplacées — une pièce ancienne doit
 * pouvoir se relire avec les réglages de son époque.
 */
export async function getReglagesCompta(
  practice: PracticeContext,
): Promise<ReglagesCompta> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("practice_settings")
    .select("settings")
    .eq("practice_id", practice.practiceId)
    .order("valid_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return REGLAGES_PAR_DEFAUT;

  const s = (data as { settings: Record<string, unknown> }).settings ?? {};
  const entier = (v: unknown, defaut: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.round(v) : defaut;

  return {
    gabarit_numero:
      typeof s.gabarit_numero === "string" && s.gabarit_numero.trim()
        ? s.gabarit_numero.trim()
        : REGLAGES_PAR_DEFAUT.gabarit_numero,
    retrocession_points_de_base: entier(s.retrocession_points_de_base, 0),
    urssaf_points_de_base: entier(s.urssaf_points_de_base, 0),
    mode_de_charge: s.mode_de_charge === "loyer" ? "loyer" : "retrocession",
    loyer_mensuel_centimes: entier(s.loyer_mensuel_centimes, 0),
  };
}

/* ==========================================================================
 *  Séances facturables
 * ========================================================================== */

export interface SeanceFacturable {
  id: string;
  starts_at: string;
  kind: string;
  pathway_id: string | null;
}

/**
 * Les séances d'un patient qui peuvent entrer sur une facture.
 *
 * Trois conditions, et la base les tient aussi : l'issue est « honoré », le
 * rendez-vous est marqué facturable, et il n'est encore rattaché à aucune
 * ligne. La troisième est la protection contre le défaut le plus coûteux —
 * facturer deux fois la même séance — et elle ne peut pas reposer sur la
 * mémoire du praticien.
 */
export async function listSeancesFacturables(
  practice: PracticeContext,
  patientId: string,
): Promise<SeanceFacturable[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("appointments")
    .select("id, starts_at, kind, pathway_id")
    .eq("practice_id", practice.practiceId)
    .eq("patient_id", patientId)
    .eq("attendance", "honore")
    .eq("billable", true)
    .order("starts_at", { ascending: true })
    .limit(300);

  if (error) {
    console.error("[compta] lecture des séances facturables refusée :", error);
    return [];
  }

  const seances = (data ?? []) as SeanceFacturable[];
  if (seances.length === 0) return [];

  /* Une séance n'est « déjà facturée » que si la pièce qui la porte VAUT
   * ENCORE. Une facture annulée par avoir ou remplacée ne facture plus rien :
   * ses séances doivent redevenir disponibles, sans quoi une erreur corrigée
   * rendrait les séances définitivement infacturables — en silence. */
  const { data: deja, error: erreurDeja } = await supabase
    .from("billing_line_appointments")
    .select("appointment_id, billing_lines!inner(billing_documents!inner(status))")
    .in(
      "appointment_id",
      seances.map((s) => s.id),
    );

  if (erreurDeja) {
    // On préfère ne rien proposer plutôt que de proposer une séance déjà
    // facturée : l'erreur ici doit rendre l'écran prudent, pas permissif.
    console.error("[compta] lecture des rattachements refusée :", erreurDeja);
    return [];
  }

  const CADUQUES = ["annule_par_avoir", "remplace"];
  const facturees = new Set(
    ((deja ?? []) as unknown as {
      appointment_id: string;
      billing_lines: { billing_documents: { status: string } | null } | null;
    }[])
      .filter((d) => {
        const statut = d.billing_lines?.billing_documents?.status;
        return statut !== undefined && !CADUQUES.includes(statut);
      })
      .map((d) => d.appointment_id),
  );
  return seances.filter((s) => !facturees.has(s.id));
}

/* ==========================================================================
 *  Charges
 * ========================================================================== */

export interface ChargesResult {
  items: Charge[];
  /** Même règle que pour les pièces : un échec de lecture se dit. */
  erreur: string | null;
}

export async function listCharges(
  practice: PracticeContext,
  filtres: { du?: string; au?: string } = {},
): Promise<ChargesResult> {
  const supabase = await createClient();
  let requete = supabase
    .from("practice_expenses")
    .select("*")
    .eq("practice_id", practice.practiceId);

  if (filtres.du) requete = requete.gte("spent_on", filtres.du);
  if (filtres.au) requete = requete.lte("spent_on", filtres.au);

  const { data, error } = await requete
    .order("spent_on", { ascending: false })
    .limit(2000);

  if (error) {
    console.error("[compta] lecture des charges refusée :", error);
    return {
      items: [],
      erreur: "La lecture des charges a échoué. Le net affiché est faux.",
    };
  }
  return { items: (data ?? []) as Charge[], erreur: null };
}

export async function listRecurrences(
  practice: PracticeContext,
): Promise<Recurrence[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_recurrences")
    .select("*")
    .eq("practice_id", practice.practiceId)
    .order("label", { ascending: true });

  if (error) {
    console.error("[compta] lecture des récurrences refusée :", error);
    return [];
  }
  return (data ?? []) as Recurrence[];
}
