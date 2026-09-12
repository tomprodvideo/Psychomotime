import type { MetadataRoute } from "next";

/**
 * Ce que les moteurs de recherche peuvent explorer.
 *
 * RIEN. Ce produit n'a aucune page destinée au public : tout est soit derrière
 * une session, soit derrière un jeton. Un lien de consultation qui atterrirait
 * dans un index cesserait d'être un secret — et il y atterrit par des chemins
 * qu'on ne contrôle pas : une barre d'adresse qui suggère, une extension qui
 * remonte l'historique, un message transféré.
 *
 * Le refus est doublé par l'en-tête `X-Robots-Tag` posé sur `/document/*` et
 * par la balise de la page : un fichier à la racine ne protège que les robots
 * qui le lisent.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
