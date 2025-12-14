// ─────────────────────────────────────────────
// ✨ Importações / Imports
// ─────────────────────────────────────────────
import { getDevMode, blockWeb } from "./config.js";

// Bloqueia execução se estiver em mobile (definido em config.js)
if (!blockWeb) {

  // ─────────────────────────────────────────────
  // ⚙️ Configurações Iniciais / Initial Settings
  // ─────────────────────────────────────────────

  const select = document.getElementById("theme-select");
  let fontSize = 14;          // Fonte padrão do editor / Default font size
  let initialTheme = "dark";  // Tema inicial / Default theme
  let theme = "dark";         // Tema selecionado no dropdown / Selected theme from dropdown
  let autoTheme = true;     // Detectar tema automaticamente / Auto-detect theme

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
    const day = today.getDate();

    if (month === 10 && day >= 20 && day <= 31) return "halloween"; // 🎃 Halloween
    if (month === 12 && day >= 10 && day <= 31) return "christmas"; // 🎄 Natal
    if (month === 3 && day >= 15 && day <= 31) return "easter";     // 🐣 Páscoa
    return "dark"; // 🌑 Tema padrão
  }

  // ─────────────────────────────────────────────
  // 🔄 Carrega o estado do autoTheme ANTES de montar o editor
  // ─────────────────────────────────────────────
  const savedState = localStorage.getItem('autoTheme');

  if (savedState !== null) {
    autoTheme = savedState === 'true';

    const autoCheckbox = document.getElementById('auto-fest-checkbox');
    if (autoCheckbox) autoCheckbox.checked = autoTheme;
  }

  select.addEventListener("change", function () {
    theme = this.value;
  });



  async function loadMonacoLoader() {
    if (window.require) return; // já carregado

    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.1/min/vs/loader.min.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  await loadMonacoLoader();

  // ─────────────────────────────────────────────
  // 🧠 Inicialização do Monaco Editor / Monaco Editor Setup
  // ─────────────────────────────────────────────

  async function initMonaco() {

    await loadMonacoLoader();
    require.config({
      paths: {
        vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.1/min/vs",
      },
    });

    initialTheme = theme;

    require(["vs/editor/editor.main"], () => {
      // 1️⃣ Definir tema inicial
      if (autoTheme) {
        initialTheme = autoTheme ? detectThemeByDate() : "dark";
        loadTheme(initialTheme);
      } else {
        initialTheme = "dark";
        loadTheme(initialTheme);
      }
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
        }
      );

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
        if (getDevMode() === "true") console.log("💾 Código salvo automaticamente / Code auto-saved");
      }

      const saveDebounced = debounce(saveCode, 1000);

      // Salva automaticamente após digitar
      window.editor.onDidChangeModelContent(saveDebounced);

      // Restaura código salvo, se existir
      const savedCode = localStorage.getItem("codigoSalvo");
      if (savedCode) window.editor.setValue(savedCode);

      // ─────────────────────────────────────────────
      // 📂 Carregamento de Arquivos / File Loading
      // ─────────────────────────────────────────────
      const loadButton = document.getElementById("load-button");
      const fileInput = document.getElementById("file-input");

      loadButton.addEventListener("click", () => fileInput.click());

      fileInput.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = (e) => {
          const content = e.target.result;
          window.editor.setValue(content);
          console.log("📂 Arquivo carregado com sucesso! / File loaded successfully!");

          if (getDevMode()) console.log("💬 Código carregado do arquivo / Code loaded from file");
        };

        reader.onerror = () => alert("❌ Erro ao ler o arquivo / Error reading file.");

        reader.readAsText(file);
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
      const response = await fetch(`Themes/${themeName}.json`);
      const theme = await response.json();

      monaco.editor.defineTheme(themeName, theme);
      monaco.editor.setTheme(themeName);
    } catch (error) {
      console.error("❌ Erro ao carregar o tema / Error loading theme:", error);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────
  // ✅ Corrige tooltips do Monaco Editor / ✅ Fix missing tooltip labels in Monaco Editor
  // ────────────────────────────────────────────────────────────────────────────────────────────

  document.querySelectorAll('[role="tooltip"]').forEach(el => {
    if (!el.hasAttribute('title') && !el.hasAttribute('aria-label')) {
      el.setAttribute('title', 'Tooltip');
    }
  });

  const autoCheckbox = document.getElementById('auto-fest-checkbox');

  if (autoCheckbox) {
    autoCheckbox.addEventListener('change', function () {
      autoTheme = this.checked;  // ← Atualiza a variável, não o elemento
      if (getDevMode()) console.log("💾 Auto Theme changed to:", autoTheme);
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
    if (getDevMode()) console.log("💾 Salvando estado do Auto Theme / Saving Auto Theme state");
    const autoValue = autoCheckbox ? autoCheckbox.checked : false;
    localStorage.setItem('autoTheme', String(autoValue));
  }

}