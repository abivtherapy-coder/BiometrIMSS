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
    assert.match(html, new RegExp(file.replace(".", "\\.") + "\\?v=7\\.0\\.0"));
  }
  assert.match(html, /style\.css\?v=7\.0\.0/);
  assert.match(worker, /biometrimss-v7\.0\.0/);
  assert.match(worker, /.\/app\.js\?v=7\.0\.0/);
  assert.match(worker, /.\/animated-report\.js\?v=7\.0\.0/);
});

test("el intro usa el video circular completo y abre el portal al terminar", () => {
  assert.match(html, /<video id="brandIntroLogo"[^>]*muted[^>]*playsinline/);
  assert.match(html, /biometrimss-intro-circle-v1\.mp4\?v=7\.0\.0/);
  assert.match(html, /video\.addEventListener\("ended", finishIntro/);
  assert.match(worker, /biometrimss-intro-circle-v1\.mp4\?v=7\.0\.0/);
});

test("la portada móvil conserva los cuatro indicadores en una fila", () => {
  assert.match(september, /Regla final: cuatro indicadores/);
  assert.match(september, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
});
