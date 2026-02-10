// ─────────────────────────────────────────────
// ⚙ DarkStudio — Config Script
// ─────────────────────────────────────────────

let i18n = {}; // Loaded language dictionary / dicionário carregado
let currentLang = "en-US"; // Current language / idioma atual
let device = "Detectando";
let block = false; // Block access flag / flag de bloqueio
const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
const faviconLight = "Extras/Assets/White Favicon.png";
const faviconDark = "Extras/Assets/Black Favicon.png";
const spotify = document.getElementById("spotify-now-playing");
const spotifyFS = document.getElementById("full-screen");

export const language = navigator.language || navigator.userLanguage;

// ─────────────────────────────────────────────
// 🌐 DEV MODE UTILITIES
// Utilitários do Modo Desenvolvedor
// ─────────────────────────────────────────────

/**
 * Get Dev Mode state from localStorage
 * Obtém o estado do Modo Dev do localStorage
 * @returns {boolean}
 */
export function getDevMode() {
  return localStorage.getItem("devMode") === "true";
}

/**
 * Set Dev Mode state in localStorage
 * Define o estado do Modo Dev no localStorage
 * @param {boolean} value - true enable / false disable
 */
export function setDevMode(value) {
  localStorage.setItem("devMode", String(value));
}

if (getDevMode()) console.log("🧪 Dev Mode ativo / active");

// ─────────────────────────────────────────────
// 🌍 INTERNATIONALIZATION (i18n)
// Internacionalização
// ─────────────────────────────────────────────

/**
 * Load language JSON file
 * Carrega o arquivo JSON de idioma
 * @param {string} langCode - ex: pt-BR, en-US
 */
export async function loadLanguage(langCode) {
  try {
    const res = await fetch(`Extras/languages/${langCode}.json`);
    if (!res.ok) throw new Error("Language not found");

    i18n = await res.json();
    currentLang = langCode;
  } catch {
    console.warn(
      `🌐 Idioma "${langCode}" não encontrado. Fallback para inglês.`
    );

    const fallback = await fetch("Extras/languages/en-US.json");
    i18n = await fallback.json();
    currentLang = "en-US";
  }
}

/**
 * Translate key
 * Traduz uma chave
 * @param {string} key
 */
export function t(key) {
  return i18n[key] ?? key;
}

/**
 * Get current language
 * Retorna o idioma atual
 */
export function getCurrentLanguage() {
  return currentLang;
}

// Auto-load browser language
await loadLanguage(language);

// ─────────────────────────────────────────────
// 📱 DEVICE DETECTION
// Detecção de Dispositivo
// ─────────────────────────────────────────────

if (!block) detectDevice();

/**
 * Detect mobile or desktop
 * Detecta se é mobile ou desktop
 */
function detectDevice() {
  const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(
    navigator.userAgent
  );

  device = isMobile ? "Mobile" : "Desktop";

  if (getDevMode()) console.log("📱 Dispositivo / Device:", device);
}

/**
 * Returns current device type
 * Retorna o tipo de dispositivo
 */
export function getDevice() {
  return device;
}

/**
 * Export block flag
 * Exporta a flag de bloqueio
 */
export const blockWeb = block;

// ─────────────────────────────────────────────
// 📦 DYNAMIC SCRIPT & STYLE LOADERS
// Carregadores Dinâmicos de JS e CSS
// ─────────────────────────────────────────────

/**
 * Load internal JS module
 * Carrega um script JS interno
 * @param {string} name - file name without .js
 */
async function js(name) {
  const path = `Extras/Code/${name}.js`;

  const ok = await checkFile(path, `${name}.js`);
  if (!ok) return;

  const script = document.createElement("script");
  script.src = path;
  script.type = "module";
  document.body.appendChild(script);
}

/**
 * Ensure DOM is ready before loading script
 * Garante que o DOM esteja pronto
 */
function loadJS(name) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => js(name));
  } else {
    js(name);
  }
}

/**
 * Load external script (CDN)
 * Carrega script externo (CDN)
 * @param {string} url
 */
export function loadExternalScript(url) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = url;
    script.defer = true;
    script.onload = () => {
      if (getDevMode()) console.log("📦 Script externo:", url);
      resolve();
    };
    script.onerror = () => reject(`Erro ao carregar ${url}`);

    document.head.appendChild(script);
  });
}

/**
 * Load CSS dynamically
 * Carrega CSS dinamicamente
 * @param {string} href
 */
export async function loadCSS(name) {
  const path = `Extras/Code/${name}`;

  if (!name.endsWith(".css")) {
    console.warn(`❌ ${name} — não é CSS`);
    return;
  }

  if (document.querySelector(`link[href="${path}"]`)) return;

  const ok = await checkFile(path, name);
  if (!ok) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = path;
  document.head.appendChild(link);

  setTimeout(() => {
    const container = document.getElementById("Website-Container");
    if (container) container.style.opacity = "1";
  }, 1000);
}

async function checkFile(path, label) {
  try {
    const res = await fetch(path, { method: "HEAD" });

    if (res.ok) {
      console.log(`✅ ${label} — ${path}`);
      return true;
    } else {
      console.warn(`❌ ${label} — ${path}`);
      return false;
    }
  } catch {
    console.warn(`❌ ${label} — erro ao acessar ${path}`);
    return false;
  }
}

// ─────────────────────────────────────────────
// ⭐ FAVICON HANDLER
// Controle de Favicon
// ─────────────────────────────────────────────

/**
 * Apply favicon dynamically
 * Aplica favicon dinamicamente
 */
export function loadFavicon(href) {
  let favicon = document.getElementById("favicon");

  if (!favicon) {
    favicon = document.createElement("link");
    favicon.id = "favicon";
    favicon.rel = "icon";
    document.head.appendChild(favicon);
  }

  favicon.href = href;

  if (getDevMode()) console.log("⭐ Favicon:", href);
}

function applyFavicon(e) {
  loadFavicon(e.matches ? faviconLight : faviconDark);
}

// ─────────────────────────────────────────────
// 🚦 MAIN LOADER
// Carregador Principal
// ─────────────────────────────────────────────

if (!block) {
  (async () => {
    loadJS("monaco");
    loadJS("main");
    loadJS("AI");

    await loadExternalScript(
      "https://cdnjs.cloudflare.com/ajax/libs/color-thief/2.3.2/color-thief.umd.js"
    );

    if (device !== "Mobile") {
      loadCSS("dark.css");
      loadJS("spotify");
    } else {
      loadCSS("mobile.css");
      if (spotify) spotify.style.display = "none";
      if (spotifyFS) spotifyFS.style.display = "none";
    }

    applyFavicon(mediaQuery);
    mediaQuery.addEventListener("change", applyFavicon);
  })();
}

// ─────────────────────────────────────────────
// ⛔ BLOCK SCREEN
// Tela de Bloqueio
// ─────────────────────────────────────────────
else {
  document.body.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:red;color:#fff;font-family:sans-serif;text-align:center;padding:20px;">
      <h1>${t("siteBlockedTitle")}</h1>
      <p>${t("siteBlockedDesc")}</p>
      <h5>By: CDP 💚</h5>
      <div style="margin-top:20px;font-size:12px;">
        <strong>${t("reason")}:</strong><br/>
        ${t("blockedMobile").replaceAll("\n", "<br/>")}
      </div>
    </div>
  `;

  document.title = "DarkStudio :(";
}