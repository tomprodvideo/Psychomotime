import { headers } from "next/headers";
import { origineAutorisee } from "./origine";

/**
 * Origine publique du site, pour les liens absolus envoyés par e-mail.
 *
 * La règle — et la raison pour laquelle elle ne fait plus confiance à
 * l'en-tête `x-forwarded-host` — vit dans `./origine`, où elle se vérifie
 * sans dépendre de `next/headers`.
 */
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  return origineAutorisee(
    h.get("x-forwarded-host") ?? h.get("host"),
    h.get("x-forwarded-proto"),
    process.env,
  );
}
