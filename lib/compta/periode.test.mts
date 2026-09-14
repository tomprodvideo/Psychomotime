import assert from "node:assert/strict";
import test from "node:test";
import { anneeEtMois, dernierJour, resoudrePeriode, versParams } from "@/lib/compta/periode";
import { dateCivile } from "@/lib/dateCivile";

/** Rejoue `f` sous un autre fuseau de PROCESSUS — celui d'un serveur, par exemple. */
function sousFuseau<T>(tz: string, f: () => T): T {
  const avant = process.env.TZ;
  process.env.TZ = tz;
  try {
    return f();
  } finally {
    if (avant === undefined) delete process.env.TZ;
    else process.env.TZ = avant;
  }
}

test("la nuit du 1er janvier, l'année en cours est celle du cabinet, pas celle du processus", () => {
  /* LE DÉFAUT CORRIGÉ. Le 31 décembre 2026 à 23 h 30 UTC, il est 0 h 30 le
   * 1er janvier 2027 à Paris. Lue par `getFullYear` sous un processus UTC,
   * l'année en cours était 2026 : l'écran s'ouvrait sur l'exercice clos. */
  const instant = new Date("2026-12-31T23:30:00Z");
  for (const tz of ["UTC", "Europe/Paris", "Pacific/Kiritimati", "Etc/GMT+12"]) {
    const p = sousFuseau(tz, () => resoudrePeriode({}, dateCivile(instant, "Europe/Paris")));
    assert.equal(p.libelle, "Année 2027", `sous ${tz}`);
    assert.deepEqual([p.du, p.au], ["2027-01-01", "2027-12-31"], `sous ${tz}`);
  }
  assert.equal(resoudrePeriode({ mode: "mois" }, "2027-01-01").libelle, "janvier 2027",
    "le mois proposé suit le même jour");
});

test("un instant n'est pas un jour : il ne compile pas, et un jour illisible est refusé", () => {
  /* À LA COMPILATION : si la signature réadmettait un `Date`, cette directive
   * deviendrait inutile et `tsc` échouerait. */
  // @ts-expect-error — un instant n'est pas une date civile
  assert.throws(() => resoudrePeriode({}, new Date("2027-01-01T00:30:00Z")), RangeError);
  assert.throws(() => resoudrePeriode({}, "2027-01-01T00:30:00Z"), RangeError);
  assert.throws(() => anneeEtMois("1er janvier"), RangeError);
});

test("les comportements existants sont conservés", () => {
  const jour = "2026-09-14";
  assert.deepEqual(resoudrePeriode({ mode: "mois", mois: "2", annee: "2024" }, jour), {
    mode: "mois", du: "2024-02-01", au: "2024-02-29", libelle: "février 2024",
  });
  const inversee = resoudrePeriode({ mode: "intervalle", du: "2026-05-10", au: "2026-01-02" }, jour);
  assert.deepEqual([inversee.du, inversee.au], ["2026-01-02", "2026-05-10"], "des bornes inversées sont remises dans l'ordre");
  assert.equal(resoudrePeriode({ annee: "1850" }, jour).libelle, "Année 2026", "une année hors bornes retombe sur l'année en cours");
  assert.equal(resoudrePeriode({ mode: "tout" }, jour).libelle, "Depuis le début");
  assert.equal(dernierJour(2026, 2), 28);
  assert.equal(versParams(resoudrePeriode({}, "2027-01-01"), "2027-01-01").get("annee"), "2027");
});
