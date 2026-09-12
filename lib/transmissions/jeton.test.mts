import { test } from "node:test";
import assert from "node:assert/strict";
import {
  empreinte,
  expiration,
  indice,
  nouveauJeton,
} from "@/lib/transmissions/jeton";

/**
 * VECTEUR D'ESSAI PARTAGÉ AVEC LA BASE. Le même jeton et la même empreinte
 * figurent dans `supabase/tests/100_transmissions.sql`. Si l'un des deux côtés
 * changeait d'algorithme ou d'encodage, tous les liens déjà transmis
 * cesseraient de fonctionner — en silence, et sans que personne ne sache
 * pourquoi. Ce vecteur est ce qui rend la divergence bruyante.
 */
const JETON_DE_REFERENCE = "jeton-de-reference-pour-le-test-0123456789";
const EMPREINTE_DE_REFERENCE =
  "6c39241568e9aceb7f187da74d5575cd40703aec4aa71f1e14e7245a1aac87a6";

test("l'empreinte concorde avec celle que calcule la base", () => {
  assert.equal(empreinte(JETON_DE_REFERENCE), EMPREINTE_DE_REFERENCE);
});

test("un jeton fait 256 bits et tient dans une URL", () => {
  const j = nouveauJeton();
  // 32 octets en base64url : 43 caractères, sans « = », « + » ni « / ».
  assert.equal(j.length, 43);
  assert.match(j, /^[A-Za-z0-9_-]+$/);
});

test("deux jetons ne se ressemblent pas", () => {
  const vus = new Set(Array.from({ length: 200 }, () => nouveauJeton()));
  assert.equal(vus.size, 200);
});

test("l'empreinte est stable et fait 64 caractères hexadécimaux", () => {
  const j = nouveauJeton();
  assert.equal(empreinte(j), empreinte(j));
  assert.match(empreinte(j), /^[0-9a-f]{64}$/);
});

test("l'indice ne dit presque rien du jeton", () => {
  const j = nouveauJeton();
  assert.equal(indice(j), j.slice(-4));
  assert.equal(indice(j).length, 4);
  // Moins de 24 bits : inutilisable pour retrouver les 256 autres.
  assert.ok(indice(j).length * 6 < 32);
});

test("l'expiration se calcule depuis une date fournie, jamais l'horloge", () => {
  // Une date de référence en paramètre : sans quoi le calcul serait intestable
  // et dépendrait du fuseau du serveur.
  const depuis = new Date("2026-03-01T10:00:00Z");
  assert.equal(expiration(30, depuis).toISOString().slice(0, 10), "2026-03-31");
  assert.equal(expiration(7, depuis).toISOString().slice(0, 10), "2026-03-08");
  // La date de départ n'est pas modifiée au passage.
  assert.equal(depuis.toISOString(), "2026-03-01T10:00:00.000Z");
});
