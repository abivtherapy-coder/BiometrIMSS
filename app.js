(function startABITIMSS() {
  "use strict";

  const L = window.BiometrLogic;
  const R = window.BiometrReport;
  const APP_VERSION = "2.4.0";
  const STORAGE = {
    settings: "abitimss:v1:settings",
    records: "abitimss:v1:records",
    installDismissed: "abitimss:v1:install-dismissed"
  };
  const LEGACY_STORAGE = {
    settings: "biometrimss:v2:settings",
    records: "biometrimss:v2:records"
  };

  const $ = (id) => document.getElementById(id);
  const now = new Date();
  const initialMonth = new Date(now.getFullYear(), now.getMonth(), 1, 12);
  const state = {
    settings: loadSettings(),
    records: loadRecords(),
    view: "home",
    calendarMonth: initialMonth,
    selectedDate: L.formatDateKey(now),
    deferredInstallPrompt: null
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    $("appVersion").textContent = `v${APP_VERSION}`;
    setDefaultPeriods();
    populateSettingsForm();
    resetRecordForm(L.currentShiftDate(new Date(), state.settings));
    bindNavigation();
    bindHome();
    bindRecordForm();
    bindCalendar();
    bindHistory();
    bindSettings();
    bindInstall();
    renderAll();
    openHashView();
    registerServiceWorker();
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE.settings) || localStorage.getItem(LEGACY_STORAGE.settings) || "null");
      if (saved) return L.normalizeSettings(saved);
    } catch (error) {
      console.warn("No se pudieron leer los ajustes guardados.", error);
    }

    const migrated = L.normalizeSettings({
      name: localStorage.getItem("nombre") || "",
      employeeId: localStorage.getItem("matricula") || "",
      unit: localStorage.getItem("unidad") || ""
    });
    return migrated;
  }

  function loadRecords() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE.records) || localStorage.getItem(LEGACY_STORAGE.records) || "[]");
      if (!Array.isArray(saved)) return [];
      return saved.map(normalizeRecord).filter(Boolean);
    } catch (error) {
      console.warn("No se pudieron leer los registros guardados.", error);
      return [];
    }
  }

  function persistSettings() {
    localStorage.setItem(STORAGE.settings, JSON.stringify(state.settings));
  }

  function persistRecords() {
    state.records.sort((a, b) => b.shiftDate.localeCompare(a.shiftDate));
    localStorage.setItem(STORAGE.records, JSON.stringify(state.records));
  }

  function setDefaultPeriods() {
    const start = L.formatDateKey(new Date(now.getFullYear(), now.getMonth(), 1, 12));
    const end = L.formatDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0, 12));
    $("periodStart").value = start;
    $("periodEnd").value = end;
    $("historyStart").value = start;
    $("historyEnd").value = end;
  }

  function bindNavigation() {
    document.querySelectorAll("[data-go]").forEach((button) => {
      button.addEventListener("click", () => navigate(button.dataset.go));
    });
    window.addEventListener("hashchange", openHashView);
  }

  function navigate(view, options = {}) {
    const target = document.querySelector(`[data-view="${view}"]`);
    if (!target) return;
    state.view = view;
    document.querySelectorAll(".view").forEach((section) => section.classList.toggle("is-active", section === target));
    document.querySelectorAll(".nav-item").forEach((button) => {
      const active = button.dataset.go === view;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    if (location.hash !== `#${view}`) history.replaceState(null, "", `#${view}`);
    if (!options.keepScroll) window.scrollTo({ top: 0, behavior: "smooth" });
    if (view === "calendar") renderCalendar();
    if (view === "history") renderHistory();
    if (view === "home") renderHome();
    if (view === "settings") populateSettingsForm();
    $("mainContent").focus({ preventScroll: true });
  }

  function openHashView() {
    const view = location.hash.replace("#", "");
    if (["home", "register", "calendar", "history", "settings"].includes(view)) navigate(view, { keepScroll: true });
  }

  function bindHome() {
    $("periodStart").addEventListener("change", renderHome);
    $("periodEnd").addEventListener("change", renderHome);
    $("currentMonthButton").addEventListener("click", () => {
      setDefaultPeriods();
      renderHome();
    });
    $("quickEntry").addEventListener("click", () => quickCheck("entry"));
    $("quickExit").addEventListener("click", () => quickCheck("exit"));
  }

  function bindRecordForm() {
    ["shiftDate", "entryAt", "exitAt", "statusOverride"].forEach((id) => {
      $(id).addEventListener("input", () => {
        if (id === "shiftDate") updateScheduledHint();
        renderStatusPreview();
      });
    });
    $("recordNotes").addEventListener("input", updateNotesCount);
    $("setEntryNow").addEventListener("click", () => {
      $("entryAt").value = L.toDateTimeLocal(new Date());
      renderStatusPreview();
    });
    $("setExitNow").addEventListener("click", () => {
      $("exitAt").value = L.toDateTimeLocal(new Date());
      renderStatusPreview();
    });
    $("useSchedule").addEventListener("click", useScheduledTimes);
    $("cancelEdit").addEventListener("click", () => {
      resetRecordForm(L.currentShiftDate(new Date(), state.settings));
      showToast("Edición cancelada.");
    });
    $("recordForm").addEventListener("submit", saveRecordFromForm);
  }

  function bindCalendar() {
    $("calendarPrev").addEventListener("click", () => changeCalendarMonth(-1));
    $("calendarNext").addEventListener("click", () => changeCalendarMonth(1));
    $("calendarToday").addEventListener("click", () => {
      const today = new Date();
      state.calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1, 12);
      state.selectedDate = L.formatDateKey(today);
      renderCalendar();
    });
    $("calendarGrid").addEventListener("click", (event) => {
      const day = event.target.closest("[data-date]");
      if (!day) return;
      state.selectedDate = day.dataset.date;
      const parsed = L.parseDateKey(state.selectedDate);
      state.calendarMonth = new Date(parsed.getFullYear(), parsed.getMonth(), 1, 12);
      renderCalendar();
    });
    $("addSelectedDay").addEventListener("click", () => beginRecordForDate(state.selectedDate));
    $("selectedDayContent").addEventListener("click", handleRecordAction);
  }

  function bindHistory() {
    ["historyStart", "historyEnd", "historyStatus"].forEach((id) => $(id).addEventListener("change", renderHistory));
    $("historyList").addEventListener("click", handleRecordAction);
    $("exportImage").addEventListener("click", exportImage);
    $("exportPdf").addEventListener("click", exportPdf);
  }

  function bindSettings() {
    $("settingsForm").addEventListener("submit", saveSettingsFromForm);
    $("exportBackup").addEventListener("click", exportBackup);
    $("importBackup").addEventListener("change", importBackup);
    $("importTuPerfilPdf").addEventListener("change", importTuPerfilPdf);
  }

  function bindInstall() {
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      state.deferredInstallPrompt = event;
      $("installButton").hidden = false;
    });

    $("installButton").addEventListener("click", async () => {
      if (!state.deferredInstallPrompt) {
        showToast("En iPhone, abre Safari y toca Compartir → Agregar a inicio.");
        return;
      }
      state.deferredInstallPrompt.prompt();
      await state.deferredInstallPrompt.userChoice;
      state.deferredInstallPrompt = null;
      $("installButton").hidden = true;
    });

    $("dismissInstallCard").addEventListener("click", () => {
      localStorage.setItem(STORAGE.installDismissed, "1");
      $("iosInstallCard").hidden = true;
    });

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    const dismissed = localStorage.getItem(STORAGE.installDismissed) === "1";
    $("iosInstallCard").hidden = !(isIos && !isStandalone && !dismissed);
  }

  function renderAll() {
    renderHome();
    renderCalendar();
    renderHistory();
    renderStatusPreview();
    updateScheduledHint();
    updateNotesCount();
  }

  function renderHome() {
    const current = new Date();
    const hour = current.getHours();
    $("greetingText").textContent = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
    $("profileName").textContent = firstName(state.settings.name);
    $("todayLabel").textContent = capitalize(new Intl.DateTimeFormat("es-MX", {
      weekday: "long", day: "numeric", month: "long"
    }).format(current));

    const shiftDate = L.currentShiftDate(current, state.settings);
    const todayScheduled = L.isScheduledDate(shiftDate, state.settings);
    const todayRecord = state.records.find((record) => record.shiftDate === shiftDate);
    const badge = $("todayShiftBadge");
    badge.classList.toggle("is-shift", todayScheduled);
    badge.textContent = todayScheduled ? "Día de guardia" : "Día libre";

    if (todayRecord) {
      const evaluation = L.evaluateRecord(todayRecord, state.settings, current);
      $("nextShiftText").textContent = `${evaluation.label}: ${evaluation.reason}`;
    } else if (todayScheduled) {
      $("nextShiftText").textContent = `Tu guardia está programada de ${state.settings.startTime} a ${state.settings.exitTime} del día siguiente.`;
    } else {
      const next = L.upcomingScheduledDates(L.addDays(current, 1), 1, state.settings)[0];
      $("nextShiftText").textContent = next ? `Tu próxima guardia inicia ${formatFriendlyDate(next)} a las ${state.settings.startTime}.` : "No hay guardias programadas.";
    }

    const start = $("periodStart").value;
    const end = $("periodEnd").value;
    const validRange = L.parseDateKey(start) && L.parseDateKey(end) && start <= end;
    const stats = validRange ? L.calculateStats(state.records, start, end, state.settings, current) : L.calculateStats([], "", "", state.settings, current);
    $("statScheduled").textContent = stats.scheduled;
    $("statEffective").textContent = stats.effective;
    $("statJustified").textContent = stats.justified;
    $("statIncidents").textContent = stats.incidents + stats.absences;
    $("complianceValue").textContent = `${stats.captureRate}%`;
    $("complianceBar").style.width = `${stats.captureRate}%`;
    $("complianceBar").parentElement.setAttribute("aria-valuenow", String(stats.captureRate));
    $("complianceHelp").textContent = stats.scheduled
      ? stats.dueScheduled
        ? `${stats.capturedDue} de ${stats.dueScheduled} guardias ya concluidas tienen registro.`
        : "Todavía no concluye ninguna guardia de este periodo."
      : "No hay guardias programadas en este periodo.";
    renderUpcoming();
  }

  function renderUpcoming() {
    const dates = L.upcomingScheduledDates(new Date(), 3, state.settings);
    const container = $("upcomingList");
    if (!dates.length) {
      container.innerHTML = '<div class="empty-state compact-empty"><p>No hay guardias programadas.</p></div>';
      return;
    }
    container.innerHTML = dates.map((dateKey) => {
      const date = L.parseDateKey(dateKey);
      const record = state.records.find((item) => item.shiftDate === dateKey);
      const evaluation = record ? L.evaluateRecord(record, state.settings) : null;
      return `
        <div class="upcoming-item">
          <div class="date-tile"><strong>${date.getDate()}</strong><small>${shortMonth(date)}</small></div>
          <div class="upcoming-copy"><strong>${capitalize(weekday(date))}</strong><span>${state.settings.startTime} – ${state.settings.exitTime}</span></div>
          ${evaluation
            ? `<span class="record-status status-${evaluation.category} status-code-${evaluation.status}">${evaluation.label}</span>`
            : '<span class="mini-badge is-free">Por capturar</span>'}
        </div>`;
    }).join("");
  }

  function quickCheck(type) {
    const current = new Date();
    const shiftDate = L.currentShiftDate(current, state.settings);
    let record = state.records.find((item) => item.shiftDate === shiftDate);

    if (!record) {
      record = {
        id: createId(),
        shiftDate,
        entryAt: "",
        exitAt: "",
        statusOverride: "auto",
        notes: "",
        createdAt: new Date().toISOString()
      };
      state.records.push(record);
    }

    const field = type === "entry" ? "entryAt" : "exitAt";
    if (record[field]) {
      showToast(`${type === "entry" ? "La entrada" : "La salida"} de esta guardia ya estaba registrada.`, "error");
      return;
    }
    record[field] = L.toDateTimeLocal(current);
    record.updatedAt = new Date().toISOString();
    persistRecords();
    renderAll();
    showToast(`${type === "entry" ? "Entrada" : "Salida"} guardada a las ${formatTime(record[field])}.`);
  }

  async function saveRecordFromForm(event) {
    event.preventDefault();
    const shiftDate = $("shiftDate").value;
    if (!L.parseDateKey(shiftDate)) {
      showToast("Selecciona la fecha de la guardia.", "error");
      $("shiftDate").focus();
      return;
    }

    const draft = {
      id: $("recordId").value || createId(),
      shiftDate,
      entryAt: $("entryAt").value,
      exitAt: $("exitAt").value,
      statusOverride: $("statusOverride").value,
      notes: $("recordNotes").value.trim()
    };

    if (draft.entryAt && draft.exitAt && new Date(draft.exitAt) < new Date(draft.entryAt)) {
      showToast("La salida no puede ocurrir antes de la entrada.", "error");
      $("exitAt").focus();
      return;
    }

    if (!draft.entryAt && !draft.exitAt && draft.statusOverride === "auto") {
      const accepted = await askConfirmation(
        "¿Guardar sin checadas?",
        "Si la guardia ya concluyó, se mostrará como “Falta real”. Antes de que concluya quedará pendiente.",
        "Sí, registrar"
      );
      if (!accepted) return;
    }

    const duplicate = state.records.find((record) => record.shiftDate === draft.shiftDate && record.id !== draft.id);
    if (duplicate) {
      const accepted = await askConfirmation(
        "Ya existe esta guardia",
        "Sólo puede haber un registro por fecha. ¿Quieres reemplazar el registro existente?",
        "Reemplazar"
      );
      if (!accepted) return;
      state.records = state.records.filter((record) => record.id !== duplicate.id);
    }

    const index = state.records.findIndex((record) => record.id === draft.id);
    const previous = index >= 0 ? state.records[index] : {};
    const saved = {
      ...previous,
      ...draft,
      createdAt: previous.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (index >= 0) state.records[index] = saved;
    else state.records.push(saved);
    persistRecords();
    state.selectedDate = saved.shiftDate;
    resetRecordForm(L.currentShiftDate(new Date(), state.settings));
    renderAll();
    showToast(index >= 0 ? "Registro actualizado correctamente." : "Guardia guardada correctamente.");
    navigate("calendar");
  }

  function useScheduledTimes() {
    const shiftDate = $("shiftDate").value;
    if (!L.parseDateKey(shiftDate)) {
      showToast("Primero selecciona la fecha de la guardia.", "error");
      return;
    }
    const window = L.shiftWindow(shiftDate, state.settings);
    $("entryAt").value = L.toDateTimeLocal(window.start);
    $("exitAt").value = L.toDateTimeLocal(window.exit);
    renderStatusPreview();
  }

  function formRecord() {
    return {
      shiftDate: $("shiftDate").value,
      entryAt: $("entryAt").value,
      exitAt: $("exitAt").value,
      statusOverride: $("statusOverride").value,
      notes: $("recordNotes").value
    };
  }

  function renderStatusPreview() {
    const draft = formRecord();
    const evaluation = !draft.entryAt && !draft.exitAt && draft.statusOverride === "auto"
      ? { status: "pendiente", ...L.STATUS_META.pendiente, reason: "Agrega las checadas o selecciona un estado manual." }
      : L.evaluateRecord(draft, state.settings);
    const preview = $("autoStatusPreview");
    preview.className = `status-preview status-${evaluation.category} status-code-${evaluation.status}`;
    preview.querySelector("strong").textContent = evaluation.label;
    preview.querySelector("small").textContent = evaluation.reason;
  }

  function updateScheduledHint() {
    const scheduled = L.isScheduledDate($("shiftDate").value, state.settings);
    $("scheduledHint").textContent = scheduled ? "Guardia programada" : "Día no programado";
    $("scheduledHint").classList.toggle("is-free", !scheduled);
  }

  function updateNotesCount() {
    $("notesCount").textContent = $("recordNotes").value.length;
  }

  function resetRecordForm(date) {
    $("recordForm").reset();
    $("recordId").value = "";
    $("shiftDate").value = date || L.formatDateKey(new Date());
    $("statusOverride").value = "auto";
    $("saveRecordLabel").textContent = "Guardar registro";
    $("cancelEdit").hidden = true;
    updateScheduledHint();
    updateNotesCount();
    renderStatusPreview();
  }

  function beginRecordForDate(date) {
    const existing = state.records.find((record) => record.shiftDate === date);
    if (existing) editRecord(existing.id);
    else {
      resetRecordForm(date);
      navigate("register");
    }
  }

  function editRecord(id) {
    const record = state.records.find((item) => item.id === id);
    if (!record) return;
    $("recordId").value = record.id;
    $("shiftDate").value = record.shiftDate;
    $("entryAt").value = record.entryAt || "";
    $("exitAt").value = record.exitAt || "";
    $("statusOverride").value = record.statusOverride || "auto";
    $("recordNotes").value = record.notes || "";
    $("saveRecordLabel").textContent = "Actualizar registro";
    $("cancelEdit").hidden = false;
    updateScheduledHint();
    updateNotesCount();
    renderStatusPreview();
    navigate("register");
  }

  async function deleteRecord(id) {
    const record = state.records.find((item) => item.id === id);
    if (!record) return;
    const accepted = await askConfirmation(
      "Eliminar registro",
      `Se eliminará la guardia del ${formatFriendlyDate(record.shiftDate)}. Esta acción no se puede deshacer.`,
      "Eliminar"
    );
    if (!accepted) return;
    state.records = state.records.filter((item) => item.id !== id);
    persistRecords();
    renderAll();
    showToast("Registro eliminado.");
  }

  function handleRecordAction(event) {
    const edit = event.target.closest("[data-edit]");
    const remove = event.target.closest("[data-delete]");
    if (edit) editRecord(edit.dataset.edit);
    if (remove) deleteRecord(remove.dataset.delete);
  }

  function changeCalendarMonth(amount) {
    state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() + amount, 1, 12);
    state.selectedDate = L.formatDateKey(state.calendarMonth);
    renderCalendar();
  }

  function renderCalendar() {
    const month = state.calendarMonth;
    $("calendarMonthLabel").textContent = capitalize(new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(month));
    const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay(), 12);
    const today = L.formatDateKey(new Date());
    const cells = [];

    for (let index = 0; index < 42; index += 1) {
      const date = L.addDays(gridStart, index);
      const key = L.formatDateKey(date);
      const record = state.records.find((item) => item.shiftDate === key);
      const evaluation = record ? L.evaluateRecord(record, state.settings) : null;
      const scheduled = L.isScheduledDate(key, state.settings);
      const classes = ["calendar-day"];
      if (date.getMonth() !== month.getMonth()) classes.push("is-outside");
      if (key === today) classes.push("is-today");
      if (key === state.selectedDate) classes.push("is-selected");
      if (evaluation) classes.push(`has-${evaluation.category}`, `has-status-${evaluation.status}`);
      else if (scheduled) classes.push("is-scheduled");
      const label = `${formatFriendlyDate(key)}${evaluation ? `, ${evaluation.label}` : scheduled ? ", guardia programada" : ""}`;
      cells.push(`<button class="${classes.join(" ")}" type="button" data-date="${key}" aria-label="${escapeHtml(label)}"><span>${date.getDate()}</span>${scheduled ? '<i class="guard-dot"></i>' : ""}</button>`);
    }
    $("calendarGrid").innerHTML = cells.join("");
    renderSelectedDay();
  }

  function renderSelectedDay() {
    const date = L.parseDateKey(state.selectedDate);
    if (!date) return;
    $("selectedDayTitle").textContent = capitalize(new Intl.DateTimeFormat("es-MX", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    }).format(date));
    const record = state.records.find((item) => item.shiftDate === state.selectedDate);
    $("addSelectedDay").hidden = Boolean(record);
    if (!record) {
      const scheduled = L.isScheduledDate(state.selectedDate, state.settings);
      $("selectedDayContent").innerHTML = `<div class="empty-state compact-empty"><p>${scheduled ? "Guardia programada todavía sin captura." : "No hay un registro en esta fecha."}</p></div>`;
      return;
    }
    $("selectedDayContent").innerHTML = recordCard(record, true);
  }

  function renderHistory() {
    const start = $("historyStart").value;
    const end = $("historyEnd").value;
    const filter = $("historyStatus").value;
    let records = state.records.filter((record) => (!start || record.shiftDate >= start) && (!end || record.shiftDate <= end));
    records = records.filter((record) => {
      const evaluation = L.evaluateRecord(record, state.settings);
      if (filter === "all") return true;
      if (filter === "incident") return evaluation.category === "incident";
      return evaluation.status === filter;
    }).sort((a, b) => b.shiftDate.localeCompare(a.shiftDate));

    $("historyCount").textContent = `${records.length} ${records.length === 1 ? "registro" : "registros"}`;
    $("exportImage").disabled = records.length === 0;
    $("exportPdf").disabled = records.length === 0 || !window.PDFLib;
    if (!records.length) {
      $("historyList").innerHTML = `
        <div class="card empty-state">
          <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
          <p>No hay registros que coincidan con estos filtros.</p>
        </div>`;
      return;
    }
    $("historyList").innerHTML = records.map((record) => historyCard(record)).join("");
  }

  function recordCard(record, showDate) {
    const evaluation = L.evaluateRecord(record, state.settings);
    return `
      <article class="day-record">
        <div class="record-main">
          <strong>${showDate ? "Registro de guardia" : escapeHtml(formatFriendlyDate(record.shiftDate))}</strong>
          <span class="record-status status-${evaluation.category} status-code-${evaluation.status}">${evaluation.label}</span>
        </div>
        ${recordTimes(record)}
        ${record.notes ? `<p class="record-note">${escapeHtml(record.notes)}</p>` : ""}
        <div class="record-actions">
          <button class="button button-secondary" type="button" data-edit="${record.id}">Editar</button>
          <button class="button button-secondary delete-record" type="button" data-delete="${record.id}">Eliminar</button>
        </div>
      </article>`;
  }

  function historyCard(record) {
    const date = L.parseDateKey(record.shiftDate);
    const evaluation = L.evaluateRecord(record, state.settings);
    return `
      <article class="history-record">
        <div class="history-date"><strong>${date.getDate()}</strong><span>${shortMonth(date)}</span></div>
        <div class="history-record-body">
          <div class="record-main">
            <strong>${capitalize(weekday(date))}</strong>
            <span class="record-status status-${evaluation.category} status-code-${evaluation.status}">${evaluation.label}</span>
          </div>
          ${recordTimes(record)}
          ${record.notes ? `<p class="record-note">${escapeHtml(record.notes)}</p>` : ""}
          <div class="record-actions">
            <button class="button button-secondary" type="button" data-edit="${record.id}">Editar</button>
            <button class="button button-secondary delete-record" type="button" data-delete="${record.id}">Eliminar</button>
          </div>
        </div>
      </article>`;
  }

  function recordTimes(record) {
    return `
      <div class="record-time-row">
        <span><svg viewBox="0 0 24 24"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/></svg>Entrada: <strong>${record.entryAt ? formatTime(record.entryAt) : "—"}</strong></span>
        <span><svg viewBox="0 0 24 24"><path d="M12 21V9m0 0 4 4m-4-4-4 4M5 4h14"/></svg>Salida: <strong>${record.exitAt ? formatTime(record.exitAt) : "—"}</strong></span>
      </div>`;
  }

  function populateSettingsForm() {
    $("settingName").value = state.settings.name || "";
    $("settingEmployeeId").value = state.settings.employeeId || "";
    $("settingUnit").value = state.settings.unit || "";
    $("settingStartTime").value = state.settings.startTime;
    $("settingEntryTolerance").value = state.settings.entryTolerance;
    $("settingExitTime").value = state.settings.exitTime;
    $("settingExitTolerance").value = state.settings.exitTolerance;
    document.querySelectorAll('input[name="guardDay"]').forEach((input) => {
      input.checked = state.settings.guardDays.includes(Number(input.value));
    });
  }

  function saveSettingsFromForm(event) {
    event.preventDefault();
    const guardDays = [...document.querySelectorAll('input[name="guardDay"]:checked')].map((input) => Number(input.value));
    if (!guardDays.length) {
      showToast("Selecciona por lo menos un día de guardia.", "error");
      return;
    }
    const startTime = $("settingStartTime").value;
    const entryTolerance = $("settingEntryTolerance").value;
    const exitTime = $("settingExitTime").value;
    const exitTolerance = $("settingExitTolerance").value;
    if ([startTime, entryTolerance, exitTime, exitTolerance].some((time) => Number.isNaN(L.toMinutes(time)))) {
      showToast("Completa correctamente todos los horarios.", "error");
      return;
    }
    if (L.toMinutes(entryTolerance) < L.toMinutes(startTime)) {
      showToast("El límite de entrada debe ser posterior a la hora de entrada.", "error");
      return;
    }
    if (L.toMinutes(exitTolerance) < L.toMinutes(exitTime)) {
      showToast("El límite de salida debe ser posterior a la hora de salida.", "error");
      return;
    }

    state.settings = L.normalizeSettings({
      name: $("settingName").value.trim(),
      employeeId: $("settingEmployeeId").value.trim(),
      unit: $("settingUnit").value.trim(),
      startTime,
      entryTolerance,
      exitTime,
      exitTolerance,
      guardDays
    });
    persistSettings();
    renderAll();
    showToast("Ajustes guardados correctamente.");
    navigate("home");
  }

  async function exportImage() {
    const start = $("historyStart").value;
    const end = $("historyEnd").value;
    const records = L.recordsInRange(state.records, start, end);
    if (!records.length) return;
    const button = $("exportImage");
    const originalLabel = button.innerHTML;
    button.disabled = true;
    button.textContent = "Generando imagen…";
    try {
      const canvas = await R.renderReport(records, state.settings, start, end, L);
      const blob = await R.canvasToBlob(canvas);
      downloadBlob(`ABITIMSS_9x16_${start}_${end}.png`, blob);
      showToast("Informe descargado como imagen.");
    } catch (error) {
      console.error(error);
      showToast("No se pudo generar la imagen. Inténtalo nuevamente.", "error");
    } finally {
      button.innerHTML = originalLabel;
      button.disabled = records.length === 0;
    }
  }

  function exportBackup() {
    const backup = {
      app: "ABITIMSS",
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      records: state.records
    };
    downloadFile(`ABITIMSS_respaldo_${L.formatDateKey(new Date())}.json`, JSON.stringify(backup, null, 2), "application/json");
    showToast("Respaldo descargado.");
  }

  async function importBackup(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || !["ABITIMSS", "BiometrIMSS"].includes(data.app) || !Array.isArray(data.records) || !data.settings) throw new Error("Formato inválido");
      const validRecords = data.records.map(normalizeRecord).filter(Boolean);
      const mergeMode = data.importMode === "merge";
      const accepted = await askConfirmation(
        mergeMode ? "Importar checadas" : "Restaurar respaldo",
        mergeMode
          ? `Se integrarán ${validRecords.length} guardias sin borrar ni duplicar tus registros actuales.`
          : `Se reemplazarán los datos actuales por ${validRecords.length} registros del respaldo.`,
        mergeMode ? "Importar" : "Restaurar"
      );
      if (!accepted) return;
      if (mergeMode) {
        const result = L.mergeRecordsByShiftDate(state.records, validRecords);
        state.records = result.records;
        state.settings = L.normalizeSettings({
          ...state.settings,
          name: state.settings.name || data.settings.name || "",
          employeeId: state.settings.employeeId || data.settings.employeeId || "",
          unit: state.settings.unit || data.settings.unit || ""
        });
        persistSettings();
        persistRecords();
        populateSettingsForm();
        renderAll();
        showToast(`${result.added} guardias agregadas, ${result.updated} completadas y ${result.skipped} ya existentes.`);
        return;
      }
      state.settings = L.normalizeSettings(data.settings);
      state.records = validRecords;
      persistSettings();
      persistRecords();
      populateSettingsForm();
      renderAll();
      showToast("Respaldo restaurado correctamente.");
    } catch (error) {
      console.error(error);
      showToast("Ese archivo no es un respaldo válido de ABITIMSS.", "error");
    }
  }

  async function exportPdf() {
    const start = $("historyStart").value;
    const end = $("historyEnd").value;
    const records = L.recordsInRange(state.records, start, end);
    if (!records.length || !window.PDFLib) return;
    const button = $("exportPdf");
    const originalLabel = button.innerHTML;
    button.disabled = true;
    button.textContent = "Generando PDF…";
    try {
      const canvas = await R.renderReport(records, state.settings, start, end, L);
      const imageBytes = await (await R.canvasToBlob(canvas)).arrayBuffer();
      const pdf = await window.PDFLib.PDFDocument.create();
      const image = await pdf.embedPng(imageBytes);
      const page = pdf.addPage([canvas.width, canvas.height]);
      page.drawImage(image, { x: 0, y: 0, width: canvas.width, height: canvas.height });
      pdf.setTitle(`Informe de guardias ${start} a ${end}`);
      pdf.setAuthor(state.settings.name || "ABITIMSS");
      pdf.setSubject("Documento digital de consulta personal");
      pdf.setCreator("ABITIMSS");
      const bytes = await pdf.save();
      downloadBlob(`Informe_guardias_${start}_${end}.pdf`, new Blob([bytes], { type: "application/pdf" }));
      showToast("Documento PDF descargado correctamente.");
    } catch (error) {
      console.error(error);
      showToast("No se pudo generar el documento PDF. Inténtalo nuevamente.", "error");
    } finally {
      button.innerHTML = originalLabel;
      button.disabled = records.length === 0 || !window.PDFLib;
    }
  }

  async function importTuPerfilPdf(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      showToast("Selecciona un archivo PDF de TuPerfilIMSS.", "error");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      showToast("El PDF supera el límite de 15 MB. Usa un archivo más pequeño.", "error");
      return;
    }
    try {
      const pdfjs = await import("./vendor/pdfjs/pdf.min.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "./vendor/pdfjs/pdf.worker.min.mjs";
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfjs.getDocument({ data: bytes }).promise;
      let extractedText = "";
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        extractedText += `${content.items.map((item) => item.str).join(" ")}\n`;
      }
      const importedRecords = L.parseTuPerfilImssText(extractedText, state.settings);
      const preview = L.mergeRecordsByShiftDate(state.records, importedRecords);
      const accepted = await askConfirmation(
        "Importar checadas de TuPerfilIMSS",
        `Se detectaron ${importedRecords.length} guardias en ${file.name}. Se agregarán ${preview.added}, se completarán ${preview.updated} y se conservarán ${preview.skipped} registros sin cambios.`,
        "Importar checadas"
      );
      if (!accepted) return;
      state.records = preview.records;
      persistRecords();
      renderAll();
      showToast(`Importación terminada: ${preview.added} agregadas, ${preview.updated} completadas y ${preview.skipped} sin cambios.`);
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo leer el PDF de TuPerfilIMSS.", "error");
    }
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    downloadBlob(filename, blob);
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function askConfirmation(title, message, confirmLabel) {
    const dialog = $("confirmDialog");
    if (!dialog || typeof dialog.showModal !== "function") return Promise.resolve(window.confirm(message));
    $("confirmTitle").textContent = title;
    $("confirmMessage").textContent = message;
    $("confirmAction").textContent = confirmLabel;
    return new Promise((resolve) => {
      const close = () => {
        dialog.removeEventListener("close", close);
        resolve(dialog.returnValue === "confirm");
      };
      dialog.addEventListener("close", close);
      dialog.showModal();
    });
  }

  function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast${type === "error" ? " is-error" : ""}`;
    toast.textContent = message;
    $("toastRegion").appendChild(toast);
    setTimeout(() => toast.remove(), 3400);
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.warn("No se pudo activar el modo sin conexión.", error);
    }));
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return `record-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeRecord(record) {
    if (!record || !L.parseDateKey(record.shiftDate)) return null;
    const overrides = new Set(["auto", ...Object.keys(L.STATUS_META)]);
    const safeId = /^[a-zA-Z0-9_-]{1,100}$/.test(String(record.id || "")) ? String(record.id) : createId();
    const normalizeDateTime = (value) => {
      if (!value) return "";
      const date = new Date(String(value));
      return Number.isNaN(date.getTime()) ? "" : L.toDateTimeLocal(date);
    };
    return {
      id: safeId,
      shiftDate: record.shiftDate,
      entryAt: normalizeDateTime(record.entryAt),
      exitAt: normalizeDateTime(record.exitAt),
      statusOverride: overrides.has(record.statusOverride) ? record.statusOverride : "auto",
      notes: String(record.notes || "").slice(0, 700),
      createdAt: record.createdAt || new Date().toISOString(),
      updatedAt: record.updatedAt || record.createdAt || new Date().toISOString()
    };
  }

  function firstName(name) {
    return String(name || "").trim().split(/\s+/)[0] || "";
  }

  function capitalize(value) {
    const text = String(value || "");
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
  }

  function weekday(date) {
    return new Intl.DateTimeFormat("es-MX", { weekday: "long" }).format(date);
  }

  function shortMonth(date) {
    return new Intl.DateTimeFormat("es-MX", { month: "short" }).format(date).replace(".", "");
  }

  function formatFriendlyDate(dateKey) {
    const date = L.parseDateKey(dateKey);
    return date ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" }).format(date) : dateKey;
  }

  function formatTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}());
