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

test("no crea faltas para guardias futuras y marca como falta real una guardia vencida sin checadas", () => {
  const records = [{ shiftDate: "2026-08-04", entryAt: "", exitAt: "", statusOverride: "vacaciones" }];
  const evaluations = L.scheduledEvaluations(records, "2026-08-04", "2026-08-08", settings, "2026-08-06T12:00:00");
  assert.equal(evaluations.find((item) => item.record.shiftDate === "2026-08-04").evaluation.status, "vacaciones");
  assert.equal(evaluations.find((item) => item.record.shiftDate === "2026-08-06").evaluation.status, "pendiente");
  assert.equal(evaluations.find((item) => item.record.shiftDate === "2026-08-08").evaluation.status, "pendiente");

  const old = L.scheduledEvaluations([], "2026-08-04", "2026-08-04", settings, "2026-08-06T12:00:00");
  assert.equal(old[0].evaluation.status, "falta");
});

test("el resumen cuenta las faltas reales y todas las justificaciones manuales", () => {
  const records = [
    { shiftDate: "2026-08-04", entryAt: "", exitAt: "", statusOverride: "incapacidad" },
    { shiftDate: "2026-08-06", entryAt: "", exitAt: "", statusOverride: "permiso" }
  ];
  const stats = L.calculateStats(records, "2026-08-04", "2026-08-08", settings, "2026-08-10T12:00:00");
  assert.equal(stats.justified, 2);
  assert.equal(stats.absences, 1);
});

test("lee las checadas nocturnas de un PDF de TuPerfilIMSS", () => {
  const pdfText = "BIOMÉTRICO REGISTRO DE EVENTOS\n11.52.14.103 20:57:33 04/08/2026 E\n11.52.14.105 08:27:17 05/08/2026 E\n11.52.14.103 21:05:11 06/08/2026 E\n11.52.14.103 08:49:39 07/08/2026 S";
  const records = L.parseTuPerfilImssText(pdfText, settings);
  assert.equal(records.length, 2);
  assert.deepEqual(records.find((record) => record.shiftDate === "2026-08-04").entryAt, "2026-08-04T20:57");
  assert.deepEqual(records.find((record) => record.shiftDate === "2026-08-04").exitAt, "2026-08-05T08:27");
});

test("convierte las guardias dentro de un periodo vacacional en vacaciones programadas", () => {
  const vacationSettings = L.normalizeSettings({
    ...settings,
    vacationPeriods: [{ id: "verano", start: "2026-08-04", end: "2026-08-08", notes: "Primer periodo" }]
  });
  const evaluations = L.scheduledEvaluations([], "2026-08-04", "2026-08-08", vacationSettings, "2026-08-10T12:00:00");
  assert.equal(evaluations.length, 3);
  assert.deepEqual(evaluations.map((item) => item.evaluation.status), ["vacaciones", "vacaciones", "vacaciones"]);
  assert.equal(evaluations[0].record.notes, "Primer periodo");
  assert.equal(L.vacationPeriodForDate("2026-08-05", vacationSettings).id, "verano");
});

test("mantiene como vacaciones una guardia futura ya programada", () => {
  const vacationSettings = L.normalizeSettings({
    guardDays: [2],
    vacationPeriods: [{ id: "futuras", start: "2026-08-18", end: "2026-08-18" }]
  });
  const evaluations = L.scheduledEvaluations([], "2026-08-18", "2026-08-18", vacationSettings, "2026-08-12T12:00:00");
  assert.equal(evaluations[0].evaluation.status, "vacaciones");
});

test("excluye justificaciones y pendientes de incidencias y asistencia real", () => {
  const metrics = L.summarizeReportEvaluations([
    { status: "efectiva" },
    { status: "vacaciones" },
    { status: "permiso" },
    { status: "incapacidad" },
    { status: "convenio" },
    { status: "festivo" },
    { status: "pendiente" }
  ]);
  assert.equal(metrics.incidentCount, 0);
  assert.equal(metrics.attendanceEligible, 1);
  assert.equal(metrics.attendanceRate, 100);
});
