import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHEMINS_PUBLICS,
  estSousChemin,
  estCheminPublic,
  estConsultationPublique,
} from "@/lib/supabase/chemins";

test("la liste des chemins ouverts sans compte est CLOSE", () => {
  /* UN JEU EXACT, PAS UNE LISTE DE CAS. Les contrôles ci-dessous vérifient des
   * chemins nommés un par un : ils ne voient pas une entrée AJOUTÉE. Une page
   * de vérification temporaire s'y est glissée le temps d'une session, et les
   * 134 contrôles unitaires sont passés sans rien dire — elle ne recevait
   * pourtant aucun des en-têtes de protection du produit, ni `no-store`, ni
   * `no-referrer`, ni `X-Robots-Tag: noindex`.
   *
   * Ouvrir un chemin au public est une décision. Elle passe par ici.
   *
   * Trouvé par la relecture de sécurité du rang 3. */
  assert.deepEqual([...CHEMINS_PUBLICS], [
    "/login",
    "/auth",
    "/document",
    "/mot-de-passe",
  ]);
});

test("un préfixe n'est pas un segment de chemin", () => {
  /* LE DÉFAUT D'ORIGINE, en un contrôle. Avec `startsWith`, le module
   * Documents du cabinet — authentifié, rempli de pièces de santé — était
   * classé chemin public parce que son nom commence comme celui de la
   * consultation par jeton. */
  assert.equal(estCheminPublic("/documents"), false);
  assert.equal(estCheminPublic("/documents/12345"), false);
  assert.equal(estConsultationPublique("/documents"), false);

  // Et la même confusion sur les trois autres entrées de la liste.
  assert.equal(estCheminPublic("/logins"), false);
  assert.equal(estCheminPublic("/authentification"), false);
  assert.equal(estCheminPublic("/mot-de-passe-oublie"), false);
});

test("ce qui doit rester ouvert le reste", () => {
  assert.equal(estCheminPublic("/login"), true);
  assert.equal(estCheminPublic("/auth/callback"), true);
  assert.equal(estCheminPublic("/mot-de-passe/nouveau"), true);

  assert.equal(estConsultationPublique("/document"), true);
  assert.equal(estConsultationPublique("/document/abcDEF-123_xyz"), true);
  assert.equal(estCheminPublic("/document/abcDEF-123_xyz"), true);
});

test("la racine et les modules du cabinet exigent une session", () => {
  for (const chemin of [
    "/", "/patients", "/bilans", "/comptabilite", "/parametres",
    "/attestations", "/transmissions", "/admin",
  ]) {
    assert.equal(estCheminPublic(chemin), false, chemin);
  }
});

test("estSousChemin ne se laisse pas glisser hors du préfixe", () => {
  assert.equal(estSousChemin("/document", "/document"), true);
  assert.equal(estSousChemin("/document/x", "/document"), true);
  assert.equal(estSousChemin("/documentx", "/document"), false);
  assert.equal(estSousChemin("/docu", "/document"), false);
  assert.equal(estSousChemin("", "/document"), false);
});
