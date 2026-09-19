(function attachAnimatedReport() {
  "use strict";

  const STORAGE = {
    settings: "biometrimss:v2:settings",
    records: "biometrimss:v2:records"
  };

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  async function buildAnimatedPdf() {
    if (!window.BiometrReport || typeof window.BiometrReport.renderReport !== "function") {
      throw new Error("No está disponible el generador visual de BIOMETRIMSS.");
    }
    if (!window.BiometrLogic) {
      throw new Error("No está disponible la lógica de BIOMETRIMSS.");
    }
    if (!window.PDFLib || !window.PDFLib.PDFDocument) {
      throw new Error("No está disponible el generador de PDF.");
    }

    const records = readJson(STORAGE.records, []);
    const settings = readJson(STORAGE.settings, {});
    const start = document.getElementById("reportStart")?.value || document.getElementById("historyStart")?.value;
    const end = document.getElementById("reportEnd")?.value || document.getElementById("historyEnd")?.value;

    if (!start || !end) throw new Error("Selecciona el periodo del informe.");

    const canvas = await window.BiometrReport.renderReport(
      records,
      settings,
      start,
      end,
      window.BiometrLogic
    );

    if (!canvas || typeof canvas.toBlob !== "function") {
      throw new Error("No se pudo construir el informe visual.");
    }

    const pngBlob = window.BiometrReport.canvasToBlob
      ? await window.BiometrReport.canvasToBlob(canvas)
      : await new Promise((resolve, reject) => {
          canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo crear la imagen del informe.")), "image/png", 1);
        });

    const pngBytes = await pngBlob.arrayBuffer();
    const pdf = await window.PDFLib.PDFDocument.create();
    const page = pdf.addPage([540, 960]);
    const image = await pdf.embedPng(pngBytes);

    page.drawImage(image, { x: 0, y: 0, width: 540, height: 960 });
    pdf.setTitle(`BIOMETRIMSS · Informe visual ${start} a ${end}`);
    pdf.setSubject("Informe visual 9:16 con avatares y clasificación");
    pdf.setCreator("BIOMETRIMSS");
    if (settings.name) pdf.setAuthor(settings.name);

    const bytes = await pdf.save();
    triggerDownload(
      new Blob([bytes], { type: "application/pdf" }),
      `BIOMETRIMSS_INFORME_ANIMADO_${start}_${end}.pdf`
    );
  }

  function init() {
    const normalPdfButton = document.getElementById("downloadDigitalPdf");
    const actions = normalPdfButton?.closest(".report-actions");
    if (!normalPdfButton || !actions) return;

    let button = document.getElementById("downloadAnimatedPdf");
    if (!button) {
      button = document.createElement("button");
      button.id = "downloadAnimatedPdf";
      button.className = "button button-primary";
      button.type = "button";
      button.textContent = "Descargar formato animado PDF";
      normalPdfButton.insertAdjacentElement("afterend", button);
    }

    if (button.dataset.bound === "1") return;
    button.dataset.bound = "1";

    button.addEventListener("click", async () => {
      const label = button.textContent;
      try {
        button.disabled = true;
        button.textContent = "Generando PDF animado…";
        await buildAnimatedPdf();
        button.textContent = "Informe generado";
        window.setTimeout(() => { button.textContent = label; }, 1400);
      } catch (error) {
        console.error("BIOMETRIMSS informe animado:", error);
        button.textContent = label;
        alert(error?.message || "No se pudo generar el informe animado.");
      } finally {
        button.disabled = false;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
}());
