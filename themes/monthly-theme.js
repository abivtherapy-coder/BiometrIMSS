(function initializeMonthlyTheme() {
  "use strict";

  const THEME_VERSION = "5.7.0";
  const SEPTEMBER_CHARACTER = "assets/biometrimss-charro-septiembre-v1.png";
  const themes = [
    ["enero", "Año Nuevo", "✦"],
    ["febrero", "Amor y amistad", "♥"],
    ["marzo", "Primavera", "✿"],
    ["abril", "Día del Niño", "★"],
    ["mayo", "Día de las Madres", "✿"],
    ["junio", "Día del Papá", "●"],
    ["julio", "Nómina y fondo de ahorro", "✦"],
    ["agosto", "Regreso a clases", "✎"],
    ["septiembre", "¡Viva México!", "✦"],
    ["octubre", "Halloween", "◒"],
    ["noviembre", "Día de Muertos", "✿"],
    ["diciembre", "Navidad", "✦"]
  ];

  function getTheme() {
    const requested = new URLSearchParams(window.location.search).get("theme");
    return themes.find(([id]) => id === String(requested || "").toLowerCase()) || themes[new Date().getMonth()];
  }

  function ensureSeasonalStyles(id) {
    if (id !== "septiembre") return;
    const previous = document.getElementById("septemberVivaStyles");
    if (previous) previous.remove();
    const link = document.createElement("link");
    link.id = "septemberVivaStyles";
    link.rel = "stylesheet";
    link.href = `themes/september-viva.css?v=${THEME_VERSION}&cb=${Date.now()}`;
    document.head.append(link);
  }

  function make(tag, className, text) {
    const el = document.createElement(tag);
    el.className = className;
    if (text) el.textContent = text;
    el.setAttribute("aria-hidden", "true");
    return el;
  }

  function normalizePermissionLabels() {
    const justifiedStat = document.getElementById("statJustified");
    const justifiedCard = justifiedStat && justifiedStat.closest(".stat-card");
    const justifiedLabel = justifiedCard && justifiedCard.querySelector("span:last-child");
    if (justifiedLabel) justifiedLabel.textContent = "Permisos";

    const select = document.getElementById("statusOverride");
    if (!select) return;
    const legacy = select.querySelector('option[value="justificada"]');
    if (legacy) {
      legacy.textContent = "Permiso (registro anterior)";
      legacy.hidden = true;
    }
    const permission = select.querySelector('option[value="permiso"]');
    if (permission) permission.textContent = "Permiso / incidencia justificada";
  }

  function chooseSeptemberCharacter(target) {
    target.src = `${SEPTEMBER_CHARACTER}?v=${THEME_VERSION}`;
    target.classList.add("is-cutout");
  }

  function decorateSeptember() {
    const home = document.getElementById("view-home");
    const header = document.querySelector(".topbar");
    const hero = home && home.querySelector(":scope > .hero-card");
    if (!home || !header || !hero || home.dataset.septemberDecorated === "true") return;
    home.dataset.septemberDecorated = "true";

    const headerArt = make("div", "sep-header-art");
    headerArt.append(make("span", "sep-firework sep-firework-a"));
    headerArt.append(make("span", "sep-firework sep-firework-b"));
    headerArt.append(make("span", "sep-viva", "¡Viva México!"));
    headerArt.append(make("span", "sep-month", "MES DE SEPTIEMBRE"));
    headerArt.append(make("span", "sep-skyline"));
    headerArt.append(make("span", "sep-flag", "🇲🇽"));
    header.append(headerArt);

    const papel = make("div", "sep-papel");
    papel.innerHTML = "<span></span><span></span><span></span><span></span><span></span>";
    hero.prepend(papel);

    const confetti = make("div", "sep-confetti");
    for (let i = 0; i < 12; i += 1) confetti.append(make("i", "sep-confetti-piece"));
    hero.append(confetti);

    const character = document.createElement("img");
    character.className = "sep-character";
    character.alt = "";
    character.setAttribute("aria-hidden", "true");
    character.loading = "eager";
    hero.append(character);
    chooseSeptemberCharacter(character);

    hero.append(make("div", "sep-theme-label", "Tema del mes: ¡Viva México!"));
    hero.append(make("div", "sep-architecture"));

    const period = home.querySelector(":scope > .period-card");
    if (period) period.append(make("span", "sep-ribbon"));

    home.querySelectorAll(":scope > .stats-grid .stat-card").forEach((card, index) => {
      card.append(make("span", `sep-stat-flower sep-stat-flower-${index + 1}`));
    });

    const progress = home.querySelector(":scope > .progress-card");
    if (progress) {
      progress.append(make("span", "sep-progress-firework"));
      progress.append(make("span", "sep-progress-eagle", "◆"));
      progress.append(make("span", "sep-ribbon sep-ribbon-bottom"));
    }
  }

  function applyTheme() {
    const [id, label, symbol] = getTheme();
    document.documentElement.dataset.monthTheme = id;
    document.documentElement.style.setProperty("--theme-symbol", `"${symbol}"`);
    document.documentElement.style.setProperty("--theme-label", `"${label}"`);
    ensureSeasonalStyles(id);
    normalizePermissionLabels();

    const header = document.querySelector(".topbar");
    if (header && !header.querySelector(".month-decoration")) {
      const decoration = document.createElement("span");
      decoration.className = "month-decoration";
      decoration.setAttribute("aria-hidden", "true");
      header.append(decoration);
    }

    if (id === "septiembre") decorateSeptember();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyTheme, { once: true });
  else applyTheme();
}());
