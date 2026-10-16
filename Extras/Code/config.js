// ─────────────────────────────────────────────
// ⚙ DarkStudio — Config Script
// ─────────────────────────────────────────────

let i18n = {}; // Loaded language dictionary / dicionário carregado
let currentLang = "en-US"; // Current language / idioma atual
let languageLoadSequence = 0;
let device = "Detectando";
let block = false; // Block access flag / flag de bloqueio
const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
const faviconLight = "Extras/Assets/White Favicon.png";
const faviconDark = "Extras/Assets/Black Favicon.png";
export let language = "en-US";
export const version = "16.10.26"; // Current version / versão atual

// ─────────────────────────────────────────────
// ▶️ CODE EXECUTOR SETTINGS
// Controle de execução de código
// ─────────────────────────────────────────────

export const EXECUTOR_CONFIG = {
  JavaScript: true,
  HTML: true,

  // Abre o código em ambiente isolado
  isolated: true,

  // Impede o código executado de acessar o documento/página do DarkStudio
  isolateOrigin: true,
};

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
  const requestSequence = ++languageLoadSequence;
  try {
    if (getDevMode())
      console.log(`🌐 Carregando idioma / Loading language: ${langCode}`);
    const res = await fetch(`Extras/languages/${langCode}.json`);
    if (!res.ok) throw new Error("Language not found");

    const dictionary = await res.json();
    if (!dictionary || typeof dictionary !== "object" || Array.isArray(dictionary)) {
      throw new Error("Invalid language catalog");
    }
    if (requestSequence !== languageLoadSequence) return currentLang;

    i18n = dictionary;
    currentLang = langCode;
    language = currentLang;
    document.documentElement.lang = currentLang;
  } catch {
    if (requestSequence !== languageLoadSequence) return currentLang;
    console.warn(
      `🌐 Idioma "${langCode}" não encontrado. Fallback para inglês.`,
    );

    const fallback = await fetch("Extras/languages/en-US.json");
    const fallbackDictionary = await fallback.json();
    if (requestSequence !== languageLoadSequence) return currentLang;
    i18n = fallbackDictionary;
    currentLang = "en-US";
    language = currentLang;
    document.documentElement.lang = currentLang;
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

window.darkStudioTranslate = t;

/**
 * Get current language
 * Retorna o idioma atual
 */
export function getCurrentLanguage() {
  return currentLang;
}

export async function getAvailableLanguages() {
  let languageCodes = ["en-US", "pt-BR", "ru"];
  try {
    const response = await fetch("Extras/languages/index.json", { cache: "no-store" });
    if (response.ok) {
      const manifest = await response.json();
      if (Array.isArray(manifest.languages)) {
        languageCodes = manifest.languages
          .map((entry) => typeof entry === "string" ? entry : entry?.code)
          .filter((code) => typeof code === "string" && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/.test(code));
      }
    }
  } catch {
    // Fall back to known candidates; individual JSON checks below still filter missing files.
  }

  const catalogs = await Promise.all(languageCodes.map(async (code) => {
    try {
      const response = await fetch(`Extras/languages/${code}.json`, { cache: "no-store" });
      if (!response.ok) return null;
      const catalog = await response.json();
      if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) return null;
      const languageName = typeof catalog.languageName === "string" ? catalog.languageName.trim() : "";
      return languageName ? { code, name: languageName } : null;
    } catch {
      return null;
    }
  }));

  return catalogs.filter(Boolean);
}

async function populateLanguageSelector(languages) {
  const selector = document.getElementById("language-select");
  if (!selector || !languages.length) return;
  selector.replaceChildren(...languages.map(({ code, name }) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = name;
    return option;
  }));
}

// Honor an explicit Settings choice; otherwise use a language available on disk.
const availableLanguages = await getAvailableLanguages();
await populateLanguageSelector(availableLanguages);
const supportedLanguages = availableLanguages.map(({ code }) => code);
const savedLanguage = localStorage.getItem("darkstudio-language");
const browserLanguage = (navigator.languages?.length ? navigator.languages : [navigator.language || "en-US"])
  .map((locale) => String(locale).toLowerCase());
