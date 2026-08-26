const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../logic.js");

const settings = L.normalizeSettings({
  startTime: "20:30",
  entryTolerance: "21:00",
  exitTime: "08:10",
  exitTolerance: "10:10",
  guardDays: [2, 4, 6]
});

test("clasifica las guardias importadas según los límites configurados", () => {
  const effective = L.evaluateRecord({
    shiftDate: "2026-08-04",
    entryAt: "2026-08-04T20:57:33",
    exitAt: "2026-08-05T08:27:17",
    statusOverride: "auto"
  }, settings, "2026-08-06T12:00:00");
  const late = L.evaluateRecord({
    shiftDate: "2026-08-06",
    entryAt: "2026-08-06T21:05:11",
    exitAt: "2026-08-07T08:49:39",
    statusOverride: "auto"
  }, settings, "2026-08-08T12:00:00");
  const missingEntry = L.evaluateRecord({
    shiftDate: "2026-08-22",
    entryAt: "",
    exitAt: "2026-08-23T08:20:09",
    statusOverride: "auto"
  }, settings, "2026-08-24T12:00:00");

  assert.equal(effective.status, "efectiva");
  assert.equal(late.status, "retardo");
  assert.equal(missingEntry.status, "omision-entrada");
});

test("integra registros sin duplicar ni borrar datos existentes", () => {
  const current = [{
    id: "actual",
    shiftDate: "2026-08-04",
    entryAt: "2026-08-04T20:57",
    exitAt: "",
    statusOverride: "auto",
    notes: "Nota personal"
  }];
  const incoming = [
    {
      id: "importado-1",
      shiftDate: "2026-08-04",
      entryAt: "2026-08-04T20:58",
      exitAt: "2026-08-05T08:27",
      statusOverride: "auto",
      notes: "Reporte"
    },
    {
      id: "importado-2",
      shiftDate: "2026-08-06",
      entryAt: "2026-08-06T21:05",
      exitAt: "2026-08-07T08:49",
      statusOverride: "auto",
      notes: "Reporte"
    }
  ];

  const result = L.mergeRecordsByShiftDate(current, incoming);
  assert.equal(result.records.length, 2);
  assert.equal(result.added, 1);
  assert.equal(result.updated, 1);
  assert.equal(result.records.find((record) => record.shiftDate === "2026-08-04").entryAt, "2026-08-04T20:57");
  assert.equal(result.records.find((record) => record.shiftDate === "2026-08-04").exitAt, "2026-08-05T08:27");
  assert.equal(result.records.find((record) => record.shiftDate === "2026-08-04").notes, "Nota personal");
});

test("distingue pase de entrada y pase de salida por sus límites", () => {
  const entryPass = L.evaluateRecord({
    shiftDate: "2026-08-04",
    entryAt: "2026-08-04T21:01:00",
    exitAt: "2026-08-05T08:20:00",
    statusOverride: "auto"
  }, settings, "2026-08-06T12:00:00");
  const exitPass = L.evaluateRecord({
    shiftDate: "2026-08-04",
    entryAt: "2026-08-04T20:45:00",
    exitAt: "2026-08-05T10:11:00",
    statusOverride: "auto"
  }, settings, "2026-08-06T12:00:00");

  assert.equal(entryPass.status, "retardo");
  assert.equal(entryPass.label, "Pase de entrada");
  assert.equal(exitPass.status, "pase-salida");
  assert.equal(exitPass.label, "Pase de salida");
});

test("acepta pase oficial y vacaciones como clasificación manual", () => {
  const officialPass = L.evaluateRecord({ shiftDate: "2026-08-04", statusOverride: "pase-salida" }, settings);
  const vacation = L.evaluateRecord({ shiftDate: "2026-08-04", statusOverride: "vacaciones" }, settings);
  assert.equal(officialPass.status, "pase-salida");
  assert.equal(vacation.status, "vacaciones");
});
