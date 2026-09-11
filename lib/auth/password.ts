/**
 * Politique de mot de passe.
 *
 * POURQUOI ELLE EXISTE. Le produit contient des données de santé et la RLS
 * PostgreSQL en est l'unique défense. Cette défense est parfaite tant que la
 * session est légitime : le maillon faible n'est pas l'isolation, c'est l'accès
 * au compte. Le minimum précédent — six caractères, aucun autre contrôle —
 * n'était pas à la hauteur de ce qu'il protège.
 *
 * Le refus explique TOUJOURS ce qui ne va pas. Un message générique
 * (« mot de passe invalide ») pousse l'utilisateur à essayer des variantes de
 * ce qu'il avait en tête, c'est-à-dire à rester dans la même famille faible.
 *
 * [À INSTRUIRE] Une vérification contre un corpus de mots de passe compromis
 * (k-anonymat HaveIBeenPwned) couvrirait davantage de cas que la liste locale
 * ci-dessous. Elle ajoute un appel réseau au moment de l'inscription et une
 * dépendance à un tiers : à trancher avec l'auditeur sécurité.
 */

export const MIN_PASSWORD_LENGTH = 12;

/**
 * Mots de passe et racines les plus employés, en français et en anglais, plus
 * ceux que ce produit attire naturellement. Liste courte et assumée : elle
 * n'est pas exhaustive, elle écarte les choix les plus immédiats.
 */
const RACINES_INTERDITES = [
  "motdepasse", "password", "azerty", "qwerty", "123456", "111111",
  "soleil", "bonjour", "abcdef", "iloveyou", "admin", "administrateur",
  "psychomotime", "psychomot", "cabinet", "patient", "bilan", "secret",
  "loulou", "doudou", "chouchou", "nintendo", "marseille", "chocolat",
];

export interface PasswordCheck {
  ok: boolean;
  /** Motif du refus, destiné à être affiché tel quel. */
  error?: string;
}

/** Retire les accents et met en minuscules, pour comparer des racines. */
function normaliser(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Vrai si la chaîne ENTIÈRE est une suite croissante ou décroissante.
 *
 * La règle porte sur le mot de passe complet, pas sur un fragment : refuser
 * tout mot de passe contenant « abcd » écarterait des phrases légitimes sans
 * rien protéger de plus.
 */
function estUneSuite(s: string): boolean {
  if (s.length < 4) return false;
  let croissant = true;
  let decroissant = true;
  for (let i = 1; i < s.length; i++) {
    const d = s.codePointAt(i)! - s.codePointAt(i - 1)!;
    if (d !== 1) croissant = false;
    if (d !== -1) decroissant = false;
  }
  return croissant || decroissant;
}

/**
 * Vérifie un mot de passe proposé.
 *
 * `email` sert à refuser un mot de passe bâti sur l'adresse : c'est la variante
 * faible la plus courante, et elle est devinable par quiconque connaît
 * l'adresse — donc par quiconque a vu une facture.
 */
export function checkPassword(
  password: string,
  email?: string | null,
): PasswordCheck {
  const p = password ?? "";

  if (p.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères. Une phrase dont vous vous souvenez fait un très bon mot de passe.`,
    };
  }
  if (p.length > 200) {
    return { ok: false, error: "Le mot de passe ne peut pas dépasser 200 caractères." };
  }
  if (p.trim() !== p) {
    return {
      ok: false,
      error: "Le mot de passe ne doit pas commencer ni finir par une espace : elle se perd au copier-coller.",
    };
  }

  const n = normaliser(p);

  if (new Set(n).size < 5) {
    return {
      ok: false,
      error: "Le mot de passe répète trop peu de caractères différents.",
    };
  }
  if (estUneSuite(n)) {
    return {
      ok: false,
      error: "Une suite de caractères consécutifs est trop facile à deviner.",
    };
  }
  for (const racine of RACINES_INTERDITES) {
    if (n.includes(racine)) {
      return {
        ok: false,
        error: `« ${racine} » figure parmi les mots de passe les plus essayés. Choisissez autre chose.`,
      };
    }
  }
  if (email) {
    const local = normaliser(email.split("@")[0] ?? "");
    if (local.length >= 4 && n.includes(local)) {
      return {
        ok: false,
        error: "Le mot de passe ne doit pas contenir votre adresse e-mail : elle est connue de vos destinataires.",
      };
    }
  }

  return { ok: true };
}
