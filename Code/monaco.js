
let font = 14;

    require.config({
      paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.1/min/vs" },
    });

    require(["vs/editor/editor.main"], function () {
      // 1) Definir tema antes do editor
monaco.editor.defineTheme("darkStudio", {
  base: "vs-dark",
  inherit: true,
  rules: [
    // === GERAL ===
    { token: "", foreground: "8F8700", background: "090909" },
    { token: "comment", foreground: "00FFB1", fontStyle: "italic" },
    { token: "number", foreground: "8F8700" },
    { token: "string", foreground: "FFB700" },
    { token: "keyword", foreground: "FF6500", fontStyle: "bold" },
    { token: "operator", foreground: "FF6700" },
    { token: "delimiter", foreground: "AAAAAA" },
    { token: "variable", foreground: "00BD82" },
    { token: "constant", foreground: "00BDFF" },
    { token: "type", foreground: "FF6700" },
    
    // === CSS ===
    { token: "attribute.name.css", foreground: "FFF200" },
    { token: "attribute.value.css", foreground: "00BD82" },
    { token: "selector.css", foreground: "FF6600", fontStyle: "bold" },
    { token: "property.css", foreground: "FFF200" },
    { token: "delimiter.css", foreground: "00DB95" }, // ;
    { token: "number.css", foreground: "00ffff" },
    { token: "string.css", foreground: "00FFB7" },
    { token: "tag.css", foreground: "FF6500"},

    // === HTML ===
    { token: "tag.html", foreground: "FF6700", fontStyle: "bold" },
    { token: "attribute.name.html", foreground: "CF5400" },
    { token: "attribute.value.html", foreground: "00BD82" },
    { token: "delimiter.html", foreground: "FFF200" },
    { token: "metatag.html", foreground: "FF0000" },

    // === JS / JSON ===
    { token: "keyword.js", foreground: "FF6500" },
    { token: "number.js", foreground: "00BD82", fontStyle: "italic" },
    { token: "string.js", foreground: "00BD82", fontStyle: "italic" },
    { token: "identifier.js", foreground: "FFF200" },
    { token: "delimiter.js", foreground: "FF6500" },
    { token: "comment.js", foreground: "8F8700" },
    { token: "keyword.css", foreground: "00FF55"},
    { token: "string.key.json", foreground: "FF6500" },
    { token: "string.value.json", foreground: "FFD700", fontStyle: "italic" },
    { token: "number.json", foreground: "FFD700", fontStyle: "italic" },
    { token: "keyword.json", foreground: "CF5400" },
  ],

  colors: {
    // Fundo e texto base
    "editor.background": "#090909",
    "editor.foreground": "#E6E6E6",

    // Cursor e seleção
    "editorCursor.foreground": "#FFFFFF",
    "editor.selectionBackground": "#1B1B1B",
    "editor.inactiveSelectionBackground": "#222222",

    // Linhas e realce
    "editor.lineHighlightBackground": "#111111",
    "editorLineNumber.foreground": "#444",
    "editorLineNumber.activeForeground": "#FF6700",

    // Minimapa
    "minimap.findMatchHighlight": "#FF6700",
    "minimap.selectionHighlight": "#00FF7F",

    // Barra lateral e scroll
    "scrollbarSlider.background": "#FF670033",
    "scrollbarSlider.hoverBackground": "#FF670055",
    "scrollbarSlider.activeBackground": "#FF670077",

    // Realce de erro e aviso
    "editorError.foreground": "#FF3333",
    "editorWarning.foreground": "#FFB700",
    "editorInfo.foreground": "#00FFB7",
  },
});


      // 2) Criar editor com o tema customizado
      window.editor = monaco.editor.create(document.getElementById("Editor-Input"), {
        value: `Escreva seu código aqui`,
        language: "plaintext", // tema padrão inicial
        theme: "darkStudio",
        automaticLayout: true,
        fontSize: font,
        minimap: { enabled: false },
      });

      // Função debounce para limitar chamadas repetidas
      function debounce(func, wait) {
        let timeout;
        return function (...args) {
          clearTimeout(timeout);
          timeout = setTimeout(() => func.apply(this, args), wait);
        };
      }

      // Função que salva no localStorage
      function saveCode() {
        const code = window.editor.getValue();
        localStorage.setItem("codigoSalvo", code);
        console.log("Código salvo automaticamente");
      }

      // Salvar automático com debounce de 1 segundo
      const saveDebounced = debounce(saveCode, 1000);

      // Evento que dispara quando o conteúdo do editor muda
      window.editor.onDidChangeModelContent(() => {
        saveDebounced();
      });

      // Ao criar o editor, carregar código salvo
      const savedCode = localStorage.getItem("codigoSalvo");
      if (savedCode) {
        window.editor.setValue(savedCode);
      }

      // Botões de salvar/carregar
      document.getElementById("load-button").addEventListener("click", () => {
        const saved = localStorage.getItem("codigoSalvo");
        if (saved) window.editor.setValue(saved);
      });

      // Botão para abrir o seletor de arquivo
      document.getElementById("load-button").addEventListener("click", () => {
        document.getElementById("file-input").click();
      });

      // Leitura do arquivo selecionado
      document.getElementById("file-input").addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = function (e) {
          const content = e.target.result;
          window.editor.setValue(content);
          console.log("Código carregado do arquivo!");
        };

        reader.onerror = function () {
          alert("Erro ao ler o arquivo.");
        };

        reader.readAsText(file);
      });
    });


    function newIframe() {
  // Pega o código do editor
  const codigo = window.editor.getValue();

  // Cria o iframe em string (HTML que o usuário pode copiar)
  const iframeHTML = `<iframe width="100%" height="400px"
  srcdoc='${codigo.replace(/'/g, "&apos;")}'
  style="border:1px solid #444;"
  sandbox="allow-scripts allow-same-origin">
  </iframe>`;

  // Copia para o clipboard
  navigator.clipboard.writeText(iframeHTML)
    .then(() => {
      alert("Iframe copiado! Cole onde desejar.");
    })
    .catch(err => {
      console.error("Erro ao copiar iframe:", err);
      alert("Não foi possível copiar o iframe.");
    });
}