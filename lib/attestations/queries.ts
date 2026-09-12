import { createClient } from "@/lib/supabase/server";
import type { PracticeContext } from "@/lib/dossier/types";
import { patientName } from "@/lib/dossier/types";
import type { Attestation, AttestationKind, AttestationStatus } from "./types";

/**
 * Lectures des attestations.
 *
 * MÊME RÈGLE QUE POUR LA COMPTABILITÉ : une lecture qui échoue le DIT. Un
 * résultat vide indiscernable d'une erreur ferait croire qu'aucune attestation
 * n'a été établie, ce qui est exactement l'inverse de ce qu'il faut savoir
 * quand on en cherche une déjà remise.
 */

const PLAFOND = 500;

export interface AttestationListItem {
  id: string;
  kind: AttestationKind;
  status: AttestationStatus;
  number: string | null;
  issued_on: string | null;
  period_start: string | null;
  period_end: string | null;
  sessions_count: number;
  total_cents: number;
  patient_id: string;
  patient_nom: string | null;
}

export interface AttestationListResult {
  items: AttestationListItem[];
  erreur: string | null;
}

export async function listAttestations(
  practice: PracticeContext,
  filtres: { patientId?: string; kind?: AttestationKind } = {},
): Promise<AttestationListResult> {
  const supabase = await createClient();
  let requete = supabase
    .from("attestations")
    .select(
      "id, kind, status, number, issued_on, period_start, period_end, " +
        "sessions_count, total_cents, patient_id, " +
        "patients(first_name, last_name, preferred_name)",
    )
    .eq("practice_id", practice.practiceId);

  if (filtres.patientId) requete = requete.eq("patient_id", filtres.patientId);
  if (filtres.kind) requete = requete.eq("kind", filtres.kind);

  const { data, error } = await requete
    .order("issued_on", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(PLAFOND);

  if (error) {
    console.error("[attestations] lecture refusée :", error);
    return {
      items: [],
      erreur:
        "La lecture des attestations a échoué. Cette liste n'est pas celle de votre cabinet.",
    };
  }

  const items = ((data ?? []) as unknown as (AttestationListItem & {
    patients: {
      first_name: string;
      last_name: string;
      preferred_name: string | null;
    } | null;
  })[]).map((a) => ({
    ...a,
    patient_nom: a.patients ? patientName(a.patients) : null,
  }));

  return { items, erreur: null };
}

/* ==========================================================================
 *  Une attestation
 * ========================================================================== */

export interface SeanceAttestee {
  appointment_id: string;
  starts_at: string;
  kind: string;
}

export interface ReglementAtteste {
  payment_id: string;
  amount_cents: number;
  received_on: string;
  method: string;
}

export interface AttestationComplete {
  attestation: Attestation;
  seances: SeanceAttestee[];
  reglements: ReglementAtteste[];
  patient_nom: string | null;
}

export async function getAttestation(
  practice: PracticeContext,
  id: string,
): Promise<AttestationComplete | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("attestations")
    .select("*, patients(first_name, last_name, preferred_name)")
    .eq("practice_id", practice.practiceId)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[attestations] lecture refusée :", error);
    return null;
  }

  const brut = data as unknown as Attestation & {
    patients: {
      first_name: string;
      last_name: string;
      preferred_name: string | null;
    } | null;
  };

  const [seancesRes, reglementsRes] = await Promise.all([
    supabase
      .from("attestation_sessions")
      .select("appointment_id, appointments(starts_at, kind)")
      .eq("attestation_id", id),
    supabase
      .from("attestation_payments")
      .select("payment_id, amount_cents, payments(received_on, method)")
      .eq("attestation_id", id),
  ]);

  const seances: SeanceAttestee[] = (
    (seancesRes.data ?? []) as unknown as {
      appointment_id: string;
      appointments: { starts_at: string; kind: string } | null;
    }[]
  )
    .filter((s) => s.appointments)
    .map((s) => ({
      appointment_id: s.appointment_id,
      starts_at: s.appointments!.starts_at,
      kind: s.appointments!.kind,
    }))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const reglements: ReglementAtteste[] = (
    (reglementsRes.data ?? []) as unknown as {
      payment_id: string;
      amount_cents: number;
      payments: { received_on: string; method: string } | null;
    }[]
  )
    .filter((r) => r.payments)
    .map((r) => ({
      payment_id: r.payment_id,
      amount_cents: r.amount_cents,
      received_on: r.payments!.received_on,
      method: r.payments!.method,
    }))
    .sort((a, b) => a.received_on.localeCompare(b.received_on));

  return {
    attestation: brut,
    seances,
    reglements,
    patient_nom: brut.patients ? patientName(brut.patients) : null,
  };
}

