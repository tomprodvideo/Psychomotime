import assert from "node:assert/strict";
import test from "node:test";
import { chaineCss, cssRappelDePage, texteRappel } from "@/lib/impression/rappel";

/* Tous les noms et dates de ce fichier sont fictifs. */

/** Relit une chaîne produite par `chaineCss`, comme le ferait un moteur CSS. */
function relire(css: string): string {
  assert.ok(css.startsWith('"') && css.endsWith('"'));
  return css
    .slice(1, -1)
    .replace(/\\([0-9A-F]{6}) /g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

/** La grammaire complète de la sortie : lettres, chiffres, échappements. Rien d'autre. */
const GRAMMAIRE = /^"(?:[A-Za-z0-9]|\\[0-9A-F]{6} )*"$/;

test("rien de ce qui peut fermer une chaîne, une règle ou un élément ne survit", () => {
  const hostile = 'Zoé "fin"; } body{display:none} </style><script>alert(1)</script> \\ \n';
  const sortie = chaineCss(hostile);
  assert.match(sortie, GRAMMAIRE);
  for (const dangereux of ['"', "\\\\", "}", "{", ";", "<", ">", "\n"]) {
    assert.ok(
      !sortie.slice(1, -1).replace(/\\[0-9A-F]{6} /g, "").includes(dangereux),
      `« ${dangereux} » a survécu à l'échappement`,
    );
  }
  assert.equal(relire(sortie), hostile);
});

test("une espace réelle qui suit un échappement n'est pas absorbée", () => {
  /* LE DÉFAUT TROUVÉ DANS LE PDF. Un échappement hexadécimal consomme
   * l'espace qui le suit ; sans terminateur explicite, « Zoé « L'Hôte » »
   * s'imprimait « Zoé« L'Hôte ». */
  const nom = "Zoé « L'Hôte » — 1er janv. – 31 mars 2026";
  assert.equal(relire(chaineCss(nom)), nom);
});

test("un emoji est UN point de code, pas deux demi-paires", () => {
  const sortie = chaineCss("✓ 🧸");
  assert.match(sortie, GRAMMAIRE);
  assert.ok(sortie.includes("\\01F9F8 "), "le code du point astral doit être entier");
  assert.equal(relire(sortie), "✓ 🧸");
});

test("les lettres et chiffres ASCII passent tels quels ; la chaîne vide reste vide", () => {
  assert.equal(chaineCss("Facture2026"), '"Facture2026"');
  assert.equal(chaineCss(""), '""');
});

test("le rappel omet ce qui manque, sans laisser de séparateur orphelin", () => {
  assert.equal(
    texteRappel({ nature: "Synthèse de suivi", personne: "Personne Fictive", date: "31/03/2026" }),
    "Synthèse de suivi · Personne Fictive · 31/03/2026",
  );
  assert.equal(texteRappel({ nature: "Fiche patient", personne: "  ", date: null }), "Fiche patient");
});

test("la feuille ne porte le texte variable QUE sous forme échappée", () => {
  const css = cssRappelDePage({ nature: "Facture", personne: '"; } x{', date: null });
  assert.ok(!css.includes('"; } x{'), "le nom hostile apparaît en clair dans la feuille");
  assert.ok(!css.includes("<"), "un chevron dans la feuille pourrait fermer <style>");
  assert.ok(css.includes('counter(page)') && css.includes("counter(pages)"));
});
