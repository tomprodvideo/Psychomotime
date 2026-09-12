"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  contexteEcriture,
  id,
  messageErreur,
  rendreCompte,
  str,
  type Resultat,
} from "@/lib/actions/serveur";
import {
  EXPIRATION_PAR_DEFAUT_JOURS,
  empreinte,
  expiration,
  indice,
  nouveauJeton,
} from "@/lib/transmissions/jeton";
import type { SujetPartage } from "@/lib/transmissions/types";
import { messageLien } from "@/lib/transmissions/courriel";
import { emailConfig, sendMail } from "@/lib/email";
import { siteOrigin } from "@/lib/siteOrigin";

/**
 * Création et révocation des liens de transmission.
 *
 * LE JETON N'EST RENDU QU'UNE FOIS, à l'appelante qui vient de le créer. Il
 * n'est pas stocké, il ne peut pas être relu, et aucune autre action ne le
 * rend. Si elle ferme l'écran sans l'avoir copié, il faut révoquer et
 * recommencer — c'est le prix de ne pas le garder, et c'est le bon prix.
 */

export interface LienCree extends Resultat {
  /** Le lien complet, en clair. Affiché une fois, jamais réaffiché. */
  lien?: string;
  expire_le?: string;
  /** Compte rendu de l'envoi, quand un envoi a été demandé. */
  envoi?: "envoye" | "non_configure" | "echec";
  envoi_a?: string;
}

/** Forme d'adresse acceptée. Volontairement stricte : pas de nom, pas de liste. */
const ADRESSE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/;

const SUJETS: SujetPartage[] = ["billing_document", "attestation"];

export async function creerLien(fd: FormData): Promise<LienCree> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const sujetBrut = String(fd.get("subject_type") ?? "");
  const subjectId = id(fd, "subject_id");
  if (!(SUJETS as string[]).includes(sujetBrut) || !subjectId) {
    return { ok: false, error: "Document introuvable." };
  }

  const joursBrut = Number(fd.get("jours") ?? EXPIRATION_PAR_DEFAUT_JOURS);
  const jours =
    Number.isInteger(joursBrut) && joursBrut >= 1 && joursBrut <= 365
      ? joursBrut
      : EXPIRATION_PAR_DEFAUT_JOURS;

  /* LE DESTINATAIRE EST NOMMÉ À LA CRÉATION, et c'est délibéré : six mois plus
   * tard, savoir à qui on avait donné quoi est la seule façon de révoquer le
   * bon lien. La version précédente ne conservait rien de tel. */
  const destinataireContact = id(fd, "recipient_contact_id");
  const destinataireLibelle = str(fd, "recipient_label");
  if (!destinataireContact && !destinataireLibelle) {
    return {
      ok: false,
      error:
        "Indiquez à qui ce lien est destiné. Sans cela, vous ne saurez plus lequel révoquer.",
    };
  }

  const jeton = nouveauJeton();
  const expire = expiration(jours, new Date());

  const supabase = await createClient();
  const { error } = await supabase.from("shared_links").insert({
    practice_id: ctx.practice.practiceId,
    subject_type: sujetBrut,
    subject_id: subjectId,
    token_hash: empreinte(jeton),
    token_hint: indice(jeton),
    expires_at: expire.toISOString(),
    recipient_contact_id: destinataireContact,
    recipient_label: destinataireLibelle,
  });

  if (error) return { ok: false, error: messageErreur(error) };

  // La trace de la création : qui a partagé quoi, et quand. Jamais le jeton.
  const { error: erreurTrace } = await supabase.rpc("log_audit_event", {
    p_practice_id: ctx.practice.practiceId,
    p_action: "transmission.link_created",
    p_subject_type: sujetBrut,
    p_subject_id: subjectId,
    p_metadata: { expire_le: expire.toISOString().slice(0, 10), jours },
  });
  if (erreurTrace) {
    console.error("[transmissions] journalisation refusée :", erreurTrace);
  }

  revalidatePath(`/comptabilite/${subjectId}`);
  revalidatePath(`/comptabilite/attestations/${subjectId}`);

  const chemin = `/document/${jeton}`;
  const expireLe = expire.toISOString().slice(0, 10);

  /* ── L'ENVOI PAR COURRIEL ─────────────────────────────────────────────
   *
   * Facultatif, et DÉSACTIVÉ tant que le cabinet n'a pas configuré de service
   * d'envoi. Ce n'est pas un oubli : l'envoi confie l'adresse du destinataire
   * à un prestataire dont les serveurs ne sont pas dans l'EEE, et ce point
   * n'est pas arbitré. [VALIDATION HUMAINE — DPO, voir R-01]
   *
   * Le message ne porte ni pièce jointe, ni montant, ni nature d'acte, ni nom
   * de patient : il dit qu'un document attend, où le prendre, et jusqu'à
   * quand. `lib/transmissions/courriel.ts` en tient la preuve par des tests. */
  const adresse = str(fd, "envoyer_a");
  if (!adresse) {
    return {
      ok: true,
      lien: chemin,
      expire_le: expireLe,
      message: "Lien créé. Copiez-le maintenant : il ne sera plus jamais affiché.",
    };
  }

  if (!ADRESSE.test(adresse)) {
    return {
      ok: true,
      lien: chemin,
      expire_le: expireLe,
      envoi: "echec",
      envoi_a: adresse,
      message:
        "Le lien est créé, mais l'adresse saisie n'est pas une adresse électronique valide : rien n'a été envoyé. Copiez le lien ci-dessus.",
    };
  }

  const config = emailConfig();
  if (!config) {
    return {
      ok: true,
      lien: chemin,
      expire_le: expireLe,
      envoi: "non_configure",
      envoi_a: adresse,
      message:
        "Le lien est créé, mais aucun service d'envoi n'est configuré : rien n'a été envoyé. Copiez le lien et transmettez-le par le canal de votre choix.",
    };
  }

  const origine = await siteOrigin();
  const msg = messageLien({
    cabinet: ctx.practice.practiceName,
    lien: `${origine}${chemin}`,
    expireLe,
    indice: indice(jeton),
  });

  const echecEnvoi = await sendMail(config, {
    to: adresse,
    subject: msg.sujet,
    text: msg.texte,
  });

  // La trace nomme l'ACTION et le document, jamais l'adresse : un journal qui
  // collectionnerait les adresses des familles serait un fichier de plus.
  await supabase.rpc("log_audit_event", {
    p_practice_id: ctx.practice.practiceId,
    p_action: echecEnvoi ? "transmission.mail_failed" : "transmission.mail_sent",
    p_subject_type: sujetBrut,
    p_subject_id: subjectId,
    p_metadata: { expire_le: expireLe },
  });

  if (echecEnvoi) {
    console.error("[transmissions] envoi refusé :", echecEnvoi);
    return {
      ok: true,
      lien: chemin,
      expire_le: expireLe,
      envoi: "echec",
      envoi_a: adresse,
      message:
        "Le lien est créé, mais son envoi a échoué. Copiez-le ci-dessus et transmettez-le autrement.",
    };
  }

  return {
    ok: true,
    lien: chemin,
    expire_le: expireLe,
    envoi: "envoye",
    envoi_a: adresse,
    message: `Lien créé et envoyé à ${adresse}. Copiez-le tout de même : il ne sera plus jamais affiché.`,
  };
}