/* ==========================================================================
 *  Ce qu'on peut attester
 * ========================================================================== */

export interface SeanceAttestable {
  id: string;
  starts_at: string;
  kind: string;
  /** Déjà portée par une autre attestation. Signalé, jamais bloquant. */
  deja_attestee: boolean;
}

/**
 * Les séances d'un patient qui peuvent entrer sur une attestation de présence.
 *
 * SOURCE UNIQUE : la vue `realised_sessions`, qui écarte par construction les
 * créneaux à venir, annulés, non qualifiés, sans patient, et les temps qui ne
 * sont pas des contacts de soin. Aucune date ne se saisit à la main.
 *
 * Une séance déjà attestée est SIGNALÉE, pas exclue : une famille peut avoir
 * besoin de deux attestations pour deux organismes, et attester deux fois une
 * présence réelle ne crée aucun faux. C'est l'inverse d'une facture.
 */
export async function listSeancesAttestables(
  practice: PracticeContext,
  patientId: string,
  bornes: { du?: string; au?: string } = {},
): Promise<SeanceAttestable[]> {
  const supabase = await createClient();

  let requete = supabase
    .from("realised_sessions")
    .select("appointment_id, starts_at, kind, session_date")
    .eq("practice_id", practice.practiceId)
    .eq("patient_id", patientId);

  if (bornes.du) requete = requete.gte("session_date", bornes.du);
  if (bornes.au) requete = requete.lte("session_date", bornes.au);

  const { data, error } = await requete
    .order("starts_at", { ascending: true })
    .limit(500);

  if (error) {
    console.error("[attestations] lecture des séances refusée :", error);
    return [];
  }

  const seances = (data ?? []) as unknown as {
    appointment_id: string;
    starts_at: string;
    kind: string;
  }[];
  if (seances.length === 0) return [];

  const { data: deja } = await supabase
    .from("attestation_sessions")
    .select("appointment_id")
    .in(
      "appointment_id",
      seances.map((s) => s.appointment_id),
    );

  const attestees = new Set(
    ((deja ?? []) as { appointment_id: string }[]).map((d) => d.appointment_id),
  );

  return seances.map((s) => ({
    id: s.appointment_id,
    starts_at: s.starts_at,
    kind: s.kind,
    deja_attestee: attestees.has(s.appointment_id),
  }));
}

export interface ReglementAttestable {
  id: string;
  received_on: string;
  method: string;
  /** Part du règlement imputée sur les factures DE CE PATIENT. */
  impute_cents: number;
  /** Numéros des pièces concernées, pour que la somme soit vérifiable. */
  factures: string[];
}

/**
 * Les règlements qui peuvent entrer sur une attestation de paiement.
 *
 * Seule la part IMPUTÉE sur les factures de ce patient est proposée. Un
 * virement couvrant deux familles ne s'atteste pas en entier à l'une d'elles,
 * et un acompte imputé nulle part n'atteste d'aucune prestation réglée.
 */
export async function listReglementsAttestables(
  practice: PracticeContext,
  patientId: string,
  bornes: { du?: string; au?: string } = {},
): Promise<ReglementAttestable[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payment_allocations")
    .select(
      "amount_cents, payment_id, " +
        "payments!inner(received_on, method), " +
        "billing_documents!inner(patient_id, number, kind)",
    )
    .eq("practice_id", practice.practiceId)
    .eq("billing_documents.patient_id", patientId)
    .limit(1000);

  if (error) {
    console.error("[attestations] lecture des règlements refusée :", error);
    return [];
  }

  const parReglement = new Map<string, ReglementAttestable>();
  for (const a of (data ?? []) as unknown as {
    amount_cents: number;
    payment_id: string;
    payments: { received_on: string; method: string } | null;
    billing_documents: { number: string | null; kind: string } | null;
  }[]) {
    if (!a.payments || !a.billing_documents) continue;
    if (a.billing_documents.kind === "devis") continue;
    if (bornes.du && a.payments.received_on < bornes.du) continue;
    if (bornes.au && a.payments.received_on > bornes.au) continue;

    const courant = parReglement.get(a.payment_id) ?? {
      id: a.payment_id,
      received_on: a.payments.received_on,
      method: a.payments.method,
      impute_cents: 0,
      factures: [],
    };
    courant.impute_cents += a.amount_cents;
    if (a.billing_documents.number) {
      courant.factures.push(a.billing_documents.number);
    }
    parReglement.set(a.payment_id, courant);
  }

  return [...parReglement.values()].sort((a, b) =>
    a.received_on.localeCompare(b.received_on),
  );
}
