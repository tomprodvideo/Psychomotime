import assert from "node:assert/strict";
import test from "node:test";
import { frDate, frJourDe } from "@/lib/format";

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

test("un jour civil s'écrit tel quel, quel que soit le fuseau du processus", () => {
  for (const tz of ["UTC", "Europe/Paris", "Pacific/Kiritimati", "Etc/GMT+12"]) {
    assert.equal(sousFuseau(tz, () => frDate("2026-06-12")), "12/06/2026", `sous ${tz}`);
  }
  assert.equal(frDate(null), "");
  assert.equal(frDate(""), "");
});

test("un horodatage n'est pas un jour : frDate ne rend rien", () => {
  /* Il le formatait dans le fuseau du processus. Une date absente se voit ;
   * une date fausse passe inaperçue. */
  assert.equal(frDate("2026-06-12T23:30:00Z"), "");
  assert.equal(frDate("12/06/2026"), "");
});

test("le jour d'un instant se lit dans le fuseau du cabinet", () => {
  /* LE DÉFAUT CORRIGÉ. `frDate(x_at.slice(0, 10))` rendait « 12/03/2026 » :
   * le jour UTC, alors qu'il est 0 h 30 le 13 à Paris. */
  const instant = "2026-03-12T23:30:00Z";
  for (const tz of ["UTC", "Europe/Paris", "Etc/GMT+12"]) {
    assert.equal(sousFuseau(tz, () => frJourDe(instant, "Europe/Paris")), "13/03/2026", `sous ${tz}`);
  }
  assert.equal(frJourDe(instant, "America/Guadeloupe"), "12/03/2026", "19 h 30 le 12 aux Antilles");
  assert.equal(frJourDe(new Date(instant), "Europe/Paris"), "13/03/2026");
  assert.equal(frJourDe("pas une date", "Europe/Paris"), "");
  assert.equal(frJourDe(null, "Europe/Paris"), "");
});
