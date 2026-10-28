/**
 * BIOMETRIMSS · SISTEMA DE TEMÁTICAS MENSUALES
 * 
 * Cada mes del año adopta una temática visual diferente.
 * La aplicación se actualiza automáticamente según la fecha actual.
 * El parámetro ?theme=nombreMes permite probar cualquier mes sin cambiar el reloj del dispositivo.
 * 
 * INVARIANTE: Los avatares, cálculos, guardias, registros y reportes NO se ven afectados.
 * Solo cambia la presentación visual (colores, fondos, decoraciones).
 */

export const monthlyThemes = [
  {
    id: "enero",
    month: 0,
    title: "Año Nuevo",
    avatar: "/themes/enero/avatar.png",
    description: "Celebración de Año Nuevo"
  },
  {
    id: "febrero",
    month: 1,
    title: "San Valentín",
    avatar: "/themes/febrero/avatar.png",
    description: "Temática de corazones"
  },
  {
    id: "marzo",
    month: 2,
    title: "Primavera",
    avatar: "/themes/marzo/avatar.png",
    description: "Flores y primavera"
  },
  {
    id: "abril",
    month: 3,
    title: "Pascua",
    avatar: "/themes/abril/avatar.png",
    description: "Orejas de conejo y huevo de Pascua"
  },
  {
    id: "mayo",
    month: 4,
    title: "Enfermería",
    avatar: "/themes/mayo/avatar.png",
    description: "Reconocimiento al personal de enfermería"
  },
  {
    id: "junio",
    month: 5,
    title: "Día del Padre",
    avatar: "/themes/junio/avatar.png",
    description: "Temática del Día del Padre"
  },
  {
    id: "julio",
    month: 6,
    title: "Fondo de ahorro",
    avatar: "/themes/julio/avatar.png",
    description: "¡Llegó el fondo de ahorro!"
  },
  {
    id: "agosto",
    month: 7,
    title: "Regreso",
    avatar: "/themes/agosto/avatar.png",
    description: "Regreso a rutina y nuevos retos"
  },
  {
    id: "septiembre",
    month: 8,
    title: "¡Viva México!",
    avatar: "/themes/septiembre/avatar.png",
    description: "Mes festivo mexicano"
  },
  {
    id: "octubre",
    month: 9,
    title: "Halloween",
    avatar: "/themes/octubre/avatar.png",
    description: "Temática Halloween"
  },
  {
    id: "noviembre",
    month: 10,
    title: "Día de Muertos",
    avatar: "/themes/noviembre/avatar.png",
    description: "Elegante Catrín/Catrina"
  },
  {
    id: "diciembre",
    month: 11,
    title: "Feliz Navidad",
    avatar: "/themes/diciembre/avatar.png",
    description: "Temática navideña"
  }
];

/**
 * Obtiene el tema del mes actual.
 * Prioriza el parámetro ?theme= si está presente y es válido.
 * @returns {Object} Objeto de tema con id, month, title, avatar, description
 */
export function getCurrentMonthlyTheme() {
  // Detectar parámetro de prueba ?theme=nombreMes
  const params = new URLSearchParams(window.location.search);
  const forcedTheme = params.get("theme");
  
  if (forcedTheme) {
    const found = monthlyThemes.find(t => t.id === forcedTheme.toLowerCase());
    if (found) {
      return found;
    }
  }
  
  // Si no hay forzamiento, usar el mes actual
  const month = new Date().getMonth();
  return monthlyThemes.find(theme => theme.month === month) || monthlyThemes[0];
}

/**
 * Aplica el tema actual al documento.
 * Establece data-month-theme en el <html> y cambia el avatar si está disponible.
 */
export function applyCurrentTheme() {
  const theme = getCurrentMonthlyTheme();
  
  // Aplicar identificador de tema al elemento raíz
  document.documentElement.dataset.monthTheme = theme.id;
  
  // Cambiar avatar del asistente ABITIMSS si existe
  const assistantAvatar = document.querySelector(".assistant-avatar");
  if (assistantAvatar && theme.avatar) {
    // Intentar cargar el avatar del tema
    const img = new Image();
    img.onload = () => {
      assistantAvatar.src = theme.avatar;
    };
    img.onerror = () => {
      // Si no existe, mantener el avatar por defecto
      console.warn(`Avatar no encontrado para ${theme.id}:`, theme.avatar);
    };
    img.src = theme.avatar;
  }
  
  return theme;
}

/**
 * Inicializa el sistema de temáticas.
 * Se debe llamar después de que el DOM esté listo.
 */
export function initMonthlyThemes() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyCurrentTheme, { once: true });
  } else {
    applyCurrentTheme();
  }
}

// Auto-inicializar si se carga como módulo principal
if (typeof window !== "undefined" && !window.__biometrimss_themes_initialized) {
  window.__biometrimss_themes_initialized = true;
  initMonthlyThemes();
}
