import assert from "node:assert/strict";
import test from "node:test";
import { mentionEtatAttestation, mentionEtatPiece } from "@/lib/impression/mentions";

/* Numéros et dates fictifs. */

test("un devis refusé ou expiré dit qu'il ne vaut plus — la page publique l'ignorait", () => {
  /* LE DÉFAUT CORRIGÉ. La page ouverte par un tiers depuis un lien ne
   * connaissait que l'annulation par avoir et le remplacement : un devis
   * refusé ou expiré s'y lisait comme valide. */
  assert.equal(mentionEtatPiece({ kind: "devis", status: "refuse" })?.titre, "DEVIS REFUSÉ");
  const expire = mentionEtatPiece({ kind: "devis", status: "expire", validUntil: "2026-03-12" });
  assert.equal(expire?.titre, "DEVIS EXPIRÉ");
  assert.match(expire!.texte, /valable jusqu'au 12\/03\/2026/);
});

test("« Cet avoir », jamais « Ce avoir » : l'élision ne se déduit pas du genre", () => {
  assert.match(mentionEtatPiece({ kind: "avoir", status: "refuse" })!.texte, /^Cet avoir /);
  assert.match(mentionEtatPiece({ kind: "devis", status: "refuse" })!.texte, /^Ce devis /);
  assert.match(mentionEtatPiece({ kind: "facture", status: "refuse" })!.texte, /^Cette facture .* acceptée\./);
});

test("le titre s'accorde avec la nature", () => {
  assert.equal(mentionEtatPiece({ kind: "facture", status: "annule_par_avoir" })?.titre, "FACTURE ANNULÉE PAR AVOIR");
  assert.equal(mentionEtatPiece({ kind: "facture_de_remplacement", status: "remplace" })?.titre, "FACTURE DE REMPLACEMENT REMPLACÉE");
  assert.equal(mentionEtatPiece({ kind: "avoir", status: "remplace" })?.titre, "AVOIR REMPLACÉ");
});

test("la pièce rectificative est nommée quand on la connaît, et pas inventée sinon", () => {
  const avecRef = mentionEtatPiece({
    kind: "facture",
    status: "annule_par_avoir",
    rectifiant: { numero: "AV-2026-004", emiseLe: "2026-03-12" },
  });
  assert.match(avecRef!.texte, /l'avoir n° AV-2026-004 du 12\/03\/2026/);
  const sansRef = mentionEtatPiece({ kind: "facture", status: "annule_par_avoir", rectifiant: null });
  assert.ok(!sansRef!.texte.includes("n°"), "un numéro absent ne doit pas être remplacé par un blanc");
});

test("une pièce qui vaut n'a AUCUNE mention", () => {
  for (const status of ["emis", "accepte", "brouillon"]) {
    assert.equal(mentionEtatPiece({ kind: "facture", status }), null, status);
  }
});

test("une nature inconnue du contrat public se dit « pièce », sans planter", () => {
  assert.equal(mentionEtatPiece({ kind: "note_de_frais", status: "refuse" })?.titre, "PIÈCE REFUSÉE");
});

test("l'attestation annulée dit son motif, sans ponctuation doublée", () => {
  const m = mentionEtatAttestation({ status: "annule", motif: "Erreur sur la période.  " });
  assert.equal(m?.titre, "ATTESTATION ANNULÉE");
  assert.ok(m!.texte.startsWith("Cette attestation a été annulée : Erreur sur la période. Elle"));
  assert.ok(!m!.texte.includes(".."));
  assert.equal(mentionEtatAttestation({ status: "annule", motif: "  " })!.texte.startsWith("Cette attestation a été annulée. Elle"), true);
  assert.equal(mentionEtatAttestation({ status: "emis" }), null);
});
