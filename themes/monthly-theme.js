(function initializeMonthlyTheme() {
  "use strict";

  const themes = [
    { id: "enero", label: "Año Nuevo", symbol: "✦", note: "Comenzamos un nuevo año" },
    { id: "febrero", label: "San Valentín", symbol: "♥", note: "Cuidar también es compartir" },
    { id: "marzo", label: "Primavera", symbol: "✿", note: "Una nueva temporada comienza" },
    { id: "abril", label: "Pascua", symbol: "★", note: "Primavera y renovación" },
    { id: "mayo", label: "Enfermería", symbol: "✚", note: "Reconocimiento al personal de enfermería" },
    { id: "junio", label: "Día del Padre", symbol: "♥", note: "Celebramos a papá" },
    { id: "julio", label: "Fondo de ahorro", symbol: "$", note: "¡Llegó el mes más esperado!" },
    { id: "agosto", label: "Regreso", symbol: "✓", note: "De vuelta a la rutina" },
    { id: "septiembre", label: "¡Viva México!", symbol: "✦", note: "Orgullo que nos une" },
    { id: "octubre", label: "Halloween", symbol: "☾", note: "Temporada de Halloween" },
    { id: "noviembre", label: "Día de Muertos", symbol: "✿", note: "Recordar también es cuidar" },
    { id: "diciembre", label: "Feliz Navidad", symbol: "✦", note: "Que la salud nos una siempre" }
  ];

  function getTheme() {
    const requested = new URLSearchParams(window.location.search).get("theme");
    return themes.find(theme => theme.id === String(requested || "").toLowerCase()) || themes[new Date().getMonth()];
  }

  function makeThemeBadge(theme) {
    const badge = document.createElement("div");
    badge.className = "monthly-theme-badge";
    badge.setAttribute("aria-label", `Tema del mes: ${theme.label}`);
    badge.innerHTML = `<span class="monthly-theme-symbol" aria-hidden="true">${theme.symbol}</span><span><small>Tema del mes</small><strong>${theme.label}</strong></span>`;
    return badge;
  }

  function applyTheme() {
    const theme = getTheme();
    document.documentElement.dataset.monthTheme = theme.id;
    document.documentElement.style.setProperty("--theme-symbol", `"${theme.symbol}"`);
    document.documentElement.style.setProperty("--theme-label", `"${theme.label}"`);

    const header = document.querySelector(".topbar");
    if (header && !header.querySelector(".month-decoration")) {
      const decoration = document.createElement("span");
      decoration.className = "month-decoration";
      decoration.setAttribute("aria-hidden", "true");
      header.append(decoration);
    }

    const hero = document.querySelector("#view-home .hero-card");
    if (hero && !hero.querySelector(".monthly-theme-badge")) {
      hero.append(makeThemeBadge(theme));
    }

    document.querySelectorAll("[data-monthly-theme-label]").forEach(node => {
      node.textContent = theme.label;
    });

    window.BiometrMonthlyTheme = Object.freeze({ ...theme });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyTheme, { once: true });
  else applyTheme();
}());
