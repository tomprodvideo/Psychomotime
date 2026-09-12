import type { Metadata } from "next";

/* LE TITRE VIT DANS UNE MISE EN PAGE, PAS DANS LA PAGE.
   Cette page-ci est un composant client — elle tient un état de formulaire —
   et Next refuse qu'un composant client exporte des métadonnées. La mise en
   page, elle, reste côté serveur : c'est l'endroit prévu pour cela. */
export const metadata: Metadata = { title: "Mot de passe oublié · Psychomotime" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
