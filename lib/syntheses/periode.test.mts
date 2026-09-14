import assert from "node:assert/strict";
import test from "node:test";
import { periodeParDefaut } from "@/lib/syntheses/types";

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

test("la période proposée : six mois avant le jour du cabinet, sans déborder d'un mois", () => {
  assert.deepEqual(periodeParDefaut("2026-09-14"), { du: "2026-03-14", au: "2026-09-14" });
  /* `setMonth` rendait le 3 mars : six mois avant le 31 août ne tombent pas en mars. */
  assert.deepEqual(periodeParDefaut("2026-08-31"), { du: "2026-02-28", au: "2026-08-31" });
});

test("elle ne lit ni l'horloge ni le fuseau de la machine", () => {
  for (const tz of ["UTC", "Pacific/Kiritimati", "Etc/GMT+12"]) {
    assert.deepEqual(sousFuseau(tz, () => periodeParDefaut("2027-01-01")),
      { du: "2026-07-01", au: "2027-01-01" }, `sous ${tz}`);
  }
  // @ts-expect-error — le jour n'a plus de valeur par défaut : l'horloge ne se lit pas en douce
  assert.throws(() => periodeParDefaut(), RangeError);
});
