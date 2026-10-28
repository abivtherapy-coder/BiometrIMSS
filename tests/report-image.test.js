const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../logic.js");
const R = require("../report-image.js");

test("prepara un informe de imagen ordenado y con resumen", () => {
  assert.deepEqual(R.REPORT_SIZE, { width: 1080, height: 1920, aspectRatio: "9:16" });
  assert.equal(R.REPORT_SIZE.width / R.REPORT_SIZE.height, 9 / 16);
  const settings = L.normalizeSettings({ name: "Usuario", employeeId: "123", unit: "HGZ 42" });
  const records = [
    { shiftDate: "2026-08-06", entryAt: "2026-08-06T21:05", exitAt: "2026-08-07T08:49", statusOverride: "auto" },
    { shiftDate: "2026-08-04", entryAt: "2026-08-04T20:57", exitAt: "2026-08-05T08:27", statusOverride: "auto" }
  ];
  const model = R.buildReportModel(records, settings, "2026-08-01", "2026-08-31", L, "2026-09-01T12:00:00");
  assert.equal(model.rows.length, 13);
  assert.match(model.rows[0].date, /^01[- ]ago/);
  assert.equal(model.summary.efectiva, 1);
  assert.equal(model.summary.retardo, 1);
  assert.equal(model.summary.falta, 11);
  assert.equal(model.profile.unit, "HGZ 42");
});

test("recorta los avatares sin deformarlos al colocarlos en cajas verticales o cuadradas", () => {
  const source = [15, 493, 263, 210];
  const square = R.coverCropRect(source, 30, 30);
  const portrait = R.coverCropRect(source, 118, 135);

  assert.equal(square[2] / square[3], 1);
  assert.ok(Math.abs((portrait[2] / portrait[3]) - (118 / 135)) < 1e-12);
  assert.ok(square[0] >= source[0] && square[0] + square[2] <= source[0] + source[2]);
  assert.ok(portrait[1] >= source[1] && portrait[1] + portrait[3] <= source[1] + source[3]);
});

test("permite forzar noviembre en el informe animado", () => {
  const theme = R.monthTheme("2026-03-01", "noviembre");
  assert.equal(theme.id, "noviembre");
  assert.equal(theme.label, "NOVIEMBRE · CATRÍN Y ABI ZAPATA");
  assert.equal(theme.primary, "#7a2a78");
});

test("usa las mismas reglas para incidencias y asistencia en todos los informes", () => {
  const settings = L.normalizeSettings({
    guardDays: [2],
    vacationPeriods: [{ id: "vacaciones", start: "2026-08-11", end: "2026-08-11" }]
  });
  const records = [{
    shiftDate: "2026-08-04",
    entryAt: "2026-08-04T20:30",
    exitAt: "2026-08-05T08:10",
    statusOverride: "auto"
  }];
  const model = R.buildReportModel(records, settings, "2026-08-04", "2026-08-18", L, "2026-08-12T12:00:00");
  assert.equal(model.rows.length, 3);
  assert.equal(model.summary.efectiva, 1);
  assert.equal(model.summary.vacaciones, 1);
  assert.equal(model.summary.pendiente, 1);
  assert.equal(model.incidentCount, 0);
  assert.equal(model.attendanceEligible, 1);
  assert.equal(model.attendanceRate, 100);
});
