/**
 * Génération du PDF d'une facture, côté serveur.
 *
 * La mise en page reprend celle de la page /comptabilite/[id]/facture, à
 * l'identique sur le fond : en-tête praticien, bloc « Facturé à », ligne de
 * prestation, total et mentions légales.
 */
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { Invoice, Patient, Settings } from "@/lib/types";
import { euro, frDate } from "@/lib/format";

const BRAND = "#2f8a82";

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 10, color: "#334155", fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 32 },
  identity: { flexDirection: "row", gap: 12, maxWidth: 320 },
  logo: { width: 64, height: 64, objectFit: "contain" },
  name: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#0f172a", marginBottom: 2 },
  line: { marginBottom: 1.5 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", color: BRAND, textAlign: "right" },
  meta: { textAlign: "right", color: "#64748b", marginTop: 3 },
  billed: {
    alignSelf: "flex-end",
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 4,
    minWidth: 200,
    marginBottom: 32,
  },
  billedLabel: { fontSize: 8, color: "#94a3b8", textTransform: "uppercase", marginBottom: 3 },
  billedName: { fontFamily: "Helvetica-Bold", color: "#1e293b", marginBottom: 2 },
  thead: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 6,
    color: "#64748b",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 9,
    color: "#334155",
  },
  cellLabel: { flex: 1 },
  cellAmount: { width: 110, textAlign: "right" },
  totalBox: { alignSelf: "flex-end", width: 220, marginTop: 24 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1.5,
    borderTopColor: "#cbd5e1",
    paddingTop: 8,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    fontSize: 11,
  },
  totalNote: { textAlign: "right", fontSize: 8, color: "#94a3b8", marginTop: 4 },
  legal: {
    marginTop: 36,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: "#f1f5f9",
    fontSize: 8,
    color: "#94a3b8",
  },
  muted: { color: "#94a3b8" },
});

export type InvoicePdfInput = {
  invoice: Invoice;
  patient: Pick<Patient, "address"> | null;
  settings: Settings;
};

/** Une image n'est embarquée que si sa source est exploitable par react-pdf. */
const usableImage = (src: string | undefined): src is string =>
  !!src && (src.startsWith("data:image/") || /^https?:\/\//.test(src));

function InvoiceDocument({ invoice: inv, patient, settings }: InvoicePdfInput) {
  const profile = settings.profile ?? {};
  const issueDate =
    inv.issue_date ?? inv.payment_date ?? new Date().toISOString().slice(0, 10);
  const service = inv.service_label ?? "Séance de psychomotricité";
  const amount = inv.revenue_gross;

  return (
    <Document title={`Facture ${inv.invoice_number ?? ""}`.trim()}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.identity}>
            {usableImage(profile.logo_url) && (
              // Image de react-pdf, pas une balise <img> : pas d'attribut alt.
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={profile.logo_url} style={s.logo} />
            )}
            <View>
              <Text style={s.name}>
                {settings.display_name ?? "Psychomotricien(ne)"}
              </Text>
              {profile.address && <Text style={s.line}>{profile.address}</Text>}
              {(profile.postal_code || profile.city) && (
                <Text style={s.line}>
                  {[profile.postal_code, profile.city].filter(Boolean).join(" ")}
                </Text>
              )}
              {profile.business_phone && (
                <Text style={s.line}>Tél. {profile.business_phone}</Text>
              )}
              {profile.business_email && (
                <Text style={s.line}>{profile.business_email}</Text>
              )}
              {profile.siret && <Text style={s.line}>SIRET : {profile.siret}</Text>}
              {profile.adeli && <Text style={s.line}>N° ADELI : {profile.adeli}</Text>}
            </View>
          </View>

          <View>
            <Text style={s.title}>FACTURE</Text>
            {inv.invoice_number && (
              <Text style={s.meta}>N° {inv.invoice_number}</Text>
            )}
            <Text style={s.meta}>Date : {frDate(issueDate)}</Text>
          </View>
        </View>

        <View style={s.billed}>
          <Text style={s.billedLabel}>Facturé à</Text>
          <Text style={s.billedName}>{inv.patient_name || "—"}</Text>
          {patient?.address && <Text>{patient.address}</Text>}
        </View>

        <View style={s.thead}>
          <Text style={s.cellLabel}>Désignation</Text>
          <Text style={s.cellAmount}>Montant</Text>
        </View>
        <View style={s.row}>
          <Text style={s.cellLabel}>
            {service}
            {inv.billing_month && (
              <Text style={s.muted}>
                {` — ${inv.billing_month}${inv.billing_year ? ` ${inv.billing_year}` : ""}`}
              </Text>
            )}
            {inv.has_pco && <Text style={s.muted}> (PCO)</Text>}
          </Text>
          <Text style={s.cellAmount}>{euro(amount)}</Text>
        </View>

        <View style={s.totalBox}>
          <View style={s.totalRow}>
            <Text>Total à payer</Text>
            <Text>{euro(amount)}</Text>
          </View>
          {inv.payment_method && (
            <Text style={s.totalNote}>
              Règlement : {inv.payment_method}
              {inv.payment_date ? ` le ${frDate(inv.payment_date)}` : ""}
            </Text>
          )}
        </View>

        {profile.legal_mentions && (
          <Text style={s.legal}>{profile.legal_mentions}</Text>
        )}
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument {...input} />);
}

/** Nom de fichier de la pièce jointe. */
export function invoiceFileName(inv: Invoice): string {
  const base = inv.invoice_number || inv.patient_name || "facture";
  return `Facture-${base.replace(/[^\w.-]+/g, "-")}.pdf`;
}

/** Objet et corps du message, alignés sur ceux de la page facture. */
export function invoiceEmailText(inv: Invoice, settings: Settings) {
  const service = inv.service_label ?? "Séance de psychomotricité";
  return {
    subject: `Facture ${inv.invoice_number ?? ""} - ${service}`.trim(),
    text:
      `Bonjour,\n\nVeuillez trouver votre facture ${
        inv.invoice_number ? `n° ${inv.invoice_number} ` : ""
      }d'un montant de ${euro(inv.revenue_gross)}, jointe à ce message.\n\n` +
      `Bien cordialement,\n${settings.display_name ?? ""}`,
  };
}
