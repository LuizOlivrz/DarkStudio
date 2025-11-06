// ─────────────────────────────────────────────
// ✨ Importações / Imports
// ─────────────────────────────────────────────
import { getDevMode, blockWeb } from "./config.js";

// Bloqueia execução se estiver em mobile (definido em config.js)
if (blockWeb) {
  console.warn("⚠️ Modo bloqueado em dispositivos móveis / Mobile mode blocked");
} else {

  // ─────────────────────────────────────────────
  // ⚙️ Configurações Iniciais / Initial Settings
  // ─────────────────────────────────────────────
  let fontSize = 14;          // Fonte padrão do editor / Default font size
  let initialTheme = "dark";  // Tema inicial / Default theme
  const autoTheme = true;     // Detectar tema automaticamente / Auto-detect theme

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
  // 🧠 Inicialização do Monaco Editor / Monaco Editor Setup
  // ─────────────────────────────────────────────
  require.config({
    paths: {
      vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.1/min/vs",
    },
  });

  require(["vs/editor/editor.main"], () => {
    // 1️⃣ Definir tema inicial
    initialTheme = autoTheme ? detectThemeByDate() : "dark";
    loadTheme(initialTheme);

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
      const response = await fetch(`${themeName}.json`);
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
  
}
