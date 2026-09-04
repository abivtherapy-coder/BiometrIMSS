(function startBiometrIMSS() {
  "use strict";

  const L = window.BiometrLogic;
  const R = window.BiometrReport;
  const APP_VERSION = "2.6.0";
  const STORAGE = {
    settings: "biometrimss:v2:settings",
    records: "biometrimss:v2:records",
    recordDraft: "biometrimss:v2:record-draft",
    settingsDraft: "biometrimss:v2:settings-draft",
    installDismissed: "biometrimss:v2:install-dismissed"
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
    restoreAutoSavedDrafts();
    bindNavigation();
    bindHome();
    bindRecordForm();
    bindCalendar();
    bindHistory();
    bindSettings();
    bindInstall();
    bindAssistant();
    window.addEventListener("pagehide", saveAutoSavedDrafts);
    renderAll();
    openHashView();
    registerServiceWorker();
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE.settings) || "null");
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
      const saved = JSON.parse(localStorage.getItem(STORAGE.records) || "[]");
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

  function saveAutoSavedDrafts() {
    saveRecordDraft();
    saveSettingsDraft();
  }

  function saveRecordDraft() {
    const draft = {
      id: $("recordId").value,
      shiftDate: $("shiftDate").value,
      entryAt: $("entryAt").value,
      exitAt: $("exitAt").value,
      statusOverride: $("statusOverride").value,
      notes: $("recordNotes").value
    };
    const hasChanges = Boolean(draft.id || draft.entryAt || draft.exitAt || draft.notes || draft.statusOverride !== "auto");
    if (hasChanges) localStorage.setItem(STORAGE.recordDraft, JSON.stringify(draft));
    else localStorage.removeItem(STORAGE.recordDraft);
  }

  function saveSettingsDraft() {
    const draft = {
      name: $("settingName").value,
      employeeId: $("settingEmployeeId").value,
      unit: $("settingUnit").value,
      startTime: $("settingStartTime").value,
      entryTolerance: $("settingEntryTolerance").value,
      exitTime: $("settingExitTime").value,
      exitTolerance: $("settingExitTolerance").value,
      guardDays: [...document.querySelectorAll('input[name="guardDay"]:checked')].map((input) => input.value),
      vacationPeriods: state.settings.vacationPeriods
    };
    localStorage.setItem(STORAGE.settingsDraft, JSON.stringify(draft));
  }

  function restoreAutoSavedDrafts() {
    try {
      const recordDraft = JSON.parse(localStorage.getItem(STORAGE.recordDraft) || "null");
      if (recordDraft) {
        $("recordId").value = recordDraft.id || "";
        $("shiftDate").value = recordDraft.shiftDate || $("shiftDate").value;
        $("entryAt").value = recordDraft.entryAt || "";
        $("exitAt").value = recordDraft.exitAt || "";
        $("statusOverride").value = recordDraft.statusOverride || "auto";
        $("recordNotes").value = recordDraft.notes || "";
        updateScheduledHint();
        updateNotesCount();
        renderStatusPreview();
        showToast("Recuperamos tu registro que estaba en borrador.");
      }
      const settingsDraft = JSON.parse(localStorage.getItem(STORAGE.settingsDraft) || "null");
      if (settingsDraft) {
        $("settingName").value = settingsDraft.name || "";
        $("settingEmployeeId").value = settingsDraft.employeeId || "";
        $("settingUnit").value = settingsDraft.unit || "";
        ["startTime", "entryTolerance", "exitTime", "exitTolerance"].forEach((field) => {
          if (settingsDraft[field]) $("setting" + field.charAt(0).toUpperCase() + field.slice(1)).value = settingsDraft[field];
        });
        if (Array.isArray(settingsDraft.guardDays)) {
          document.querySelectorAll('input[name="guardDay"]').forEach((input) => {
            input.checked = settingsDraft.guardDays.includes(input.value);
          });
        }
        if (Array.isArray(settingsDraft.vacationPeriods)) {
          state.settings = L.normalizeSettings({ ...state.settings, vacationPeriods: settingsDraft.vacationPeriods });
          renderVacationPeriods();
        }
      }
    } catch (error) {
      console.warn("No se pudieron recuperar los borradores automáticos.", error);
    }
  }

  function clearRecordDraft() { localStorage.removeItem(STORAGE.recordDraft); }
  function clearSettingsDraft() { localStorage.removeItem(STORAGE.settingsDraft); }

  function bindAssistant() {
    const dialog = $("assistantProviderDialog");
    const chooseButton = $("assistantChooseProvider");
    if (!dialog || !chooseButton) return;

    const providerTitle = $("assistantProviderTitle");
    const providerDescription = $("assistantProviderDescription");
    const defaultTitle = providerTitle.textContent;
    const defaultDescription = providerDescription.textContent;
    const chooseProvider = (topic) => {
      if (topic) {
        providerTitle.textContent = `¿Quién te responde sobre ${topic}?`;
        providerDescription.textContent = `Elige dónde abrir tu consulta de ${topic}. BiometrIMSS no comparte tus guardias ni tus registros.`;
      } else {
        providerTitle.textContent = defaultTitle;
        providerDescription.textContent = defaultDescription;
      }
      if (typeof dialog.showModal === "function") dialog.showModal();
      else showToast("Abre esta app en un navegador actualizado para elegir tu asistente externo.", "error");
    };

    chooseButton.addEventListener("click", () => chooseProvider());
    document.querySelectorAll("[data-assistant-topic]").forEach((button) => {
      button.addEventListener("click", () => chooseProvider(button.dataset.assistantTopic));
    });

    dialog.querySelectorAll("[data-provider-url]").forEach((button) => {
      button.addEventListener("click", () => openExternalAssistant(button.dataset.providerUrl, button.dataset.providerName));
    });

    $("assistantCustomLaunch").addEventListener("click", () => {
      const input = $("assistantExternalUrl");
      openExternalAssistant(input.value, "tu aplicación externa");
    });

    function openExternalAssistant(rawUrl, providerName) {
      let url;
      try {
        url = new URL(String(rawUrl || "").trim());
        if (!/^https?:$/.test(url.protocol)) throw new Error("invalid protocol");
      } catch {
        showToast("Escribe una dirección válida que empiece con https://", "error");
        return;
      }
      dialog.close();
      window.open(url.href, "_blank", "noopener,noreferrer");
      showToast(`Abriendo conversación en ${providerName}. Tú decides qué información compartir.`);
    }
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
    if (view === "report") renderDigitalReport();
    if (view === "home") renderHome();
    if (view === "settings") populateSettingsForm();
    $("mainContent").focus({ preventScroll: true });
  }

  function openHashView() {
    const view = location.hash.replace("#", "");
    if (["home", "register", "calendar", "history", "report", "settings", "manual", "assistant"].includes(view)) navigate(view, { keepScroll: true });
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
        saveRecordDraft();
      });
    });
    $("recordNotes").addEventListener("input", () => {
      updateNotesCount();
      saveRecordDraft();
    });
    $("setEntryNow").addEventListener("click", () => {
      $("entryAt").value = L.toDateTimeLocal(new Date());
      renderStatusPreview();
      saveRecordDraft();
    });
    $("setExitNow").addEventListener("click", () => {
      $("exitAt").value = L.toDateTimeLocal(new Date());
      renderStatusPreview();
      saveRecordDraft();
    });
    $("useSchedule").addEventListener("click", useScheduledTimes);
    $("cancelEdit").addEventListener("click", () => {
      clearRecordDraft();
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
    $("openDigitalReport").addEventListener("click", () => navigate("report"));
    $("exportPdf").addEventListener("click", exportPdf);
    $("downloadDigitalPdf").addEventListener("click", exportPdf);
    $("printDigitalReport").addEventListener("click", () => window.print());
  }

  function bindSettings() {
    $("settingsForm").addEventListener("submit", saveSettingsFromForm);
    $("settingsForm").querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", saveSettingsDraft);
      input.addEventListener("change", saveSettingsDraft);
    });
    $("exportBackup").addEventListener("click", exportBackup);
    $("importBackup").addEventListener("change", importBackup);
    $("chooseTuPerfilPdf").addEventListener("click", () => $("importTuPerfilPdf").click());
    $("importTuPerfilPdf").addEventListener("change", importTuPerfilPdf);
    $("addVacationPeriod").addEventListener("click", addVacationPeriod);
    $("vacationPeriodsList").addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-vacation]");
      if (button) removeVacationPeriod(button.dataset.removeVacation);
    });
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
    const todayVacation = L.vacationPeriodForDate(shiftDate, state.settings);
    const todayRecord = state.records.find((record) => record.shiftDate === shiftDate);
    const badge = $("todayShiftBadge");
    badge.classList.toggle("is-shift", todayScheduled && !todayVacation);
    badge.textContent = todayVacation ? "Vacaciones" : todayScheduled ? "Día de guardia" : "Día libre";

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
      const vacation = L.vacationPeriodForDate(dateKey, state.settings);
      const evaluation = record ? L.evaluateRecord(record, state.settings) : vacation ? L.manualEvaluation("vacaciones") : null;
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
    clearRecordDraft();
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

    if (requiresJustificationNote(draft.statusOverride) && !draft.notes) {
      showToast("Escribe una nota para registrar esta justificación.", "error");
      $("recordNotes").focus();
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
    clearRecordDraft();
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
    saveRecordDraft();
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
    updateNotesRequirement(draft.statusOverride);
  }

  function updateScheduledHint() {
    const scheduled = L.isScheduledDate($("shiftDate").value, state.settings);
    $("scheduledHint").textContent = scheduled ? "Guardia programada" : "Día no programado";
    $("scheduledHint").classList.toggle("is-free", !scheduled);
  }

  function updateNotesCount() {
    $("notesCount").textContent = $("recordNotes").value.length;
  }

  function requiresJustificationNote(status) {
    return ["justificada", "incapacidad", "permiso", "convenio", "vacaciones", "festivo"].includes(status);
  }

  function updateNotesRequirement(status) {
    const required = requiresJustificationNote(status);
    $("notesRequirement").hidden = !required;
    $("recordNotes").required = required;
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
      const vacation = L.vacationPeriodForDate(state.selectedDate, state.settings);
      $("selectedDayContent").innerHTML = `<div class="empty-state compact-empty"><p>${vacation ? `Vacaciones programadas${vacation.notes ? ` · ${escapeHtml(vacation.notes)}` : ""}.` : scheduled ? "Guardia programada todavía sin captura." : "No hay un registro en esta fecha."}</p></div>`;
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
    const hasReportRows = getReportModel().rows.length > 0;
    $("openDigitalReport").disabled = !hasReportRows;
    $("exportPdf").disabled = !hasReportRows || !window.PDFLib;
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
    renderVacationPeriods();
  }

  function renderVacationPeriods() {
    const container = $("vacationPeriodsList");
    if (!container) return;
    const periods = state.settings.vacationPeriods || [];
    if (!periods.length) {
      container.innerHTML = '<p class="field-note">Todavía no hay periodos vacacionales programados.</p>';
      return;
    }
    container.innerHTML = periods.map((period) => `
      <article class="vacation-period-item">
        <div><strong>${escapeHtml(formatFriendlyDate(period.start))} — ${escapeHtml(formatFriendlyDate(period.end))}</strong>${period.notes ? `<small>${escapeHtml(period.notes)}</small>` : ""}</div>
        <button class="text-button vacation-remove" type="button" data-remove-vacation="${escapeHtml(period.id)}">Eliminar</button>
      </article>`).join("");
  }

  function addVacationPeriod() {
    const start = $("vacationStart").value;
    const end = $("vacationEnd").value;
    if (!L.parseDateKey(start) || !L.parseDateKey(end)) {
      showToast("Selecciona las fechas de inicio y fin de las vacaciones.", "error");
      return;
    }
    if (start > end) {
      showToast("La fecha final no puede ser anterior a la fecha inicial.", "error");
      return;
    }
    const overlaps = (state.settings.vacationPeriods || []).some((period) => start <= period.end && end >= period.start);
    if (overlaps) {
      showToast("Este periodo se cruza con otras vacaciones ya programadas.", "error");
      return;
    }
    const period = { id: createId(), start, end, notes: $("vacationNotes").value.trim() };
    state.settings = L.normalizeSettings({ ...state.settings, vacationPeriods: [...state.settings.vacationPeriods, period] });
    persistSettings();
    $("vacationStart").value = "";
    $("vacationEnd").value = "";
    $("vacationNotes").value = "";
    renderVacationPeriods();
    renderAll();
    showToast("Periodo vacacional agregado.");
  }

  async function removeVacationPeriod(id) {
    const period = (state.settings.vacationPeriods || []).find((item) => item.id === id);
    if (!period) return;
    const accepted = await askConfirmation("Eliminar periodo vacacional", `Se eliminarán las vacaciones del ${formatFriendlyDate(period.start)} al ${formatFriendlyDate(period.end)}.`, "Eliminar");
    if (!accepted) return;
    state.settings = L.normalizeSettings({ ...state.settings, vacationPeriods: state.settings.vacationPeriods.filter((item) => item.id !== id) });
    persistSettings();
    renderVacationPeriods();
    renderAll();
    showToast("Periodo vacacional eliminado.");
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
      guardDays,
      vacationPeriods: state.settings.vacationPeriods
    });
    persistSettings();
    clearSettingsDraft();
    renderAll();
    showToast("Ajustes guardados correctamente.");
    navigate("home");
  }

  function exportBackup() {
    const backup = {
      app: "BiometrIMSS",
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      records: state.records
    };
    downloadFile(`BiometrIMSS_respaldo_${L.formatDateKey(new Date())}.json`, JSON.stringify(backup, null, 2), "application/json");
    showToast("Respaldo descargado.");
  }

  async function importBackup(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || data.app !== "BiometrIMSS" || !Array.isArray(data.records) || !data.settings) throw new Error("Formato inválido");
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
      showToast("Ese archivo no es una importación válida de BiometrIMSS.", "error");
    }
  }

  function getReportModel() {
    return R.buildReportModel(state.records, state.settings, $("historyStart").value, $("historyEnd").value, L);
  }

  function renderDigitalReport() {
    const model = getReportModel();
    const summary = model.summary;
    const total = model.rows.length;
    const effective = summary.efectiva || 0;
    const justified = (summary.justificada || 0) + (summary.incapacidad || 0) + (summary.permiso || 0) + (summary.convenio || 0) + (summary.vacaciones || 0) + (summary.festivo || 0);
    const absences = summary.falta || 0;
    const pending = summary.pendiente || 0;
    const incidents = model.incidentCount;
    $("digitalReportContent").innerHTML = `
      <header class="digital-report-header">
        <div><p class="eyebrow">BiometrIMSS · documento digital</p><h2>Informe de guardias</h2></div>
        <span>Generado ${escapeHtml(new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date()))}</span>
        <div class="digital-report-hero-avatar" aria-hidden="true"></div>
      </header>
      <section class="digital-report-profile">
        <div><span>Personal</span><strong>${escapeHtml(model.profile.name)}</strong></div>
        <div><span>Matrícula</span><strong>${escapeHtml(model.profile.employeeId)}</strong></div>
        <div><span>Unidad</span><strong>${escapeHtml(model.profile.unit)}</strong></div>
        <div><span>Periodo</span><strong>${escapeHtml(model.period)}</strong></div>
      </section>
      <section class="digital-report-summary" aria-label="Resumen del periodo">
        <div><span>Guardias</span><strong>${total}</strong></div>
        <div><span>Efectivas</span><strong>${effective}</strong></div>
        <div><span>Justificadas</span><strong>${justified}</strong></div>
        <div class="report-total-absence"><span>Faltas reales</span><strong>${absences}</strong></div>
        <div><span>Pendientes</span><strong>${pending}</strong></div>
        <div><span>Incidencias</span><strong>${incidents}</strong></div>
      </section>
      <section class="digital-report-details">
        <h3>Detalle de guardias</h3>
        <div class="digital-report-table-wrap"><table><thead><tr><th>Guardia</th><th>Entrada</th><th>Salida</th><th>Estatus</th><th>Detalle</th></tr></thead><tbody>
          ${model.rows.length ? model.rows.map((row) => `<tr><td>${escapeHtml(row.date)}</td><td>${escapeHtml(row.entry)}</td><td>${escapeHtml(`${row.exitDate} · ${row.exit}`)}</td><td><span class="report-state-avatar avatar-${reportAvatarName(row.status)}" aria-hidden="true"></span><span class="record-status status-code-${escapeHtml(row.status)}">${escapeHtml(row.statusLabel)}</span></td><td>${escapeHtml(row.typeLabel)}</td></tr>`).join("") : '<tr><td colspan="5">No hay guardias programadas en este periodo.</td></tr>'}
        </tbody></table></div>
      </section>
      <footer class="digital-report-footer">Documento personal de consulta generado por BiometrIMSS. Verifica la información antes de presentarla o utilizarla como referencia.</footer>`;
  }

  function reportAvatarName(status) {
    if (status === "vacaciones") return "vacation";
    if (status === "incapacidad") return "care";
    if (status === "pendiente" || status === "festivo") return "schedule";
    if (status === "pase-salida" || status === "salida-anticipada") return "exit";
    if (["retardo", "omision-entrada", "omision-salida", "falta", "fuera-horario"].includes(status)) return "alert";
    return "complete";
  }

  async function exportPdf(event) {
    const model = getReportModel();
    if (!model.rows.length || !window.PDFLib) return;
    const button = event && event.currentTarget ? event.currentTarget : $("exportPdf");
    const originalLabel = button.innerHTML;
    button.disabled = true;
    button.textContent = "Generando PDF…";
    try {
      const bytes = await createDigitalPdf(model);
      const start = $("historyStart").value;
      const end = $("historyEnd").value;
      const pdf = await window.PDFLib.PDFDocument.load(bytes);
      pdf.setTitle(`Informe de guardias ${start} a ${end}`);
      pdf.setAuthor(state.settings.name || "BiometrIMSS");
      pdf.setSubject("Documento digital de consulta personal");
      pdf.setCreator("BiometrIMSS");
      downloadBlob(`Informe_guardias_${start}_${end}.pdf`, new Blob([await pdf.save()], { type: "application/pdf" }));
      showToast("Documento PDF descargado correctamente.");
    } catch (error) {
      console.error(error);
      showToast("No se pudo generar el documento PDF. Inténtalo nuevamente.", "error");
    } finally {
      button.innerHTML = originalLabel;
      button.disabled = !model.rows.length || !window.PDFLib;
    }
  }

  async function createDigitalPdf(model) {
    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const pageSize = [595.28, 841.89];
    const margin = 42;
    const safeText = (value) => String(value || "-").replace(/[\u2022\u00b7]/g, "-").replace(/[\u2013\u2014]/g, "-").replace(/[^\x20-\xFF]/g, "?");
    const shorten = (value, limit) => {
      const text = safeText(value);
      return text.length > limit ? `${text.slice(0, Math.max(1, limit - 3))}...` : text;
    };
    let page;
    let cursorY;
    let pageNumber = 0;
    const newPage = (continued = false) => {
      page = pdf.addPage(pageSize);
      pageNumber += 1;
      page.drawRectangle({ x: 0, y: pageSize[1] - 92, width: pageSize[0], height: 92, color: rgb(0.024, 0.24, 0.20) });
      page.drawText(continued ? "INFORME DE GUARDIAS - CONTINUACION" : "BIOMETRIMSS - INFORME DE GUARDIAS", { x: margin, y: pageSize[1] - 43, size: 15, font: bold, color: rgb(1, 1, 1) });
      page.drawText(safeText(model.period), { x: margin, y: pageSize[1] - 66, size: 9, font: regular, color: rgb(0.86, 0.96, 0.92) });
      page.drawText(`Pagina ${pageNumber}`, { x: pageSize[0] - margin - 45, y: 25, size: 8, font: regular, color: rgb(0.37, 0.48, 0.45) });
      cursorY = pageSize[1] - 118;
    };
    const labelValue = (label, value, x, width) => {
      page.drawText(label.toUpperCase(), { x, y: cursorY, size: 7, font: bold, color: rgb(0.04, 0.46, 0.35) });
      page.drawText(shorten(value, Math.floor(width / 5.2)), { x, y: cursorY - 14, size: 9, font: bold, color: rgb(0.09, 0.20, 0.18) });
    };
    newPage();
    labelValue("Personal", model.profile.name, margin, 245);
    labelValue("Matrícula", model.profile.employeeId, 292, 120);
    labelValue("Unidad", model.profile.unit, 425, 128);
    cursorY -= 42;
    const summary = model.summary;
    const justified = (summary.justificada || 0) + (summary.incapacidad || 0) + (summary.permiso || 0) + (summary.convenio || 0) + (summary.vacaciones || 0) + (summary.festivo || 0);
    const incidents = model.incidentCount;
    const summaryItems = [["Guardias", model.rows.length], ["Efectivas", summary.efectiva || 0], ["Justificadas", justified], ["Faltas reales", summary.falta || 0], ["Pendientes", summary.pendiente || 0], ["Incidencias", incidents], ["Asistencia", `${model.attendanceRate}%`]];
    const summaryWidth = (pageSize[0] - margin * 2) / 4;
    summaryItems.forEach(([label, value], index) => {
      const column = index % 4;
      const row = Math.floor(index / 4);
      const x = margin + column * summaryWidth;
      const y = cursorY - row * 45;
      page.drawRectangle({ x, y: y - 39, width: summaryWidth - 5, height: 38, color: rgb(0.94, 0.98, 0.96) });
      page.drawText(label.toUpperCase(), { x: x + 8, y: y - 16, size: 6.5, font: bold, color: rgb(0.04, 0.46, 0.35) });
      page.drawText(String(value), { x: x + 8, y: y - 32, size: 13, font: bold, color: rgb(0.02, 0.24, 0.20) });
    });
    cursorY -= 113;
    const drawTableHeader = () => {
      page.drawRectangle({ x: margin, y: cursorY - 18, width: pageSize[0] - margin * 2, height: 22, color: rgb(0.024, 0.24, 0.20) });
      [["GUARDIA", 0], ["ENTRADA", 86], ["SALIDA", 142], ["ESTATUS", 218], ["DETALLE", 303]].forEach(([label, offset]) => page.drawText(label, { x: margin + offset + 5, y: cursorY - 10, size: 6.5, font: bold, color: rgb(1, 1, 1) }));
      cursorY -= 22;
    };
    drawTableHeader();
    model.rows.forEach((row, index) => {
      if (cursorY < 76) {
        newPage(true);
        drawTableHeader();
      }
      const y = cursorY - 18;
      page.drawRectangle({ x: margin, y, width: pageSize[0] - margin * 2, height: 22, color: index % 2 ? rgb(0.98, 0.99, 0.985) : rgb(1, 1, 1) });
      const values = [shorten(row.date, 16), shorten(row.entry, 10), shorten(`${row.exitDate} ${row.exit}`, 16), shorten(row.statusLabel, 18), shorten(row.typeLabel, 34)];
      const offsets = [0, 86, 142, 218, 303];
      values.forEach((value, valueIndex) => page.drawText(value, { x: margin + offsets[valueIndex] + 5, y: cursorY - 11, size: 6.5, font: valueIndex === 3 ? bold : regular, color: rgb(0.09, 0.20, 0.18) }));
      cursorY -= 22;
    });
    return pdf.save();
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
