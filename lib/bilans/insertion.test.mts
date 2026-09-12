import { test } from "node:test";
import assert from "node:assert/strict";
import { insererAuCurseur } from "@/lib/bilans/insertion";

test("le fragment va là où est le curseur, pas à la fin", () => {
  // Le défaut d'origine : tout atterrissait en queue de champ.
  const r = insererAuCurseur("Début fin.", 6, 6, "MILIEU");
  assert.equal(r.texte, "Début MILIEU fin.");
});

test("une sélection est remplacée", () => {
  const r = insererAuCurseur("Le tonus est bon.", 3, 8, "TONUS AXIAL");
  assert.equal(r.texte, "Le TONUS AXIAL est bon.");
});

test("les mots ne se collent pas, et la ponctuation ne s'écarte pas", () => {
  assert.equal(insererAuCurseur("abcdef", 3, 3, "X").texte, "abc X def");
  // Devant un point, pas d'espace ajoutée : « fatigué ., » serait pire.
  assert.equal(insererAuCurseur("Il est.", 7, 7, "fatigué").texte, "Il est. fatigué");
  assert.equal(insererAuCurseur("Il est .", 7, 7, "fatigué").texte, "Il est fatigué.");
  // Ni devant une virgule, un point-virgule, une parenthèse ou un guillemet.
  for (const p of [",", ";", ":", "!", "?", ")", "»"]) {
    assert.equal(insererAuCurseur(`ab${p}`, 2, 2, "X").texte, `ab X${p}`, p);
  }
});

test("un champ vide reçoit le fragment tel quel", () => {
  assert.equal(insererAuCurseur("", 0, 0, "Texte").texte, "Texte");
  assert.equal(insererAuCurseur("", 0, 0, "Texte").curseur, 5);
});

test("le curseur se replace après ce qui vient d'être inséré", () => {
  // Sans cela on continue de taper avant son propre fragment.
  const r = insererAuCurseur("Début fin.", 6, 6, "MILIEU");
  assert.equal(r.texte.slice(0, r.curseur), "Début MILIEU ");
});

test("une position aberrante ne découpe pas le texte au hasard", () => {
  /* `slice` accepte n'importe quel nombre sans broncher. Sur un texte
   * clinique, un découpage silencieux à une mauvaise position est exactement
   * le défaut qu'on ne verrait pas. */
  assert.equal(insererAuCurseur("abc", 99, 99, "X").texte, "abc X");
  assert.equal(insererAuCurseur("abc", -5, -5, "X").texte, "X abc");
  /* LE CAS QUI DISTINGUE VRAIMENT. `slice` interprète un indice négatif comme
   * « depuis la fin » : sans ramener les bornes, `slice(0, -1)` sur « abcdef »
   * rend « abcde », et le texte se retrouve DUPLIQUÉ autour du fragment. Avec
   * -5 sur « abc », `slice` donne le même résultat que la borne ramenée — le
   * contrôle passait donc sans rien prouver. */
  assert.equal(insererAuCurseur("abcdef", -1, -1, "X").texte, "X abcdef");
  // Bornes inversées : la fin ne peut pas précéder le début.
  assert.equal(insererAuCurseur("abcdef", 4, 1, "X").texte, "abcd X ef");
});
