const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
const september = fs.readFileSync(path.join(root, "themes/september-viva.css"), "utf8");

test("el informe muestra únicamente las dos descargas aprobadas", () => {
  assert.match(html, /id="downloadDigitalPdf"[^>]*>Descargar formato PDF</);
  assert.match(html, /id="downloadAnimatedPdf"[^>]*>Descargar formato animado PDF</);
  assert.doesNotMatch(html, /Imprimir y guardar/);
  assert.doesNotMatch(app, /printDigitalReport/);
});

test("la versión visible y la caché cargan los scripts corregidos", () => {
  for (const file of ["app.js", "animated-report.js", "logic.js", "report-image.js"]) {
    assert.ok(html.includes(file + "?v=7.2.0"), file);
  }
  assert.ok(html.includes("themes/monthly-theme.js?v=7.5.1-navidad"));
  assert.ok(html.includes("style.css?v=7.3.0"));
  assert.ok(worker.includes("biometrimss-v7.5.2-navidad"));
  assert.ok(worker.includes("./app.js?v=7.2.0"));
  assert.ok(worker.includes("./animated-report.js?v=7.2.0"));
});

test("la portada abre directamente y carga la capa navideña sin intro bloqueante", () => {
  assert.doesNotMatch(html, /brandIntro|biometrimss-intro-circle-v1/);
  assert.ok(html.includes("themes/christmas-reference.css?v=1.0.0"));
  assert.doesNotMatch(worker, /biometrimss-intro-circle-v1/);
  assert.ok(worker.includes("christmas-reference.css?v=1.0.0"));
});

test("octubre usa el avatar zombi oficial y catorce fantasmas", () => {
  const theme = fs.readFileSync(path.join(root, "themes/monthly-theme.js"), "utf8");
  const q4 = fs.readFileSync(path.join(root, "themes/q4-seasonal.css"), "utf8");
  assert.match(theme, /i < 14/);
  assert.match(theme, /q4-ghost/);
  assert.match(q4, /biometrimss-zombie-octubre-v2\.png/);
  assert.match(worker, /biometrimss-zombie-octubre-v2\.png\?v=7\.2\.0/);
});

test("el acceso, la vista y los PDF cambian con octubre, noviembre y diciembre", () => {
  const theme = fs.readFileSync(path.join(root, "themes/monthly-theme.js"), "utf8");
  const q4 = fs.readFileSync(path.join(root, "themes/q4-seasonal.css"), "utf8");
  const reportImage = fs.readFileSync(path.join(root, "report-image.js"), "utf8");
  assert.match(html, /id="openDigitalReportLabel">Ver informe</);
  assert.match(theme, /Ver informe · \$\{copy\.header\}/);
  assert.match(q4, /Tema mensual también en Historial, Ver informe e informe digital/);
  assert.match(q4, /#view-report #downloadAnimatedPdf/);
  assert.match(reportImage, /OCTUBRE · HALLOWEEN BIOMETRIMSS/);
  assert.match(reportImage, /NOVIEMBRE · DÍA DE MUERTOS/);
  assert.match(reportImage, /DICIEMBRE · FELIZ NAVIDAD/);
  assert.match(app, /NOVIEMBRE - DIA DE MUERTOS/);
  assert.match(app, /DICIEMBRE - FELIZ NAVIDAD/);
});

test("la portada móvil conserva los cuatro indicadores en una fila", () => {
  assert.match(september, /Regla final: cuatro indicadores/);
  assert.match(september, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
});
