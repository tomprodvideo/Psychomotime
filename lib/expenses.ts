/**
 * Dépenses récurrentes du cabinet (Paramètres › Dépenses).
 *
 * Elles sont ramenées à un équivalent mensuel pour pouvoir être déduites sur
 * n'importe quelle période : une dépense annuelle compte pour un douzième par
 * mois, ce qui évite qu'un mois porte seul toute la charge de l'année.
 */
import type { RecurringExpense } from "@/lib/types";
import { round2 } from "@/lib/calc";

/** Coût mensuel d'une dépense ; 0 si elle est désactivée. */
export function monthlyEquivalent(e: RecurringExpense): number {
  if (!e.active) return 0;
  const amount = e.amount || 0;
  return e.period === "annuel" ? amount / 12 : amount;
}

/** Coût mensuel de toutes les dépenses actives. */
export function monthlyTotal(list: RecurringExpense[]): number {
  return round2(list.reduce((sum, e) => sum + monthlyEquivalent(e), 0));
}

/** Coût cumulé sur un nombre de mois donné. */
export function recurringOver(
  list: RecurringExpense[],
  months: number,
): number {
  return round2(monthlyTotal(list) * Math.max(0, months));
}
