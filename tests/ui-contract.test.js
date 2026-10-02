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
  for (const file of ["app.js", "animated-report.js", "logic.js", "report-image.js", "themes/monthly-theme.js"]) {
    assert.match(html, new RegExp(file.replace(".", "\\.") + "\\?v=7\\.2\\.0"));
  }
  assert.match(html, /style\.css\?v=7\.2\.0/);
  assert.match(worker, /biometrimss-v7\.2\.0/);
  assert.match(worker, /.\/app\.js\?v=7\.2\.0/);
  assert.match(worker, /.\/animated-report\.js\?v=7\.2\.0/);
});

test("el intro usa el video circular completo y abre el portal al terminar", () => {
  assert.match(html, /<video id="brandIntroLogo"[^>]*muted[^>]*playsinline/);
  assert.match(html, /biometrimss-intro-circle-v1\.mp4\?v=7\.2\.0/);
  assert.match(html, /video\.addEventListener\("ended", finishIntro/);
  assert.match(worker, /biometrimss-intro-circle-v1\.mp4\?v=7\.2\.0/);
});

test("octubre usa el avatar zombi oficial y nueve fantasmas", () => {
  const theme = fs.readFileSync(path.join(root, "themes/monthly-theme.js"), "utf8");
  const q4 = fs.readFileSync(path.join(root, "themes/q4-seasonal.css"), "utf8");
  assert.match(theme, /i < 9/);
  assert.match(theme, /q4-ghost/);
  assert.match(q4, /biometrimss-zombie-octubre-v1\.png/);
  assert.match(worker, /biometrimss-zombie-octubre-v1\.png\?v=7\.2\.0/);
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
