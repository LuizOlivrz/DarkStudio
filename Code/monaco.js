
let font = 14;

    require.config({
      paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.1/min/vs" },
    });

    require(["vs/editor/editor.main"], function () {
      // 1) Definir tema antes do editor
      carregarTema("halloween");


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

async function carregarTema(nomeTema) {
  try {
    // Carrega o JSON dinamicamente
    const response = await fetch(`${nomeTema}.json`);
    const tema = await response.json();

    // Define o tema no Monaco
    monaco.editor.defineTheme(nomeTema, tema);
    monaco.editor.setTheme(nomeTema);

    console.log(`Tema "${nomeTema}" aplicado com sucesso!`);
  } catch (erro) {
    console.error("Erro ao carregar o tema:", erro);
  }
}
