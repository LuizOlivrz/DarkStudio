// ─────────────────────────────────────────────
// ✨ Importações / Imports
// ─────────────────────────────────────────────
import { getDevMode, blockWeb, t, getCurrentLanguage } from "./config.js";
import { chatOpenValue, ChatVerification } from "./main.js";
let chatOpen = chatOpenValue();

// Bloqueia execução se estiver em mobile (definido em config.js)
if (!blockWeb) {
  // ─────────────────────────────────────────────
  // ⚙️ Configurações Iniciais / Initial Settings
  // ─────────────────────────────────────────────

  const select = document.getElementById("theme-select");
  let fontSize = 14; // Fonte padrão do editor / Default font size
  let initialTheme = "dark"; // Tema inicial / Default theme
  let theme = "dark"; // Tema selecionado no dropdown / Selected theme from dropdown
  let autoTheme = true; // Detectar tema automaticamente / Auto-detect theme
  const inlineChat = document.getElementById("inline-chat");
  const inlineInput = document.getElementById("inline-input");
  const inlineSend = document.getElementById("inline-send");
  const inlineMessages = document.getElementById("inline-messages");
  const chat = document.getElementById("chat");

  // ─────────────────────────────────────────────
  // 🎃 Detecção de Tema por Data / Auto Theme by Date
  // ─────────────────────────────────────────────
  /**
   * Detects theme based on current date.
   * Detecta o tema com base na data atual.
   * @returns {string} Nome do tema / Theme name
   */
  function detectThemeByDate() {
    const today = new Date();
    const month = today.getMonth() + 1; // Janeiro = 0
    const year = today.getFullYear();

    if (month === 10) return "halloween"; // 🎃 O mês inteiro de Halloween
    if (month === 12) return "christmas"; // 🎄 O mês inteiro de Natal

    // Computus Gregorian: use the actual Easter month, then apply it for that entire month.
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const correction = Math.floor((a + 11 * h + 22 * l) / 451);
    const easterMonth = Math.floor((h + l - 7 * correction + 114) / 31);
    if (month === easterMonth) return "easter"; // 🐣 O mês da Páscoa
    return "dark"; // 🌑 Tema padrão
  }

  function applySeasonalPalette(themeName) {
    const festivePalette = autoTheme ? {
      halloween: { primary: "#FF8A3D", secondary: "#FF781F" },
      christmas: { primary: "#FFFFFF", secondary: "#D62828" },
      easter: { primary: "#E6A8D7", secondary: "#71A85A" },
    }[themeName] : null;
    const savedBorder = localStorage.getItem("borderColor");
    const savedAccent = localStorage.getItem("accentColor");
    const isCustomColor = (color, settingKey, legacySeasonalDefault) =>
      color &&
      (localStorage.getItem(`${settingKey}Customized`) === "true" ||
        !["#5d00ff", "#683ab7", legacySeasonalDefault].includes(color.toLowerCase()));
    const wallpaperColorsEnabled =
      localStorage.getItem("wallpaperColorsEnabled") === "true";
    const customPalette = {
      primary: isCustomColor(savedBorder, "borderColor", "#ff8a3d")
        ? savedBorder
        : "#5d00ff",
      secondary: isCustomColor(savedAccent, "accentColor", "#ff6700")
        ? savedAccent
        : "#5d00ff",
    };
    const wallpaperPalette = {
      primary: localStorage.getItem("wallpaperPrimaryColor") || "#5d00ff",
      secondary: localStorage.getItem("wallpaperSecondaryColor") || "#5d00ff",
    };
    const palette = {
      primary: wallpaperColorsEnabled
        ? wallpaperPalette.primary
        : autoTheme
          ? festivePalette?.primary || "#5d00ff"
          : customPalette.primary,
      secondary: wallpaperColorsEnabled
        ? wallpaperPalette.secondary
        : autoTheme
          ? festivePalette?.secondary || "#5d00ff"
          : customPalette.secondary,
    };
    const root = document.documentElement;
    root.style.setProperty("--primary-color", palette.primary);
    root.style.setProperty("--secondary-color", palette.secondary);
    const rgb = palette.secondary.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
    if (rgb) root.style.setProperty("--secondary-rgb", `${parseInt(rgb[1], 16)}, ${parseInt(rgb[2], 16)}, ${parseInt(rgb[3], 16)}`);
    const borderInput = document.getElementById("border-color-input");
    const accentInput = document.getElementById("accent-color-input");
    if (borderInput) borderInput.value = palette.primary;
    if (accentInput) accentInput.value = palette.secondary;
  }

  // ─────────────────────────────────────────────
  // 🔄 Carrega o estado do autoTheme ANTES de montar o editor
  // ─────────────────────────────────────────────
  const savedState = localStorage.getItem("autoTheme");

  if (savedState !== null) {
    autoTheme = savedState === "true";

    const autoCheckbox = document.getElementById("auto-fest-checkbox");
    if (autoCheckbox) autoCheckbox.checked = autoTheme;
  }
  if (localStorage.getItem("wallpaperColorsEnabled") === "true") {
    autoTheme = false;
    localStorage.setItem("autoTheme", "false");
    const autoCheckbox = document.getElementById("auto-fest-checkbox");
    if (autoCheckbox) autoCheckbox.checked = false;
  }

  select.addEventListener("change", function () {
    theme = this.value;
  });

  // ─────────────────────────────────────────────
  // Carregamento do monaco (Editor né bro)
  // ─────────────────────────────────────────────

  const MONACO_LOCAL = "./Extras/Monaco/vs/loader.js";

  const MONACO_WEB =
    "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/loader.js";

  const MONACO_WEB_PATH =
    "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs";

  let monacoSource = "local";
  let projectLinkSupportInstalled = false;

  function installProjectLinkSupport(monaco, codeEditor) {
    if (projectLinkSupportInstalled || !monaco?.languages || !monaco?.editor) return;
    projectLinkSupportInstalled = true;

    const patterns = [
      /\b(?:href|src|poster)\s*=\s*(["'])(.*?)\1/gi,
      /url\(\s*(["']?)(.*?)\1\s*\)/gi,
      /@import\s+(?:url\(\s*)?(?:(["'])(.*?)\1|([^'"\s);]+))\s*\)?/gi,
      /\b(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)(["'])(\.{1,2}\/[^"']+)\1/gi,
    ];

    const resolveAtPosition = (model, position) => {
      if (!position || typeof window.darkStudioResolveProjectReference !== "function") return null;
      const source = model.getValue();
      const offset = model.getOffsetAt(position);
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(source))) {
          const reference = match[2] || match[3] || "";
          if (!reference) continue;
          const start = match.index + match[0].lastIndexOf(reference);
          const end = start + reference.length;
          if (offset < start || offset > end) continue;
          const path = window.darkStudioResolveProjectReference(reference);
          if (path) return path;
        }
      }
      return null;
    };

    monaco.languages.registerLinkProvider(
      ["html", "javascript", "typescript", "css", "scss", "less", "json"],
      {
        provideLinks(model) {
          const resolveReference = window.darkStudioResolveProjectReference;
          if (typeof resolveReference !== "function") return { links: [] };

          const source = model.getValue();
          const links = [];
          const seen = new Set();
          for (const pattern of patterns) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(source))) {
              const reference = match[2] || match[3] || "";
              const target = resolveReference(reference);
              if (!target) continue;
              const valueOffset = match.index + match[0].lastIndexOf(reference);
              const start = model.getPositionAt(valueOffset);
              const end = model.getPositionAt(valueOffset + reference.length);
              const key = `${start.lineNumber}:${start.column}:${end.column}:${target}`;
              if (seen.has(key)) continue;
              seen.add(key);
              const encodedPath = target.split("/").map((part) => encodeURIComponent(part)).join("/");
              links.push({
                range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
                url: `darkstudio-project://open/${encodedPath}`,
                tooltip: `Open ${target}`,
              });
            }
          }
          return { links };
        },
      },
    );

    // The editor's built-in link gesture can vary with its loader/build. Handle
    // Ctrl/Cmd+click directly as well, while leaving external links untouched.
    codeEditor?.onMouseDown((event) => {
      const browserEvent = event.event?.browserEvent;
      if (!browserEvent || !(browserEvent.ctrlKey || browserEvent.metaKey)) return;
      const model = codeEditor.getModel();
      const targetPath = model && resolveAtPosition(model, event.target?.position);
      if (!targetPath) return;
      browserEvent.preventDefault();
      browserEvent.stopPropagation();
      window.darkStudioOpenProjectFile?.(targetPath);
    });

    monaco.editor.registerLinkOpener({
      open(resource) {
        if (resource.scheme !== "darkstudio-project" || resource.authority !== "open") return false;
        const path = String(resource.path || "").replace(/^\//, "").split("/").map((part) => {
          try { return decodeURIComponent(part); } catch { return part; }
        }).join("/");
        return Boolean(window.darkStudioOpenProjectFile?.(path));
      },
    });
  }

  function testMonacoWeb(timeout = 1800) {
    return new Promise((resolve) => {
      const controller = new AbortController();

      const timer = setTimeout(() => {
        controller.abort();
        resolve(false);
      }, timeout);

      fetch(MONACO_WEB, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      })
        .then((response) => {
          clearTimeout(timer);
          resolve(response.ok);
        })
        .catch(() => {
          clearTimeout(timer);
          resolve(false);
        });
    });
  }

  async function loadMonacoLoader() {
    if (window.require) return;

    let loaderURL = MONACO_LOCAL;

    if (navigator.onLine) {
      const webAvailable = await testMonacoWeb();

      if (webAvailable) {
        loaderURL = MONACO_WEB;
        monacoSource = "web";
      }
    }

    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");

        script.src = loaderURL;
        script.onload = resolve;
        script.onerror = reject;

        document.head.appendChild(script);
      });
    } catch {
      if (loaderURL !== MONACO_LOCAL) {
        monacoSource = "local";

        await new Promise((resolve, reject) => {
          const script = document.createElement("script");

          script.src = MONACO_LOCAL;
          script.onload = resolve;
          script.onerror = reject;

          document.head.appendChild(script);
        });
      } else {
        throw new Error("Não foi possível carregar o Monaco.");
      }
    }
  }
  await loadMonacoLoader();

  // ─────────────────────────────────────────────
  // 🧠 Inicialização do Monaco Editor / Monaco Editor Setup
  // ─────────────────────────────────────────────

  async function initMonaco() {
    await loadMonacoLoader();

    require.config({
      paths: {
        vs: monacoSource === "web" ? MONACO_WEB_PATH : "./Extras/Monaco/vs",
      },
    });

    if (getDevMode()) console.log(monacoSource === "web" ? "🌐 Monaco Web" : "📦 Monaco Local");

    initialTheme = theme;

    // O bundle editor.main já carrega as contribuições internas do Monaco
    // e os módulos compartilhados de HTML/TypeScript desta distribuição.
    // Importar novamente os wrappers monaco.contribution pode fazer o AMD
    // definir o mesmo módulo duas vezes e impedir a criação do editor.
    require(["vs/editor/editor.main"], (monacoInstance) => {
      window.monaco = monacoInstance;

      // 1️⃣ Definir tema inicial
      if (autoTheme) {
        initialTheme = autoTheme ? detectThemeByDate() : "dark";
        loadTheme(initialTheme);
      } else {
        initialTheme = "dark";
        loadTheme(initialTheme);
      }

      window.loadTheme = loadTheme;

      // 2️⃣ Criar editor
      window.editor = monaco.editor.create(
        document.getElementById("Editor-Input"),
        {
          value: "Escreva seu código aqui",
          language: "plaintext",
          theme: initialTheme,
          automaticLayout: true,
          fontSize,
          minimap: { enabled: false },
          // Permite rolagem horizontal quando linhas excedem a largura visível.
          wordWrap: "off",
          scrollbar: {
            horizontal: "auto",
            horizontalScrollbarSize: 10,
            alwaysConsumeMouseWheel: false,
          },
          links: true,
        },
      );

      installProjectLinkSupport(monaco, window.editor);

      // ─────────────────────────────────────────────
      // 💾 Auto Save / Salvamento Automático
      // ─────────────────────────────────────────────

      /**
       * Creates a debounced version of a function.
       * Cria uma versão “debounced” de uma função (evita execuções repetidas).
       * @param {Function} func - Função original / Original function
       * @param {number} wait - Tempo de espera / Delay in ms
       */
      function debounce(func, wait) {
        let timeout;
        return (...args) => {
          clearTimeout(timeout);
          timeout = setTimeout(() => func.apply(this, args), wait);
        };
      }

      /**
       * Saves the current code in localStorage.
       * Salva o código atual no localStorage.
       */
      function saveCode() {
        const code = window.editor.getValue();
        localStorage.setItem("codigoSalvo", code);
        if (getDevMode() === "true")
          console.log("💾 Código salvo automaticamente / Code auto-saved");
      }

      const saveDebounced = debounce(saveCode, 1000);

      // Salva automaticamente após digitar
      window.editor.onDidChangeModelContent(saveDebounced);

      // Restaura código salvo, se existir
      const savedCode = localStorage.getItem("codigoSalvo");
      if (savedCode) window.editor.setValue(savedCode);

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI, () => {
        const selection = editor.getSelection();
        if (!selection) {
          showInlineChat(
            "⚠️ Selecione um trecho de código antes de usar a IA.",
          );
          return;
        }

        showInlineChat("🤖 O que você quer que eu faça com esse código?");
      });
    });
  }

  initMonaco();

  // ─────────────────────────────────────────────
  // 🎨 Carregamento de Tema / Theme Loader
  // ─────────────────────────────────────────────
  /**
   * Loads and applies a Monaco Editor theme from JSON.
   * Carrega e aplica um tema do Monaco Editor a partir de um JSON.
   * @param {string} themeName - Nome do tema / Theme name
   */
  async function loadTheme(themeName) {
    try {
      const response = await fetch(`Extras/Themes/${themeName}.json`);
      const theme = await response.json();

      monaco.editor.defineTheme(themeName, theme);
      monaco.editor.setTheme(themeName);
      applySeasonalPalette(themeName);
    } catch (error) {
      console.error("❌ Erro ao carregar o tema / Error loading theme:", error);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────
  // ✅ Corrige tooltips do Monaco Editor / ✅ Fix missing tooltip labels in Monaco Editor
  // ────────────────────────────────────────────────────────────────────────────────────────────

  document.querySelectorAll('[role="tooltip"]').forEach((el) => {
    if (!el.hasAttribute("title") && !el.hasAttribute("aria-label")) {
      el.setAttribute("title", "Tooltip");
    }
  });

  const autoCheckbox = document.getElementById("auto-fest-checkbox");

  if (autoCheckbox) {
    autoCheckbox.addEventListener("change", function () {
      autoTheme = this.checked; // ← Atualiza a variável, não o elemento
      if (autoTheme) {
        const wallpaperColorsInput = document.getElementById("wallpaper-colors-checkbox");
        if (wallpaperColorsInput) wallpaperColorsInput.checked = false;
        localStorage.setItem("wallpaperColorsEnabled", "false");
      }
      if (getDevMode()) console.log("💾 Auto Theme changed to:", autoTheme);
      window.darkStudioUpdateAppearanceOptions?.();
      // Recarrega o tema do editor sem recarregar a página
      if (autoTheme) {
        const newTheme = detectThemeByDate();
        loadTheme(newTheme);
      } else {
        loadTheme(theme);
      }
      saveCheckboxState();
    });
  }

  // Salvando o estado do checkbox com localStorage:
  function saveCheckboxState() {
    if (getDevMode())
      console.log("💾 Salvando estado do Auto Theme / Saving Auto Theme state");
    const autoValue = autoCheckbox ? autoCheckbox.checked : false;
    localStorage.setItem("autoTheme", String(autoValue));
  }

  function getSelectedCode() {
    const selection = editor.getSelection();
    if (!selection || selection.isEmpty()) return null;

    const model = editor.getModel();
    return model.getValueInRange(selection);
  }

  async function copilotInline(promptUser) {
    const selectedCode = getSelectedCode();

    if (!selectedCode) {
      alert("Selecione um trecho de código primeiro.");
      return;
    }

    const prompt = `
Código selecionado:
${selectedCode}

Pedido do usuário:
${promptUser}

Responda SOMENTE com o código corrigido. sem explicações, sem nada além do código.
`;

    sendToAI(prompt);
  }

  async function applyInlineFix(userPrompt) {
    const selection = editor.getSelection();
    const model = editor.getModel();

    if (!selection || selection.isEmpty()) {
      showInlineChat(t("inlineSelectCode"));
      return;
    }
    const selectedCode = model.getValueInRange(selection);

    const rawResponse = await window.sendInlineRequest(`
      Código:
      ${selectedCode}

      Pedido:
      ${userPrompt}

      Altere somente o trecho selecionado. Responda como um objeto JSON válido, sem cercas Markdown, com duas propriedades string: "corrected_code" contendo o trecho completo corrigido e "summary" contendo um resumo curto e específico das alterações realizadas, escrito em ${getCurrentLanguage()}.
      `);
    const result = parseInlineResponse(rawResponse);

    editor.executeEdits("copilot-inline", [
      {
        range: selection,
        text: result.code,
        forceMoveMarkers: true,
      },
    ]);
    showInlineSummary(result.summary);
  }

  function parseInlineResponse(rawResponse) {
    const text = String(rawResponse || "").trim();
    const jsonText = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
    const start = jsonText.indexOf("{");
    const end = jsonText.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        const parsed = JSON.parse(jsonText.slice(start, end + 1));
        if (typeof parsed.corrected_code === "string") {
          return {
            code: parsed.corrected_code,
            summary: typeof parsed.summary === "string" && parsed.summary.trim()
              ? parsed.summary.trim()
              : t("inlineSummaryFallback"),
          };
        }
      } catch {
        // Older or malformed model replies continue through the legacy code extraction.
      }
    }
    return { code: extractCodeOnly(text), summary: t("inlineSummaryFallback") };
  }

  function extractCodeOnly(text) {
    const match = text.match(
      /```(?:javascript|js|ts|html|css)?\s*([\s\S]*?)```/i,
    );
    return match ? match[1].trim() : text.trim();
  }

  function showInlineChat(message = "") {
    if (ChatVerification() === true) {
      chat.style.opacity = "0";
      chat.style.pointerEvents = "none";
      document.getElementById("Editor-Input").focus();
    }

    inlineChat.style.display = "block";
    inlineChat.style.pointerEvents = "auto";
    chatOpen = true;

    requestAnimationFrame(() => {
      inlineChat.style.opacity = "1";
    });

    if (message) showInlineMessage(message);

    inlineInput.value = "";
    inlineInput.focus();
  }

  function showInlineMessage(message) {
    const item = document.createElement("div");
    item.className = "ai";
    item.textContent = message;
    inlineMessages.replaceChildren(item);
  }

  function showInlineSummary(summary) {
    const card = document.createElement("div");
    card.className = "ai inline-change-summary";
    const heading = document.createElement("strong");
    heading.textContent = t("inlineChangesTitle");
    const body = document.createElement("p");
    body.textContent = summary;
    card.append(heading, body);
    inlineMessages.replaceChildren(card);
    inlineChat.style.display = "block";
    inlineChat.style.opacity = "1";
    inlineChat.style.pointerEvents = "auto";
  }

  function hideInlineChat() {
    inlineChat.style.opacity = "0";
    inlineChat.style.pointerEvents = "none";
    chatOpen = false;
    setTimeout(() => {
      inlineChat.style.display = "none";
      inlineMessages.innerHTML = "";
      inlineInput.value = "";
    }, 200);
  }

  inlineSend.onclick = async () => {
    const userPrompt = inlineInput.value.trim();
    if (!userPrompt) return;

    inlineSend.disabled = true;
    showInlineChat(t("inlineWorking"));
    try {
      await applyInlineFix(userPrompt);
    } catch (error) {
      console.error("Inline AI edit failed:", error);
      showInlineChat(t("inlineError"));
    } finally {
      inlineSend.disabled = false;
    }
  };

  inlineInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      inlineSend.click();
    }
  });
}
