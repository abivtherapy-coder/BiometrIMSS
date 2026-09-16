(function initializeMonthlyTheme() {
  "use strict";

  const THEME_VERSION = "5.6.0";
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

  const septemberCandidates = [
    "assets/7AA47CC3-1646-484E-A630-9E70E523A486.png",
    "assets/881D4859-FEF3-45D9-AEE1-892678FEEAA2.png",
    "assets/A5BD8F79-366E-46CA-AAC1-43AD5E48DC52.png",
    "assets/BCF6ADEE-FFFA-4572-811F-BB8EB423AD02.png"
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

  function scoreImage(img) {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 72;
      canvas.height = 96;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let transparent = 0, dark = 0, gold = 0, red = 0, green = 0, visible = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
        if (a < 220) { transparent += 1; continue; }
        visible += 1;
        if (r < 95 && g < 95 && b < 95) dark += 1;
        if (r > 145 && g > 95 && g < 190 && b < 85) gold += 1;
        if (r > 145 && g < 105 && b < 105) red += 1;
        if (g > 90 && g > r * 1.12 && g > b * 1.12) green += 1;
      }
      const total = canvas.width * canvas.height;
      const alphaRatio = transparent / total;
      if (alphaRatio < 0.08 || visible < total * 0.18) return -1;
      return alphaRatio * 2.2 + (dark / total) * 2.5 + (gold / total) * 2.2 + (red / total) * 1.1 + (green / total) * 0.45;
    } catch (error) {
      return -1;
    }
  }

  function loadCandidate(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve({ src, img, score: scoreImage(img) });
      img.onerror = () => resolve({ src, img: null, score: -1 });
      img.src = `${src}?v=${THEME_VERSION}`;
    });
  }

  async function chooseSeptemberCharacter(target) {
    const results = await Promise.all(septemberCandidates.map(loadCandidate));
    const best = results.sort((a, b) => b.score - a.score)[0];
    if (best && best.score >= 0) {
      target.src = `${best.src}?v=${THEME_VERSION}`;
      target.classList.add("is-cutout");
      return;
    }
    target.src = `assets/DD8ADD59-010C-4F1A-8763-448A17FC021B.png?v=${THEME_VERSION}`;
    target.classList.add("is-reference-fallback");
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
