// ─────────────────────────────────────────────
// ⚙ DarkStudio — Config Script
// ─────────────────────────────────────────────

let i18n = {}; // Loaded language dictionary / dicionário carregado
let currentLang = "en-US"; // Current language / idioma atual
let languageLoadSequence = 0;
let device = "Detectando";
let block = false; // Block access flag / flag de bloqueio
let blockReasonKey = "blockedMobile";
const OFFICIAL_ORIGIN_UNLOCK_KEY = "darkstudio-official-origin-unlocked";
const OFFICIAL_ORIGIN_PASSWORD_HASH =
  "fdeee64735ecac5bcf069172e2dbe5dc89e7214d648eb968a4fff90bc8e1e873";
const OFFICIAL_ORIGINS = new Set([
  "https://darkstudio-code.netlify.app",
  "https://darkstudio-code.com",
  "https://dscode.dev",
]);
const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
const faviconLight = "Extras/Assets/White Favicon.png";
const faviconDark = "Extras/Assets/Black Favicon.png";
export let language = "en-US";
export const version = "24.11.26"; // Current version / versão atual

const versionLabel = document.getElementById("app-version");
if (versionLabel) versionLabel.textContent = `v${version}`;

// A verificação manual existe apenas no executável desktop para Windows.
// A versão web e os APKs não recebem este controle nem chamam o atualizador.
if (
  versionLabel &&
  window.darkStudioDesktop?.isDesktop === true &&
  window.darkStudioDesktop.platform === "win32"
) {
  versionLabel.setAttribute("role", "button");
  versionLabel.setAttribute("tabindex", "0");
  versionLabel.setAttribute(
    "aria-label",
    "Verificar atualizações do DarkStudio",
  );
  versionLabel.title =
    "Clique para verificar atualizações do aplicativo desktop";
  versionLabel.style.cursor = "pointer";

  let checkingForDesktopUpdates = false;
  const runDesktopUpdateCheck = async () => {
    if (checkingForDesktopUpdates) return;
    checkingForDesktopUpdates = true;
    versionLabel.setAttribute("aria-busy", "true");
    versionLabel.dataset.previousText =
      versionLabel.textContent || `v${version}`;
    versionLabel.textContent = "Verificando atualizações...";

    try {
      await window.darkStudioDesktop.checkForUpdates();
    } catch (error) {
      console.error(
        "DarkStudio: falha ao iniciar a verificação manual de atualizações.",
        error,
      );
      window.alert(
        "Não foi possível verificar atualizações. Tente novamente mais tarde.",
      );
    } finally {
      versionLabel.textContent =
        versionLabel.dataset.previousText || `v${version}`;
      delete versionLabel.dataset.previousText;
      versionLabel.removeAttribute("aria-busy");
      checkingForDesktopUpdates = false;
    }
  };

  versionLabel.addEventListener("click", runDesktopUpdateCheck);
  versionLabel.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    runDesktopUpdateCheck();
  });
}

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

// Identifica o dispositivo antes de qualquer diagnóstico de inicialização.
detectDevice();
if (device === "Mobile") setDevMode(false);
document.documentElement.classList.toggle("mobile-device", device === "Mobile");

/**
 * Centralized developer feedback.
 * Keep application diagnostics in config.js so feature modules do not
 * write directly to the browser console.
 */
export function devLog(label, data) {
  if (!getDevMode()) return;
  if (data === undefined) console.log(label);
  else console.log(label, data);
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
    if (
      !dictionary ||
      typeof dictionary !== "object" ||
      Array.isArray(dictionary)
    ) {
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
    const response = await fetch("Extras/languages/index.json", {
      cache: "no-store",
    });
    if (response.ok) {
      const manifest = await response.json();
      if (Array.isArray(manifest.languages)) {
        languageCodes = manifest.languages
          .map((entry) => (typeof entry === "string" ? entry : entry?.code))
          .filter(
            (code) =>
              typeof code === "string" &&
              /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/.test(code),
          );
      }
    }
  } catch {
    // Fall back to known candidates; individual JSON checks below still filter missing files.
  }

  const catalogs = await Promise.all(
    languageCodes.map(async (code) => {
      try {
        const response = await fetch(`Extras/languages/${code}.json`, {
          cache: "no-store",
        });
        if (!response.ok) return null;
        const catalog = await response.json();
        if (!catalog || typeof catalog !== "object" || Array.isArray(catalog))
          return null;
        const languageName =
          typeof catalog.languageName === "string"
            ? catalog.languageName.trim()
            : "";
        return languageName ? { code, name: languageName } : null;
      } catch {
        return null;
      }
    }),
  );

  return catalogs.filter(Boolean);
}