/**
 * Révoque un lien.
 *
 * Il n'est pas supprimé : le compte rendu de ses consultations reste, et
 * effacer la ligne effacerait la preuve qu'un document a circulé.
 */
export async function revoquerLien(fd: FormData): Promise<Resultat> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const lienId = id(fd, "link_id");
  if (!lienId) return { ok: false, error: "Lien introuvable." };

  const supabase = await createClient();
  const resultat = await supabase
    .from("shared_links")
    /* QUI a retiré ce lien, pas seulement quand. Le modèle admet plusieurs
     * membres par cabinet : sans cette colonne, rien sur la ligne ne dit qui
     * a repris un document de santé déjà transmis. `created_by` est, lui,
     * posé par défaut en base — c'est le seul chemin d'écriture. */
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: ctx.userId,
    })
    .eq("id", lienId)
    .eq("practice_id", ctx.practice.practiceId)
    .is("revoked_at", null)
    .select("id, subject_id, subject_type, token_hint");

  const echec = rendreCompte(resultat, "le lien");
  if (echec) return echec;

  const cible = (resultat.data as unknown as
    | { subject_id: string; subject_type: string }[]
    | null)?.[0];

  if (cible) {
    await supabase.rpc("log_audit_event", {
      p_practice_id: ctx.practice.practiceId,
      p_action: "transmission.link_revoked",
      p_subject_type: cible.subject_type,
      p_subject_id: cible.subject_id,
      p_metadata: {},
    });
    revalidatePath(`/comptabilite/${cible.subject_id}`);
    revalidatePath(`/comptabilite/attestations/${cible.subject_id}`);
  }

  return {
    ok: true,
    /* Formulation exacte : la révocation prend effet à la PROCHAINE ouverture.
     * Une page déjà affichée sur l'écran de quelqu'un y reste — aucun logiciel
     * ne peut la retirer d'un navigateur. Promettre le contraire serait
     * rassurer à tort sur un document qui a déjà été lu. */
    message:
      "Lien révoqué. Toute nouvelle ouverture affichera qu'il n'est plus valide. Une page déjà affichée chez son destinataire y reste : la révocation empêche de la rouvrir, elle ne l'efface pas.",
  };
}
