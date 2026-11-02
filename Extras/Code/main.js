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
import { detectLanguage } from "./language-detection.js";
import { setupPanelResizers } from "./panel-resizers.js";

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
  const editor = document.getElementById("main-content");
  const executorPanel = document.getElementById("executor-panel");
  const executorOutput = document.getElementById("executor-output");
  const configMenu = document.getElementById("config");
  const chat = document.getElementById("chat");
  const signatureInput = document.getElementById("signature-input");
  const resetSignatureButton = document.getElementById("reset-signature");
  const signatureElement = document.getElementById("signature");
  const WebsiteContainer = document.getElementById("Website-Container");
  // A execução ocupa o próprio espaço de #main-content; #options permanece independente.
  if (editor && executorPanel && executorPanel.parentElement !== editor) {
    editor.appendChild(executorPanel);
  }
  let configValue = false;
  let currentDetectedLanguage = "";
  let lastLinkAnalysis = null;

  // ─────────────────────────────────────────────
  // 🗺️ Monaco Mode Map / Mapeamento de Linguagens
  // ─────────────────────────────────────────────

  const modeMap = {
    JavaScript: "javascript",
    Python: "python",
    Java: "java",
    HTML: "html",
    XML: "xml",
    SVG: "xml",
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
    PowerShell: "powershell",
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
    currentDetectedLanguage = language;
    const isUrl = language === "Link (URL)";
    const rawUrl = isUrl ? (window.editor.getValue() || "").trim().replace(/[),.;!?]+$/, "") : "";
    let normalizedUrl = rawUrl;
    try { if (rawUrl) normalizedUrl = new URL(rawUrl).href; } catch {}
    const metadata = lastLinkAnalysis?.url === normalizedUrl ? lastLinkAnalysis.metadata : null;
    const displayText = isUrl
      ? `${t("linkPrefix")} - ${getLinkSiteName(rawUrl, metadata || {})}`
      : language;

    if (display && display.textContent !== displayText) display.textContent = displayText;
    if (display) {
      display.title = isUrl
        ? buildLinkTooltip(rawUrl, metadata || {})
        : language;
      display.dataset.detectedLanguage = language;
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
    });

    // Workspace tabs/files replace the Monaco model without necessarily changing
    // the old model's content. Refresh the UI and media preview on model switches.
    window.editor.onDidChangeModel(() => {
      scheduleCodeAnalysis();
      requestAnimationFrame(() => {
        if (!window.editor) return;
        updateUI(window.editor.getValue(), detectLanguage(window.editor.getValue()));
      });
    });

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
   * Atualiza a linguagem e a interface de mídia com base no código atual
   * Updates the language display and media UI based on current code
   */
  function updateUI(code, language) {
    // Se não foram fornecidos, obtém do editor
    if (code === undefined) {
      code = window.editor ? window.editor.getValue() : "";
    }

    if (language === undefined) {
      language = detectLanguage(code);
    }

    const workspaceFile = window.darkStudioWorkspaceCurrentFile;
    if (workspaceFile?.languageOverride && workspaceFile.languageOverrideLabel) {
      language = workspaceFile.languageOverrideLabel;
    } else {
      window.darkStudioWorkspaceSyncExtension?.(language);
    }

    updateLanguageDisplay(language);





    updateDetectedUrl(code);
  }

  // Permite que o Workspace atualize imediatamente a interface quando um arquivo
  // é aberto, sem depender apenas do debounce da análise de conteúdo.
  window.darkStudioRefreshEditorUI = () => updateUI();

  initEditorEvents();

  function getLinkSiteName(rawUrl, metadata = {}) {
    const metadataName = typeof metadata.ogSiteName === "string" ? metadata.ogSiteName.trim() : "";
    if (metadataName) return metadataName;
    let host = "";
    try { host = new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, ""); } catch {}
    const knownSites = [
      [/spotify\.com$/, "Spotify"], [/discord\.(?:com|gg)$/, "Discord"],
      [/youtube\.com$|youtu\.be$/, "YouTube"], [/github\.com$/, "GitHub"],
      [/gitlab\.com$/, "GitLab"], [/instagram\.com$/, "Instagram"],
      [/facebook\.com$/, "Facebook"], [/twitter\.com$|x\.com$/, "X"],
      [/tiktok\.com$/, "TikTok"], [/reddit\.com$/, "Reddit"],
      [/twitch\.tv$/, "Twitch"], [/steamcommunity\.com$|steampowered\.com$/, "Steam"],
      [/drive\.google\.com$|docs\.google\.com$|google\.com$/, "Google"],
      [/whatsapp\.com$|wa\.me$/, "WhatsApp"], [/telegram\.org$|t\.me$/, "Telegram"],
      [/soundcloud\.com$/, "SoundCloud"], [/musicbrainz\.org$/, "MusicBrainz"],
      [/pinterest\.com$/, "Pinterest"], [/linkedin\.com$/, "LinkedIn"],
      [/netflix\.com$/, "Netflix"], [/amazon\.[a-z.]+$/, "Amazon"],
      [/apple\.com$/, "Apple"], [/openai\.com$|chatgpt\.com$/, "OpenAI"],
    ];
    const known = knownSites.find(([pattern]) => pattern.test(host));
    if (known) return known[1];
    const firstLabel = host.split(".")[0] || host || "URL";
    return firstLabel.charAt(0).toUpperCase() + firstLabel.slice(1);
  }

  function buildLinkTooltip(rawUrl, metadata = {}) {
    const details = [
      metadata.title && `${t("linkMetaTitle")}: ${metadata.title}`,
      metadata.description && `${t("linkMetaDescription")}: ${metadata.description}`,
      metadata.author && `${t("linkMetaAuthor")}: ${metadata.author}`,
      rawUrl,
    ].filter(Boolean);
    return details.join("\n");
  }

  window.addEventListener("darkstudio:site-analysis", (event) => {
    const detail = event.detail || {};
    const rawUrl = (window.editor?.getValue() || "").trim().replace(/[),.;!?]+$/, "");
    let currentUrl = "";
    try { currentUrl = new URL(rawUrl).href; } catch {}
    if (!currentUrl || currentDetectedLanguage !== "Link (URL)" || detail.url !== currentUrl) return;
    lastLinkAnalysis = { url: currentUrl, metadata: detail.metadata || {}, ok: Boolean(detail.ok) };
    updateLanguageDisplay("Link (URL)");
  });

  function updateDetectedUrl(code) {
    const text = typeof code === "string" ? code.trim() : "";
    const editorUrl = detectLanguage(text) === "Link (URL)"
      ? text.replace(/[),.;!?]+$/, "")
      : "";
    if (editorUrl) {
      window.dispatchEvent(new CustomEvent("darkstudio:url-detected", {
        detail: { url: editorUrl },
      }));
    }
  }

  // ─────────────────────────────────────────────
  // 💾 File Download / Download de Arquivo
  // ─────────────────────────────────────────────

  function downloadCurrentCode() {
    if (!window.editor) return;

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
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${fileName}.${extension}`;
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

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
        editor.classList.remove("execution-active");
      }


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
        editor.classList.add("execution-active");
      }

      executorPanel.classList.add("executor-visible");
    });

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
    const opening = !WebsiteContainer.classList.contains("settings-active");
    const wasExtensionsActive = WebsiteContainer.classList.contains("extensions-active");
    const extensionsPanel = document.getElementById("extensions-panel");
    const editorInput = document.getElementById("Editor-Input");
    const emptyState = document.getElementById("workspace-empty-state");
    const optionsPanel = document.getElementById("options");

    WebsiteContainer.classList.remove("extensions-active");
    if (extensionsPanel) extensionsPanel.hidden = true;

    // Ao abrir Configurações, selecione a Estação de Arquivos e mostre seu painel.
    if (opening) {
      const fileLauncher = document.getElementById("file-gutter-icon");
      if (wasExtensionsActive && optionsPanel) optionsPanel.hidden = false;
      fileLauncher?.click();
    }

    configValue = opening;
    WebsiteContainer.classList.toggle("settings-active", opening);
    configMenu.hidden = !opening;
    // Ao fechar Configurações, respeita o estado vazio do Explorer em vez de exibir Monaco sem arquivos.
    if (editorInput) editorInput.hidden = opening || Boolean(emptyState && !emptyState.hidden);

    configMenu.scrollTop = 0;
    requestAnimationFrame(() => window.editor?.layout());
  }

  window.config = config;

  setupPanelResizers(WebsiteContainer, () => { chatOpen = true; });

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
    if (e.ctrlKey && !e.altKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      e.stopPropagation();
      downloadCurrentCode();
      return;
    }

    if (
      e.ctrlKey &&
      e.shiftKey &&
      !e.altKey &&
      e.code === "Backquote" &&
      window.darkStudioDesktop?.isDesktop
    ) {
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(new Event("darkstudio:toggle-terminal"));
      return;
    }

    if (e.ctrlKey && !e.shiftKey && (e.key === "`" || e.code === "Backquote")) {
      e.preventDefault();
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

        WebsiteContainer.classList.remove("no-chat", "chat-resize-hidden");
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

  // A interface agora se adapta a qualquer tamanho de janela; não bloquear
  // o site com uma camada modal ao redimensionar a janela.
  function checkScreenWidth() {
    document.getElementById("min-width-overlay")?.remove();
    if (document.body.dataset.prevOverflow !== undefined) {
      document.body.style.overflow = document.body.dataset.prevOverflow;
      delete document.body.dataset.prevOverflow;
    }
  }

  // Mantém o footer alinhado ao limite real do painel #options, mesmo quando
  // o usuário redimensiona esse painel ou a janela do navegador.
  function syncWorkspaceFooterOffset() {
    const options = document.getElementById("options");
    const footer = document.getElementById("workspace-footer");
    if (!options || !footer) return;
    const containingBlock = footer.offsetParent;
    if (!containingBlock) return;
    const optionsRect = options.getBoundingClientRect();
    const parentRect = containingBlock.getBoundingClientRect();
    footer.style.left = `${Math.max(0, optionsRect.right - parentRect.left + 8)}px`;
  }

  window.addEventListener("load", () => {
    checkScreenWidth();
    syncWorkspaceFooterOffset();
  });
  window.addEventListener("resize", () => {
    checkScreenWidth();
    syncWorkspaceFooterOffset();
  });
  const optionsResizeObserver = new ResizeObserver(syncWorkspaceFooterOffset);
  const optionsPanel = document.getElementById("options");
  if (optionsPanel) optionsResizeObserver.observe(optionsPanel);
  syncWorkspaceFooterOffset();

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
    const mindMapClear = document.getElementById("mindmap-clear");
    const mindMapConnect = document.getElementById("mindmap-connect");
    const mindMapAdd = document.getElementById("mindmap-add-files");
    const setLabel = (element, key) => {
      if (!element) return;
      const content = element.querySelector("[data-i18n]") || element;
      content.textContent = t(key);
    };
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
