(function attachBiometrReport(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.BiometrReport = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createBiometrReport() {
  "use strict";

  const COLORS = {
    green: "#08745a",
    dark: "#143c34",
    ink: "#182421",
    muted: "#667773",
    line: "#cbd7d3",
    pale: "#edf6f3",
    effective: "#12805f",
    justified: "#2774b7",
    incident: "#b87509",
    absence: "#b63543",
    pending: "#71807c"
  };

  function dateLabel(value, logic) {
    const date = logic.parseDateKey(value);
    return date ? new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date) : value;
  }

  function timeLabel(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("es-MX", {
      hour: "2-digit", minute: "2-digit", hour12: false
    }).format(date);
  }

  function buildReportModel(records, settings, start, end, logic, nowValue) {
    const config = logic.normalizeSettings(settings);
    const rows = (Array.isArray(records) ? records : []).slice().sort((a, b) => a.shiftDate.localeCompare(b.shiftDate)).map((record) => {
      const evaluation = logic.evaluateRecord(record, config, nowValue);
      return {
        date: dateLabel(record.shiftDate, logic),
        entry: timeLabel(record.entryAt),
        exit: timeLabel(record.exitAt),
        status: evaluation.label,
        category: evaluation.category
      };
    });
    const summary = rows.reduce((counts, row) => {
      counts[row.category] = (counts[row.category] || 0) + 1;
      return counts;
    }, { effective: 0, justified: 0, incident: 0, absence: 0, pending: 0 });
    return {
      profile: {
        name: config.name || "Sin nombre registrado",
        employeeId: config.employeeId || "Sin matrícula",
        unit: config.unit || "Sin unidad registrada"
      },
      schedule: `${config.startTime} a ${config.exitTime} · ${config.guardDays.length} guardias por semana`,
      period: `${dateLabel(start, logic)} al ${dateLabel(end, logic)}`,
      rows,
      summary
    };
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function text(ctx, value, x, y, options = {}) {
    ctx.fillStyle = options.color || COLORS.ink;
    ctx.font = `${options.weight || 500} ${options.size || 28}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textAlign = options.align || "left";
    ctx.textBaseline = options.baseline || "alphabetic";
    ctx.fillText(String(value), x, y, options.maxWidth);
  }

  function line(ctx, x1, y1, x2, y2, color = COLORS.line, width = 2) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function renderReport(records, settings, start, end, logic) {
    if (typeof document === "undefined") throw new Error("Se necesita un navegador para dibujar el informe.");
    const model = buildReportModel(records, settings, start, end, logic);
    const width = 1600;
    const margin = 72;
    const rowHeight = 76;
    const height = 680 + Math.max(model.rows.length, 1) * rowHeight + 250;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#f2f5f4";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(32, 32, width - 64, height - 64);
    ctx.strokeStyle = COLORS.dark;
    ctx.lineWidth = 3;
    ctx.strokeRect(52, 52, width - 104, height - 104);

    ctx.fillStyle = COLORS.green;
    roundedRect(ctx, margin, 82, 112, 112, 24);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(margin + 56, 138, 34, -1.4, 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(margin + 56, 138, 20, -1.4, 1.5);
    ctx.stroke();

    text(ctx, "BiometrIMSS", 215, 126, { size: 44, weight: 800, color: COLORS.dark });
    text(ctx, "MI CONTROL PERSONAL DE GUARDIAS", 215, 170, { size: 23, weight: 700, color: COLORS.green });
    text(ctx, "INFORME BIOMÉTRICO", width - margin, 126, { size: 31, weight: 800, align: "right", color: COLORS.dark });
    text(ctx, `Periodo: ${model.period}`, width - margin, 170, { size: 22, align: "right", color: COLORS.muted });
    line(ctx, margin, 220, width - margin, 220, COLORS.dark, 3);

    text(ctx, "Matrícula:", 95, 278, { size: 22, weight: 800 });
    text(ctx, model.profile.employeeId, 235, 278, { size: 22 });
    text(ctx, "Nombre:", 95, 326, { size: 22, weight: 800 });
    text(ctx, model.profile.name, 235, 326, { size: 22, maxWidth: 650 });
    text(ctx, "Unidad:", 865, 278, { size: 22, weight: 800 });
    text(ctx, model.profile.unit, 985, 278, { size: 22, maxWidth: 500 });
    text(ctx, "Horario:", 865, 326, { size: 22, weight: 800 });
    text(ctx, model.schedule, 985, 326, { size: 22, maxWidth: 500 });

    const tableX = margin;
    const tableY = 380;
    const tableW = width - margin * 2;
    const columns = [0, 310, 610, 910, tableW];
    ctx.fillStyle = COLORS.dark;
    ctx.fillRect(tableX, tableY, tableW, 68);
    const headers = ["FECHA DE GUARDIA", "ENTRADA", "SALIDA", "CLASIFICACIÓN"];
    headers.forEach((header, index) => {
      text(ctx, header, tableX + (columns[index] + columns[index + 1]) / 2, tableY + 35, {
        size: 21, weight: 800, color: "#ffffff", align: "center", baseline: "middle"
      });
    });

    const displayRows = model.rows.length ? model.rows : [{ date: "—", entry: "—", exit: "—", status: "Sin registros", category: "pending" }];
    displayRows.forEach((row, index) => {
      const y = tableY + 68 + index * rowHeight;
      ctx.fillStyle = index % 2 ? "#f6faf8" : "#ffffff";
      ctx.fillRect(tableX, y, tableW, rowHeight);
      line(ctx, tableX, y + rowHeight, tableX + tableW, y + rowHeight);
      const values = [row.date, row.entry, row.exit, row.status];
      values.forEach((value, column) => {
        const color = column === 3 ? (COLORS[row.category] || COLORS.ink) : COLORS.ink;
        text(ctx, value, tableX + (columns[column] + columns[column + 1]) / 2, y + rowHeight / 2, {
          size: 24, weight: column === 3 ? 800 : 600, color, align: "center", baseline: "middle"
        });
      });
    });
    columns.forEach((offset) => line(ctx, tableX + offset, tableY, tableX + offset, tableY + 68 + displayRows.length * rowHeight, COLORS.line));
    ctx.strokeStyle = COLORS.dark;
    ctx.lineWidth = 3;
    ctx.strokeRect(tableX, tableY, tableW, 68 + displayRows.length * rowHeight);

    const summaryY = tableY + 68 + displayRows.length * rowHeight + 52;
    text(ctx, "RESUMEN DEL PERIODO", margin, summaryY, { size: 24, weight: 800, color: COLORS.dark });
    const cards = [
      ["Efectivas", model.summary.effective, "effective"],
      ["Justificadas", model.summary.justified, "justified"],
      ["Incidencias", model.summary.incident, "incident"],
      ["Faltas", model.summary.absence, "absence"]
    ];
    const cardY = summaryY + 30;
    const gap = 20;
    const cardW = (tableW - gap * 3) / 4;
    cards.forEach(([label, count, category], index) => {
      const x = margin + index * (cardW + gap);
      ctx.fillStyle = `${COLORS[category]}18`;
      roundedRect(ctx, x, cardY, cardW, 92, 18);
      ctx.fill();
      text(ctx, count, x + 28, cardY + 57, { size: 42, weight: 900, color: COLORS[category] });
      text(ctx, label, x + cardW - 24, cardY + 52, { size: 21, weight: 700, align: "right", color: COLORS[category] });
    });

    text(ctx, "Documento personal de consulta · Generado por BiometrIMSS", width / 2, height - 82, {
      size: 20, color: COLORS.muted, align: "center"
    });
    return canvas;
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo crear la imagen.")), "image/png", 1);
    });
  }

  return { buildReportModel, canvasToBlob, renderReport };
}));
