import assert from "node:assert/strict";
import test from "node:test";
import { checkPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

/* Aucun mot de passe de ce fichier n'est ni n'a été employé nulle part. */

test("un mot de passe trop court est refusé, avec le nombre attendu", () => {
  const r = checkPassword("Court1!");
  assert.equal(r.ok, false);
  assert.match(r.error!, new RegExp(String(MIN_PASSWORD_LENGTH)));
});

test("l'ancien minimum de six caractères ne passe plus", () => {
  // Le produit acceptait « abcdef ». C'est le défaut que cette politique ferme.
  assert.equal(checkPassword("abcdef").ok, false);
});

test("une phrase de passe ordinaire est acceptée", () => {
  // Longue, mémorisable, sans exigence de symbole exotique : c'est le bon
  // conseil, et la politique doit le rendre possible.
  assert.equal(checkPassword("le tapis bleu du mardi matin").ok, true);
  assert.equal(checkPassword("Cerceaux&Ballons2031").ok, true);
});

test("un mot de passe bâti sur l'adresse e-mail est refusé", () => {
  // C'est la variante faible la plus courante, et elle est devinable par
  // quiconque a vu une facture.
  const r = checkPassword("bouclette-bouclette-2031", "bouclette@exemple-fictif.test");
  assert.equal(r.ok, false);
  assert.match(r.error!, /adresse e-mail/);
});

test("l'adresse n'est prise en compte que si sa partie locale est significative", () => {
  // Une partie locale de trois lettres apparaîtrait dans trop de mots
  // légitimes : la refuser gênerait sans protéger.
  assert.equal(checkPassword("abcorbeille du jardin", "abc@exemple-fictif.test").ok, true);
});

test("les racines les plus essayées sont refusées, accents et casse compris", () => {
  for (const mot of [
    "MotDePasse2031!!",
    "monPASSWORDsecret",
    "azertyuiop12345",
    "PsychomotimeCabinet",
  ]) {
    assert.equal(checkPassword(mot).ok, false, `« ${mot} » devrait être refusé`);
  }
});

test("un mot de passe entièrement fait d'une suite est refusé", () => {
  assert.equal(checkPassword("abcdefghijklm").ok, false); // croissante
  assert.equal(checkPassword("zyxwvutsrqponml").ok, false); // décroissante
});

test("une suite CONTENUE dans un mot de passe ne le disqualifie pas", () => {
  // La règle vise le mot de passe entier, pas un fragment : refuser tout mot
  // contenant « abcd » écarterait des phrases légitimes sans rien protéger.
  assert.equal(checkPassword("le tapis abcd du mardi").ok, true);
});

test("un mot de passe trop répétitif est refusé", () => {
  const r = checkPassword("aaaabbbbaaaa");
  assert.equal(r.ok, false);
  assert.match(r.error!, /caractères différents/);
});

test("les espaces de bord sont refusées, car elles se perdent au copier-coller", () => {
  const r = checkPassword(" le tapis bleu du mardi ");
  assert.equal(r.ok, false);
  assert.match(r.error!, /espace/);
});

test("le refus dit toujours ce qui ne va pas", () => {
  // Un message générique pousse à essayer des variantes de la même idée faible.
  for (const mauvais of ["court", "abcdefghijklm", "MotDePasseLong", "aaaabbbbaaaa"]) {
    const r = checkPassword(mauvais);
    assert.equal(r.ok, false);
    assert.ok(r.error && r.error.length > 20, `motif attendu pour « ${mauvais} »`);
  }
});

test("un mot de passe très long est refusé plutôt que tronqué", () => {
  assert.equal(checkPassword("z".repeat(300)).ok, false);
});
