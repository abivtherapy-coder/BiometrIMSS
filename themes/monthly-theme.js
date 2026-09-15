(function initializeMonthlyTheme() {
  "use strict";

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
    if (id !== "septiembre" || document.getElementById("septemberVivaStyles")) return;
    const link = document.createElement("link");
    link.id = "septemberVivaStyles";
    link.rel = "stylesheet";
    link.href = "themes/september-viva.css?v=5.4.0";
    document.head.append(link);
  }

  function make(tag, className, text) {
    const el = document.createElement(tag);
    el.className = className;
    if (text) el.textContent = text;
    el.setAttribute("aria-hidden", "true");
    return el;
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

    hero.append(make("div", "sep-character"));
    hero.append(make("div", "sep-theme-label", "Tema del mes: ¡Viva México!"));
    hero.append(make("div", "sep-architecture"));

    const period = home.querySelector(":scope > .period-card");
    if (period) period.append(make("span", "sep-ribbon"));

    home.querySelectorAll(":scope > .stats-grid .stat-card").forEach((card, index) => {
      const flower = make("span", `sep-stat-flower sep-stat-flower-${index + 1}`);
      const sprinkle = make("span", `sep-stat-sprinkle sep-stat-sprinkle-${index + 1}`);
      card.append(flower, sprinkle);
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
