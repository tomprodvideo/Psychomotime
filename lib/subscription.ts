import type { Access, Subscription } from "@/lib/types";

/**
 * Règles d'accès payant — source unique côté application.
 *
 * POURQUOI CE MODULE EXISTE. La question « ce compte a-t-il accès ? » était
 * réécrite à chaque endroit qui en avait besoin : une fois dans le chargeur de
 * session, une fois dans la page d'administration, jamais côté serveur pour
 * les mutations. Trois implémentations d'une même règle, c'est trois occasions
 * de diverger.
 *
 * CONTRAT AVEC LA BASE. Ces fonctions doivent dire exactement la même chose que
 * `app.subscription_is_active` (voir `supabase/migrations/0001_socle_identite.sql`).
 * La base reste l'autorité : l'application ne fait qu'anticiper sa réponse pour
 * afficher le bon écran. Si les deux divergent, c'est la base qui a raison.
 *
 * L'instant est toujours un paramètre, jamais une lecture d'horloge cachée :
 * une règle qui dépend du temps doit être testable à une date choisie.
 */

/** L'essai court-il encore à cet instant ? */
export function isTrialRunning(
  sub: Pick<Subscription, "status" | "trial_end"> | null,
  now: Date = new Date(),
): boolean {
  if (!sub || sub.status !== "trialing" || !sub.trial_end) return false;
  const end = new Date(sub.trial_end).getTime();
  return Number.isFinite(end) && end > now.getTime();
}

/** L'abonnement donne-t-il accès au produit à cet instant ? */
export function isSubscriptionActive(
  sub: Pick<Subscription, "status" | "trial_end" | "manual_override"> | null,
  now: Date = new Date(),
): boolean {
  if (!sub) return false;
  return (
    sub.manual_override === true ||
    sub.status === "active" ||
    isTrialRunning(sub, now)
  );
}

/** Jours entiers restants avant la fin de l'essai, ou `null` hors essai. */
export function trialDaysLeft(
  sub: Pick<Subscription, "status" | "trial_end"> | null,
  now: Date = new Date(),
): number | null {
  if (!isTrialRunning(sub, now) || !sub?.trial_end) return null;
  const ms = new Date(sub.trial_end).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/** Refus complet : la forme rendue quand aucun accès n'est démontrable. */
export const ACCESS_DENIED: Access = {
  active: false,
  isAdmin: false,
  status: "none",
  trialEnd: null,
  trialDaysLeft: null,
};

/**
 * Décision d'accès à partir de la ligne d'abonnement lue en base.
 *
 * `sub` à `null` signifie « aucune ligne lisible » — pas « accès libre ».
 * Le refus est le comportement par défaut : une base indisponible ne doit
 * jamais ouvrir un produit qui contient des données de santé.
 */
export function decideAccess(
  sub: Subscription | null,
  now: Date = new Date(),
): Access {
  if (!sub) return ACCESS_DENIED;
  const isAdmin = sub.is_admin === true;
  return {
    active: isAdmin || isSubscriptionActive(sub, now),
    isAdmin,
    status: sub.status ?? "inactive",
    trialEnd: sub.trial_end ?? null,
    trialDaysLeft: trialDaysLeft(sub, now),
  };
}
