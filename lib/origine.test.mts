import { test } from "node:test";
import assert from "node:assert/strict";
import { origineAutorisee } from "@/lib/origine";

const PROD = { VERCEL_PROJECT_PRODUCTION_URL: "psychomotime.vercel.app" };

test("un hôte proposé par la requête ne suffit pas", () => {
  /* LE DÉFAUT D'ORIGINE. `x-forwarded-host` est proposé par l'appelant, et le
   * lien construit ici porte le jeton de consultation en clair. */
  assert.equal(
    origineAutorisee("cabinet-de-lattaquant.example", null, PROD),
    "https://psychomotime.vercel.app",
  );
  assert.equal(
    origineAutorisee("psychomotime.vercel.app.example.com", null, PROD),
    "https://psychomotime.vercel.app",
  );
  // Un sous-domaine de l'hôte attendu n'est pas l'hôte attendu.
  assert.equal(
    origineAutorisee("evil.psychomotime.vercel.app", null, PROD),
    "https://psychomotime.vercel.app",
  );
});

test("l'hôte que la plateforme déclare est accepté", () => {
  assert.equal(
    origineAutorisee("psychomotime.vercel.app", "https", PROD),
    "https://psychomotime.vercel.app",
  );
  // Une prévisualisation : l'hôte vient de la plateforme, pas de la requête.
  assert.equal(
    origineAutorisee("psychomotime-abc123.vercel.app", "https", {
      ...PROD,
      VERCEL_URL: "psychomotime-abc123.vercel.app",
    }),
    "https://psychomotime-abc123.vercel.app",
  );
});

test("SITE_ORIGIN l'emporte sur tout ce que propose la requête", () => {
  assert.equal(
    origineAutorisee("cabinet-de-lattaquant.example", "https", {
      ...PROD,
      SITE_ORIGIN: "https://psychomotime.fr",
    }),
    "https://psychomotime.fr",
  );
  // Avec ou sans protocole, avec ou sans chemin résiduel.
  assert.equal(
    origineAutorisee(null, null, { SITE_ORIGIN: "psychomotime.fr" }),
    "https://psychomotime.fr",
  );
});

test("le poste de développement reste utilisable", () => {
  assert.equal(origineAutorisee("localhost:3000", "http", {}), "http://localhost:3000");
  assert.equal(origineAutorisee("127.0.0.1:3000", "http", {}), "http://127.0.0.1:3000");
});

test("un protocole en clair ne dégrade pas un lien vers la production", () => {
  // Un `x-forwarded-proto: http` proposé par la requête ne doit pas faire
  // partir en clair un lien qui porte un jeton.
  assert.equal(
    origineAutorisee("psychomotime.vercel.app", "http", PROD),
    "https://psychomotime.vercel.app",
  );
});

test("sans rien pour établir l'adresse, on refuse plutôt que de deviner", () => {
  assert.throws(
    () => origineAutorisee("cabinet-de-lattaquant.example", "https", {}),
    /SITE_ORIGIN/,
  );
});
