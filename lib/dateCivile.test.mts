import assert from "node:assert/strict";
import test from "node:test";
import {
  ajouterJours,
  dateCivile,
  debutDuJour,
  fuseauUtilisable,
  FUSEAU_PAR_DEFAUT,
  heureDuCabinet,
  instantDuCabinet,
  lundiDe,
} from "@/lib/dateCivile";

/* Instants fictifs, choisis autour des bascules de jour. */

test("à 00 h 30 à Paris, c'est déjà le lendemain — l'hiver (UTC+1)", () => {
  /* LE DÉFAUT CORRIGÉ. `toISOString().slice(0, 10)` rendait « 2026-03-12 ». */
  const instant = new Date("2026-03-12T23:30:00Z");
  assert.equal(instant.toISOString().slice(0, 10), "2026-03-12", "la mesure du défaut a changé");
  assert.equal(dateCivile(instant, "Europe/Paris"), "2026-03-13");
});

test("à 00 h 30 à Paris, c'est déjà le lendemain — l'été (UTC+2)", () => {
  assert.equal(dateCivile(new Date("2026-07-12T22:30:00Z"), "Europe/Paris"), "2026-07-13");
});

test("à 23 h 59 à Paris, c'est encore le même jour", () => {
  assert.equal(dateCivile(new Date("2026-07-12T21:59:00Z"), "Europe/Paris"), "2026-07-12");
});

test("la nuit du passage à l'heure d'été ne fait ni sauter ni doubler un jour", () => {
  /* 29 mars 2026 : à Paris, 02:00 devient 03:00. */
  assert.equal(dateCivile(new Date("2026-03-28T23:30:00Z"), "Europe/Paris"), "2026-03-29");
  assert.equal(dateCivile(new Date("2026-03-29T01:30:00Z"), "Europe/Paris"), "2026-03-29");
});

test("le fuseau DU CABINET fait foi : le jour ne bascule pas à la même heure outre-mer", () => {
  const instant = new Date("2026-03-12T21:30:00Z");
  assert.equal(dateCivile(instant, "Europe/Paris"), "2026-03-12"); // 22 h 30
  assert.equal(dateCivile(instant, "Indian/Reunion"), "2026-03-13"); // 01 h 30
  assert.equal(dateCivile(new Date("2026-03-13T02:00:00Z"), "America/Cayenne"), "2026-03-12"); // 23 h 00
});

test("un fuseau vide ou illisible retombe sur le défaut de la base, sans faire échouer", () => {
  assert.equal(fuseauUtilisable(null), FUSEAU_PAR_DEFAUT);
  assert.equal(fuseauUtilisable("   "), FUSEAU_PAR_DEFAUT);
  assert.equal(fuseauUtilisable("Mars/Olympus"), FUSEAU_PAR_DEFAUT);
  assert.equal(fuseauUtilisable(" Indian/Reunion "), "Indian/Reunion");
  assert.equal(dateCivile(new Date("2026-03-12T23:30:00Z"), "Mars/Olympus"), "2026-03-13");
});

test("le format est toujours « AAAA-MM-JJ », zéros compris", () => {
  assert.equal(dateCivile(new Date("2026-01-05T10:00:00Z"), "Europe/Paris"), "2026-01-05");
});

/* ==========================================================================
 *  Jours civils et heures du cabinet — ce dont l'agenda dépend
 * ========================================================================== */

test("ajouter des jours ne traverse ni mois, ni année, ni changement d'heure de travers", () => {
  assert.equal(ajouterJours("2026-09-14", 1), "2026-09-15");
  assert.equal(ajouterJours("2026-09-14", -1), "2026-09-13");
  assert.equal(ajouterJours("2026-12-31", 1), "2027-01-01");
  assert.equal(ajouterJours("2028-02-28", 1), "2028-02-29");
  assert.equal(ajouterJours("2026-03-28", 1), "2026-03-29"); // veille du passage à l'heure d'été
  assert.equal(ajouterJours("2026-03-29", 1), "2026-03-30");
  assert.equal(ajouterJours("2026-09-14", 7), "2026-09-21");
});