async function populateLanguageSelector(languages) {
  const selector = document.getElementById("language-select");
  if (!selector || !languages.length) return;
  selector.replaceChildren(
    ...languages.map(({ code, name }) => {
      const option = document.createElement("option");
      option.value = code;
      option.textContent = name;
      return option;
    }),
  );
}

// Honor an explicit Settings choice; otherwise use a language available on disk.
const availableLanguages = await getAvailableLanguages();
await populateLanguageSelector(availableLanguages);
const supportedLanguages = availableLanguages.map(({ code }) => code);
const savedLanguage = localStorage.getItem("darkstudio-language");
const browserLanguage = (
  navigator.languages?.length
    ? navigator.languages
    : [navigator.language || "en-US"]
).map((locale) => String(locale).toLowerCase());
const exactBrowserLanguage = browserLanguage
  .map(
    (locale) =>
      availableLanguages.find(({ code }) => code.toLowerCase() === locale)
        ?.code,
  )
  .find(Boolean);
const detectedLanguage =
  exactBrowserLanguage ||
  (browserLanguage.some((locale) => locale.startsWith("pt"))
    ? supportedLanguages.find((code) => code.toLowerCase().startsWith("pt"))
    : browserLanguage.some((locale) => locale.startsWith("ru"))
      ? supportedLanguages.find((code) => code.toLowerCase().startsWith("ru"))
      : null) ||
  supportedLanguages.find((code) => code.toLowerCase() === "en-us") ||
  supportedLanguages[0] ||
  "en-US";
await loadLanguage(
  supportedLanguages.includes(savedLanguage) ? savedLanguage : detectedLanguage,
);
language = currentLang;
document.documentElement.lang = currentLang;

// ─────────────────────────────────────────────
// 📱 DEVICE DETECTION
// Detecção de Dispositivo
// ─────────────────────────────────────────────

const isDesktopApp = window.darkStudioDesktop?.isDesktop === true;
const isLocalDevelopmentOrigin =
  window.location.protocol === "http:" &&
  ["localhost", "127.0.0.1", "::1", "[::1]"].includes(window.location.hostname);
if (
  !isDesktopApp &&
  !OFFICIAL_ORIGINS.has(window.location.origin) &&
  !isLocalDevelopmentOrigin
) {
  if (sessionStorage.getItem(OFFICIAL_ORIGIN_UNLOCK_KEY) !== "true") {
    block = true;
    blockReasonKey = "blockedOrigin";
  }
}

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

// NightCoder é carregado ao abrir o Chat ou expandir as configurações de IA.
// O import dinâmico é deduplicado e pode ser tentado novamente após uma falha.
let nightCoderLoadPromise = null;
export function loadNightCoder() {
  if (blockWeb) return Promise.resolve(false);

  if (!nightCoderLoadPromise) {
    nightCoderLoadPromise = import("./AI.js")
      .then(() => true)
      .catch((error) => {
        nightCoderLoadPromise = null;
        console.error(
          "DarkStudio: não foi possível carregar o NightCoder.",
          error,
        );
        return false;
      });
  }

  return nightCoderLoadPromise;
}

window.darkStudioLoadNightCoder = loadNightCoder;

// ─────────────────────────────────────────────
// 📦 DYNAMIC SCRIPT & STYLE LOADERS
// Carregadores Dinâmicos de JS e CSS
// ─────────────────────────────────────────────

/**
 * Load internal JS module
 * Carrega um script JS interno
 * @param {string} name - file name without .js
 */
const internalScriptPromises = new Map();

function js(name) {
  if (internalScriptPromises.has(name)) return internalScriptPromises.get(name);
  const path = `Extras/Code/${name}.js`;

  const promise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = path;
    script.type = "module";
    script.onload = () => resolve(true);
    script.onerror = () => {
      bootLogs.push(`❌ ${name}.js`);
      internalScriptPromises.delete(name);
      resolve(false);
    };
    document.body.appendChild(script);
  });

  internalScriptPromises.set(name, promise);
  return promise;
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
const externalScriptPromises = new Map();

export function loadExternalScript(url) {
  if (externalScriptPromises.has(url)) return externalScriptPromises.get(url);

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.defer = true;
    script.onload = () => {
      bootLogs.push("✅ Color Thief");
      resolve();
    };
    script.onerror = () => {
      bootLogs.push("❌ Color Thief");
      externalScriptPromises.delete(url);
      reject(`Erro ao carregar ${url}`);
    };
    document.head.appendChild(script);
  });

  externalScriptPromises.set(url, promise);
  return promise;
}

