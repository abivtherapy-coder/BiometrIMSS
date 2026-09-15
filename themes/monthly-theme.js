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
    link.href = "themes/september-viva.css?v=5.0.0";
    document.head.append(link);
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
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyTheme, { once: true });
  else applyTheme();
}());
