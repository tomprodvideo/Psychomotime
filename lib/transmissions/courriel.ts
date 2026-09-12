/**
 * Le message qui accompagne un lien.
 *
 * MODULE PUR : ni réseau, ni horloge, ni base. Il ne fait que composer un texte,
 * ce qui le rend vérifiable — et c'est nécessaire, parce que ce qu'un courriel
 * NE contient PAS est ici plus important que ce qu'il contient.
 *
 * ── CE QUI N'Y ENTRE JAMAIS, ET POURQUOI ─────────────────────────────────
 *
 * Un courriel voyage en clair d'un serveur à l'autre, se range dans des boîtes
 * partagées, s'affiche en notification sur un écran verrouillé, et se conserve
 * chez un hébergeur que ni le cabinet ni ce logiciel ne maîtrisent.
 *
 * Il ne porte donc :
 *  · AUCUNE PIÈCE JOINTE — le document reste derrière le lien, révocable ;
 *  · AUCUN MONTANT ;
 *  · AUCUNE NATURE D'ACTE, aucun diagnostic, aucun contenu de dossier ;
 *  · AUCUN NOM DE PATIENT. Qu'une personne suive des séances de
 *    psychomotricité est une information de santé : elle n'a pas à
 *    s'afficher dans un aperçu de notification.
 *
 * Il dit qu'un document attend, où le prendre, et jusqu'à quand. Rien d'autre.
 *
 * ── CE QUI RESTE À TRANCHER ──────────────────────────────────────────────
 *
 * [VALIDATION HUMAINE — DPO] L'envoi passe par un prestataire dont les serveurs
 * ne sont pas dans l'EEE, et l'adresse du destinataire lui est confiée. Tant que
 * ce point n'est pas arbitré, l'envoi reste DÉSACTIVÉ par défaut : il n'existe
 * que si le cabinet configure lui-même un service d'envoi. Voir R-01.
 */

export interface MessageLien {
  sujet: string;
  texte: string;
}

/**
 * Compose le message.
 *
 * `expireLe` et `cabinet` sont des paramètres : rien ici ne lit l'horloge ni la
 * base, pour que le résultat soit le même à chaque exécution.
 */
export function messageLien(params: {
  cabinet: string;
  lien: string;
  expireLe: string;
}): MessageLien {
  const { cabinet, lien, expireLe } = params;

  return {
    // Le sujet s'affiche dans une notification, parfois sur un écran verrouillé,
    // parfois devant quelqu'un d'autre. Il ne nomme ni le document ni personne.
    sujet: "Un document vous a été transmis",
    texte: [
      "Bonjour,",
      "",
      `${cabinet} met un document à votre disposition.`,
      "",
      "Vous pouvez le consulter ici :",
      lien,
      "",
      `Ce lien est personnel et cesse de fonctionner le ${jourFr(expireLe)}.`,
      "Si vous ne comprenez pas ce message, ne suivez pas le lien et",
      "signalez-le à l'expéditeur.",
      "",
      "Ce message est automatique : il ne sert à rien d'y répondre.",
    ].join("\n"),
  };
}

/** « 2026-03-31 » → « 31/03/2026 ». Pas d'`Intl` : le format est fixe. */
function jourFr(iso: string): string {
  const [a, m, j] = iso.slice(0, 10).split("-");
  return `${j}/${m}/${a}`;
}
