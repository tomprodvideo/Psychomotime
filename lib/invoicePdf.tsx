/**
 * Génération du PDF d'une facture, côté serveur.
 *
 * Le contenu vient du modèle de document partagé (lib/invoiceDocument.ts) : ce
 * fichier ne décide plus rien du document, il ne fait que le mettre en page en
 * A4 avec les primitives de react-pdf. Restent ici, parce qu'ils ne sont pas des
 * règles de document : la feuille de style, le garde `usableImage`, la
 * pagination et le titre du fichier PDF.
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
import type { SharedInvoice } from "@/lib/invoiceShare";
import {
  buildInvoiceDocument,
  type InvoiceDocument,
  type InvoiceDocumentText,
} from "@/lib/invoiceDocument";

/** brand-500. L'écran titre « FACTURE » en brand-700 (#1d5854) : divergence
 *  connue, conservée telle quelle, à trancher dans une étape séparée. */
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

/** Le PDF ne reçoit que les champs imprimés : rien sur la rétrocession,
 *  l'URSSAF ou le net, qui ne regardent pas le patient. */
export type InvoicePdfInput = SharedInvoice;

/** Une image n'est embarquée que si sa source est exploitable par react-pdf.
 *  Contrainte de react-pdf, pas règle de document : elle reste ici. */
const usableImage = (src: string | null | undefined): src is string =>
  !!src && (src.startsWith("data:image/") || /^https?:\/\//.test(src));

/**
 * Assemblage d'un bloc du modèle. Les fragments sont posés côte à côte sans
 * jamais être concaténés : un fragment atténué devient un `<Text>` imbriqué, et
 * react-pdf crêne une chaîne unique autrement que deux fragments voisins.
 */
const fragments = (block: InvoiceDocumentText) =>
  block.segments.map((seg, i) =>
    seg.muted ? (
      <Text key={i} style={s.muted}>
        {seg.text}
      </Text>
    ) : (
      seg.text
    ),
  );

/** Mise en page A4 du modèle de document. react-pdf respecte les « \n »
 *  nativement : l'indication `multiline` du modèle n'a rien à appliquer ici. */
function InvoiceSheet({ doc }: { doc: InvoiceDocument }) {
  return (
    <Page size="A4" style={s.page}>
      <View style={s.header}>
        <View style={s.identity}>
          {usableImage(doc.issuer.logoUrl) && (
            // Image de react-pdf, pas une balise <img> : pas d'attribut alt.
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={doc.issuer.logoUrl} style={s.logo} />
          )}
          <View>
            <Text style={s.name}>{doc.issuer.name ?? "Psychomotricien(ne)"}</Text>
            {doc.issuer.lines.map((l, i) => (
              <Text key={i} style={s.line}>
                {fragments(l)}
              </Text>
            ))}
          </View>
        </View>

        <View>
          <Text style={s.title}>{doc.header.title}</Text>
          {doc.header.number && (
            <Text style={s.meta}>{fragments(doc.header.number)}</Text>
          )}
          <Text style={s.meta}>{fragments(doc.header.date)}</Text>
        </View>
      </View>

      <View style={s.billed}>
        <Text style={s.billedLabel}>{doc.billedTo.label}</Text>
        <Text style={s.billedName}>{doc.billedTo.name || "—"}</Text>
        {doc.billedTo.address && <Text>{fragments(doc.billedTo.address)}</Text>}
      </View>

      <View style={s.thead}>
        <Text style={s.cellLabel}>{doc.table.designationHeader}</Text>
        <Text style={s.cellAmount}>{doc.table.amountHeader}</Text>
      </View>
      <View style={s.row}>
        <Text style={s.cellLabel}>{fragments(doc.table.line.designation)}</Text>
        <Text style={s.cellAmount}>{doc.table.line.amount}</Text>
      </View>

      <View style={s.totalBox}>
        <View style={s.totalRow}>
          <Text>{doc.total.label}</Text>
          <Text>{doc.total.amount}</Text>
        </View>
        {doc.total.note && (
          <Text style={s.totalNote}>{fragments(doc.total.note)}</Text>
        )}
      </View>

      {doc.legalMentions && (
        <Text style={s.legal}>{fragments(doc.legalMentions)}</Text>
      )}
    </Page>
  );
}

export async function renderInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  const doc = buildInvoiceDocument(input);
  // Métadonnée du fichier, pas contenu du document : elle reste ici.
  const title = `Facture ${input.invoice.invoice_number ?? ""}`.trim();

  return renderToBuffer(
    <Document title={title}>
      <InvoiceSheet doc={doc} />
    </Document>,
  );
}

/** Nom du fichier téléchargé depuis la page publique. */
export function invoiceFileName(inv: {
  invoice_number: string | null;
  patient_name: string | null;
}): string {
  const base = inv.invoice_number || inv.patient_name || "facture";
  return `Facture-${base.replace(/[^\w.-]+/g, "-")}.pdf`;
}
