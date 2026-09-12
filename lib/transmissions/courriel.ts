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
 * ── UNE RÉSERVE, ET ELLE EST DE TAILLE ───────────────────────────────────
 *
 * LE NOM DU CABINET EST INSÉRÉ TEL QUEL, et il échappe à tout ce qui précède.
 * Un cabinet s'appelle souvent « Cabinet de psychomotricité … » : le mot que ce
 * fichier s'interdit d'écrire arrive alors dans l'aperçu de notification par la
 * porte d'à côté. Le contrôle ne le voyait pas — sa donnée d'essai s'appelait
 * « Cabinet des Trois Ballons », et vérifiait donc la fixture, pas le code.
 *
 * Il est conservé quand même, et c'est un arbitrage, pas un oubli : un message
 * qui ne dit pas de qui il vient a tous les traits d'une contrefaçon, et la
 * personne qui hésite à cliquer finira par se faire envoyer le document en
 * pièce jointe — c'est-à-dire par le pire canal, sans révocation ni trace.
 *
 * [ARBITRAGE — psychomotricienne] Préférez-vous que vos courriels portent un
 * nom d'expéditeur DISTINCT du nom du cabinet ? La réponse appelle un réglage,
 * pas une ligne de code. Consigné en T-01.
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
  /* Les quatre derniers caractères du jeton — l'indice déjà affiché au cabinet
   * dans la liste de ses liens. C'est une VÉRIFICATION HORS DU COURRIEL : la
   * praticienne peut les annoncer de vive voix ou par message, et personne ne
   * peut les deviner à l'avance. Ils ne disent rien du jeton : quatre
   * caractères base64url, c'est moins de 24 bits sur 256. */
  indice?: string | null;
}): MessageLien {
  const { cabinet, lien, expireLe } = params;

  /* L'INDICE EST TRONQUÉ ICI, quoi qu'on lui passe.
   *
   * `indice(jeton)` rend déjà quatre caractères. Mais ce paramètre est une
   * chaîne comme une autre, et le site d'appel a le jeton complet sous la main :
   * une frappe — `indice: jeton` au lieu de `indice: indice(jeton)` — écrirait
   * la clé DEUX FOIS dans le message, dont une hors de l'URL, là où aucun
   * en-tête `no-referrer` ne la protège. Le garde-fou est ici parce que c'est
   * ici qu'on écrit le texte. */
  const indice = (params.indice ?? "").trim().slice(0, 8);

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
      ...(indice !== ""
        ? [
            `Ce lien se termine par « ${indice} » : la personne qui vous l'a`,
            "annoncé peut vous le confirmer.",
            "",
          ]
        : []),
      `Ce lien est personnel et cesse de fonctionner le ${jourFr(expireLe)}.`,
      "",
      /* L'ANCIENNE VERSION SE CONTREDISAIT : elle demandait de « signaler à
       * l'expéditeur » un message dont elle disait ensuite qu'il ne servait à
       * rien d'y répondre — et ne donnait aucun autre moyen de joindre qui que
       * ce soit. Répondre à une adresse d'envoi automatique est d'ailleurs le
       * mauvais réflexe : si le message est une contrefaçon, cette adresse est
       * celle du contrefacteur. La bonne consigne ne s'appuie sur RIEN de ce
       * que le message contient. */
      "Si vous n'attendiez pas ce message, ne suivez pas le lien et prévenez",
      "le cabinet par les coordonnées que vous connaissez déjà.",
    ].join("\n"),
  };
}

/** « 2026-03-31 » → « 31/03/2026 ». Pas d'`Intl` : le format est fixe. */
function jourFr(iso: string): string {
  const [a, m, j] = iso.slice(0, 10).split("-");
  return `${j}/${m}/${a}`;
}