// Recursos opcionais são carregados somente quando a funcionalidade que os usa é acionada.
window.darkStudioLoadExtensions = () => loadJS("extensions");
window.darkStudioLoadColorThief = () =>
  loadExternalScript(
    "https://cdnjs.cloudflare.com/ajax/libs/color-thief/2.3.2/color-thief.umd.js",
  );

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

  return new Promise((resolve) => {
    const link = document.createElement("link");

    link.rel = "stylesheet";
    link.href = path;

    link.onload = () => {
      // O container permanece oculto até que todos os módulos essenciais
      // (incluindo extensões) terminem de carregar no carregador principal.
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
    // Monaco e extensões têm inicialização própria: os módulos base não
    // devem aguardar recursos opcionais nem iniciar runtimes que não estão em uso.
    await Promise.all([loadJS("monaco"), loadJS("main")]);

    await loadCSS(device !== "Mobile" ? "dark.css" : "mobile.css");

    applyFavicon(mediaQuery);

    mediaQuery.addEventListener("change", applyFavicon);

    // Aguarda a restauração do Workspace antes de revelar a interface.
    // O limite evita manter a janela preta caso um módulo opcional falhe.
    await new Promise((resolve) => {
      if (window.darkStudioWorkspaceReady) {
        resolve();
        return;
      }
      let timeoutId;
      const finish = () => {
        window.removeEventListener("darkstudio:workspace-ready", finish);
        window.clearTimeout(timeoutId);
        resolve();
      };
      window.addEventListener("darkstudio:workspace-ready", finish, {
        once: true,
      });
      timeoutId = window.setTimeout(finish, 5000);
    });

    // Restaura a última área de trabalho aberta depois que os módulos de
    // interface e o Workspace estão prontos, sem disparar carregamentos duplicados.
    try {
      const savedView = localStorage.getItem(
        "darkstudio-active-workbench-view",
      );
      if (savedView === "settings") window.config?.();
    } catch {}

    const root = document.documentElement;
    const shouldAnimateBoot = root.classList.contains("ds-boot");
    root.classList.remove("ds-boot", "ds-boot-pending");
    if (shouldAnimateBoot) {
      root.classList.add("ds-boot-building");
      // A assinatura termina em 1,84 s; liberamos a interface antes de 2 s.
      await new Promise((resolve) => window.setTimeout(resolve, 1900));
      root.classList.remove("ds-boot-building");
    }
    root.classList.add("ds-boot-complete");
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
      <h5>By: Luiz.Olivrz</h5>
      <div style="margin-top:20px;font-size:12px;">
        <strong>${t("reason")}:</strong><br/>
        ${t(blockReasonKey).replaceAll("\n", "<br/>")}
      </div>
      ${
        blockReasonKey === "blockedOrigin"
          ? `
        <form id="origin-unlock-form" style="display:flex;flex-direction:column;gap:10px;width:min(320px,100%);margin-top:24px;">
          <label for="origin-unlock-password">${t("originPasswordLabel")}</label>
          <input id="origin-unlock-password" type="password" autocomplete="current-password" required style="box-sizing:border-box;width:100%;padding:10px;border:1px solid #fff;border-radius:6px;">
          <button type="submit" style="padding:10px;border:0;border-radius:6px;cursor:pointer;">${t("originPasswordSubmit")}</button>
          <p id="origin-unlock-error" role="status" aria-live="polite" style="margin:0;"></p>
        </form>
      `
          : ""
      }
    </div>
  `;

  document.title = "DarkStudio :(";

  const unlockForm = document.getElementById("origin-unlock-form");
  unlockForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = document.getElementById("origin-unlock-password");
    const errorMessage = document.getElementById("origin-unlock-error");
    const submitButton = unlockForm.querySelector("button[type='submit']");
    if (!(input instanceof HTMLInputElement) || !errorMessage || !submitButton)
      return;

    submitButton.disabled = true;
    errorMessage.textContent = "";
    try {
      const bytes = new TextEncoder().encode(input.value);
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const passwordHash = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      if (passwordHash !== OFFICIAL_ORIGIN_PASSWORD_HASH) {
        errorMessage.textContent = t("originPasswordInvalid");
        return;
      }

      sessionStorage.setItem(OFFICIAL_ORIGIN_UNLOCK_KEY, "true");
      window.location.reload();
    } catch (error) {
      console.error(
        "DarkStudio: could not validate the local unlock password.",
        error,
      );
      errorMessage.textContent = t("originPasswordUnavailable");
    } finally {
      submitButton.disabled = false;
    }
  });
}