const exactBrowserLanguage = browserLanguage
  .map((locale) => availableLanguages.find(({ code }) => code.toLowerCase() === locale)?.code)
  .find(Boolean);
const detectedLanguage = exactBrowserLanguage ||
  (browserLanguage.some((locale) => locale.startsWith("pt"))
    ? supportedLanguages.find((code) => code.toLowerCase().startsWith("pt"))
    : browserLanguage.some((locale) => locale.startsWith("ru"))
      ? supportedLanguages.find((code) => code.toLowerCase().startsWith("ru"))
      : null) || supportedLanguages.find((code) => code.toLowerCase() === "en-us") || supportedLanguages[0] || "en-US";
await loadLanguage(supportedLanguages.includes(savedLanguage) ? savedLanguage : detectedLanguage);
language = currentLang;
document.documentElement.lang = currentLang;

// ─────────────────────────────────────────────
// 📱 DEVICE DETECTION
// Detecção de Dispositivo
// ─────────────────────────────────────────────

detectDevice();

/**
 * Detect mobile or desktop
 * Detecta se é mobile ou desktop
 */
function detectDevice() {
  const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(
    navigator.userAgent,
  );

  device = isMobile ? "Mobile" : "Desktop";
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

  if (!ok) return false;

  return new Promise((resolve) => {
    const script = document.createElement("script");

    script.src = path;
    script.type = "module";

    script.onload = () => resolve(true);
    script.onerror = () => {
      bootLogs.push(`❌ ${name}.js`);
      resolve(false);
    };

    document.body.appendChild(script);
  });
}

/**
 * Ensure DOM is ready before loading script
 * Garante que o DOM esteja pronto
 */
function loadJS(name) {
  if (document.readyState === "loading") {
    return new Promise((resolve) => {
      document.addEventListener("DOMContentLoaded", () => resolve(js(name)), {
        once: true,
      });
    });
  }

  return js(name);
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
      bootLogs.push("✅ Color Thief");
      resolve();
    };

    script.onerror = () => {
      bootLogs.push("❌ Color Thief");
      reject(`Erro ao carregar ${url}`);
    };

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
    bootLogs.push(`❌ ${name}`);
    return false;
  }

  if (document.querySelector(`link[href="${path}"]`)) {
    return true;
  }

  const ok = await checkFile(path, name);

  if (!ok) return false;

  return new Promise((resolve) => {
    const link = document.createElement("link");

    link.rel = "stylesheet";
    link.href = path;

    link.onload = () => {
      const container = document.getElementById("Website-Container");

      if (container) {
        container.style.opacity = "1";
      }

      resolve(true);
    };

    link.onerror = () => {
      bootLogs.push(`❌ ${name}`);
      resolve(false);
    };

    document.head.appendChild(link);
  });
}

const bootLogs = [];

async function checkFile(path, label) {
  try {
    const res = await fetch(path, { method: "HEAD" });

    if (res.ok) {
      bootLogs.push(`✅ ${label}`);
      return true;
    }

    bootLogs.push(`❌ ${label}`);
    return false;
  } catch {
    bootLogs.push(`❌ ${label}`);
    return false;
  }
}

function flushBootLogs() {
  if (!getDevMode()) return;

  console.log(
    `🌑 DarkStudio | Device: ${device} | Language: ${currentLang} | ${bootLogs.join(" • ")}`,
  );

  bootLogs.length = 0;
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
    await Promise.all([
      loadJS("monaco"),
      loadJS("main"),
      loadJS("AI"),

      loadExternalScript(
        "https://cdnjs.cloudflare.com/ajax/libs/color-thief/2.3.2/color-thief.umd.js",
      ),
    ]);

    await loadCSS(device !== "Mobile" ? "dark.css" : "mobile.css");

    applyFavicon(mediaQuery);

    mediaQuery.addEventListener("change", applyFavicon);

    flushBootLogs();
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
