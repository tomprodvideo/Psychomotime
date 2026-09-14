/**
 * Périodes comptables.
 *
 * MODULE PUR, et l'horloge y est un PARAMÈTRE. Un écran comptable qui lit
 * `new Date()` au fond de son code rend ses totaux intestables et fait dépendre
 * ce qu'il affiche du fuseau du serveur : une facture du 31 décembre peut
 * basculer d'un exercice à l'autre selon l'endroit où la question est posée.
 *
 * ET CE PARAMÈTRE EST UN JOUR DU CABINET, PAS UN INSTANT. Il était un `Date`,
 * lu par `getFullYear` et `getMonth` — dans le fuseau du PROCESSUS, soit la
 * dépendance même que ce module annonçait écarter. Sous un processus UTC, le
 * 1er janvier à 0 h 30 à Paris, « l'année en cours » était encore l'année
 * close. Les écrans passent désormais `dateCivile(instant, fuseau du cabinet)`,
 * et un instant ne compile plus. Déplacé depuis `app/(app)/comptabilite/` pour
 * être contrôlé : les contrôles unitaires ne parcourent que `lib/`.
 */

import type { DateCivile } from "@/lib/dateCivile";

export type ModePeriode = "mois" | "annee" | "intervalle" | "tout";

export interface Periode {
  mode: ModePeriode;
  /** Bornes incluses, au format « AAAA-MM-JJ ». Absentes en mode « tout ». */
  du?: string;
  au?: string;
  libelle: string;
}

export const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
] as const;

function jour(annee: number, mois: number, j: number): string {
  return `${annee}-${String(mois).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
}

/** Dernier jour du mois. Février bissextile compris. */
export function dernierJour(annee: number, mois: number): number {
  return new Date(Date.UTC(annee, mois, 0)).getUTCDate();
}

/** L'année et le mois d'un jour civil. Un jour illisible est une erreur, pas une devinette. */
export function anneeEtMois(jour: DateCivile): { annee: number; mois: number } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) throw new RangeError(`Jour civil illisible : ${jour}`);
  return { annee: Number(jour.slice(0, 4)), mois: Number(jour.slice(5, 7)) };
}

/**
 * Résout la période demandée.
 *
 * Une saisie illisible n'est pas devinée : on retombe sur l'année en cours, ce
 * qui est visible dans le sélecteur, plutôt que d'afficher des totaux d'une
 * période que personne n'a choisie.
 */
export function resoudrePeriode(
  params: { mode?: string; mois?: string; annee?: string; du?: string; au?: string },
  aujourdhui: DateCivile,
): Periode {
  const { annee: anneeCourante, mois: moisCourant } = anneeEtMois(aujourdhui);
  const annee = Number(params.annee);
  const anneeValide =
    Number.isInteger(annee) && annee >= 2000 && annee <= 2200 ? annee : anneeCourante;

  if (params.mode === "tout") {
    return { mode: "tout", libelle: "Depuis le début" };
  }

  if (params.mode === "intervalle") {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    const du = params.du && iso.test(params.du) ? params.du : jour(anneeValide, 1, 1);
    const au =
      params.au && iso.test(params.au)
        ? params.au
        : jour(anneeValide, 12, 31);
    // Deux bornes inversées donneraient un ensemble vide sans le dire.
    const [debut, fin] = du <= au ? [du, au] : [au, du];
    return {
      mode: "intervalle",
      du: debut,
      au: fin,
      libelle: `Du ${debut.split("-").reverse().join("/")} au ${fin.split("-").reverse().join("/")}`,
    };
  }

  if (params.mode === "mois") {
    const mois = Number(params.mois);
    const moisValide =
      Number.isInteger(mois) && mois >= 1 && mois <= 12
        ? mois
        : moisCourant;
    return {
      mode: "mois",
      du: jour(anneeValide, moisValide, 1),
      au: jour(anneeValide, moisValide, dernierJour(anneeValide, moisValide)),
      libelle: `${MOIS[moisValide - 1]} ${anneeValide}`,
    };
  }

  return {
    mode: "annee",
    du: jour(anneeValide, 1, 1),
    au: jour(anneeValide, 12, 31),
    libelle: `Année ${anneeValide}`,
  };
}

/** Les paramètres d'URL correspondant à une période, pour construire un lien. */
export function versParams(p: Periode, aujourdhui: DateCivile): URLSearchParams {
  const u = new URLSearchParams();
  u.set("mode", p.mode);
  if (p.mode === "tout") return u;
  const annee = p.du ? Number(p.du.slice(0, 4)) : anneeEtMois(aujourdhui).annee;
  u.set("annee", String(annee));
  if (p.mode === "mois" && p.du) u.set("mois", String(Number(p.du.slice(5, 7))));
  if (p.mode === "intervalle") {
    if (p.du) u.set("du", p.du);
    if (p.au) u.set("au", p.au);
  }
  return u;
}