test("le lundi d'une semaine", () => {
  assert.equal(lundiDe("2026-09-14"), "2026-09-14"); // un lundi
  assert.equal(lundiDe("2026-09-20"), "2026-09-14"); // le dimanche qui suit
  assert.equal(lundiDe("2026-09-16"), "2026-09-14");
  assert.equal(lundiDe("2027-01-01"), "2026-12-28"); // une semaine à cheval sur deux années
});

test("« 14 h 30 au cabinet » est le même instant, quel que soit le fuseau du serveur", () => {
  /* LE DÉFAUT DE L'AGENDA. `new Date("2026-09-15T14:30:00")` était lu dans le
   * fuseau du processus : 14 h 30 à Paris sur un poste réglé sur Paris, 16 h 30
   * à Paris sous un serveur UTC. */
  for (const tz of ["UTC", "Europe/Paris", "America/Los_Angeles"]) {
    const t = sousFuseauProcessus(tz, () => instantDuCabinet("2026-09-15", "14:30", "Europe/Paris"));
    assert.equal(t.toISOString(), "2026-09-15T12:30:00.000Z", `été, processus ${tz}`);
  }
  assert.equal(instantDuCabinet("2026-01-15", "14:30", "Europe/Paris").toISOString(), "2026-01-15T13:30:00.000Z");
  assert.equal(instantDuCabinet("2026-09-15", "14:30", "Indian/Reunion").toISOString(), "2026-09-15T10:30:00.000Z");
});

test("les nuits de changement d'heure : une heure absente avance, une heure doublée prend la seconde", () => {
  // 29 mars 2026 à Paris : 02:00 devient 03:00 ; 2 h 30 n'existe pas.
  const absente = instantDuCabinet("2026-03-29", "02:30", "Europe/Paris");
  assert.equal(absente.toISOString(), "2026-03-29T01:30:00.000Z");
  assert.equal(heureDuCabinet(absente, "Europe/Paris"), "03:30");
  // 25 octobre 2026 à Paris : 03:00 redevient 02:00 ; 2 h 30 existe deux fois.
  const doublee = instantDuCabinet("2026-10-25", "02:30", "Europe/Paris");
  assert.equal(doublee.toISOString(), "2026-10-25T01:30:00.000Z");
  assert.equal(heureDuCabinet(doublee, "Europe/Paris"), "02:30");
});

test("minuit au cabinet ouvre le jour, et un rendez-vous à 00 h 30 tombe du bon côté", () => {
  const debut = debutDuJour("2026-09-14", "Europe/Paris");
  const fin = debutDuJour(ajouterJours("2026-09-14", 1), "Europe/Paris");
  assert.equal(debut.toISOString(), "2026-09-13T22:00:00.000Z");
  const minuitEtDemi = instantDuCabinet("2026-09-14", "00:30", "Europe/Paris");
  const veilleAuSoir = instantDuCabinet("2026-09-13", "23:30", "Europe/Paris");
  assert.ok(minuitEtDemi >= debut && minuitEtDemi < fin, "00 h 30 le 14 appartient au 14");
  assert.ok(!(veilleAuSoir >= debut && veilleAuSoir < fin), "23 h 30 le 13 n'appartient pas au 14");
  assert.equal(dateCivile(minuitEtDemi, "Europe/Paris"), "2026-09-14");
});

test("aller-retour : l'heure et le jour saisis se relisent à l'identique", () => {
  for (const [jour, heure] of [["2026-09-14", "08:15"], ["2026-01-02", "17:45"], ["2026-12-31", "23:59"]]) {
    const t = instantDuCabinet(jour, heure, "Europe/Paris");
    assert.equal(dateCivile(t, "Europe/Paris"), jour);
    assert.equal(heureDuCabinet(t, "Europe/Paris"), heure);
  }
});

test("une saisie illisible est refusée, pas devinée", () => {
  assert.throws(() => ajouterJours("14/09/2026", 1), RangeError);
  assert.throws(() => instantDuCabinet("2026-09-14", "14h30", "Europe/Paris"), RangeError);
});

/** Exécute `f` sous un fuseau de processus donné, puis le restaure. */
function sousFuseauProcessus<T>(tz: string, f: () => T): T {
  const avant = process.env.TZ;
  process.env.TZ = tz;
  try {
    return f();
  } finally {
    if (avant === undefined) delete process.env.TZ;
    else process.env.TZ = avant;
  }
}
