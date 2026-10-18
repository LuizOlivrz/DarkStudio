// 🌑 DarkStudio — Main Script / Script Principal
// ─────────────────────────────────────────────

let chatOpen = false;
export function chatOpenValue(value) {
  chatOpen = value;
}

// ─────────────────────────────────────────────
// 🧠 Chat Verification / Verificação do Chat
// ─────────────────────────────────────────────

export function ChatVerification() {
  return chatOpen;
}

// ─────────────────────────────────────────────
// 🚫 Block Access for Mobile Devices
// 🚫 Bloqueia acesso em dispositivos móveis
// ─────────────────────────────────────────────

import {
  blockWeb,
  setDevMode,
  getDevMode,
  t,
  getDevice,
  EXECUTOR_CONFIG,
  loadLanguage,
  devLog,
  getCurrentLanguage,
} from "./config.js";

if (!blockWeb) {
  // ─────────────────────────────────────────────
  // 🧠 Element References / Referências de Elementos
  // ─────────────────────────────────────────────

  const languageDisplay = document.querySelector("#code-language h4");
  const isMobile = getDevice();
  const borderColorInput = document.getElementById("border-color-input");
  const resetBorderColorButton = document.getElementById("reset-border-color");
  const accentColorInput = document.getElementById("accent-color-input");
  const resetAccentColorButton = document.getElementById("reset-accent-color");
  const executeButton = document.getElementById("execute");
  const iframeButton = document.getElementById("new-iframe-button");
  const downloadButton = document.getElementById("download-file");
  const clearButton = document.getElementById("clear");
  const editor = document.getElementById("Editor");
  const executorPanel = document.getElementById("executor-panel");
  const executorOutput = document.getElementById("executor-output");
  const configMenu = document.getElementById("config");
  const chat = document.getElementById("chat");
  const signatureInput = document.getElementById("signature-input");
  const resetSignatureButton = document.getElementById("reset-signature");
  const signatureElement = document.getElementById("signature");
  const WebsiteContainer = document.getElementById("Website-Container");
  const dynamicPanel = document.getElementById("dynamic-panel");
  const dynamicPanelText = document.getElementById("dynamic-panel-text");
  const dynamicPanelCheckbox = document.getElementById("dynamic-panel-checkbox");
  const pageOpenedAt = Date.now();
  let configValue = false;
  let panelIndex = 0;
  let panelRotationTimer = null;
  let dynamicPanelChangeTimer = null;
  let dynamicPanelChangeId = 0;
  let typingTimer = null;
  let isTyping = false;
  let weatherKey = "loadingWeather";
  let weatherTemperature = null;

  // ─────────────────────────────────────────────
  // 🗺️ Monaco Mode Map / Mapeamento de Linguagens
  // ─────────────────────────────────────────────

  const modeMap = {
    JavaScript: "javascript",
    Python: "python",
    Java: "java",
    HTML: "html",
    CSS: "css",
    "Batch (BAT/CMD)": "bat",
    Arduino: "cpp",
    JSON: "json",
    C: "c",
    "C++": "cpp",
    "C#": "csharp",
    SQL: "sql",
    Kotlin: "kotlin",
    ADB: "bat",
    SBV: "plaintext",
    VCF: "plaintext",
    Markdown: "markdown",
    Git: "plaintext",
    Texto: "plaintext",
    [t("text")]: "plaintext",
    [t("gitText")]: "plaintext",
    Rust: "rust",
    "Comece a escrever seu código e veja a linguagem aqui!": "plaintext",
    "Start writing your code and see the language here!": "plaintext",
  };

  // ─────────────────────────────────────────────
  // 🔄 Auto Language Detection / Detecção Automática
  // ─────────────────────────────────────────────

  function updateLanguageDisplay(language) {
    if (!window.editor) return;

    const model = window.editor.getModel();
    if (!model) return;

    const display = document.querySelector("#code-language h4");

    if (display && display.textContent !== language) {
      display.textContent = language;
    }

    const monacoLang =
      modeMap[language] ||
      ([t("text"), t("gitText"), t("startWriting")].includes(language)
        ? "plaintext"
        : null);

    if (monacoLang && model.getLanguageId() !== monacoLang) {
      monaco.editor.setModelLanguage(model, monacoLang);
    }
  }

  // ─────────────────────────────────────────────
  // ⚙️ Editor Initialization / Inicialização do Editor
  // ─────────────────────────────────────────────

  function initEditorEvents() {
    if (!window.editor) {
      setTimeout(initEditorEvents, 500);
      return;
    }

    // 1️⃣ Carrega código salvo do localStorage
    const savedCode = localStorage.getItem("codigoSalvo");

    if (savedCode) {
      window.editor.setValue(savedCode);
    }

    // 2️⃣ Detecta linguagem inicial e configura interface
    updateUI();

    // 3️⃣ Atualiza a interface quando o usuário digitar
    window.editor.onDidChangeModelContent(() => {
      scheduleCodeAnalysis();
      handleTypingActivity();
    });

    initDynamicPanel();
  }

  let languageTimer = null;

  function scheduleCodeAnalysis() {
    clearTimeout(languageTimer);

    languageTimer = setTimeout(() => {
      if (!window.editor) return;

      const code = window.editor.getValue().trim();
      const language = detectLanguage(code);

      updateUI(code, language);
    }, 180);
  }

  /**
   * Atualiza os botões e linguagem com base no código atual
   * Updates the buttons and language display based on current code
   */
  function updateUI(code, language) {
    // Se não foram fornecidos, obtém do editor
    if (code === undefined) {
      code = window.editor ? window.editor.getValue() : "";
    }

    if (language === undefined) {
      language = detectLanguage(code);
    }

    const isEmpty = code.trim() === "";

    updateLanguageDisplay(language);

    executeButton.style.display =
      language === "HTML" || language === "JavaScript" ? "block" : "none";

    iframeButton.style.display = language === "HTML" ? "block" : "none";

    downloadButton.style.display = isEmpty ? "none" : "inline-block";

    clearButton.style.display = isEmpty ? "none" : "inline-block";

    updateMediaPlayer(code);
  }

  initEditorEvents();

  // ─────────────────────────────────────────────
  // 🧭 Dynamic Panel / Painel Dinâmico
  // ─────────────────────────────────────────────

  function formatUptime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(
        seconds,
      ).padStart(2, "0")}s`;
    }

    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }

  function getClockText() {
    return `🕒 ${new Date().toLocaleTimeString(getCurrentLanguage(), {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  function getWeatherText() {
    const temperature = Number.isFinite(weatherTemperature)
      ? ` — ${weatherTemperature}°C`
      : "";
    return `☁️ ${t(weatherKey)}${temperature}`;
  }

  function getUptimeText() {
    return `⏱️ ${t("openFor")} ${formatUptime(Date.now() - pageOpenedAt)}`;
  }

  function getPanelText() {
    const panels = getAvailablePanels();
    return panels[panelIndex % panels.length]();
  }

  function isAppFullscreen() {
    return Boolean(
      document.fullscreenElement ||
      window.matchMedia?.("(display-mode: fullscreen)").matches,
    );
  }

  function getAvailablePanels() {
    return [...(isAppFullscreen() ? [getClockText] : []), getWeatherText, getUptimeText];
  }

  function setPanelText(text) {
    if (!dynamicPanel || !dynamicPanelText) return;
    if (
      dynamicPanelText.textContent === text &&
      dynamicPanelText.classList.contains("visible")
    ) {
      return;
    }

    if (dynamicPanelChangeTimer) clearTimeout(dynamicPanelChangeTimer);
    const changeId = ++dynamicPanelChangeId;
    const compact = window.matchMedia?.("(max-width: 700px)").matches;
    const minWidth = compact ? 104 : 120;
    const maxWidth = Math.max(minWidth, Math.min(compact ? 240 : 320, window.innerWidth * .42));
    const currentWidth = dynamicPanel.getBoundingClientRect().width || minWidth;

    dynamicPanel.classList.add("visible", "is-changing");
    dynamicPanelText.classList.remove("visible");
    dynamicPanel.style.flexBasis = `${currentWidth}px`;
    dynamicPanelText.textContent = text;

    const measure = document.createElement("span");
    const textStyle = getComputedStyle(dynamicPanelText);
    Object.assign(measure.style, {
      position: "fixed", visibility: "hidden", width: "max-content", maxWidth: "none",
      whiteSpace: "nowrap", font: textStyle.font, letterSpacing: textStyle.letterSpacing,
    });
    measure.textContent = text;
    dynamicPanel.appendChild(measure);
    const panelStyle = getComputedStyle(dynamicPanel);
    const extraWidth = [panelStyle.paddingLeft, panelStyle.paddingRight, panelStyle.borderLeftWidth, panelStyle.borderRightWidth]
      .reduce((total, value) => total + (Number.parseFloat(value) || 0), 0);
    const contentWidth = measure.getBoundingClientRect().width + extraWidth;
    measure.remove();
    const targetWidth = Math.min(maxWidth, Math.max(minWidth, contentWidth));

    dynamicPanel.getBoundingClientRect();
    requestAnimationFrame(() => {
      if (changeId !== dynamicPanelChangeId) return;
      dynamicPanel.style.flexBasis = `${targetWidth}px`;
      dynamicPanelChangeTimer = window.setTimeout(() => {
        if (changeId !== dynamicPanelChangeId) return;
        dynamicPanelText.classList.add("visible");
        dynamicPanel.style.flexBasis = "";
        dynamicPanel.classList.remove("is-changing");
        dynamicPanelChangeTimer = null;
      }, 190);
    });
  }

  function updateDynamicPanel() {
    if (isTyping) {
      setPanelText(t("typingHelp"));
      return;
    }

    setPanelText(getPanelText());
  }

  function cycleDynamicPanel() {
    if (isTyping) return;
    panelIndex = (panelIndex + 1) % getAvailablePanels().length;
    updateDynamicPanel();
  }

  function startPanelRotation() {
    if (panelRotationTimer) clearInterval(panelRotationTimer);
    panelRotationTimer = setInterval(cycleDynamicPanel, 8000);
  }

  function stopPanelRotation() {
    if (panelRotationTimer) {
      clearInterval(panelRotationTimer);
      panelRotationTimer = null;
    }
  }

  function handleTypingActivity() {
    isTyping = true;
    updateDynamicPanel();

    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = window.setTimeout(() => {
      isTyping = false;
      panelIndex = 0;
      updateDynamicPanel();
    }, 3800);
  }

  async function fetchWeather() {
    if (!navigator.geolocation) {
      weatherKey = "weatherDefault";
      updateDynamicPanel();
      return;
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 6000,
        });
      });

      const { latitude, longitude } = position.coords;
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`,
      );
      const data = await response.json();

      if (data && data.current_weather) {
        const weatherCode = data.current_weather.weathercode;
        const temp = Math.round(data.current_weather.temperature);
        weatherKey = mapWeatherCode(weatherCode);
        weatherTemperature = temp;
      } else {
        weatherKey = "weatherDefault";
        weatherTemperature = null;
      }
    } catch {
      weatherKey = "weatherDefault";
      weatherTemperature = null;
    }

    if (!isTyping) updateDynamicPanel();
  }

  function mapWeatherCode(code) {
    switch (code) {
      case 0:
        return "weatherClear";
      case 1:
      case 2:
        return "weatherPartlyCloudy";
      case 3:
        return "weatherCloudy";
      case 45:
      case 48:
        return "weatherFog";
      case 51:
      case 53:
      case 55:
        return "weatherDrizzle";
      case 61:
      case 63:
      case 65:
      case 80:
      case 81:
      case 82:
        return "weatherRain";
      case 71:
      case 73:
      case 75:
        return "weatherSnow";
      case 95:
      case 96:
      case 99:
        return "weatherStorm";
      default:
        return "weatherDefault";
    }
  }

  function initDynamicPanel() {
    if (!dynamicPanel || !dynamicPanelText) return;
    const panelHidden = localStorage.getItem("darkstudio-hide-dynamic-panel") === "true";
    if (dynamicPanelCheckbox) dynamicPanelCheckbox.checked = panelHidden;
    let visibilityTimer = null;
    let visibilityAnimationEnd = null;
    const setDynamicPanelVisibility = (hidden, animate = true) => {
      if (visibilityTimer) clearTimeout(visibilityTimer);
      if (visibilityAnimationEnd) dynamicPanel.removeEventListener("animationend", visibilityAnimationEnd);
      dynamicPanel.classList.remove("is-hiding", "is-showing");
      dynamicPanel.hidden = false;

      if (!animate) {
        dynamicPanel.hidden = hidden;
        dynamicPanel.setAttribute("aria-hidden", String(hidden));
        return;
      }

      dynamicPanel.setAttribute("aria-hidden", String(hidden));
      visibilityAnimationEnd = (event) => {
        if (event.target !== dynamicPanel) return;
        dynamicPanel.removeEventListener("animationend", visibilityAnimationEnd);
        visibilityAnimationEnd = null;
        dynamicPanel.classList.remove("is-hiding", "is-showing");
        dynamicPanel.hidden = hidden;
        visibilityTimer = null;
      };
      dynamicPanel.addEventListener("animationend", visibilityAnimationEnd);
      dynamicPanel.classList.add(hidden ? "is-hiding" : "is-showing");
      visibilityTimer = window.setTimeout(() => {
        visibilityAnimationEnd?.({ target: dynamicPanel });
      }, 500);
    };

    setDynamicPanelVisibility(panelHidden, false);
    dynamicPanelCheckbox?.addEventListener("change", () => {
      setDynamicPanelVisibility(dynamicPanelCheckbox.checked);
      localStorage.setItem("darkstudio-hide-dynamic-panel", String(dynamicPanelCheckbox.checked));
    });
    document.addEventListener("fullscreenchange", () => {
      panelIndex = 0;
      updateDynamicPanel();
    });
    window.addEventListener("resize", () => {
      panelIndex %= getAvailablePanels().length;
      updateDynamicPanel();
    });
    updateDynamicPanel();
    startPanelRotation();
    fetchWeather();
  }

  // ─────────────────────────────────────────────
  // 🧹 Remove código Markdown (inline e blocos)
  // ─────────────────────────────────────────────
  function stripMarkdownCode(code) {
    return code
      .replace(/```[\s\S]*?```/g, "") // blocos
      .replace(/`[^`]*`/g, ""); // inline
  }

  // ─────────────────────────────────────────────
  // 🧩 Language Detection / Detecção de Linguagem
  // ─────────────────────────────────────────────

  function detectLanguage(code) {
    if (code.trim() === "") {
      return t("startWriting");
    }

    // 👉 código limpo (sem inline/block code do Markdown)
    const cleanCode = stripMarkdownCode(code);

    // 🔗 Detecção genérica de URL: não exige lista de domínios.
    // Só classifica como link quando o conteúdo inteiro é uma URL, para não
    // confundir código-fonte que contém URLs com um link isolado.
    const linkCandidate = code.trim().replace(/[),.;!?]+$/, "");
    try {
      const parsedUrl = new URL(
        /^https?:\/\//i.test(linkCandidate)
          ? linkCandidate
          : `https://${linkCandidate}`
      );
      if (
        /^(https?:\/\/)/i.test(linkCandidate) &&
        ["http:", "https:"].includes(parsedUrl.protocol) &&
        parsedUrl.hostname.includes(".")
      ) {
        return "Link (URL)";
      }
    } catch {
      // Não é uma URL válida; continue a detecção normal da linguagem.
    }

    const isGit =
      (/^# Please enter the commit message/m.test(code) ||
        /^On branch\s+\w+/m.test(code)) &&
      !/\b(function|const|let|var|import|export|document\.)\b/.test(
        cleanCode,
      ) &&
      !/[{};]/.test(cleanCode);

    if (isGit) return t("gitText");

    // 📝 Markdown detection / Detecção de Markdown
    const isMarkdown =
      (/^#{1,6}\s+\S+/m.test(code) ||
        /^\s*>.+/m.test(code) ||
        /^```[\s\S]+```$/m.test(code.trim()) ||
        /\[[^\]]+\]\([^)]+\)/.test(code) ||
        /^\s*[-*+]\s+\S+/m.test(code) ||
        /\*\*[^*]+\*\*/.test(code) ||
        /_[^_]+_/.test(code)) &&
      !/[{}();]/.test(cleanCode) && // mata JS/CSS disfarçado
      !/<\/?[a-z][\s\S]*>/i.test(cleanCode);

    if (isMarkdown) return "Markdown";

    // HTML tem prioridade sobre JavaScript e CSS
    const hasHtmlStructure =
      /<!doctype\s+html\b/i.test(cleanCode) ||
      /<html(?:\s[^>]*)?>/i.test(cleanCode) ||
      /<head(?:\s[^>]*)?>/i.test(cleanCode) ||
      /<body(?:\s[^>]*)?>/i.test(cleanCode);

    if (hasHtmlStructure) {
      return "HTML";
    }

    // Fragmentos HTML sem documento completo
    const hasHtmlElements =
      /<(div|main|section|header|footer|nav|article|form|button|script|style|h[1-6])\b[^>]*>/i.test(
        cleanCode,
      );

    if (hasHtmlElements) {
      return "HTML";
    }

    // 👇 SÓ DEPOIS disso vem o JS
    const isJavaScript =
      (/\b(import|export)\s+.*from\s+['"]/.test(cleanCode) ||
        /\b(function\s+\w+|\(\)\s*=>|=>\s*\{)/.test(cleanCode) ||
        /\b(const|let|var)\s+\w+\s*=/.test(cleanCode) ||
        /\bconsole\.(log|warn|error)\s*\(/.test(cleanCode)) &&
      !/^\s*:(root)|@keyframes/.test(cleanCode);

    if (isJavaScript) return "JavaScript";

    if (/\bvoid\s+setup\s*\(\)|\bvoid\s+loop\s*\(\)/.test(cleanCode))
      return "Arduino";

    if (/public\s+class\s+\w+|static\s+void\s+main/.test(cleanCode))
      return "Java";

    if (/#include\s*<[^>]+>|cout\s*<<|cin\s*>>/.test(cleanCode)) return "C++";

    if (/using\s+\w+;|Console\.WriteLine/.test(cleanCode)) return "C#";

    if (/def\s+\w+\(.*\):|print\(/.test(cleanCode)) return "Python";

    if (/<(html|head|body|script|style|div)/i.test(cleanCode)) return "HTML";

    if (/^\/\*[\s\S]*?\*\//.test(cleanCode) && /:\s*[^;]+;/.test(cleanCode)) {
      return "CSS";
    }

    // CSS fallback forte (arquivo inteiro)
    if (
      /[a-zA-Z-]+\s*:\s*[^;]+;/.test(cleanCode) &&
      /{[\s\S]*}/.test(cleanCode) &&
      !/<\/?[a-z]/i.test(cleanCode) &&
      !/\b(fn|let|mut|println!|use\s+std::|impl|struct|enum)\b/.test(cleanCode)
    ) {
      return "CSS";
    }

    if (/fun\s+\w+\s*\(.*\)/.test(cleanCode)) return "Kotlin";

    const isRust =
      (/\bfn\s+main\s*\(\s*\)/.test(cleanCode) || // fn main()
        /\bfn\s+\w+\s*\([^)]*\)\s*(->\s*\w+)?\s*\{/.test(cleanCode) || // fn foo() {}
        /\blet\s+(mut\s+)?\w+/.test(cleanCode) || // let / let mut
        /\bprintln!\s*\(/.test(cleanCode) || // println!
        /\buse\s+[\w:]+;/.test(cleanCode) || // use std::...
        /\bimpl\s+\w+/.test(cleanCode) || // impl Struct
        /\bstruct\s+\w+/.test(cleanCode) || // struct
        /\benum\s+\w+/.test(cleanCode)) && // enum
      !/#include|cout\s*<<|Console\.WriteLine|print\(/.test(cleanCode) && // evita C++/C#/Python
      !/function\s+|=>/.test(cleanCode); // evita JS

    if (isRust) return "Rust";

    const isSQL =
      /^\s*(SELECT|INSERT|UPDATE|DELETE)\s+[\s\S]+?\s+(FROM|INTO|SET)\s+/im.test(
        cleanCode,
      ) &&
      /;\s*$|$/m.test(cleanCode) && // normalmente termina comando
      !/[{}]/.test(cleanCode) && // CSS/JS usam {}
      !/--bg|--[a-z-]+:/i.test(cleanCode); // variáveis CSS

    if (isSQL) return "SQL";

    const isJSON =
      /^\s*[\[{]/.test(cleanCode) && // começa com { ou [
      /"\s*[^"]+"\s*:\s*/.test(cleanCode) && // chave válida
      !/[;()=]/.test(cleanCode); // não é JS

    if (isJSON) {
      try {
        JSON.parse(cleanCode);
        return "JSON";
      } catch {}
    }

    if (/adb\s+(shell|devices|install|pull|push)/i.test(cleanCode))
      return "ADB";

    if (/BEGIN:VCARD/.test(cleanCode)) return "VCF";

    if (/^@echo\s+off|set\s+\w+=|pause/i.test(cleanCode))
      return "Batch (BAT/CMD)";

    const normalized = cleanCode.replace(/\s+/g, "");

    const isMathExpression =
      /^[0-9+\-*/%().,]+$/.test(normalized) && /[+\-*/%]/.test(normalized);

    if (isMathExpression) {
      try {
        const expression = normalized.replace(/(\d),(\d)/g, "$1.$2");

        const result = Function(`"use strict"; return (${expression})`)();

        return `${t("mathResult")} ${result.toLocaleString("pt-BR")}`;
      } catch (e) {
        console.error(e);
        return `${t("mathError")}`;
      }
    }

    if (/^[a-zA-ZÀ-ú0-9\s.,!?'"()-]+$/.test(cleanCode)) return t("text");

    return t("startWriting");
  }

  function updateMediaPlayer(code) {
    const player = document.getElementById("mini-player");
    const list = document.getElementById("mini-player-list");
    const toggle = document.getElementById("mini-player-toggle");
    if (!player || !list) return;
    const enabled = localStorage.getItem("darkstudio-mini-players-enabled") !== "false";
    player.hidden = !enabled;

    const text = typeof code === "string" ? code.trim() : "";
    // URLs are also found inside pasted iframe/embed HTML (src="...").
    const urls = text.match(/https?:\/\/[^\s<>"']+/gi) || [];
    const embeds = [];
    const seen = new Set();
    let websiteUrl = "";

    for (const rawUrl of urls) {
      const cleanedUrl = rawUrl.replace(/[),.;!?]+$/, "").replace(/&amp;/gi, "&");
      try {
        const url = new URL(cleanedUrl);
        const host = url.hostname.toLowerCase().replace(/^www\./, "");
        let embed = null;

        // YouTube links and pasted iframe src values.
        let videoId = "";
        if (host === "youtu.be") videoId = url.pathname.split("/").filter(Boolean)[0] || "";
        else if (["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"].includes(host)) {
          if (url.pathname === "/watch") videoId = url.searchParams.get("v") || "";
          else {
            const match = url.pathname.match(/^\/(shorts|live|embed|v)\/([^/]+)/);
            if (match) videoId = match[2];
          }
        }
        if (/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
          const isShort = /^\/shorts\//.test(url.pathname);
          embed = {
            type: "youtube",
            src: "https://www.youtube.com/embed/" + videoId + "?enablejsapi=1&origin=" + encodeURIComponent(location.origin),
            ratio: isShort ? "9 / 16" : "16 / 9",
            width: isShort ? 300 : 480,
            height: isShort ? 533 : 270,
            title: "YouTube video player"
          };
        }

        // Spotify track/album/playlist/artist embeds; keep the official Spotify card.
        if (!embed) {
          const spotify = getSpotifyInfo(cleanedUrl);
          if (spotify) embed = {
            type: "spotify",
            src: "https://open.spotify.com/embed/" + spotify.type + "/" + spotify.id + "?utm_source=generator",
            height: 352,
            title: "Spotify Embed: " + spotify.type,
            spotify: spotify
          };
        }

        // TikTok's documented inline player URL.
        if (!embed && host === "tiktok.com") {
          const match = url.pathname.match(/\/video\/(\d+)/);
          if (match) embed = {
            type: "tiktok",
            src: "https://www.tiktok.com/player/v1/" + match[1] + "?autoplay=0&music_info=1&description=1",
            ratio: "9 / 16",
            width: 338,
            height: 600,
            title: "TikTok video player"
          };
        }

        // Other platforms with documented iframe players.
        if (!embed && ["vimeo.com", "player.vimeo.com"].includes(host)) {
          const match = url.pathname.match(/(?:video\/)?(\d+)/);
          if (match) embed = { type: "vimeo", src: "https://player.vimeo.com/video/" + match[1], ratio: "16 / 9", width: 480, height: 270, title: "Vimeo video player" };
        }
        if (!embed && host === "dailymotion.com") {
          const match = url.pathname.match(/\/(?:video|embed\/video)\/([a-zA-Z0-9]+)/);
          if (match) embed = { type: "dailymotion", src: "https://www.dailymotion.com/embed/video/" + match[1], ratio: "16 / 9", width: 480, height: 270, title: "Dailymotion video player" };
        }
        if (!embed && host === "twitch.tv") {
          const clip = url.pathname.match(/^\/(?:[^/]+\/clip|clip)\/([A-Za-z0-9_-]+)/);
          const video = url.pathname.match(/^\/videos\/(\d+)/);
          if (clip) {
            const parent = encodeURIComponent(location.hostname || "localhost");
            embed = { type: "twitch", src: "https://clips.twitch.tv/embed?clip=" + clip[1] + "&parent=" + parent, ratio: "16 / 9", width: 480, height: 270, title: "Twitch clip player" };
          } else if (video) {
            const parent = encodeURIComponent(location.hostname || "localhost");
            embed = { type: "twitch", src: "https://player.twitch.tv/?video=" + video[1] + "&parent=" + parent, ratio: "16 / 9", width: 480, height: 270, title: "Twitch video player" };
          }
        }
        if (embed) {
          if (!seen.has(embed.src)) embeds.push(embed);
          seen.add(embed.src);
        } else if (!websiteUrl && /^https?:$/.test(url.protocol)) {
          websiteUrl = url.href;
        }
      } catch {
        // Ignore malformed URLs and continue.
      }
    }

    list.classList.toggle("mini-player-tiktok-stack", embeds.length > 1 && embeds.every(embed => embed.type === "tiktok"));
    list.replaceChildren(...embeds.map((embed, index) => {
      const item = document.createElement("div");
      item.className = "mini-player-item " + embed.type;
      if (embed.ratio) item.style.aspectRatio = embed.ratio;
      // The player controls the item size. Do not freeze each media card to its
      // provider's default dimensions, otherwise resizing only changes the shell.
      item.style.width = "100%";
      item.style.height = embed.type === "spotify" ? (embed.height ? embed.height + "px" : "152px") : "auto";
      item.style.flex = "0 0 auto";
      const iframe = document.createElement("iframe");
      iframe.src = embed.src;
      iframe.title = embed.title || (embed.type + " player " + (index + 1));
      iframe.loading = "lazy";
      iframe.referrerPolicy = embed.type === "youtube" ? "strict-origin-when-cross-origin" : "strict-origin-when-cross-origin";
      iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture; web-share";
      if (embed.height) iframe.style.height = embed.height + "px";
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.display = "block";
      item.appendChild(iframe);
      if (embed.spotify) updateSpotifyTheme(embed.spotify);
      return item;
    }));

    const playersEnabled = localStorage.getItem("darkstudio-mini-players-enabled") !== "false";
    player.hidden = !playersEnabled;
    player.classList.toggle("visible", playersEnabled && embeds.length > 0);
    if (toggle) toggle.hidden = !playersEnabled || embeds.length === 0;
    // Re-read the media ratio immediately when switching workspace files.
    // Expanded layout is owned by the mini-player controller below.
    if (player.classList.contains("is-expanded")) {
      requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    }
    player.dataset.pendingWebsite = websiteUrl;
    if (websiteUrl) window.dispatchEvent(new CustomEvent("darkstudio:url-detected", { detail: { url: websiteUrl } }));
  }

  // Pause every off-screen embed when scrolling through a stacked feed.
  function pauseMiniPlayerItem(item) {
    const iframe = item?.querySelector("iframe");
    if (!iframe?.contentWindow) return;
    try {
      if (item.classList.contains("youtube")) {
        iframe.contentWindow.postMessage(JSON.stringify({ event: "command", func: "pauseVideo", args: "" }), "*");
      } else if (item.classList.contains("tiktok")) {
        iframe.contentWindow.postMessage({ type: "pause" }, "*");
        iframe.contentWindow.postMessage(JSON.stringify({ type: "pause" }), "*");
      } else if (item.classList.contains("vimeo")) {
        iframe.contentWindow.postMessage({ method: "pause" }, "*");
      } else if (item.classList.contains("dailymotion")) {
        iframe.contentWindow.postMessage({ command: "pause" }, "*");
      }
    } catch (error) {
      console.debug("Não foi possível pausar o mini-player anterior.", error);
    }
  }

  document.getElementById("mini-player-list")?.addEventListener("scroll", (event) => {
    const list = event.currentTarget;
    if (!list.classList.contains("mini-player-tiktok-stack")) return;
    const items = [...list.querySelectorAll(".mini-player-item")];
    if (!items.length) return;
    const activeIndex = Math.max(0, Math.min(items.length - 1, Math.round(list.scrollTop / Math.max(1, items[0].getBoundingClientRect().height))));
    items.forEach((item, index) => {
      if (index !== activeIndex) pauseMiniPlayerItem(item);
    });
  }, { passive: true });

  const miniPlayerEnabledCheckbox = document.getElementById("mini-player-enabled-checkbox");
  if (miniPlayerEnabledCheckbox) {
    miniPlayerEnabledCheckbox.checked = localStorage.getItem("darkstudio-mini-players-enabled") !== "false";
    miniPlayerEnabledCheckbox.addEventListener("change", () => {
      localStorage.setItem("darkstudio-mini-players-enabled", String(miniPlayerEnabledCheckbox.checked));
      const player = document.getElementById("mini-player");
      const toggle = document.getElementById("mini-player-toggle");
      if (player) {
        player.hidden = !miniPlayerEnabledCheckbox.checked;
        player.classList.toggle("visible", miniPlayerEnabledCheckbox.checked && Boolean(player.querySelector("iframe")));
      }
      if (toggle) toggle.hidden = !miniPlayerEnabledCheckbox.checked || !Boolean(player?.querySelector("iframe"));
    });
  }

  document.getElementById("mini-player-toggle")?.addEventListener("click", (event) => {
    const toggle = event.currentTarget;
    const player = document.getElementById("mini-player");
    const collapsed = !player.classList.contains("collapsed");
    setMiniPlayersCollapsed(player, toggle, collapsed);
  });

  function setMiniPlayersCollapsed(player, toggle, collapsed) {
    if (!player || !toggle) return;
    player.classList.toggle("collapsed", collapsed);
    toggle.setAttribute("aria-pressed", String(collapsed));
    toggle.dataset.i18nTitle = collapsed ? "showMiniPlayers" : "hideMiniPlayers";
    toggle.dataset.i18nAriaLabel = toggle.dataset.i18nTitle;
    toggle.textContent = collapsed ? "▶" : "▾";
    toggle.title = t(toggle.dataset.i18nTitle);
    toggle.setAttribute("aria-label", toggle.title);
  }

  document.getElementById("mini-player")?.addEventListener("click", (event) => {
    const player = event.currentTarget;
    if (!player.classList.contains("collapsed") || event.target !== player) return;
    setMiniPlayersCollapsed(player, document.getElementById("mini-player-toggle"), false);
  });
  
  // Mini-player geometry: isolate player layout from the app grid and AI panel.
  (function initMiniPlayerMovement() {
    const player = document.getElementById("mini-player");
    const toolbar = document.getElementById("mini-player-toolbar");
    const expandButton = document.getElementById("mini-player-expand");
    const list = document.getElementById("mini-player-list");
    const editorSurface = document.getElementById("Editor");
    if (!player || !toolbar || !expandButton || !list || !editorSurface) return;

    const DEFAULT = { width: 360, height: 240 };
    const positionKey = "darkstudio-mini-player-position";
    const sizeKey = "darkstudio-mini-player-size";
    let restoreRect = null;
    let drag = null;
    let resize = null;
    let suppressClick = false;

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const getMedia = () => list.querySelector(".mini-player-item");
    const getRatio = (item) => {
      if (!item) return 16 / 9;
      const raw = (item.style.aspectRatio || "").replace(/\s/g, "");
      if (item.classList.contains("tiktok") || raw === "9/16") return 9 / 16;
      if (item.classList.contains("spotify")) return 1;
      if (raw && raw.includes("/")) {
        const [w, h] = raw.split("/").map(Number);
        if (w > 0 && h > 0) return w / h;
      }
      return 16 / 9;
    };
    const isExpanded = () => player.classList.contains("is-expanded");
    const setRect = (left, top, width, height, animate = true) => {
      player.style.position = "fixed";
      player.style.inset = "auto";
      player.style.left = Math.round(left) + "px";
      player.style.top = Math.round(top) + "px";
      player.style.right = "auto";
      player.style.bottom = "auto";
      player.style.width = Math.round(width) + "px";
      player.style.height = Math.round(height) + "px";
      player.style.setProperty("--mini-player-fit-width", Math.round(width) + "px");
      player.style.setProperty("--mini-player-fit-height", Math.round(height) + "px");
      player.classList.toggle("mini-player-resizing", !animate);
    };
    const syncMiniPlayerContent = (width, height) => {
      const items = [...list.querySelectorAll(".mini-player-item")];
      items.forEach(item => {
        item.style.width = "100%";
        if (!item.classList.contains("spotify")) {
          item.style.height = "auto";
          item.style.aspectRatio = item.style.aspectRatio || "16 / 9";
        }
      });
      player.style.setProperty("--mini-player-content-width", Math.round(width) + "px");
      player.style.setProperty("--mini-player-content-height", Math.round(height) + "px");
    };
    const savePosition = () => {
      const r = player.getBoundingClientRect();
      try {
        localStorage.setItem(positionKey, JSON.stringify({ left: r.left, top: r.top }));
        localStorage.setItem(sizeKey, JSON.stringify({ width: r.width, height: r.height }));
      } catch {}
    };
    const addCaption = (portrait) => {
      let caption = player.querySelector(".mini-player-orientation-caption");
      if (!caption) {
        caption = document.createElement("div");
        caption.className = "mini-player-orientation-caption";
        caption.setAttribute("aria-live", "polite");
        caption.textContent = "DARKSTUDIO • MINI-PLAYER";
        player.appendChild(caption);
      }
      caption.classList.toggle("portrait", portrait);
      caption.classList.toggle("landscape", !portrait);
      const messages = portrait
        ? ["DARKSTUDIO • MINI-PLAYER", "FOQUE NO CÓDIGO • VÍDEO ATIVO", "ARRASTE PARA MOVER • CANTO PARA REDIMENSIONAR"]
        : ["DARKSTUDIO • MINI-PLAYER", "VÍDEO ATIVO • EDITOR INDEPENDENTE", "ARRASTE PARA MOVER • CANTO PARA REDIMENSIONAR"];
      if (!caption.dataset.rotating) {
        caption.dataset.rotating = "true";
        let index = 0;
        caption.textContent = messages[index];
        window.setInterval(() => {
          if (!caption.isConnected || !isExpanded()) return;
          index = (index + 1) % messages.length;
          caption.classList.add("is-changing");
          window.setTimeout(() => {
            if (!caption.isConnected) return;
            caption.textContent = messages[index];
            caption.classList.remove("is-changing");
          }, 140);
        }, 2600);
      }
    };
    const clearExpandedState = () => {
      editorSurface.classList.remove("mini-player-fit-portrait", "mini-player-fit-landscape");
      editorSurface.style.removeProperty("--mini-player-fit-width");
      editorSurface.style.removeProperty("--mini-player-fit-height");
      player.classList.remove("is-expanded-portrait", "is-expanded-landscape", "mini-player-resizing");
      player.querySelector(".mini-player-orientation-caption")?.remove();
      player.querySelectorAll(".mini-player-caution-tape").forEach(el => el.remove());
    };
    const fitExpandedPlayer = () => {
      if (!isExpanded()) return;
      const item = getMedia();
      if (!item) return;
      const ratio = getRatio(item);
      const portrait = ratio < 1;
      // Use the editor's visible rectangle as a reference only. Never change Website-Container
      // or its grid tracks: options/chat keep their own columns and cannot be pushed around.
      const editorRect = editorSurface.getBoundingClientRect();
      const bounds = {
        left: Math.max(8, editorRect.left),
        top: Math.max(8, editorRect.top),
        width: Math.max(240, Math.min(editorRect.width || window.innerWidth - 32, window.innerWidth - 16)),
        height: Math.max(180, Math.min(editorRect.height || window.innerHeight - 100, window.innerHeight - 16))
      };
      const preferredWidth = portrait ? Math.min(bounds.width, bounds.height * ratio) : bounds.width;
      const preferredHeight = preferredWidth / ratio;
      const width = Math.max(180, Math.min(preferredWidth, bounds.width, bounds.height * ratio));
      const height = width / ratio;
      const left = clamp(bounds.left + (bounds.width - width) / 2, 8, window.innerWidth - width - 8);
      const top = clamp(bounds.top + (bounds.height - height) / 2, 8, window.innerHeight - height - 8);

      player.classList.toggle("is-expanded-portrait", portrait);
      player.classList.toggle("is-expanded-landscape", !portrait);
      editorSurface.classList.toggle("mini-player-fit-portrait", portrait);
      editorSurface.classList.toggle("mini-player-fit-landscape", !portrait);
      editorSurface.style.setProperty("--mini-player-fit-width", Math.round(width) + "px");
      editorSurface.style.setProperty("--mini-player-fit-height", Math.round(height) + "px");
      setRect(left, top, width, height);
      addCaption(portrait);
      devLog("layout expanded", {
        media: item.className, portrait, ratio, editor: { width: Math.round(editorRect.width), height: Math.round(editorRect.height) },
        player: { left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) }
      });
    };

    try {
      const savedPos = JSON.parse(localStorage.getItem(positionKey) || "null");
      const savedSize = JSON.parse(localStorage.getItem(sizeKey) || "null");
      const width = clamp(Number(savedSize?.width) || DEFAULT.width, 220, window.innerWidth - 16);
      const height = clamp(Number(savedSize?.height) || DEFAULT.height, 150, window.innerHeight - 16);
      const left = clamp(Number(savedPos?.left) || 20, 0, window.innerWidth - width);
      const top = clamp(Number(savedPos?.top) || 90, 0, window.innerHeight - height);
      setRect(left, top, width, height);
    } catch {}

    expandButton.addEventListener("click", () => {
      if (suppressClick) { suppressClick = false; return; }
      if (!isExpanded()) {
        const r = player.getBoundingClientRect();
        restoreRect = { left: r.left, top: r.top, width: r.width, height: r.height };
        player.classList.add("is-expanded");
        expandButton.textContent = "↙";
        expandButton.title = "Restaurar mini-player";
        expandButton.setAttribute("aria-label", "Restaurar mini-player");
        requestAnimationFrame(() => requestAnimationFrame(fitExpandedPlayer));
      } else {
        clearExpandedState();
        player.classList.remove("is-expanded");
        const r = restoreRect || { left: 20, top: 90, ...DEFAULT };
        setRect(clamp(r.left, 0, window.innerWidth-r.width), clamp(r.top, 0, window.innerHeight-r.height), r.width, r.height);
        expandButton.textContent = "⛶";
        expandButton.title = "Expandir mini-player";
        expandButton.setAttribute("aria-label", "Expandir mini-player");
        savePosition();
        devLog("layout restored", player.getBoundingClientRect().toJSON());
      }
    });

    // Drag the floating player from its toolbar. In expanded mode, drag from the expand/restore
    // control; route pointer movement through window so capture remains reliable over iframes.
    const startDrag = (event, handle) => {
      if (event.button !== 0 || (handle === toolbar && event.target.closest("button"))) return;
      if (handle === toolbar && isExpanded()) return;
      if (handle === expandButton && !isExpanded()) return;
      const r = player.getBoundingClientRect();
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: r.left, top: r.top, width: r.width, height: r.height, handle };
      try { handle.setPointerCapture?.(event.pointerId); } catch {}
      handle.style.touchAction = "none";
      player.classList.add("mini-player-dragging");
      event.preventDefault();
      event.stopPropagation();
      devLog("drag start", { expanded: isExpanded(), left: r.left, top: r.top });
    };
    const moveDrag = (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) suppressClick = true;
      const left = clamp(drag.left + dx, 8, window.innerWidth - drag.width - 8);
      const top = clamp(drag.top + dy, 8, window.innerHeight - drag.height - 8);
      setRect(left, top, drag.width, drag.height, false);
      if (isExpanded()) {
        player.style.setProperty("--mini-player-editor-left", Math.round(left) + "px");
        player.style.setProperty("--mini-player-editor-top", Math.round(top) + "px");
      }
      event.preventDefault();
    };
    const endDrag = (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      drag = null;
      player.classList.remove("mini-player-dragging", "mini-player-resizing");
      savePosition();
      devLog("drag end", player.getBoundingClientRect().toJSON());
      if (suppressClick) window.setTimeout(() => { suppressClick = false; }, 100);
    };
    toolbar.addEventListener("pointerdown", e => startDrag(e, toolbar));
    expandButton.addEventListener("pointerdown", e => startDrag(e, expandButton));
    window.addEventListener("pointermove", moveDrag, { passive: false });
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);

    // Resizing is available only in floating/text mode, never while expanded.
    // The 44px invisible target makes the corner much easier to grab while preserving its look.
    const resizeHandle = player.querySelector('.mini-player-resize-handle[data-resize="se"]');
    if (resizeHandle) {
      resizeHandle.addEventListener("pointerdown", event => {
        if (isExpanded() || player.classList.contains("collapsed")) return;
        const r = player.getBoundingClientRect();
        resize = { id: event.pointerId, x: event.clientX, y: event.clientY, width: r.width, ratio: getRatio(getMedia()), left: r.left, top: r.top };
        try { resizeHandle.setPointerCapture?.(event.pointerId); } catch {}
        player.classList.add("mini-player-resizing");
        event.preventDefault();
        event.stopPropagation();
        devLog("resize start", { width: r.width, height: r.height, ratio: resize.ratio });
      });
      const moveResize = event => {
        if (!resize || resize.id !== event.pointerId) return;
        if (isExpanded()) return;
        const dx = event.clientX - resize.x, dy = event.clientY - resize.y;
        const ratio = resize.ratio;
        const delta = Math.abs(dx) >= Math.abs(dy * ratio) ? dx : dy * ratio;
        const maxW = Math.min(window.innerWidth - resize.left - 8, (window.innerHeight - resize.top - 8) * ratio);
        const width = clamp(resize.width + delta, 180, Math.max(180, maxW));
        const height = width / ratio;
        setRect(resize.left, resize.top, width, height, false);
        syncMiniPlayerContent(width, height);
        event.preventDefault();
      };
      const stopResize = event => {
        if (!resize || resize.id !== event.pointerId) return;
        resize = null;
        player.classList.remove("mini-player-resizing");
        savePosition();
        devLog("resize complete", player.getBoundingClientRect().toJSON());
      };
      window.addEventListener("pointermove", moveResize, { passive: false });
      window.addEventListener("pointerup", stopResize);
      window.addEventListener("pointercancel", stopResize);
    }

    // Recompute only on viewport/media changes, not on every AI panel/grid mutation.
    window.addEventListener("resize", () => {
      if (isExpanded()) fitExpandedPlayer();
      else {
        const r = player.getBoundingClientRect();
        setRect(clamp(r.left, 0, window.innerWidth-r.width), clamp(r.top, 0, window.innerHeight-r.height), Math.min(r.width, window.innerWidth-16), Math.min(r.height, window.innerHeight-16));
      }
    });
    new ResizeObserver(() => {
      if (isExpanded()) fitExpandedPlayer();
    }).observe(editorSurface);
  })();


  // ─────────────────────────────────────────────
  // 💾 File Download / Download de Arquivo
  // ─────────────────────────────────────────────

  document.getElementById("download-file").addEventListener("click", () => {
    const code = window.editor.getValue();
    const language = detectLanguage(code);

    if (!code.trim()) {
      alert(t("codeEmpty"));
      return;
    }

    const extensionMap = {
      JavaScript: "js",
      Python: "py",
      Java: "java",
      HTML: "html",
      CSS: "css",
      "Batch (BAT/CMD)": "bat",
      Arduino: "ino",
      JSON: "json",
      C: "c",
      "C++": "cpp",
      "C#": "cs",
      SQL: "sql",
      Kotlin: "kt",
      SBV: "sbv",
      ADB: "bat",
      VCF: "vcf",
      Markdown: "md",
      Git: "git",
    };

    const extension = extensionMap[language] || "txt";
    const fileName = prompt(t("fileName"), t("defaultFile"));
    if (!fileName) return;

    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName}.${extension}`;
    link.click();
  });

  // ─────────────────────────────────────────────
  // ▶️ Execute Code / Executar Código
  // ─────────────────────────────────────────────

  let executorActive = false;

  function execute() {
    // =====================================================
    // VOLTAR PARA O EDITOR
    // =====================================================

    if (executorActive) {
      executorActive = false;

      if (executorPanel) {
        executorPanel.classList.remove("executor-visible");
      }

      if (editor) {
        editor.classList.remove("editor-hidden");
      }

      executeButton.textContent = t("execute");

      setTimeout(() => {
        if (!executorActive && executorOutput) {
          executorOutput.innerHTML = "";
        }

        if (!executorActive && executorPanel) {
          executorPanel.style.display = "none";
        }
      }, 300);

      return;
    }

    // =====================================================
    // OBTER CÓDIGO
    // =====================================================

    if (!window.editor) {
      console.error("DarkStudio: Monaco não encontrado.");
      return;
    }

    // Imported project files are previewed inside the existing sandboxed
    // executor. This keeps relative assets available without eval or access
    // to the DarkStudio page context.
    const projectPreview = window.getMindmapProjectPreview?.();
    if (projectPreview) {
      showExecutor();
      const iframe = createIsolatedFrame();
      iframe.title = "Prévia do projeto importado";
      iframe.srcdoc = projectPreview.html;
      iframe.addEventListener("load", () => setTimeout(projectPreview.revoke, 60000), { once: true });
      return;
    }

    const code = window.editor.getValue();
    const language = detectLanguage(code);

    if (!code.trim()) {
      alert(t("codeEmpty"));
      return;
    }

    // =====================================================
    // JAVASCRIPT
    // =====================================================

    if (language === "JavaScript") {
      if (!EXECUTOR_CONFIG.JavaScript) {
        alert(t("JSBlocked"));
        return;
      }

      showExecutor();

      executeIsolatedJavaScript(code);

      return;
    }

    // =====================================================
    // HTML
    // =====================================================

    if (language === "HTML") {
      if (!EXECUTOR_CONFIG.HTML) {
        alert(t("Errorhtmljs"));
        return;
      }

      showExecutor();

      executeIsolatedHTML(code);

      return;
    }

    alert(t("Errorhtmljs"));
  }

  // ─────────────────────────────────────────────
  // MOSTRA O EXECUTOR NA CÉLULA DO EDITOR
  // ─────────────────────────────────────────────

  function showExecutor() {
    if (!executorPanel || !executorOutput) {
      console.error(
        "DarkStudio Executor: #executor-panel ou #executor-output não encontrado.",
      );

      return;
    }

    executorActive = true;

    // limpa execução anterior
    executorOutput.innerHTML = "";

    // mostra o painel antes da animação
    executorPanel.style.display = "block";

    // força o navegador a reconhecer o display antes da animação
    requestAnimationFrame(() => {
      if (editor) {
        editor.classList.add("editor-hidden");
      }

      executorPanel.classList.add("executor-visible");
    });

    executeButton.textContent = t("returnToEditor");
  }

  // ─────────────────────────────────────────────
  // CRIA IFRAME SANDBOX
  // ─────────────────────────────────────────────

  function createIsolatedFrame() {
    const iframe = document.createElement("iframe");

    iframe.setAttribute("sandbox", "allow-scripts");

    iframe.setAttribute("title", "DarkStudio Executor");

    iframe.setAttribute("frameborder", "0");

    executorOutput.appendChild(iframe);

    return iframe;
  }

  // ─────────────────────────────────────────────
  // EXECUTOR JAVASCRIPT
  // ─────────────────────────────────────────────

  function executeIsolatedJavaScript(code) {
    const iframe = createIsolatedFrame();

    const safeCode = code.replace(/<\/script>/gi, "<\\/script>");

    iframe.srcdoc = `
<!doctype html>

<html>

<head>

<meta charset="utf-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1"
/>

<style>

html,
body {

  margin: 0;
  padding: 0;

  width: 100%;
  height: 100%;

  background: #071012;

  color: #00ff88;

  font-family: monospace;

}

#output {

  width: 100%;
  height: 100%;

  box-sizing: border-box;

  padding: 16px;

  overflow: auto;

  white-space: pre-wrap;

}

.error {

  color: #ff6b6b;

}

</style>

</head>

<body>

<div id="output"></div>

<script>

(() => {

  const output =
    document.getElementById("output");


  function stringify(value) {

    if (typeof value === "string") {
      return value;
    }

    try {

      return JSON.stringify(
        value,
        null,
        2
      );

    } catch {

      return String(value);

    }

  }


  const originalLog =
    console.log;

  const originalWarn =
    console.warn;

  const originalError =
    console.error;


  console.log = (...args) => {

    originalLog(...args);

    output.textContent +=
      args.map(stringify).join(" ")
      + "\\n";

  };


  console.warn = (...args) => {

    originalWarn(...args);

    output.textContent +=
      "⚠️ "
      + args.map(stringify).join(" ")
      + "\\n";

  };


  console.error = (...args) => {

    originalError(...args);

    const line =
      document.createElement("div");

    line.className = "error";

    line.textContent =
      "❌ "
      + args.map(stringify).join(" ");

    output.appendChild(line);

  };


  window.onerror =
    (message, source, line, column, error) => {

      console.error(
        error?.stack || message
      );

      return true;

    };


  window.onunhandledrejection =
    (event) => {

      console.error(
        event.reason
      );

    };


  try {

    ${safeCode}

  } catch (error) {

    console.error(error);

  }

})();

<\/script>

</body>

</html>
`;
  }

  // ─────────────────────────────────────────────
  // EXECUTOR HTML
  // ─────────────────────────────────────────────

  // ─────────────────────────────────────────────
  // EXECUTOR HTML
  // ─────────────────────────────────────────────

  // ─────────────────────────────────────────────
  // EXECUTOR HTML
  // ─────────────────────────────────────────────

  function executeIsolatedHTML(code) {
    const iframe = createIsolatedFrame();

    iframe.srcdoc = `

<style>
/* =====================================================
   DARKSTUDIO DEFAULT HTML STYLE

   Apenas o padrão inicial.
   O CSS do usuário pode sobrescrever tudo.
   ===================================================== */

   html {
   color: #5d00ff;
   }
</style>
${code}

`;
  }

  // ─────────────────────────────────────────────

  window.execute = execute;

  // ─────────────────────────────────────────────
  // ⚙️ Config Panel / Painel de Configuração
  // ─────────────────────────────────────────────

  function config() {
    document.getElementById("Website-Container")?.classList.remove("extensions-active");
    const extensionsPanel = document.getElementById("extensions-panel");
    if (extensionsPanel) extensionsPanel.hidden = true;
    configValue = !WebsiteContainer.classList.contains("settings-active");
    WebsiteContainer.classList.toggle("settings-active", configValue);
    configMenu.scrollTop = 0;
    requestAnimationFrame(() => window.editor?.layout());
  }

  window.config = config;

  function setupPanelResizers() {
    const storedNumber = (key, fallback, minimum, maximum) => {
      const value = Number(localStorage.getItem(key));
      return Number.isFinite(value) && value >= minimum && value <= maximum ? value : fallback;
    };
    const isCompact = window.innerWidth <= 700;
    const optionMinimum = isCompact ? 116 : 148;
    const optionDefault = isCompact ? 126 : 160;
    const chatDefault = window.innerWidth <= 700 ? 240 : 350;
    const chatMax = Math.max(180, Math.min(720, window.innerWidth * .58));
    const optionsMax = Math.max(optionMinimum, Math.min(360, window.innerWidth * .42));
    const optionsWidth = storedNumber("darkstudio-options-width", Math.min(optionDefault, optionsMax), optionMinimum, optionsMax);
    const chatWidth = storedNumber("darkstudio-chat-width", Math.min(chatDefault, chatMax), 180, chatMax);
    WebsiteContainer.style.setProperty("--options-width", `${optionsWidth}px`);
    WebsiteContainer.style.setProperty("--chat-width", `${chatWidth}px`);

    const constraints = {
      "options-resize-handle": {
        key: "darkstudio-options-width", variable: "--options-width", axis: "x", direction: 1,
        min: optionMinimum, max: () => Math.max(optionMinimum, Math.min(360, WebsiteContainer.clientWidth * .42)), initial: optionDefault, unit: "px",
      },
      "chat-resize-handle": {
        key: "darkstudio-chat-width", variable: "--chat-width", axis: "x", direction: -1,
        min: 180, max: () => Math.min(720, WebsiteContainer.clientWidth * .58), initial: chatDefault, unit: "px",
      },
    };

    for (const [id, config] of Object.entries(constraints)) {
      const handle = document.getElementById(id);
      if (!handle) continue;
      const current = () => {
        const raw = getComputedStyle(WebsiteContainer).getPropertyValue(config.variable).trim();
        const value = Number.parseFloat(raw);
        return Number.isFinite(value) ? value : config.initial;
      };
      const apply = (value) => {
        const maximum = typeof config.max === "function" ? config.max() : (config.max ?? 98);
        const clamped = Math.min(maximum, Math.max(config.min, value));
        WebsiteContainer.style.setProperty(config.variable, `${clamped}${config.unit}`);
        localStorage.setItem(config.key, String(clamped));
        requestAnimationFrame(() => window.editor?.layout());
      };
      handle.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        handle.setPointerCapture?.(event.pointerId);
        const startValue = current();
        const startPoint = config.axis === "x" ? event.clientX : event.clientY;
        const move = (nextEvent) => {
          const delta = (config.axis === "x" ? nextEvent.clientX : nextEvent.clientY) - startPoint;
          const scaledDelta = config.unit === "dvh" ? (delta / window.innerHeight) * 100 : delta;
          apply(startValue + scaledDelta * config.direction);
        };
        const stop = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", stop);
          window.removeEventListener("pointercancel", stop);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", stop, { once: true });
        window.addEventListener("pointercancel", stop, { once: true });
      });
      handle.addEventListener("keydown", (event) => {
        const keys = config.axis === "x" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
        if (!keys.includes(event.key)) return;
        event.preventDefault();
        const delta = event.key === keys[1] ? 12 : -12;
        apply(current() + delta * config.direction);
      });
      window.addEventListener("resize", () => {
        const maximum = typeof config.max === "function" ? config.max() : (config.max ?? 98);
        if (current() > maximum) apply(maximum);
      });
    }
  }

  setupPanelResizers();

  // ─────────────────────────────────────────────
  // ⚙️ Shortcuts / Atalhos
  // ─────────────────────────────────────────────

  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey && e.key === ",") {
      e.preventDefault(); // impede o comportamento padrão do browser
      config(); // chama sua função
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && (e.key === "`" || e.code === "Backquote")) {
      execute();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.repeat) return;

    if (e.ctrlKey && e.key.toLowerCase() === "i") {
      e.preventDefault();

      const input = document.getElementById("input");
      const inlineChat = document.getElementById("inline-chat");

      if (inlineChat.style.opacity === "1") {
        inlineChat.style.opacity = "0";
        return;
      }

      if (e.shiftKey) return;

      if (chatOpen) {
        input.blur();
        document.getElementById("Editor-Input").focus();

        WebsiteContainer.classList.remove("with-chat");
        WebsiteContainer.classList.add("no-chat");

        chat.style.display = "none";

        chatOpen = false;
      } else {
        input.focus();

        chat.style.display = "flex";
        chat.style.pointerEvents = "auto";

        WebsiteContainer.classList.remove("no-chat");
        WebsiteContainer.classList.add("with-chat");

        chatOpen = true;
      }
    }
  });

  // ─────────────────────────────────────────────
  // 🌐 Network Status / Status da Conexão
  // ─────────────────────────────────────────────

  function handleNetworkChange() {
    const aviso = document.getElementById("network-status");
    const login = document.getElementById("login");

    if (!navigator.onLine && isMobile !== "Mobile") {
      if (getDevMode()) console.warn("🔴 " + t("offline"));
      if (aviso) {
        aviso.textContent = t("noInternet");
        setTimeout(() => {
          aviso.style.opacity = "1";
        }, 300);
      }
      if (login) {
        login.style.opacity = "0";
      }
    } else {
      if (getDevMode()) console.log("🟢 " + t("online"));
      if (aviso) {
        aviso.textContent = t("onInternet");
      }
      if (login) {
        login.style.opacity = "1";
      }

      setTimeout(() => {
        if (aviso) aviso.style.opacity = "0";
      }, 1000);
    }
  }

  window.addEventListener("online", handleNetworkChange);
  window.addEventListener("offline", handleNetworkChange);

  document.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.blur(); // remove o foco
    });
  });

  function setSignature(text) {
    text = text.substring(0, 22);

    if (signatureInput) signatureInput.value = text;
    if (signatureElement) signatureElement.textContent = text;

    localStorage.setItem("signature", text);
  }

  const DEFAULT_SIGNATURE = "LUIZzz";

  const savedSignature = localStorage.getItem("signature");
  setSignature(savedSignature || DEFAULT_SIGNATURE);

  let signatureTimeout;

  if (signatureInput) {
    signatureInput.addEventListener("input", (event) => {
      const value = event.target.value.substring(0, 22);

      if (signatureElement) {
        signatureElement.textContent = value || DEFAULT_SIGNATURE;
      }
    });

    signatureInput.addEventListener("blur", () => {
      const value = signatureInput.value.trim();

      setSignature(value || DEFAULT_SIGNATURE);
    });
  }

  if (resetSignatureButton) {
    resetSignatureButton.addEventListener("click", () => {
      setSignature(DEFAULT_SIGNATURE);
    });
  }

  // ─────────────────────────────────────────────
  // 🖥️ Screen Size Check / Verificação de Tela
  // ─────────────────────────────────────────────

  function checkScreenWidth() {
    const existing = document.getElementById("min-width-overlay");

    if (window.innerWidth < 620 || window.innerHeight < 700) {
      if (!existing) {
        document.body.dataset.prevOverflow = document.body.style.overflow || "";
        document.body.style.overflow = "hidden";

        const overlay = document.createElement("div");
        overlay.id = "min-width-overlay";
        Object.assign(overlay.style, {
          position: "fixed",
          top: "0",
          left: "0",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)", // Safari
          color: "#fff",
          fontFamily: "sans-serif",
          textAlign: "center",
          padding: "20px",
          boxSizing: "border-box",
          zIndex: "999999",
        });
        overlay.innerHTML = `
        <h1>${t("screenTooSmallTitle")}</h1>
        <p>${t("screenTooSmallText")}</p>
      `;
        document.body.appendChild(overlay);
      }
    } else if (existing) {
      existing.remove();
      document.body.style.overflow = document.body.dataset.prevOverflow || "";
      delete document.body.dataset.prevOverflow;
    }
  }

  window.addEventListener("load", checkScreenWidth);
  window.onload = function () {
    checkScreenWidth();
  };
  window.addEventListener("resize", checkScreenWidth);

  // ─────────────────────────────────────────────
  // 🖼 Background image + blur controls
  // Adds a full-page background image element and settings
  // ─────────────────────────────────────────────

  function toggleBg(enable) {
    const pageBg = document.getElementById("page-bg");
    if (!pageBg) return;
    if (enable) pageBg.classList.add("active");
    else pageBg.classList.remove("active");
  }

  let wallpaperColorStatusKey = "";

  function setWallpaperColorStatus(messageKey) {
    const status = document.getElementById("wallpaper-colors-status");
    if (!status) return;
    wallpaperColorStatusKey = messageKey || "";
    status.textContent = messageKey ? t(messageKey) : "";
    status.hidden = !messageKey;
  }

  window.addEventListener("darkstudio:languagechange", () => {
    setWallpaperColorStatus(wallpaperColorStatusKey);
  });

  function colorToHex(color) {
    return `#${color
      .map((channel) =>
        Math.max(0, Math.min(255, Math.round(channel)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")}`;
  }

  function applyWallpaperColors() {
    const wallpaperColorsInput = document.getElementById("wallpaper-colors-checkbox");
    if (!wallpaperColorsInput?.checked) return;

    const root = document.documentElement;
    const storedPrimary = localStorage.getItem("wallpaperPrimaryColor") || "#5d00ff";
    const storedSecondary = localStorage.getItem("wallpaperSecondaryColor") || "#5d00ff";
    root.style.setProperty("--primary-color", storedPrimary);
    root.style.setProperty("--secondary-color", storedSecondary);
    const storedSecondaryRgb = storedSecondary.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
    if (storedSecondaryRgb) {
      root.style.setProperty(
        "--secondary-rgb",
        `${parseInt(storedSecondaryRgb[1], 16)}, ${parseInt(storedSecondaryRgb[2], 16)}, ${parseInt(storedSecondaryRgb[3], 16)}`,
      );
    }

    const image = document.getElementById("page-bg-img");
    if (!image?.complete || !image.naturalWidth) {
      setWallpaperColorStatus("wallpaperColorsMissing");
      return;
    }

    if (typeof window.ColorThief !== "function") {
      console.error("Dynamic wallpaper colors require Color Thief, but it is unavailable.");
      setWallpaperColorStatus("wallpaperColorsUnavailable");
      return;
    }

    try {
      const palette = new window.ColorThief().getPalette(image, 2);
      if (!Array.isArray(palette) || !Array.isArray(palette[0]) || palette[0].length < 3) {
        throw new Error("Color Thief returned an invalid wallpaper palette.");
      }
      const primary = colorToHex(palette[0]);
      const secondaryRgb = palette[1] || palette[0];
      const secondary = colorToHex(secondaryRgb);

      localStorage.setItem("wallpaperPrimaryColor", primary);
      localStorage.setItem("wallpaperSecondaryColor", secondary);
      root.style.setProperty("--primary-color", primary);
      root.style.setProperty("--secondary-color", secondary);
      root.style.setProperty("--secondary-rgb", secondaryRgb.join(", "));
      setWallpaperColorStatus("");
    } catch (error) {
      console.error("Could not extract colors from the wallpaper:", error);
      setWallpaperColorStatus("wallpaperColorsError");
    }
  }

  function initBackgroundFeature() {
    const checkbox = document.getElementById("bg-image-checkbox");
    const fileInput = document.getElementById("bg-image-file");
    const range = document.getElementById("bg-blur-range");
    const valueSpan = document.getElementById("bg-blur-value");
    const pageBgImg = document.getElementById("page-bg-img");

    if (!checkbox) return; // nothing to do if UI not present

    // Load saved values
    const savedEnabled = localStorage.getItem("bgEnabled") === "true";
    const savedImg = localStorage.getItem("bgImageData") || "";
    const savedBlur = parseInt(localStorage.getItem("bgBlur") || "10", 10);

    pageBgImg?.addEventListener("load", applyWallpaperColors);
    pageBgImg?.addEventListener("error", () => {
      if (localStorage.getItem("wallpaperColorsEnabled") === "true") {
        setWallpaperColorStatus("wallpaperColorsError");
      }
    });
    checkbox.checked = savedEnabled;
    if (savedImg && pageBgImg) pageBgImg.src = savedImg;
    if (range) {
      range.value = savedBlur;
      if (valueSpan) valueSpan.textContent = String(savedBlur);
      document.documentElement.style.setProperty("--bg-blur", savedBlur + "px");
    }

    // Ensure UI reflects current enabled state
    setTimeout(() => toggleBg(savedEnabled), 10);

    checkbox.addEventListener("change", (e) => {
      const v = e.target.checked;
      localStorage.setItem("bgEnabled", String(v));
      toggleBg(v);
    });

    if (fileInput) {
      fileInput.addEventListener("change", (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        if (f.type && !f.type.startsWith("image/")) {
          console.error("The selected background file is not an image.");
          if (localStorage.getItem("wallpaperColorsEnabled") === "true") {
            setWallpaperColorStatus("wallpaperColorsError");
          }
          return;
        }
        const reader = new FileReader();
        reader.onerror = () => {
          console.error("Could not read the selected background image:", reader.error);
          if (localStorage.getItem("wallpaperColorsEnabled") === "true") {
            setWallpaperColorStatus("wallpaperColorsError");
          }
        };
        reader.onload = () => {
          if (pageBgImg && typeof reader.result === "string") {
            pageBgImg.src = reader.result;
          }
          try {
            if (typeof reader.result === "string") {
              localStorage.setItem("bgImageData", reader.result);
            }
          } catch (err) {
            if (getDevMode())
              console.warn("Could not persist background image:", err);
          }
          // Auto-enable background when a new image is selected
          try {
            if (checkbox) {
              checkbox.checked = true;
              localStorage.setItem("bgEnabled", "true");
              toggleBg(true);
            }
          } catch (err) {
            if (getDevMode()) console.warn("Error enabling background:", err);
          }
        };
        reader.readAsDataURL(f);
      });
    }

    if (range) {
      range.addEventListener("input", (e) => {
        const r = e.target.value;
        if (valueSpan) valueSpan.textContent = r;
        document.documentElement.style.setProperty("--bg-blur", r + "px");
        localStorage.setItem("bgBlur", String(r));
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBackgroundFeature);
  } else {
    initBackgroundFeature();
  }

  function fixLanguage() {
    const upload = document.getElementById("load-button");
    const mindMap = document.getElementById("mindmap-button");
    const clear = document.getElementById("clear");
    const execute = document.getElementById("execute");
    const dowload = document.getElementById("download-file");
    const mindMapClear = document.getElementById("mindmap-clear");
    const mindMapConnect = document.getElementById("mindmap-connect");
    const mindMapAdd = document.getElementById("mindmap-add-files");
    const setLabel = (element, key) => {
      if (!element) return;
      const content = element.querySelector("[data-i18n]") || element;
      content.textContent = t(key);
    };
    setLabel(upload, "upload");
    setLabel(clear, "clear");
    setLabel(execute, "execute");
    setLabel(dowload, "download");
    setLabel(mindMap, "mindMap");
    setLabel(mindMapClear, "mindMapClear");
    setLabel(mindMapConnect, "mindMapConnect");
    setLabel(mindMapAdd, "mindMapAdd");

    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    document.querySelectorAll("#send, #inline-send").forEach((button) => {
      button.textContent = t("send");
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      element.placeholder = t(element.dataset.i18nPlaceholder);
    });
    document.querySelectorAll("[data-i18n-title]").forEach((element) => {
      element.title = t(element.dataset.i18nTitle);
    });
    document.querySelectorAll("[data-i18n-alt]").forEach((element) => {
      element.alt = t(element.dataset.i18nAlt);
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
    });
    document.querySelectorAll("[data-i18n-content]").forEach((element) => {
      element.content = t(element.dataset.i18nContent);
    });

    const languageSelect = document.getElementById("language-select");
    if (languageSelect) languageSelect.value = getCurrentLanguage();
    document.documentElement.lang = getCurrentLanguage();
  }

  window.applyDarkStudioTranslations = fixLanguage;

  const languageSelect = document.getElementById("language-select");
  languageSelect?.addEventListener("change", async () => {
    await loadLanguage(languageSelect.value);
    localStorage.setItem("darkstudio-language", getCurrentLanguage());
    fixLanguage();
    updateDynamicPanel();
    handleNetworkChange();
    if (window.editor) {
      const currentCode = window.editor.getValue();
      updateLanguageDisplay(detectLanguage(currentCode));
    }
    window.dispatchEvent(new Event("darkstudio:languagechange"));
  });

  fixLanguage();

  const devModeCheckbox = document.getElementById("dev-mode-checkbox");
  devModeCheckbox.checked = getDevMode();

  // Ao mudar o checkbox
  devModeCheckbox.addEventListener("change", function () {
    const newValue = this.checked;
    setDevMode(newValue);
    console.log("Dev Mode atualizado:", getDevMode());
  });

  function saveCheckboxState() {
    localStorage.setItem("autoBackground", String(autoCheckbox.checked));
  }

  function loadCheckboxState() {
    const savedAuto = localStorage.getItem("autoBackground");

    if (savedAuto !== null) {
      autoCheckbox.checked = savedAuto === "true";
      autoBackground = autoCheckbox.checked;
    }

    if (devModeCheckbox) devModeCheckbox.checked = getDevMode();
  }

  loadCheckboxState();

  const seasonalThemeInput = document.getElementById("auto-fest-checkbox");
  const wallpaperColorsInput = document.getElementById("wallpaper-colors-checkbox");
  const seasonalThemeOption = document.getElementById("seasonal-theme-option");
  const wallpaperColorsOption = document.getElementById("wallpaper-colors-option");
  const customColorSettings = document.getElementById("custom-color-settings");
  const savedSeasonalTheme = localStorage.getItem("autoTheme");
  const wallpaperColorsEnabled = localStorage.getItem("wallpaperColorsEnabled") === "true";

  if (seasonalThemeInput && savedSeasonalTheme !== null) {
    seasonalThemeInput.checked = savedSeasonalTheme === "true";
  }
  if (wallpaperColorsInput) wallpaperColorsInput.checked = wallpaperColorsEnabled;
  if (wallpaperColorsEnabled && seasonalThemeInput) {
    seasonalThemeInput.checked = false;
    localStorage.setItem("autoTheme", "false");
  }

  function updateAppearanceOptions() {
    const seasonalEnabled = Boolean(seasonalThemeInput?.checked);
    const wallpaperEnabled = Boolean(wallpaperColorsInput?.checked);
    if (seasonalThemeOption) seasonalThemeOption.hidden = wallpaperEnabled;
    if (wallpaperColorsOption) wallpaperColorsOption.hidden = seasonalEnabled;
    if (customColorSettings) {
      customColorSettings.hidden = seasonalEnabled || wallpaperEnabled;
    }
  }

  window.darkStudioUpdateAppearanceOptions = updateAppearanceOptions;

  function setBorderColor(color) {
    if (!color) return;
    document.documentElement.style.setProperty("--primary-color", color);
    localStorage.setItem("borderColor", color);
    if (borderColorInput) borderColorInput.value = color;
  }

  function setAccentColor(color) {
    if (!color) return;
    document.documentElement.style.setProperty("--secondary-color", color);
    const rgb = color.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
    if (rgb) {
      document.documentElement.style.setProperty(
        "--secondary-rgb",
        `${parseInt(rgb[1], 16)}, ${parseInt(rgb[2], 16)}, ${parseInt(rgb[3], 16)}`,
      );
    }
    localStorage.setItem("accentColor", color);
    if (accentColorInput) accentColorInput.value = color;
  }

  const savedBorderColor = localStorage.getItem("borderColor");
  const hasCustomBorderColor =
    savedBorderColor &&
    (localStorage.getItem("borderColorCustomized") === "true" ||
      !["#ff8a3d", "#683ab7"].includes(savedBorderColor.toLowerCase()));
  if (hasCustomBorderColor) {
    setBorderColor(savedBorderColor);
  } else {
    setBorderColor("#5d00ff");
  }

  const savedAccentColor = localStorage.getItem("accentColor");
  const hasCustomAccentColor =
    savedAccentColor &&
    (localStorage.getItem("accentColorCustomized") === "true" ||
      !["#ff6700", "#683ab7"].includes(savedAccentColor.toLowerCase()));
  if (hasCustomAccentColor) {
    setAccentColor(savedAccentColor);
  } else {
    setAccentColor("#5d00ff");
  }

  function applySavedCustomColors() {
    const border = localStorage.getItem("borderColor");
    const accent = localStorage.getItem("accentColor");
    const legacyDefaults = ["#ff8a3d", "#ff6700", "#683ab7"];
    setBorderColor(
      border && !legacyDefaults.includes(border.toLowerCase()) ? border : "#5d00ff",
    );
    setAccentColor(
      accent && !legacyDefaults.includes(accent.toLowerCase()) ? accent : "#5d00ff",
    );
  }

  updateAppearanceOptions();

  seasonalThemeInput?.addEventListener("change", () => {
    if (seasonalThemeInput.checked && wallpaperColorsInput) {
      wallpaperColorsInput.checked = false;
      localStorage.setItem("wallpaperColorsEnabled", "false");
      setWallpaperColorStatus("");
    }
    localStorage.setItem("autoTheme", String(seasonalThemeInput.checked));
    updateAppearanceOptions();
    if (!seasonalThemeInput.checked && !wallpaperColorsInput?.checked) {
      applySavedCustomColors();
    }
  });

  wallpaperColorsInput?.addEventListener("change", () => {
    localStorage.setItem("wallpaperColorsEnabled", String(wallpaperColorsInput.checked));
    if (wallpaperColorsInput.checked && seasonalThemeInput) {
      seasonalThemeInput.checked = false;
      localStorage.setItem("autoTheme", "false");
      seasonalThemeInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
    updateAppearanceOptions();
    if (wallpaperColorsInput.checked) applyWallpaperColors();
    else {
      setWallpaperColorStatus("");
      applySavedCustomColors();
    }
  });

  const backgroundImage = document.getElementById("page-bg-img");
  if (backgroundImage?.complete && backgroundImage.naturalWidth) {
    applyWallpaperColors();
  }

  if (borderColorInput) {
    borderColorInput.addEventListener("input", (event) => {
      localStorage.setItem("borderColorCustomized", "true");
      setBorderColor(event.target.value);
    });
  }

  if (accentColorInput) {
    accentColorInput.addEventListener("input", (event) => {
      localStorage.setItem("accentColorCustomized", "true");
      setAccentColor(event.target.value);
    });
  }

  if (resetBorderColorButton) {
    resetBorderColorButton.addEventListener("click", () => {
      localStorage.setItem("borderColorCustomized", "true");
      setBorderColor("#5d00ff");
    });
  }

  if (resetAccentColorButton) {
    resetAccentColorButton.addEventListener("click", () => {
      localStorage.setItem("accentColorCustomized", "true");
      setAccentColor("#5d00ff");
    });
  }

  function getSpotifyInfo(url) {
    const match = url.match(
      /spotify\.com\/(?:intl-[^/]+\/)?(track|album|playlist|artist)\/([A-Za-z0-9]+)/,
    );

    if (!match) return null;

    return {
      type: match[1],
      id: match[2],
    };
  }

  async function updateSpotifyTheme(spotify) {
    try {
      // Obtém informações da música pelo oEmbed
      const oembed = await fetch(
        `https://open.spotify.com/oembed?url=https://open.spotify.com/${spotify.type}/${spotify.id}`,
      );

      if (!oembed.ok) throw new Error("Spotify oEmbed falhou.");

      const meta = await oembed.json();

      const title = meta.title;

      // Pesquisa no iTunes
      const response = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(title)}&entity=song&limit=1`,
      );

      if (!response.ok) throw new Error("iTunes Search falhou.");

      const data = await response.json();

      if (!data.results?.length) {
        throw new Error("Música não encontrada.");
      }

      // pega a capa em resolução maior
      const cover = data.results[0].artworkUrl100.replace(
        /100x100[^/]*/,
        "600x600bb",
      );

      console.log("Capa encontrada:", cover);
      await applyThemeFromImage(cover);
    } catch (err) {
      console.error("Erro ao atualizar tema:", err);
    }
  }

  async function applyThemeFromImage(url) {
    return new Promise((resolve) => {
      const img = new Image();

      img.crossOrigin = "anonymous";
      img.referrerPolicy = "no-referrer";

      img.onload = () => {
        const savedAccent = localStorage.getItem("accentColor");
        const customAccent =
          localStorage.getItem("accentColorCustomized") === "true" ||
          Boolean(savedAccent && !["#5d00ff", "#683ab7", "#ff6700"].includes(savedAccent.toLowerCase()));
        if (
          document.getElementById("auto-fest-checkbox")?.checked ||
          localStorage.getItem("wallpaperColorsEnabled") === "true" ||
          customAccent
        ) {
          resolve(true);
          return;
        }

        try {
          const colorThief = new ColorThief();

          const color = colorThief.getColor(img);

          document.documentElement.style.setProperty(
            "--secondary-color",
            `rgb(${color.join(",")})`,
          );
          document.documentElement.style.setProperty(
            "--secondary-rgb",
            color.join(", "),
          );

          resolve(true);
        } catch (err) {
          console.error(err);
          resolve(false);
        }
      };

      img.onerror = () => resolve(false);

      img.src = url;
    });
  }
}
