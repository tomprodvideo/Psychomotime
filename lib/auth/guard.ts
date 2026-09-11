import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/data";
import type { Access } from "@/lib/types";

/**
 * Garde serveur unique.
 *
 * POURQUOI ELLE EXISTE. Une Server Action est un endpoint HTTP public : elle est
 * atteignable sans jamais traverser la page qui l'affiche. Or le contrôle
 * d'abonnement vivait exclusivement dans un layout React, qui ne s'exécute pas
 * lors d'une invocation d'action. Le blocage était donc un écran, pas une
 * frontière.
 *
 * CE QUE CETTE GARDE N'EST PAS. Elle ne remplace pas la RLS, elle la double.
 * L'isolation entre cabinets reste tenue par PostgreSQL ; cette garde répond à
 * une autre question — « cet appelant a-t-il le droit d'agir maintenant ? » —
 * et permet de refuser proprement, avec un message, plutôt que de laisser la
 * base rendre zéro ligne sans rien dire.
 *
 * FORME DU RÉSULTAT. Une action serveur ne doit pas lever : une exception
 * remonterait en page d'erreur au lieu d'un message dans le formulaire. Les
 * gardes rendent donc un résultat discriminé, que l'appelant traite comme une
 * valeur.
 */

export type Guarded<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/** Message unique de session absente. Ne révèle rien de la configuration. */
export const SESSION_EXPIREE =
  "Votre session a expiré. Reconnectez-vous pour continuer.";

/** Message unique d'accès non actif. */
export const ACCES_INACTIF =
  "Votre accès n'est plus actif. Rendez-vous dans Paramètres pour le rétablir.";

/** Exige une session valide. Premier contrôle de toute action serveur. */
export async function requireUser(): Promise<Guarded<User>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: SESSION_EXPIREE };
  return { ok: true, value: user };
}

/**
 * Exige une session valide ET un accès actif.
 *
 * À employer pour toute action qui écrit ou qui consomme une ressource payante.
 * La lecture d'un dossier déjà saisi reste autorisée sans abonnement actif :
 * couper l'accès à ses propres données de santé serait disproportionné, et
 * contraire au droit d'accès. Les actions de LECTURE n'appellent donc que
 * `requireUser`.
 */
export async function requireActiveAccess(): Promise<
  Guarded<{ user: User; access: Access }>
> {
  const session = await requireUser();
  if (!session.ok) return session;

  const access = await getAccess();
  if (!access.active) return { ok: false, error: ACCES_INACTIF };

  return { ok: true, value: { user: session.value, access } };
}

/**
 * Traduit le résultat d'une écriture Supabase en succès ou en échec franc.
 *
 * POURQUOI. Dix-huit mutations sur vingt et une affichaient « Enregistré » sans
 * jamais lire l'erreur. Sur un contenu clinique, une note qu'on croit sauvée et
 * qui ne l'est pas, c'est une passation perdue et une séance à refaire. Un
 * `error` non nul est un échec ; zéro ligne affectée en est un aussi — c'est
 * ainsi que se manifeste un refus de la RLS, qui ne lève pas d'exception.
 */
export function ecritureReussie(
  result: { error: unknown; data?: unknown },
  quoi: string,
): Guarded<true> {
  if (result.error) {
    // Le détail reste côté serveur : un message de PostgREST peut nommer une
    // colonne, une contrainte ou une politique.
    console.error(`[écriture] ${quoi} :`, result.error);
    return {
      ok: false,
      error: `${quoi} n'a pas pu être enregistré. Réessayez ; si le problème persiste, notez ce que vous étiez en train de faire.`,
    };
  }
  if (Array.isArray(result.data) && result.data.length === 0) {
    console.error(`[écriture] ${quoi} : aucune ligne affectée.`);
    return {
      ok: false,
      error: `${quoi} n'a pas été trouvé, ou vous n'avez pas le droit de le modifier.`,
    };
  }
  return { ok: true, value: true };
}
