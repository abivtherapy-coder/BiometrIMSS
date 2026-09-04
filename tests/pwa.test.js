const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("todos los recursos para uso sin conexión existen", () => {
  const worker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
  const assets = [...worker.matchAll(/"\.\/([^"#]+)"/g)].map((match) => match[1]).filter(Boolean);
  for (const asset of assets) {
    const filePath = asset.split("?")[0];
    assert.equal(fs.existsSync(path.join(root, filePath)), true, asset);
  }
});

test("el manifiesto PWA contiene iconos instalables", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.display, "standalone");
  for (const icon of manifest.icons) assert.equal(fs.existsSync(path.join(root, icon.src.split("?")[0])), true, icon.src);
});

test("incluye un manual accesible con instalación para iOS y Android", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /id="view-manual"/);
  assert.match(html, /Instalar en iPhone o iPad/);
  assert.match(html, /Instalar en Android/);
  assert.match(html, /Importar PDF de TuPerfilIMSS/);
  assert.match(html, /Periodos vacacionales/);
});
