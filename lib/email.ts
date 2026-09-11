/**
 * Envoi d'e-mails via Resend.
 *
 * Deux variables d'environnement sont nécessaires (Vercel > Settings >
 * Environment Variables, et .env.local en développement) :
 *   RESEND_API_KEY     clé API Resend
 *   INVOICE_FROM_EMAIL adresse d'expédition, sur un domaine vérifié chez
 *                      Resend — sans quoi les messages partent en indésirables
 *                      ou sont refusés.
 * Tant qu'elles ne sont pas renseignées, l'envoi est refusé proprement plutôt
 * que de échouer au moment de l'appel.
 */
import { Resend } from "resend";

export type EmailConfig = { apiKey: string; from: string };

/** Configuration d'envoi, ou null si elle est incomplète. */
export function emailConfig(): EmailConfig | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.INVOICE_FROM_EMAIL?.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

export type Attachment = { filename: string; content: Buffer };

/** Envoie un message. Renvoie null si tout s'est bien passé, sinon l'erreur. */
export async function sendMail(
  config: EmailConfig,
  message: {
    to: string;
    subject: string;
    text: string;
    replyTo?: string;
    attachments?: Attachment[];
  },
): Promise<string | null> {
  try {
    const resend = new Resend(config.apiKey);
    const { error } = await resend.emails.send({
      from: config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      replyTo: message.replyTo,
      attachments: message.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    });
    return error ? (error.message ?? "Envoi refusé par Resend") : null;
  } catch (e) {
    return e instanceof Error ? e.message : "Erreur d'envoi inconnue";
  }
}
