import { test } from "node:test";
import assert from "node:assert/strict";
import { origineAutorisee } from "@/lib/origine";

/* L'apex répond 308 vers `www` : c'est donc `www` qui est canonique, et un
 * contrôle le fige — inverser la liste ferait échouer ce fichier. */
const CANONIQUE = "https://www.psychomotime.com";
const PROD = { VERCEL_PROJECT_PRODUCTION_URL: "psychomotime.vercel.app" };

test("un hôte proposé par la requête ne suffit pas", () => {
  /* LE DÉFAUT D'ORIGINE. `x-forwarded-host` est proposé par l'appelant, et le
   * lien construit ici porte le jeton de consultation en clair. */
  assert.equal(origineAutorisee("cabinet-de-lattaquant.example", "https", PROD), CANONIQUE);
  assert.equal(origineAutorisee("", null, PROD), CANONIQUE);
  assert.equal(origineAutorisee(null, null, PROD), CANONIQUE);
});

test("un domaine qui ressemble n'est pas le domaine", () => {
  // Les quatre formes classiques : le suffixe, le sous-domaine, le tiret, et
  // l'homographe. Aucune n'est une égalité.
  for (const hote of [
    "psychomotime.com.example.net",
    "evil.psychomotime.com",
    "psychomotime-com.example",
    "xn--psychomtime-p1a.com",
    "psychomotime.vercel.app.example.com",
  ]) {
    assert.equal(origineAutorisee(hote, "https", PROD), CANONIQUE, hote);
  }
});

test("un lien repart sur le domaine que la personne utilise", () => {
  // Le produit répond sur plusieurs domaines. Recevoir un lien vers un autre
  // que celui qu'on utilise ressemble à un courriel de contrefaçon.
  for (const hote of ["psychomotime.com", "www.psychomotime.com", "psychomotime.vercel.app"]) {
    assert.equal(origineAutorisee(hote, "https", PROD), `https://${hote}`);
    assert.equal(origineAutorisee(hote, "https", {}), `https://${hote}`);
  }
});

test("une prévisualisation est reconnue par la plateforme, pas par la requête", () => {
  const apercu = "psychomotime-abc123-tom-prod.vercel.app";
  assert.equal(
    origineAutorisee(apercu, "https", { ...PROD, VERCEL_URL: apercu }),
    `https://${apercu}`,
  );
  // Le même hôte, sans que la plateforme le déclare : refusé.
  assert.equal(origineAutorisee(apercu, "https", PROD), CANONIQUE);
});

test("SITE_ORIGIN l'emporte sur tout ce que propose la requête", () => {
  assert.equal(
    origineAutorisee("cabinet-de-lattaquant.example", "https", {
      ...PROD,
      SITE_ORIGIN: "https://cabinet-des-trois-ballons.fr",
    }),
    "https://cabinet-des-trois-ballons.fr",
  );
  // Avec ou sans protocole.
  assert.equal(
    origineAutorisee(null, null, { SITE_ORIGIN: "cabinet-des-trois-ballons.fr" }),
    "https://cabinet-des-trois-ballons.fr",
  );
  // Une valeur illisible est ignorée plutôt que de produire un lien cassé.
  assert.equal(origineAutorisee(null, null, { SITE_ORIGIN: "  " }), CANONIQUE);
});

test("une SITE_ORIGIN mal formée est ignorée plutôt que suivie", () => {
  /* C'est l'entrée de plus haut privilège du module, et `new URL()` accepte
   * n'importe quel schéma : sans contrôle, `javascript://…` désignait un hôte
   * tiers, qui serait parti dans un lien portant un jeton. */
  for (const mauvaise of [
    "javascript://cabinet-de-lattaquant.test",
    "data://cabinet-de-lattaquant.test",
    "file://cabinet-de-lattaquant.test",
    "https://compte:motdepasse@cabinet-de-lattaquant.test",
    "pas une url du tout",
    "   ",
  ]) {
    assert.equal(
      origineAutorisee(null, null, { ...PROD, SITE_ORIGIN: mauvaise }),
      CANONIQUE,
      mauvaise,
    );
  }
});

test("le poste de développement reste utilisable", () => {
  assert.equal(origineAutorisee("localhost:3000", "http", {}), "http://localhost:3000");
  assert.equal(origineAutorisee("127.0.0.1:3000", "http", {}), "http://127.0.0.1:3000");
  assert.equal(origineAutorisee("[::1]:3000", "http", {}), "http://[::1]:3000");
});

test("le protocole proposé n'est pas recopié tel quel", () => {
  /* Sur le poste local, le protocole suit l'en-tête — mais il est RAMENÉ à
   * `http` ou `https`. Recopier la valeur proposée fabriquerait l'adresse
   * qu'elle dit, quelle qu'elle soit, dans un lien qu'on envoie ensuite. */
  for (const propose of ["javascript", "data", "file", "HTTPS", "", "http:"]) {
    const url = origineAutorisee("localhost:3000", propose, {});
    assert.equal(url, "http://localhost:3000", propose);
  }
  assert.equal(origineAutorisee("localhost:3000", "https", {}), "https://localhost:3000");
});

test("un protocole en clair ne dégrade pas un lien vers la production", () => {
  // Un `x-forwarded-proto: http` proposé par la requête ne doit pas faire
  // partir en clair un lien qui porte un jeton.
  assert.equal(origineAutorisee("psychomotime.com", "http", PROD), "https://psychomotime.com");
  assert.equal(
    origineAutorisee(null, "http", { SITE_ORIGIN: "psychomotime.com" }),
    "https://psychomotime.com",
  );
});
