import { createClient } from "@/lib/supabase/server";
import type { SharedInvoice } from "@/lib/invoiceShare";
import { invoiceFileName, renderInvoicePdf } from "@/lib/invoicePdf";

/** Téléchargement du PDF depuis le lien de consultation. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("invoice_by_token", { p_token: token });
  if (!data) return new Response("Facture introuvable ou lien expiré", { status: 404 });

  const shared = data as SharedInvoice;
  const pdf = await renderInvoicePdf(shared);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoiceFileName(shared.invoice)}"`,
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "private, no-store",
    },
  });
}
