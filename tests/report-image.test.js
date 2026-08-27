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
  assert.equal(model.rows.length, 2);
  assert.match(model.rows[0].date, /^04[- ]ago/);
  assert.equal(model.summary.efectiva, 1);
  assert.equal(model.summary.retardo, 1);
  assert.equal(model.profile.unit, "HGZ 42");
});
