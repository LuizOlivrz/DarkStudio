import blockWeb from './main.js';

if (!blockWeb) {

let font = 14;
let autoTheme = true;

// 🎃 Função para detectar tema baseado em data
function detectarTemaPorData() {
  const hoje = new Date();
  const mes = hoje.getMonth() + 1; // Janeiro = 0
  const dia = hoje.getDate();

  // 🧡 Halloween: de 20 a 31 de outubro
  if (mes === 10 && dia >= 20 && dia <= 31) return "halloween";

  // 🌲 Natal: de 10 a 31 de dezembro
  if (mes === 12 && dia >= 10 && dia <= 31) return "christmas";

  // 🌸 Páscoa (exemplo genérico, muda por ano, mas só exemplo)
  if (mes === 3 && dia >= 15 && dia <= 31) return "easter";

  // 🌑 Padrão (modo escuro)
  return "dark";
}

require.config({
  paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.1/min/vs" },
});

require(["vs/editor/editor.main"], function () {
  // 1) Definir tema antes do editor
  const temaInicial = autoTheme ? detectarTemaPorData() : "halloween";
  carregarTema(temaInicial);

  // 2) Criar editor com o tema customizado
  window.editor = monaco.editor.create(document.getElementById("Editor-Input"), {
    value: `Escreva seu código aqui`,
    language: "plaintext",
    theme: temaInicial,
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

  const saveDebounced = debounce(saveCode, 1000);

  window.editor.onDidChangeModelContent(() => {
    saveDebounced();
  });

  const savedCode = localStorage.getItem("codigoSalvo");
  if (savedCode) {
    window.editor.setValue(savedCode);
  }

  document.getElementById("load-button").addEventListener("click", () => {
    const saved = localStorage.getItem("codigoSalvo");
    if (saved) window.editor.setValue(saved);
  });

  document.getElementById("load-button").addEventListener("click", () => {
    document.getElementById("file-input").click();
  });

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

// Função para carregar tema dinamicamente
async function carregarTema(nomeTema) {
  try {
    const response = await fetch(`${nomeTema}.json`);
    const tema = await response.json();

    monaco.editor.defineTheme(nomeTema, tema);
    monaco.editor.setTheme(nomeTema);

  } catch (erro) {
    console.error("Erro ao carregar o tema:", erro);
  }
}
}