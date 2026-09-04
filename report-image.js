(function attachBiometrReport(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.BiometrReport = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createBiometrReport() {
  "use strict";

  const COLORS = Object.freeze({
    efectiva: "#2f8b35", retardo: "#e0aa00", "pase-salida": "#e56f18",
    "salida-anticipada": "#e56f18", "omision-entrada": "#2f80d0",
    "omision-salida": "#7a4fc2", justificada: "#d84f8b", incapacidad: "#b14aa0", permiso: "#5668c9", convenio: "#009fa3",
    vacaciones: "#8a5b35", falta: "#d62828", pendiente: "#75827e",
    festivo: "#2b8f83",
    "fuera-horario": "#555f5c", green: "#08745a", dark: "#063d34",
    ink: "#17201e", muted: "#60706c", line: "#bdc9c5"
  });

  const LEGEND = Object.freeze([
    ["efectiva", "En tolerancia", "Entrada y salida dentro del horario"],
    ["retardo", "Pase de entrada", "Entrada posterior a las 21:00"],
    ["pase-salida", "Pase de salida", "Salida posterior a las 10:10"],
    ["omision-entrada", "Omisión de entrada", "Sin entrada, pero sí con salida"],
    ["omision-salida", "Omisión de salida", "Con entrada, pero sin salida"],
    ["justificada", "Justificada", "Incidencia con justificación"],
    ["incapacidad", "Incapacidad", "Guardia justificada por incapacidad"],
    ["permiso", "Permiso", "Guardia justificada por permiso"],
    ["convenio", "Convenio", "Guardia cubierta mediante convenio"],
    ["vacaciones", "Vacaciones", "Día correspondiente a vacaciones"],
    ["festivo", "Festivo o descanso", "Día festivo o descanso programado"],
    ["falta", "Falta real", "Sin entrada ni salida"]
  ]);

  const ILLUSTRATIONS = Object.freeze({
    retardo: "assets/abisai-pase-entrada.png",
    "pase-salida": "assets/abisai-pase-salida.png",
    vacaciones: "assets/abisai-vacaciones.png"
  });

  const REPORT_SIZE = Object.freeze({ width: 1080, height: 1920, aspectRatio: "9:16" });

  function dateLabel(value, logic, includeDay = false) {
    const date = logic.parseDateKey(value);
    if (!date) return value || "—";
    if (!includeDay) return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
    const shortDate = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" }).format(date).replace(".", "");
    const day = new Intl.DateTimeFormat("es-MX", { weekday: "short" }).format(date).replace(".", "");
    return `${shortDate} (${day.charAt(0).toUpperCase()}${day.slice(1)})`;
  }

  function timeLabel(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("es-MX", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
    }).format(date);
  }

  function exitDateLabel(record, logic) {
    if (record.exitAt) {
      const date = new Date(record.exitAt);
      if (!Number.isNaN(date.getTime())) return dateLabel(logic.formatDateKey(date), logic, true);
    }
    return dateLabel(logic.formatDateKey(logic.addDays(record.shiftDate, 1)), logic, true);
  }

  function broadStatus(status, hasExit) {
    if (["efectiva", "retardo", "omision-entrada"].includes(status) && hasExit) return "EN TOLERANCIA";
    const labels = {
      falta: "FALTA REAL", "omision-salida": "SIN SALIDA", "pase-salida": "FUERA DE TOLERANCIA",
      "salida-anticipada": "SALIDA ANTICIPADA", "fuera-horario": "FUERA DE HORARIO"
    };
    return labels[status] || status.toUpperCase();
  }

  function buildReportModel(records, settings, start, end, logic, nowValue) {
    const config = logic.normalizeSettings(settings);
    const rows = logic.scheduledEvaluations(records, start, end, config, nowValue).map(({ record, evaluation }) => {
      const notes = String(record.notes || "").trim();
      return {
        date: dateLabel(record.shiftDate, logic, true), entry: timeLabel(record.entryAt),
        exitDate: exitDateLabel(record, logic), exit: timeLabel(record.exitAt), status: evaluation.status,
        statusLabel: broadStatus(evaluation.status, Boolean(record.exitAt)),
        typeLabel: notes ? `${evaluation.label.toUpperCase()} · ${notes}` : evaluation.label.toUpperCase()
      };
    });
    const summary = rows.reduce((counts, row) => {
      counts[row.status] = (counts[row.status] || 0) + 1;
      return counts;
    }, {});
    return {
      profile: { name: config.name || "Sin nombre registrado", employeeId: config.employeeId || "Sin matrícula", unit: config.unit || "Sin unidad registrada" },
      schedule: config, period: `${dateLabel(start, logic)} al ${dateLabel(end, logic)}`, rows, summary,
      attendanceRate: rows.length ? Math.round(((summary.efectiva || 0) / rows.length) * 1000) / 10 : 0
    };
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r); ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r); ctx.closePath();
  }

  function text(ctx, value, x, y, options = {}) {
    ctx.fillStyle = options.color || COLORS.ink;
    ctx.font = `${options.weight || 500} ${options.size || 24}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textAlign = options.align || "left"; ctx.textBaseline = options.baseline || "alphabetic";
    ctx.fillText(String(value), x, y, options.maxWidth);
  }

  function line(ctx, x1, y1, x2, y2, color = COLORS.line, width = 2) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  function tint(hex, alpha) {
    const value = hex.replace("#", "");
    return `rgba(${parseInt(value.slice(0, 2), 16)},${parseInt(value.slice(2, 4), 16)},${parseInt(value.slice(4, 6), 16)},${alpha})`;
  }

  function drawSymbol(ctx, status, x, y, radius = 16) {
    const color = COLORS[status] || COLORS.muted;
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath();
    if (status === "efectiva") { ctx.moveTo(x - 7, y); ctx.lineTo(x - 1, y + 6); ctx.lineTo(x + 9, y - 7); }
    else if (status === "falta") { ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); }
    else if (["retardo", "pase-salida"].includes(status)) { ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 3); ctx.moveTo(x, y + 9); ctx.lineTo(x, y + 9); }
    else { ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y); }
    ctx.stroke();
  }

  function loadIllustrations() {
    const entries = Object.entries(ILLUSTRATIONS);
    return Promise.all(entries.map(([key, src]) => new Promise((resolve) => {
      const image = new Image(); image.onload = () => resolve([key, image]); image.onerror = () => resolve([key, null]); image.src = src;
    }))).then((items) => Object.fromEntries(items));
  }

  function drawContain(ctx, image, x, y, width, height) {
    if (!image) return;
    const scale = Math.min(width / image.width, height / image.height);
    const drawW = image.width * scale; const drawH = image.height * scale;
    ctx.drawImage(image, x + (width - drawW) / 2, y + (height - drawH) / 2, drawW, drawH);
  }

  function drawHeader(ctx, model, width, margin, images) {
    ctx.fillStyle = COLORS.green; roundedRect(ctx, margin, 45, 102, 102, 18); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(margin + 51, 96, 31, -1.4, 1.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(margin + 51, 96, 18, -1.4, 1.5); ctx.stroke();
    text(ctx, "IMSS", margin + 51, 180, { size: 30, weight: 900, color: COLORS.green, align: "center" });
    text(ctx, "REPORTE DE GUARDIAS · BIOMÉTRICO", width / 2, 69, { size: 36, weight: 900, align: "center" });
    text(ctx, model.profile.name.toUpperCase(), width / 2, 116, { size: 37, weight: 900, color: COLORS.green, align: "center", maxWidth: 1040 });
    text(ctx, `Matrícula: ${model.profile.employeeId}  ·  ${model.profile.unit}`, width / 2, 156, { size: 21, weight: 650, color: COLORS.muted, align: "center", maxWidth: 1050 });
    drawContain(ctx, images.retardo, width - margin - 150, 35, 145, 150);
    const y = 200; ctx.fillStyle = "#f5faf8"; roundedRect(ctx, margin, y, width - margin * 2, 116, 12); ctx.fill();
    text(ctx, "PERIODO", margin + 28, y + 35, { size: 18, weight: 900, color: COLORS.green });
    text(ctx, model.period, margin + 28, y + 76, { size: 25, weight: 800 });
    text(ctx, "TURNO 3 · NOCTURNO", margin + 590, y + 35, { size: 19, weight: 900, color: COLORS.green });
    text(ctx, `${model.schedule.startTime} a ${model.schedule.exitTime}`, margin + 590, y + 76, { size: 25, weight: 800 });
    text(ctx, `ENTRADA ${model.schedule.startTime} · Límite ${model.schedule.entryTolerance}`, width - margin - 28, y + 35, { size: 19, weight: 750, align: "right" });
    text(ctx, `SALIDA ${model.schedule.exitTime} · Límite ${model.schedule.exitTolerance}`, width - margin - 28, y + 76, { size: 19, weight: 750, align: "right" });
  }

  function drawTable(ctx, model, x, y, width, rowHeight) {
    const columns = [0, 205, 390, 600, 785, 1020, width];
    const headers = ["GUARDIA", "ENTRADA", "SALIDA", "HORA", "ESTATUS", "TIPO"];
    ctx.fillStyle = COLORS.dark; ctx.fillRect(x, y, width, 72);
    headers.forEach((header, i) => text(ctx, header, x + (columns[i] + columns[i + 1]) / 2, y + 37, { size: 19, weight: 900, color: "#fff", align: "center", baseline: "middle" }));
    const rows = model.rows.length ? model.rows : [{ date: "—", entry: "—", exitDate: "—", exit: "—", status: "pendiente", statusLabel: "SIN REGISTROS", typeLabel: "SIN REGISTROS" }];
    rows.forEach((row, index) => {
      const top = y + 72 + index * rowHeight; ctx.fillStyle = index % 2 ? "#fafcfb" : "#fff"; ctx.fillRect(x, top, width, rowHeight);
      const cell = (from, to, color) => { ctx.fillStyle = tint(color, .14); ctx.fillRect(x + columns[from], top, columns[to] - columns[from], rowHeight); };
      if (row.status === "omision-entrada") cell(1, 2, COLORS["omision-entrada"]);
      if (row.status === "omision-salida") cell(3, 4, COLORS["omision-salida"]);
      if (row.status === "retardo") cell(1, 2, COLORS.retardo);
      if (["pase-salida", "salida-anticipada"].includes(row.status)) cell(3, 4, COLORS["pase-salida"]);
      ctx.fillStyle = tint(COLORS[row.status] || COLORS.muted, .11); ctx.fillRect(x + columns[4], top, width - columns[4], rowHeight);
      [row.date, row.entry, row.exitDate, row.exit].forEach((value, col) => text(ctx, value, x + (columns[col] + columns[col + 1]) / 2, top + rowHeight / 2, { size: 19, weight: 750, color: value === "—" ? "#ba2323" : COLORS.ink, align: "center", baseline: "middle" }));
      const color = COLORS[row.status] || COLORS.muted;
      drawSymbol(ctx, row.status, x + columns[4] + 26, top + rowHeight / 2, 14);
      text(ctx, row.statusLabel, x + columns[4] + 49, top + rowHeight / 2, { size: 15, weight: 900, color, baseline: "middle", maxWidth: columns[5] - columns[4] - 55 });
      drawSymbol(ctx, row.status, x + columns[5] + 26, top + rowHeight / 2, 14);
      text(ctx, row.typeLabel, x + columns[5] + 49, top + rowHeight / 2, { size: 15, weight: 900, color, baseline: "middle", maxWidth: columns[6] - columns[5] - 53 });
      line(ctx, x, top + rowHeight, x + width, top + rowHeight);
    });
    columns.forEach((offset) => line(ctx, x + offset, y, x + offset, y + 72 + rows.length * rowHeight));
    ctx.strokeStyle = COLORS.dark; ctx.lineWidth = 3; ctx.strokeRect(x, y, width, 72 + rows.length * rowHeight);
    return y + 72 + rows.length * rowHeight;
  }

  function drawSidebar(ctx, model, images, x, y, width) {
    ctx.fillStyle = COLORS.dark; ctx.fillRect(x, y, width, 62);
    text(ctx, "LEYENDA", x + width / 2, y + 32, { size: 24, weight: 900, color: "#fff", align: "center", baseline: "middle" });
    let cursor = y + 62;
    LEGEND.forEach(([status, label, detail]) => {
      const illustrated = Boolean(images[status]); const height = illustrated ? 112 : 74;
      ctx.fillStyle = tint(COLORS[status], .12); ctx.fillRect(x, cursor, width, height);
      if (illustrated) drawContain(ctx, images[status], x + 5, cursor + 4, 88, height - 8); else drawSymbol(ctx, status, x + 34, cursor + height / 2, 17);
      const copyX = illustrated ? x + 99 : x + 65;
      text(ctx, label.toUpperCase(), copyX, cursor + height / 2 - 8, { size: 18, weight: 900, color: COLORS[status], maxWidth: width - (copyX - x) - 12 });
      text(ctx, detail, copyX, cursor + height / 2 + 19, { size: 14, weight: 650, maxWidth: width - (copyX - x) - 12 });
      line(ctx, x, cursor + height, x + width, cursor + height); cursor += height;
    });
    ctx.strokeStyle = COLORS.line; ctx.lineWidth = 2; ctx.strokeRect(x, y, width, cursor - y);
    cursor += 24; ctx.fillStyle = COLORS.dark; ctx.fillRect(x, cursor, width, 60);
    text(ctx, "RESUMEN DEL PERIODO", x + width / 2, cursor + 31, { size: 20, weight: 900, color: "#fff", align: "center", baseline: "middle" }); cursor += 60;
    LEGEND.forEach(([status, label]) => {
      const count = model.summary[status] || 0; if (!count) return;
      ctx.fillStyle = tint(COLORS[status], .08); ctx.fillRect(x, cursor, width, 52);
      drawSymbol(ctx, status, x + 27, cursor + 26, 13); text(ctx, label.toUpperCase(), x + 50, cursor + 27, { size: 15, weight: 850, color: COLORS[status], baseline: "middle" });
      text(ctx, count, x + width - 18, cursor + 27, { size: 22, weight: 900, align: "right", baseline: "middle" }); line(ctx, x, cursor + 52, x + width, cursor + 52); cursor += 52;
    });
    ctx.fillStyle = COLORS.dark; ctx.fillRect(x, cursor, width, 62);
    text(ctx, "% ASISTENCIA REAL", x + 18, cursor + 32, { size: 17, weight: 900, color: "#fff", baseline: "middle" });
    text(ctx, `${model.attendanceRate}%`, x + width - 18, cursor + 32, { size: 26, weight: 900, color: "#fff", align: "right", baseline: "middle" });
    return cursor + 62;
  }

  function drawPortraitHeader(ctx, model, images, width, margin) {
    ctx.fillStyle = COLORS.green; roundedRect(ctx, margin, 28, 82, 82, 15); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(margin + 41, 69, 25, -1.4, 1.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(margin + 41, 69, 14, -1.4, 1.5); ctx.stroke();
    text(ctx, "IMSS", margin + 41, 137, { size: 23, weight: 900, color: COLORS.green, align: "center" });
    text(ctx, "REPORTE DE GUARDIAS · BIOMÉTRICO", width / 2, 55, { size: 27, weight: 900, align: "center" });
    text(ctx, model.profile.name.toUpperCase(), width / 2, 94, { size: 29, weight: 900, color: COLORS.green, align: "center", maxWidth: 720 });
    text(ctx, `Matrícula: ${model.profile.employeeId}`, width / 2, 126, { size: 18, weight: 750, color: COLORS.muted, align: "center" });
    text(ctx, model.profile.unit, width / 2, 151, { size: 16, weight: 650, color: COLORS.muted, align: "center", maxWidth: 720 });
    drawContain(ctx, images.retardo, width - margin - 118, 20, 118, 135);

    const y = 174; const cardWidth = width - margin * 2;
    ctx.fillStyle = "#f5faf8"; roundedRect(ctx, margin, y, cardWidth, 116, 14); ctx.fill();
    line(ctx, width / 2, y + 14, width / 2, y + 102, "#d7e3df", 2);
    text(ctx, "PERIODO", margin + 24, y + 31, { size: 15, weight: 900, color: COLORS.green });
    text(ctx, model.period, margin + 24, y + 63, { size: 21, weight: 850 });
    text(ctx, "TURNO 3 · NOCTURNO", margin + 24, y + 93, { size: 16, weight: 850, color: COLORS.green });
    text(ctx, `${model.schedule.startTime} a ${model.schedule.exitTime}`, margin + 255, y + 93, { size: 17, weight: 800 });
    text(ctx, `ENTRADA ${model.schedule.startTime}`, width / 2 + 24, y + 31, { size: 16, weight: 850, color: COLORS.green });
    text(ctx, `Límite ${model.schedule.entryTolerance}`, width - margin - 24, y + 31, { size: 16, weight: 750, align: "right" });
    text(ctx, `SALIDA ${model.schedule.exitTime}`, width / 2 + 24, y + 72, { size: 16, weight: 850, color: COLORS.green });
    text(ctx, `Límite ${model.schedule.exitTolerance}`, width - margin - 24, y + 72, { size: 16, weight: 750, align: "right" });
  }

  function drawPortraitTable(ctx, model, x, y, width, rowHeight) {
    const columns = [0, 145, 275, 425, 555, 755, width];
    const headers = ["GUARDIA", "ENTRADA", "SALIDA", "HORA", "ESTATUS", "TIPO"];
    const headerHeight = 58;
    ctx.fillStyle = COLORS.dark; ctx.fillRect(x, y, width, headerHeight);
    headers.forEach((header, i) => text(ctx, header, x + (columns[i] + columns[i + 1]) / 2, y + headerHeight / 2, { size: 14, weight: 900, color: "#fff", align: "center", baseline: "middle" }));
    const rows = model.rows.length ? model.rows : [{ date: "—", entry: "—", exitDate: "—", exit: "—", status: "pendiente", statusLabel: "SIN REGISTROS", typeLabel: "SIN REGISTROS" }];
    const regularSize = Math.max(12, Math.min(17, rowHeight * .31));
    const statusSize = Math.max(10, Math.min(13, rowHeight * .24));
    rows.forEach((row, index) => {
      const top = y + headerHeight + index * rowHeight;
      ctx.fillStyle = index % 2 ? "#fafcfb" : "#fff"; ctx.fillRect(x, top, width, rowHeight);
      const cell = (from, to, color) => { ctx.fillStyle = tint(color, .14); ctx.fillRect(x + columns[from], top, columns[to] - columns[from], rowHeight); };
      if (row.status === "omision-entrada") cell(1, 2, COLORS["omision-entrada"]);
      if (row.status === "omision-salida") cell(3, 4, COLORS["omision-salida"]);
      if (row.status === "retardo") cell(1, 2, COLORS.retardo);
      if (["pase-salida", "salida-anticipada"].includes(row.status)) cell(3, 4, COLORS["pase-salida"]);
      ctx.fillStyle = tint(COLORS[row.status] || COLORS.muted, .11); ctx.fillRect(x + columns[4], top, width - columns[4], rowHeight);
      [row.date, row.entry, row.exitDate, row.exit].forEach((value, col) => text(ctx, value, x + (columns[col] + columns[col + 1]) / 2, top + rowHeight / 2, { size: regularSize, weight: 750, color: value === "—" ? "#ba2323" : COLORS.ink, align: "center", baseline: "middle" }));
      const color = COLORS[row.status] || COLORS.muted; const radius = Math.max(8, Math.min(11, rowHeight * .2));
      drawSymbol(ctx, row.status, x + columns[4] + 18, top + rowHeight / 2, radius);
      text(ctx, row.statusLabel, x + columns[4] + 36, top + rowHeight / 2, { size: statusSize, weight: 900, color, baseline: "middle", maxWidth: columns[5] - columns[4] - 42 });
      drawSymbol(ctx, row.status, x + columns[5] + 18, top + rowHeight / 2, radius);
      text(ctx, row.typeLabel, x + columns[5] + 36, top + rowHeight / 2, { size: statusSize, weight: 900, color, baseline: "middle", maxWidth: columns[6] - columns[5] - 42 });
      line(ctx, x, top + rowHeight, x + width, top + rowHeight);
    });
    columns.forEach((offset) => line(ctx, x + offset, y, x + offset, y + headerHeight + rows.length * rowHeight));
    ctx.strokeStyle = COLORS.dark; ctx.lineWidth = 3; ctx.strokeRect(x, y, width, headerHeight + rows.length * rowHeight);
    return y + headerHeight + rows.length * rowHeight;
  }

  function drawPortraitLegend(ctx, model, images, x, y, width, height) {
    const gap = 10; const columns = 3; const rows = Math.ceil(LEGEND.length / columns);
    const cardWidth = (width - gap * (columns - 1)) / columns;
    const cardHeight = Math.max(54, (height - gap * (rows - 1)) / rows);
    LEGEND.forEach(([status, label, detail], index) => {
      const col = index % columns; const row = Math.floor(index / columns);
      const left = x + col * (cardWidth + gap); const top = y + row * (cardHeight + gap);
      ctx.fillStyle = tint(COLORS[status], .1); roundedRect(ctx, left, top, cardWidth, cardHeight, 12); ctx.fill();
      ctx.strokeStyle = tint(COLORS[status], .35); ctx.lineWidth = 2; ctx.stroke();
      const illustrated = Boolean(images[status]); const visualWidth = illustrated ? 74 : 48;
      if (illustrated) drawContain(ctx, images[status], left + 5, top + 5, 69, cardHeight - 10);
      else drawSymbol(ctx, status, left + 27, top + cardHeight / 2, 14);
      const copyX = left + visualWidth + 7;
      text(ctx, label.toUpperCase(), copyX, top + cardHeight / 2 - 10, { size: 14, weight: 900, color: COLORS[status], maxWidth: cardWidth - visualWidth - 44 });
      text(ctx, detail, copyX, top + cardHeight / 2 + 14, { size: 11, weight: 650, color: COLORS.ink, maxWidth: cardWidth - visualWidth - 14 });
      ctx.fillStyle = COLORS[status]; ctx.beginPath(); ctx.arc(left + cardWidth - 21, top + 22, 15, 0, Math.PI * 2); ctx.fill();
      text(ctx, model.summary[status] || 0, left + cardWidth - 21, top + 22, { size: 14, weight: 900, color: "#fff", align: "center", baseline: "middle" });
    });
  }

  function drawPortraitSummary(ctx, model, x, y, width) {
    const total = model.rows.length; const effective = model.summary.efectiva || 0; const incidents = Math.max(0, total - effective);
    const cards = [["TOTAL GUARDIAS", total], ["EFECTIVAS", effective], ["INCIDENCIAS", incidents], ["ASISTENCIA REAL", `${model.attendanceRate}%`]];
    const cardWidth = width / cards.length;
    ctx.fillStyle = COLORS.dark; roundedRect(ctx, x, y, width, 92, 12); ctx.fill();
    cards.forEach(([label, value], index) => {
      const center = x + cardWidth * index + cardWidth / 2;
      if (index) line(ctx, x + cardWidth * index, y + 15, x + cardWidth * index, y + 77, "rgba(255,255,255,.25)", 2);
      text(ctx, label, center, y + 30, { size: 13, weight: 850, color: "#d8ede7", align: "center" });
      text(ctx, value, center, y + 68, { size: 29, weight: 900, color: "#fff", align: "center" });
    });
  }

  async function renderReport(records, settings, start, end, logic) {
    if (typeof document === "undefined") throw new Error("Se necesita un navegador para dibujar el informe.");
    const [model, images] = [buildReportModel(records, settings, start, end, logic), await loadIllustrations()];
    const { width, height } = REPORT_SIZE; const margin = 36; const contentY = 315; const tableWidth = width - margin * 2;
    const rowCount = Math.max(model.rows.length, 1); const rowHeight = Math.max(22, Math.min(70, Math.floor(920 / rowCount)));
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, height);
    drawPortraitHeader(ctx, model, images, width, margin);
    const tableBottom = drawPortraitTable(ctx, model, margin, contentY, tableWidth, rowHeight);
    const legendY = tableBottom + 18; const reservedAfterLegend = 216;
    const legendHeight = Math.max(288, Math.min(420, height - legendY - reservedAfterLegend));
    drawPortraitLegend(ctx, model, images, margin, legendY, tableWidth, legendHeight);
    const summaryY = legendY + legendHeight + 15; drawPortraitSummary(ctx, model, margin, summaryY, tableWidth);
    const noteY = summaryY + 106; ctx.fillStyle = "#f5faf8"; roundedRect(ctx, margin, noteY, tableWidth, 54, 10); ctx.fill();
    text(ctx, "NOTA:", margin + 18, noteY + 28, { size: 14, weight: 900, color: COLORS.green, baseline: "middle" });
    text(ctx, `Guardia completa: entrada hasta ${model.schedule.entryTolerance} y salida al día siguiente hasta ${model.schedule.exitTolerance}.`, margin + 72, noteY + 28, { size: 14, weight: 700, baseline: "middle", maxWidth: tableWidth - 90 });
    text(ctx, "Documento personal de consulta · Generado por ABITIMSS · Formato 9:16", width - margin, height - 22, { size: 13, color: COLORS.muted, align: "right" });
    return canvas;
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo crear la imagen.")), "image/png", 1));
  }

  return { COLORS, LEGEND, REPORT_SIZE, buildReportModel, canvasToBlob, renderReport };
}));
