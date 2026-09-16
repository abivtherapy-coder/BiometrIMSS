(function initializeMonthlyTheme() {
  "use strict";

  const THEME_VERSION = "5.9.0";
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
    if (!["septiembre", "octubre", "noviembre", "diciembre"].includes(id)) return;
    const previous = document.getElementById("septemberVivaStyles");
    if (previous) previous.remove();
    const link = document.createElement("link");
    link.id = "septemberVivaStyles";
    link.rel = "stylesheet";
    link.href = `themes/september-viva.css?v=${THEME_VERSION}&cb=${Date.now()}`;
    document.head.append(link);
    if (id !== "septiembre") {
      const q4 = document.createElement("link");
      q4.id = "q4SeasonalStyles";
      q4.rel = "stylesheet";
      q4.href = `themes/q4-seasonal.css?v=${THEME_VERSION}&cb=${Date.now()}`;
      document.head.append(q4);
    }
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

  const Q4_COPY = Object.freeze({
    octubre: { header: "Halloween", theme: "¡Halloween!", slogan: "EL COMPROMISO TAMBIÉN DA VIDA" },
    noviembre: { header: "Día de Muertos", theme: "Día de Muertos", slogan: "HONRAMOS LA VIDA EN CADA GUARDIA" },
    diciembre: { header: "Feliz Navidad", theme: "¡Feliz Navidad!", slogan: "LA SALUD NOS UNE EN CADA TEMPORADA" }
  });

  function decorateQ4(id) {
    const copy = Q4_COPY[id];
    const home = document.getElementById("view-home");
    const header = document.querySelector(".topbar");
    const hero = home && home.querySelector(":scope > .hero-card");
    if (!copy || !home || !header || !hero || home.dataset.q4Decorated === id) return;
    home.dataset.q4Decorated = id;

    const headerArt = make("div", `q4-header-art q4-header-art--${id}`);
    headerArt.append(make("span", "q4-header-title", copy.header));
    headerArt.append(make("span", "q4-header-detail"));
    header.append(headerArt);

    const character = make("div", `q4-character q4-character--${id}`);
    hero.append(character);
    hero.append(make("div", "q4-theme-label", `Tema del mes: ${copy.theme}`));
    hero.append(make("div", "q4-scene"));

    const period = home.querySelector(":scope > .period-card");
    if (period) period.append(make("span", "q4-period-art"));
    home.querySelectorAll(":scope > .stats-grid .stat-card").forEach((card) => card.append(make("span", "q4-card-art")));
    const progress = home.querySelector(":scope > .progress-card");
    if (progress) progress.append(make("span", "q4-progress-art"));

    const nav = document.querySelector(".bottom-nav");
    if (nav) nav.dataset.seasonSlogan = copy.slogan;
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
    else if (Q4_COPY[id]) decorateQ4(id);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyTheme, { once: true });
  else applyTheme();
}());
