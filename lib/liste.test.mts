import { test } from "node:test";
import assert from "node:assert/strict";
import { liste } from "@/lib/liste";

test("un tableau passe tel quel", () => {
  const t = [1, 2, 3];
  assert.deepEqual(liste<number>(t), t);
  assert.deepEqual(liste([]), []);
});

test("ce qui n'est pas un tableau devient un tableau vide", () => {
  // Les formes qu'un jsonb peut réellement prendre à la place d'un tableau.
  for (const v of [null, undefined, {}, { type: "rpps" }, "rpps", 12, true]) {
    assert.deepEqual(liste(v), [], String(v));
  }
});

test("le résultat est toujours parcourable", () => {
  // C'est tout l'objet : le rendu enchaîne .filter et .map sans se demander
  // ce que la base a rendu.
  assert.doesNotThrow(() => liste<{ v: number }>({ pas: "un tableau" }).map((x) => x.v));
});
