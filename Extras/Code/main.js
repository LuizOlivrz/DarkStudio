// ─────────────────────────────────────────────
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

import { blockWeb, getDevMode, t, getDevice } from "./config.js";

if (!blockWeb) {
  // ─────────────────────────────────────────────
  // 🧠 Element References / Referências de Elementos
  // ─────────────────────────────────────────────

  const languageDisplay = document.querySelector("#code-language h4");
  const isMobile = getDevice();
  const executeButton = document.getElementById("execute");
  const iframeButton = document.getElementById("new-iframe-button");
  const downloadButton = document.getElementById("download-file");
  const clearButton = document.getElementById("clear");
  const editor = document.getElementById("Editor");
  const configMenu = document.getElementById("config");
  const options = document.getElementById("options");
  const chat = document.getElementById("chat");
  const signatureInput = document.getElementById("signature-input");
  const resetSignatureButton = document.getElementById("reset-signature");
  const signatureElement = document.getElementById("signature");
  const WebsiteContainer = document.getElementById("Website-Container");
  const dynamicPanel = document.getElementById("dynamic-panel");
  const dynamicPanelText = document.getElementById("dynamic-panel-text");
  const pageOpenedAt = Date.now();
  let configValue = false;
  let panelIndex = 0;
  let panelRotationTimer = null;
  let typingTimer = null;
  let isTyping = false;
  let weatherText = "☁️ Carregando clima...";

  // ─────────────────────────────────────────────
  // 🗺️ Monaco Mode Map / Mapeamento de Linguagens
  // ─────────────────────────────────────────────

  const modeMap = {
    JavaScript: "javascript",
    "VeloScript - pqpcara": "javascript",
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
    Rust: "rust",
    "Comece a escrever seu código e veja a linguagem aqui!": "plaintext",
    "Start writing your code and see the language here!": "plaintext",
  };

  // ─────────────────────────────────────────────
  // 🔄 Auto Language Detection / Detecção Automática
  // ─────────────────────────────────────────────

  setInterval(() => {
    if (!window.editor) return;

    const code = window.editor.getValue();
    const language = detectLanguage(code);

    const display = document.querySelector("#code-language h4");
    display.textContent = language;

    const monacoLang = modeMap[language];
    const currentLang = window.editor.getModel().getLanguageId();

    if (monacoLang && monacoLang !== currentLang) {
      monaco.editor.setModelLanguage(window.editor.getModel(), monacoLang);
    }
  }, 1000);

  // ─────────────────────────────────────────────
  // ⚙️ Editor Initialization / Inicialização do Editor
  // ─────────────────────────────────────────────

  function initEditorEvents() {
    if (!window.editor) {
      setTimeout(initEditorEvents, 500); // tenta novamente até o editor carregar
      return;
    }

    // 1️⃣ Carrega código salvo do localStorage
    const savedCode = localStorage.getItem("codigoSalvo");
    if (savedCode) window.editor.setValue(savedCode);

    // 2️⃣ Detecta linguagem inicial e configura botões
    updateUI();

    // 3️⃣ Atualiza a interface sempre que o usuário digitar
    window.editor.onDidChangeModelContent(() => {
      updateUI();
      handleTypingActivity();
    });

    initDynamicPanel();
  }

  /**
   * Atualiza os botões e linguagem com base no código atual
   * Updates the buttons and language display based on current code
   */
  function updateUI() {
    const code = window.editor.getValue().trim();
    const language = detectLanguage(code);
    const isEmpty = code === "";

    languageDisplay.textContent = language;
    executeButton.style.display =
      language === "HTML" || language === "JavaScript" ? "block" : "none";
    iframeButton.style.display = language === "HTML" ? "block" : "none";
    downloadButton.style.display = isEmpty ? "none" : "inline-block";
    clearButton.style.display = isEmpty ? "none" : "inline-block";
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
    return `🕒 ${new Date().toLocaleTimeString("pt-BR", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })}`;
  }

  function getWeatherText() {
    return weatherText;
  }

  function getUptimeText() {
    return `⏱️ Aberto há ${formatUptime(Date.now() - pageOpenedAt)}`;
  }

  function getPanelText() {
    switch (panelIndex) {
      case 0:
        return getClockText();
      case 1:
        return getWeatherText();
      default:
        return getUptimeText();
    }
  }

  function setPanelText(text) {
    if (!dynamicPanel || !dynamicPanelText) return;
    if (
      dynamicPanelText.textContent === text &&
      dynamicPanelText.classList.contains("visible")
    ) {
      return;
    }

    dynamicPanel.classList.add("visible");
    dynamicPanelText.classList.remove("visible");

    window.setTimeout(() => {
      dynamicPanelText.textContent = text;
      dynamicPanelText.classList.add("visible");
    }, 250);
  }

  function updateDynamicPanel() {
    if (isTyping) {
      setPanelText("# NightCoder pode te ajudar - Ctrl+I");
      return;
    }

    setPanelText(getPanelText());
  }

  function cycleDynamicPanel() {
    if (isTyping) return;
    panelIndex = (panelIndex + 1) % 3;
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
      weatherText = "☁️ Clima desconhecido";
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
        const label = mapWeatherCode(weatherCode);
        weatherText = `☁️ ${label} — ${temp}°C`;
      } else {
        weatherText = "☁️ Clima indisponível";
      }
    } catch {
      weatherText = "☁️ Clima indisponível";
    }

    if (!isTyping) updateDynamicPanel();
  }

  function mapWeatherCode(code) {
    switch (code) {
      case 0:
        return "Céu limpo";
      case 1:
      case 2:
        return "Parcialmente nublado";
      case 3:
        return "Nublado";
      case 45:
      case 48:
        return "Neblina";
      case 51:
      case 53:
      case 55:
        return "Chuvisco";
      case 61:
      case 63:
      case 65:
      case 80:
      case 81:
      case 82:
        return "Chuva";
      case 71:
      case 73:
      case 75:
        return "Neve";
      case 95:
      case 96:
      case 99:
        return "Tempestade";
      default:
        return "Clima";
    }
  }

  function initDynamicPanel() {
    if (!dynamicPanel || !dynamicPanelText) return;
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

    // 🔗 Detect common URLs / Detecta links e plataformas
    function detectLink(url) {
      const u = url.toLowerCase();

      if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//.test(u))
        return "Link (YouTube)";
      if (/^(https?:\/\/)?(www\.)?github\.com\//.test(u))
        return "Link (GitHub)";
      if (/^(https?:\/\/)?drive\.google\.com\//.test(u))
        return "Link (Google Drive)";
      if (/^(https?:\/\/)?pastebin\.com\//.test(u)) return "Link (Pastebin)";
      if (/^(https?:\/\/)?(chatgpt\.com|openai\.com)\//.test(u))
        return "Link (ChatGPT/OpenAI)";
      if (/^(https?:\/\/)?(www\.)?facebook\.com\//.test(u))
        return "Link (Facebook)";
      if (/^(https?:\/\/)?(www\.)?instagram\.com\//.test(u))
        return "Link (Instagram)";
      if (/^(https?:\/\/)?(twitter\.com|x\.com)\//.test(u))
        return "Link (Twitter/X)";
      if (/^(https?:\/\/)?(www\.)?tiktok\.com\//.test(u))
        return "Link (TikTok)";
      if (/^(https?:\/\/)?(www\.)?reddit\.com\//.test(u))
        return "Link (Reddit)";
      if (/^(https?:\/\/)?(discord\.com|discord\.gg)\//.test(u))
        return "Link (Discord)";
      if (
        /^(https?:\/\/)?(steamcommunity\.com|store\.steampowered\.com)\//.test(
          u,
        )
      )
        return "Link (Steam)";
      if (/^(https?:\/\/)?docs\.google\.com\//.test(u))
        return "Link (Google Docs)";
      if (/^(https?:\/\/)?(www\.)?whatsapp\.com\//.test(u))
        return "Link (WhatsApp)";
      if (/^(https?:\/\/)?(t\.me|telegram\.org)\//.test(u))
        return "Link (Telegram)";

      return "Link (URL)";
    }

    if (/^https?:\/\/\S+$/i.test(code.trim())) {
      return detectLink(code.trim());
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

    // 🟣 VeloScript detection
    const isVeloScript =
      /#![\s\S]*?VeloScript[\s\S]*?!#/i.test(code) ||
      /\bfunc\s+\w+\s*\(/.test(cleanCode) ||
      (/\bvar\s+\w+\s*=/.test(cleanCode) &&
        /\bconsole\s*\(/.test(cleanCode) &&
        !/\bconsole\.(log|warn|error)\s*\(/.test(cleanCode));

    if (isVeloScript) return "VeloScript - pqpcara";

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

    if (/^[a-zA-ZÀ-ú0-9\s.,!?'"()-]+$/.test(cleanCode)) return t("text");

    return t("startWriting");
  }

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
      "VeloScript - pqpcara": "velo",
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

  function execute() {
    const code = window.editor.getValue();
    const language = detectLanguage(code);

    if (language === "HTML") {
      const newWindow = window.open();
      const safeHTML = sanitizeHTML(code);
      newWindow.document.write(safeHTML);
      newWindow.document.close();
    } else if (language === "JavaScript") {
      alert(t("JSBlocked"));
      return;
      const safeCode = code.replace(/<\/script>/gi, "<\\/script>");
      const newTab = window.open();
      newTab.document.write(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Terminal JS — DarkStudio</title>
        <style>
          body{background:#071012;color:#00ff88;font-family:monospace;padding:12px;margin:0}
          #output{white-space:pre-wrap;overflow:auto;height:calc(100vh - 40px)}
          .error{color:#ff6b6b}
        </style>
      </head>
      <body>
        <div id="output"></div>
        <script>
          const out = document.getElementById('output');
          const log = console.log, err = console.error;
          console.log = (...a)=>{ log(...a); out.textContent += a.join(' ')+'\\n'; };
          console.error = (...a)=>{ err(...a); out.innerHTML += '<span class="error">'+a.join(' ')+'</span>\\n'; };
          try { ${safeCode} } catch(e){ console.error('Erro:', e); }
        <\\/script>
      </body>
      </html>
    `);
    } else {
      alert(t("Errorhtmljs"));
    }

    function sanitizeHTML(html) {
      return (
        html
          // remove scripts externos
          .replace(/<script[^>]*src[^>]*><\/script>/gi, "")
          // remove qualquer script inline
          .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
          // remove links de CSS
          .replace(/<link[^>]*>/gi, "")
      );
    }
  }

  window.execute = execute;

  // ─────────────────────────────────────────────
  // ⚙️ Config Panel / Painel de Configuração
  // ─────────────────────────────────────────────

  function config() {
    if (configValue) {
      configMenu.style.opacity = "0";
      configMenu.style.pointerEvents = "none";
      editor.style.opacity = "1";
      editor.style.pointerEvents = "auto";
      configValue = false;
    } else {
      configMenu.style.opacity = "1";
      configMenu.style.pointerEvents = "auto";
      editor.style.opacity = "0";
      editor.style.pointerEvents = "none";
      configValue = true;
    }
  }

  window.config = config;

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

        chat.style.display = "block";
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
    if (!text) text = "LUIZzz";
    text = text.substring(0, 22);
    if (signatureInput) signatureInput.value = text;
    if (signatureElement) signatureElement.textContent = text;
    localStorage.setItem("signature", text);
  }

  const savedSignature = localStorage.getItem("signature");
  if (savedSignature) {
    setSignature(savedSignature);
  } else {
    setSignature("LUIZzz");
  }

  if (signatureInput) {
    signatureInput.addEventListener("input", (event) => {
      setSignature(event.target.value);
    });
  }

  if (resetSignatureButton) {
    resetSignatureButton.addEventListener("click", () => {
      setSignature("LUIZzz");
    });
  }

}
