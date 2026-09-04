(function attachBiometrLogic(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.BiometrLogic = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createBiometrLogic() {
  "use strict";

  const DEFAULT_SETTINGS = Object.freeze({
    name: "",
    employeeId: "",
    unit: "",
    startTime: "20:30",
    entryTolerance: "21:00",
    exitTime: "08:10",
    exitTolerance: "10:10",
    guardDays: [2, 4, 6]
  });

  const STATUS_META = Object.freeze({
    efectiva: { label: "Efectiva", category: "effective", description: "Entrada y salida dentro del horario configurado." },
    retardo: { label: "Pase de entrada", category: "incident", description: "La entrada fue posterior al límite configurado." },
    "pase-salida": { label: "Pase de salida", category: "incident", description: "La salida fue posterior al límite configurado." },
    "fuera-horario": { label: "Fuera de horario", category: "incident", description: "Alguna checada quedó fuera de la ventana configurada." },
    "omision-entrada": { label: "Omisión de entrada", category: "incident", description: "Hay salida, pero no se registró la entrada." },
    "omision-salida": { label: "Omisión de salida", category: "incident", description: "Hay entrada, pero no se registró la salida." },
    "salida-anticipada": { label: "Salida anticipada", category: "incident", description: "La salida fue anterior a la hora configurada." },
    justificada: { label: "Justificada", category: "justified", description: "Registro marcado como justificado." },
    incapacidad: { label: "Incapacidad", category: "justified", description: "Guardia justificada por incapacidad." },
    permiso: { label: "Permiso", category: "justified", description: "Guardia justificada por permiso." },
    convenio: { label: "Convenio", category: "agreement", description: "Guardia cubierta mediante convenio." },
    vacaciones: { label: "Vacaciones", category: "vacation", description: "Día correspondiente a vacaciones." },
    festivo: { label: "Festivo o descanso", category: "justified", description: "Día festivo o descanso programado." },
    falta: { label: "Falta", category: "absence", description: "No hubo entrada ni salida registradas." },
    pendiente: { label: "Pendiente", category: "pending", description: "La guardia todavía no concluye o faltan datos." }
  });

  const INCIDENT_STATUSES = new Set([
    "retardo",
    "pase-salida",
    "fuera-horario",
    "omision-entrada",
    "omision-salida",
    "salida-anticipada"
  ]);

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function formatDateKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseDateKey(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
  }

  function addDays(value, amount) {
    const date = value instanceof Date ? new Date(value) : parseDateKey(value);
    if (!date) return null;
    date.setDate(date.getDate() + amount);
    return date;
  }

  function toMinutes(time) {
    if (typeof time !== "string" || !/^\d{2}:\d{2}$/.test(time)) return NaN;
    const [hours, minutes] = time.split(":").map(Number);
    if (hours > 23 || minutes > 59) return NaN;
    return hours * 60 + minutes;
  }

  function normalizeSettings(settings) {
    const source = settings && typeof settings === "object" ? settings : {};
    const guardDays = Array.isArray(source.guardDays)
      ? [...new Set(source.guardDays.map(Number).filter((day) => day >= 0 && day <= 6))].sort((a, b) => a - b)
      : [...DEFAULT_SETTINGS.guardDays];

    return {
      ...DEFAULT_SETTINGS,
      ...source,
      guardDays: guardDays.length ? guardDays : [...DEFAULT_SETTINGS.guardDays]
    };
  }

  function dateTimeForShift(shiftDate, time, forceNextDay) {
    const base = parseDateKey(shiftDate);
    const minutes = toMinutes(time);
    if (!base || Number.isNaN(minutes)) return null;
    base.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    if (forceNextDay) base.setDate(base.getDate() + 1);
    return base;
  }

  function shiftWindow(shiftDate, settings) {
    const config = normalizeSettings(settings);
    const startMinutes = toMinutes(config.startTime);
    const exitMinutes = toMinutes(config.exitTime);
    const exitToleranceMinutes = toMinutes(config.exitTolerance);
    const exitNextDay = exitMinutes <= startMinutes;
    const exitToleranceNextDay = exitToleranceMinutes <= startMinutes;

    return {
      start: dateTimeForShift(shiftDate, config.startTime, false),
      entryTolerance: dateTimeForShift(shiftDate, config.entryTolerance, false),
      exit: dateTimeForShift(shiftDate, config.exitTime, exitNextDay),
      exitTolerance: dateTimeForShift(shiftDate, config.exitTolerance, exitToleranceNextDay)
    };
  }

  function toDateTimeLocal(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${formatDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function parseDateTime(value) {
    if (!value) return null;
    const date = value instanceof Date ? new Date(value) : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function getStatusMeta(status) {
    return STATUS_META[status] || STATUS_META.pendiente;
  }

  function manualEvaluation(status) {
    const resolved = STATUS_META[status] ? status : "pendiente";
    return {
      status: resolved,
      ...getStatusMeta(resolved),
      reason: "Clasificación elegida manualmente."
    };
  }

  function evaluateRecord(record, settings, nowValue) {
    const data = record && typeof record === "object" ? record : {};
    const override = data.statusOverride || "auto";
    if (override !== "auto") return manualEvaluation(override);

    const window = shiftWindow(data.shiftDate, settings);
    const entry = parseDateTime(data.entryAt);
    const exit = parseDateTime(data.exitAt);
    const now = parseDateTime(nowValue) || new Date();

    if (!window.start || !window.entryTolerance || !window.exit || !window.exitTolerance) {
      return { status: "pendiente", ...STATUS_META.pendiente, reason: "Revisa la fecha y el horario configurado." };
    }

    if (!entry && !exit && now <= window.exitTolerance) {
      return { status: "pendiente", ...STATUS_META.pendiente, reason: "La guardia todavía no concluye." };
    }

    if (!entry && !exit) {
      return { status: "falta", ...STATUS_META.falta, reason: "No se capturaron checadas de entrada ni de salida." };
    }

    if (!entry && exit) {
      return { status: "omision-entrada", ...STATUS_META["omision-entrada"], reason: "Se registró una salida sin entrada." };
    }

    if (entry && !exit) {
      if (now <= window.exitTolerance) {
        return { status: "pendiente", ...STATUS_META.pendiente, reason: "La entrada está guardada; falta registrar la salida." };
      }
      return { status: "omision-salida", ...STATUS_META["omision-salida"], reason: "Terminó la ventana de salida y no hay checada registrada." };
    }

    const earliestReasonableEntry = new Date(window.start.getTime() - 4 * 60 * 60 * 1000);
    if (exit < entry || entry < earliestReasonableEntry || entry > window.exit) {
      return { status: "fuera-horario", ...STATUS_META["fuera-horario"], reason: "La entrada o la salida quedó fuera de la ventana de guardia." };
    }

    if (exit > window.exitTolerance) {
      return { status: "pase-salida", ...STATUS_META["pase-salida"], reason: "La salida fue posterior al límite permitido." };
    }

    if (entry > window.entryTolerance) {
      return { status: "retardo", ...STATUS_META.retardo, reason: "La entrada fue posterior al límite permitido." };
    }

    if (exit < window.exit) {
      return { status: "salida-anticipada", ...STATUS_META["salida-anticipada"], reason: "La salida fue anterior a la hora programada." };
    }

    return { status: "efectiva", ...STATUS_META.efectiva, reason: "Entrada y salida dentro del horario configurado." };
  }

  function isScheduledDate(dateValue, settings) {
    const date = dateValue instanceof Date ? dateValue : parseDateKey(dateValue);
    if (!date) return false;
    return normalizeSettings(settings).guardDays.includes(date.getDay());
  }

  function datesInRange(startValue, endValue) {
    const start = startValue instanceof Date ? new Date(startValue) : parseDateKey(startValue);
    const end = endValue instanceof Date ? new Date(endValue) : parseDateKey(endValue);
    if (!start || !end || start > end) return [];

    const output = [];
    const cursor = new Date(start);
    while (cursor <= end && output.length < 3700) {
      output.push(formatDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return output;
  }

  function scheduledDates(start, end, settings) {
    return datesInRange(start, end).filter((date) => isScheduledDate(date, settings));
  }

  function recordsInRange(records, start, end) {
    const list = Array.isArray(records) ? records : [];
    return list.filter((record) => record.shiftDate >= start && record.shiftDate <= end);
  }

  function scheduledEvaluations(records, start, end, settings, nowValue) {
    const config = normalizeSettings(settings);
    const now = parseDateTime(nowValue) || new Date();
    const byDate = new Map(recordsInRange(records, start, end).map((record) => [record.shiftDate, record]));

    return scheduledDates(start, end, config).map((shiftDate) => {
      const window = shiftWindow(shiftDate, config);
      const complete = Boolean(window.exitTolerance && window.exitTolerance < now);
      const record = byDate.get(shiftDate) || {
        id: `scheduled-${shiftDate}`,
        shiftDate,
        entryAt: "",
        exitAt: "",
        statusOverride: "auto",
        notes: ""
      };
      const evaluation = complete
        ? evaluateRecord(record, config, now)
        : { status: "pendiente", ...STATUS_META.pendiente, reason: "La guardia todavía no concluye." };
      return { record, evaluation, complete, scheduled: true };
    });
  }

  function mergeRecordsByShiftDate(currentRecords, incomingRecords) {
    const current = Array.isArray(currentRecords) ? currentRecords.map((record) => ({ ...record })) : [];
    const incoming = Array.isArray(incomingRecords) ? incomingRecords : [];
    const byDate = new Map(current.map((record, index) => [record.shiftDate, index]));
    let added = 0;
    let updated = 0;
    let skipped = 0;

    incoming.forEach((record) => {
      const index = byDate.get(record.shiftDate);
      if (index === undefined) {
        current.push({ ...record });
        byDate.set(record.shiftDate, current.length - 1);
        added += 1;
        return;
      }

      const existing = current[index];
      const merged = {
        ...existing,
        entryAt: existing.entryAt || record.entryAt || "",
        exitAt: existing.exitAt || record.exitAt || "",
        statusOverride: existing.statusOverride && existing.statusOverride !== "auto"
          ? existing.statusOverride
          : (record.statusOverride || existing.statusOverride || "auto"),
        notes: existing.notes || record.notes || "",
        updatedAt: existing.updatedAt || record.updatedAt || new Date().toISOString()
      };
      const changed = ["entryAt", "exitAt", "statusOverride", "notes"]
        .some((field) => merged[field] !== existing[field]);
      current[index] = merged;
      if (changed) updated += 1;
      else skipped += 1;
    });

    return {
      records: current.sort((a, b) => b.shiftDate.localeCompare(a.shiftDate)),
      added,
      updated,
      skipped
    };
  }

  function parseTuPerfilImssText(text, settings) {
    const source = String(text || "");
    if (!/BIOM.?TRICO[\s\S]*REGISTRO\s+DE\s+EVENTOS/i.test(source)) {
      throw new Error("El PDF no parece ser un Registro de Eventos de TuPerfilIMSS.");
    }
    const config = normalizeSettings(settings);
    const eventPattern = /(?:\b\d{1,3}(?:\.\d{1,3}){3}\s*)?(\d{2}):(\d{2}):(\d{2})\s*(\d{2})\/(\d{2})\/(\d{4})\s*[ES]\b/g;
    const byShiftDate = new Map();
    let match;
    while ((match = eventPattern.exec(source))) {
      const [, hours, minutes, seconds, day, month, year] = match;
      const eventDate = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes), Number(seconds));
      if (Number.isNaN(eventDate.getTime())) continue;
      const isNightEntry = eventDate.getHours() >= 15;
      const shiftDate = formatDateKey(isNightEntry ? eventDate : addDays(eventDate, -1));
      const eventAt = toDateTimeLocal(eventDate);
      const record = byShiftDate.get(shiftDate) || {
        id: `tuperfil-${shiftDate}`,
        shiftDate,
        entryAt: "",
        exitAt: "",
        statusOverride: "auto",
        notes: "Importado desde PDF de TuPerfilIMSS"
      };
      if (isNightEntry) {
        if (!record.entryAt || eventAt < record.entryAt) record.entryAt = eventAt;
      } else if (!record.exitAt || eventAt > record.exitAt) {
        record.exitAt = eventAt;
      }
      byShiftDate.set(shiftDate, record);
    }
    const records = [...byShiftDate.values()].filter((record) => record.entryAt || record.exitAt).sort((a, b) => b.shiftDate.localeCompare(a.shiftDate));
    if (!records.length) throw new Error("No se encontraron checadas con fecha y hora en el PDF.");
    return records;
  }

  function calculateStats(records, start, end, settings, nowValue) {
    const list = recordsInRange(records, start, end);
    const scheduled = scheduledDates(start, end, settings);
    const evaluations = scheduledEvaluations(records, start, end, settings, nowValue);
    const dueScheduled = evaluations.filter(({ complete }) => complete);
    const effective = evaluations.filter(({ evaluation }) => evaluation.status === "efectiva").length;
    const justified = evaluations.filter(({ evaluation }) => evaluation.category === "justified").length;
    const incidents = evaluations.filter(({ evaluation }) => INCIDENT_STATUSES.has(evaluation.status)).length;
    const absences = evaluations.filter(({ evaluation }) => evaluation.status === "falta").length;
    const pending = evaluations.filter(({ evaluation }) => evaluation.status === "pendiente").length;
    const agreements = evaluations.filter(({ evaluation }) => evaluation.status === "convenio").length;
    const vacations = evaluations.filter(({ evaluation }) => evaluation.status === "vacaciones").length;
    const capturedScheduled = evaluations.filter(({ record }) => Boolean(record.entryAt || record.exitAt || record.statusOverride !== "auto")).length;
    const capturedDue = dueScheduled.filter(({ record }) => Boolean(record.entryAt || record.exitAt || record.statusOverride !== "auto")).length;

    return {
      scheduled: scheduled.length,
      dueScheduled: dueScheduled.length,
      captured: list.length,
      capturedScheduled,
      capturedDue,
      effective,
      justified,
      incidents,
      absences,
      pending,
      agreements,
      vacations,
      captureRate: dueScheduled.length ? Math.min(100, Math.round((capturedDue / dueScheduled.length) * 100)) : 0,
      effectiveRate: scheduled.length ? Math.min(100, Math.round((effective / scheduled.length) * 100)) : 0
    };
  }

  function currentShiftDate(nowValue, settings) {
    const now = parseDateTime(nowValue) || new Date();
    const today = formatDateKey(now);
    const yesterday = formatDateKey(addDays(now, -1));
    const yesterdayWindow = shiftWindow(yesterday, settings);

    if (isScheduledDate(yesterday, settings) && yesterdayWindow.exitTolerance && now <= yesterdayWindow.exitTolerance) {
      return yesterday;
    }
    return today;
  }

  function upcomingScheduledDates(fromValue, count, settings) {
    const from = fromValue instanceof Date ? new Date(fromValue) : (parseDateKey(fromValue) || new Date());
    const output = [];
    const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);
    while (output.length < count) {
      if (isScheduledDate(cursor, settings)) output.push(formatDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
      if (output.length === 0 && cursor - from > 32 * 86400000) break;
    }
    return output;
  }

  function escapeCsv(value) {
    const safe = String(value == null ? "" : value).replace(/"/g, '""');
    return `"${safe}"`;
  }

  function recordsToCsv(records, settings, nowValue) {
    const config = normalizeSettings(settings);
    const headers = ["Fecha de guardia", "Día", "Entrada", "Salida", "Estado", "Notas", "Nombre", "Matrícula", "Unidad"];
    const rows = (Array.isArray(records) ? records : [])
      .slice()
      .sort((a, b) => a.shiftDate.localeCompare(b.shiftDate))
      .map((record) => {
        const date = parseDateKey(record.shiftDate);
        const evaluation = evaluateRecord(record, config, nowValue);
        const day = date ? new Intl.DateTimeFormat("es-MX", { weekday: "long" }).format(date) : "";
        return [
          record.shiftDate,
          day,
          record.entryAt || "",
          record.exitAt || "",
          evaluation.label,
          record.notes || "",
          config.name,
          config.employeeId,
          config.unit
        ].map(escapeCsv).join(",");
      });
    return `\uFEFF${headers.map(escapeCsv).join(",")}\r\n${rows.join("\r\n")}`;
  }

  return {
    DEFAULT_SETTINGS,
    STATUS_META,
    INCIDENT_STATUSES,
    addDays,
    calculateStats,
    currentShiftDate,
    datesInRange,
    dateTimeForShift,
    evaluateRecord,
    formatDateKey,
    getStatusMeta,
    isScheduledDate,
    mergeRecordsByShiftDate,
    normalizeSettings,
    parseTuPerfilImssText,
    parseDateKey,
    recordsInRange,
    recordsToCsv,
    scheduledEvaluations,
    scheduledDates,
    shiftWindow,
    toDateTimeLocal,
    toMinutes,
    upcomingScheduledDates
  };
}));
