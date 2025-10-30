// Mapeamento de linguagens para o Monaco Editor
const modeMap = {
  JavaScript: 'javascript',
  Python: 'python',
  Java: 'java',
  HTML: 'html',
  CSS: 'css',
  'Batch (BAT/CMD)': 'bat',
  Arduino: 'cpp',
  JSON: 'json',
  C: 'c',
  'C++': 'cpp',
  'C#': 'csharp',
  SQL: 'sql',
  Kotlin: 'kotlin',
  ADB: 'bat',
  SBV: 'plaintext',
  VCF: 'plaintext',
  Markdown: 'markdown', // 👈 Adiciona esta linha
  Git: 'plaintext', // 👈 adiciona isso aqui
  Texto: 'plaintext'
};

// Atualiza a linguagem no editor a cada segundo
setInterval(() => {
  if (window.editor) {
    const code = window.editor.getValue();
    const language = detectLanguage(code);
    const languageDisplay = document.getElementById('code-language').querySelector('h4');
    languageDisplay.textContent = language;

    const monacoLang = modeMap[language];
    const currentLang = window.editor.getModel().getLanguageId();

    if (monacoLang && monacoLang !== currentLang) {
      monaco.editor.setModelLanguage(window.editor.getModel(), monacoLang);
    }
  }
}, 1000);

// Atualiza a exibição da linguagem e botão executar ao digitar
const languageDisplay = document.getElementById('code-language').querySelector('h4');
const executeButton = document.getElementById('execute');
const iframeButton = document.getElementById('new-iframe-button');

function initEditorEvents() {
  if (!window.editor) {
    // ainda não carregou, tenta de novo daqui 500ms
    setTimeout(initEditorEvents, 500);
    return;
  }

  const executeButton = document.getElementById('execute');
  const iframeButton = document.getElementById('new-iframe-button');
  const downloadButton = document.getElementById('download-file');
  const clearButton = document.querySelector('#options button[title="apagar o código"]');

  // 1) Carrega código salvo do localStorage
  const savedCode = localStorage.getItem('codigoSalvo');
  if (savedCode) {
    window.editor.setValue(savedCode);
  }

  // 2) Detecta linguagem e ajusta botões após carregar o código
  (function detectAfterLoad() {
    const code = window.editor.getValue().trim();
    const language = detectLanguage(code);

    languageDisplay.textContent = language;

    // Botões executar e iframe
    executeButton.style.display = (language === "HTML" || language === "JavaScript") ? 'block' : 'none';
    iframeButton.style.display = (language === "HTML") ? 'block' : 'none';

    // Oculta download e clear se editor estiver vazio
    const isEmpty = code === '';
    downloadButton.style.display = isEmpty ? 'none' : 'inline-block';
    clearButton.style.display = isEmpty ? 'none' : 'inline-block';
  })();

  // 3) Atualiza linguagem e botões ao digitar
  window.editor.onDidChangeModelContent(() => {
    const code = window.editor.getValue().trim();
    const language = detectLanguage(code);

    languageDisplay.textContent = language;

    executeButton.style.display = (language === "HTML" || language === "JavaScript") ? 'block' : 'none';
    iframeButton.style.display = (language === "HTML") ? 'block' : 'none';

    const isEmpty = code === '';
    downloadButton.style.display = isEmpty ? 'none' : 'inline-block';
    clearButton.style.display = isEmpty ? 'none' : 'inline-block';
  });
}



initEditorEvents();



// Função para detectar linguagem pelo código
function detectLanguage(code) {
  if (code.trim() === '') {
    return 'Comece a escrever seus códigos e veja a linguagem aqui!';
  }

// Detecta links comuns e a plataforma
function detectLink(url) {
  if (/youtube\.com|youtu\.be/.test(url)) return 'Link (YouTube)';
  if (/github\.com/.test(url)) return 'Link (GitHub)';
  if (/spotify\.com/.test(url)) return 'Link (Spotify)';
  if (/drive\.google\.com/.test(url)) return 'Link (Google Drive)';
  if (/pastebin\.com/.test(url)) return 'Link (Pastebin)';
  if (/chatgpt\.com|openai\.com/.test(url)) return 'Link (ChatGPT/OpenAI)';
  if (/facebook\.com/.test(url)) return 'Link (Facebook)';
  if (/instagram\.com/.test(url)) return 'Link (Instagram)';
  if (/twitter\.com|x\.com/.test(url)) return 'Link (Twitter/X)';
  if (/tiktok\.com/.test(url)) return 'Link (TikTok)';
  if (/reddit\.com/.test(url)) return 'Link (Reddit)';
  if (/discord\.com|discord\.gg/.test(url)) return 'Link (Discord)';
  if (/steamcommunity\.com|store\.steampowered\.com/.test(url)) return 'Link (Steam)';
  if (/docs\.google\.com/.test(url)) return 'Link (Google Docs)';
  if (/whatsapp\.com/.test(url)) return 'Link (WhatsApp)';
  if (/telegram\.org|t\.me/.test(url)) return 'Link (Telegram)';

  return 'Link (URL)';
}

// Dentro da função detectLanguage()
if (/^https?:\/\/[^\s]+$/i.test(code.trim())) {
  return detectLink(code.trim());
}

  // Markdown com blocos de código (prioritário, mas não se parecer com código puro)
if (
  (
    /^#{1,6}\s.+/m.test(code) ||            // títulos
    /^>/.test(code) ||                      // citações
    /^```[\s\S]+```/m.test(code) ||         // blocos de código
    /\[.+\]\(.+\)/.test(code) ||            // links
    /^[-*+]\s/m.test(code) ||               // listas
    /\*\*.+\*\*/.test(code) ||              // negrito
    /_.+_/.test(code)                       // itálico
  )
  &&
  !/(function|const|let|var|=>|if\s*\(|for\s*\(|console\.log)/.test(code) // não é JS
  &&
  !/<[a-z!]/i.test(code) // não é HTML
) {
  return 'Markdown';
}


  // JavaScript (só quando não há tags HTML)
  if (!/<[a-z!]/i.test(code) && /(function\s+\w+\s*\(|\bconsole\.log\b|let\s+|const\s+|var\s+)/.test(code)) {
    return 'JavaScript';
  }

  // Arduino
  if (
    /\bvoid\s+setup\s*\(\)/.test(code) ||
    /\bvoid\s+loop\s*\(\)/.test(code) ||
    /\bpinMode\s*\(/.test(code) ||
    /\bdigitalWrite\s*\(/.test(code) ||
    /\banalog(Read|Write)\s*\(/.test(code)

  ) {
    return 'Arduino';
  }

  // Java
  if (/public\s+class\s+\w+|public\s+static\s+void\s+main/.test(code) || /import\s+java\.[\w.]+;/.test(code)) {
    return 'Java';
  }

  // C++
  if (
    /#include\s*<[^>]+>|std::|cout\s*<<|cin\s*>>/.test(code)
    &&
    !/(function|const|let|var|=>|if\s*\(|for\s*\(|console\.log)/.test(code) // não é JS
  ) {
    return 'C++';
  }

  // C#
  if (/^\s*using\s+\w+;/m.test(code) || /\bnamespace\b|\bConsole\.WriteLine\b/.test(code)) {
    return 'C#';
  }

  // Python
  if (/^\s*def\s+\w+\s*\(.*\):|print\(|input\(|from\s+\w+\s+import/.test(code)) {
    return 'Python';
  }

  // HTML (checado antes de JS e CSS)
  if (/<(html|head|body|div|span|p|a|script|style|!DOCTYPE)[\s>]/i.test(code)) {
    return 'HTML';
  }

  // CSS (melhorado, evita confundir com objetos JS)
  if (/[.#]?[a-zA-Z][\w-]*\s*\{[^}]*:[^;]+;[^}]*\}/.test(code) && // padrão CSS válido!
  !/(function|const|let|var|\=\>|console\.log)/.test(code)     // não parece JS
  ) {
    return 'CSS';
  }

  // Kotlin
  if (/^\s*@\w+|class\s+\w+|fun\s+\w+\s*\(.*\)/.test(code)) {
    return 'Kotlin';
  }

  // SBV legendas
  if ((code.match(/\d{2}:\d{2}:\d{2}\.\d{3},\d{2}:\d{2}:\d{2}\.\d{3}/g) || []).length > 3) {
    return 'SBV';
  }

  // SQL
  if (/\bSELECT\b[\s\S]+?\bFROM\b/i.test(code) || /\bINSERT\b|\bUPDATE\b|\bDELETE\b/i.test(code)) {
    return 'SQL';
  }

  // JSON
  if (/^\s*\{[\s\S]*?\}|\[\s*[\s\S]*?\]/.test(code) && /"\s*[^"]+"\s*:\s*/.test(code)) {
    try {
      JSON.parse(code);
      return 'JSON';
    } catch (e) {}
  }

  // Batch (BAT/CMD)
  if (/^@echo\s+off|set\s+\w+=|goto\s+\w+|pause|cmdextversion/i.test(code)) {
    return 'Batch (BAT/CMD)';
  }

  // ADB
  if (/adb\s+(shell|devices|install|uninstall|push|pull|logcat|start|input|reboot)/i.test(code)) {
    return 'ADB';
  }

  // VCF
  if (/BEGIN:VCARD|END:VCARD|^VERSION:\d+\.\d+/m.test(code)) {
    return 'VCF';
  }

  // Git Commit (.git)
  if (
    /^# Please enter the commit message for your changes\./m.test(code) ||
    /^# On branch/m.test(code) ||
    /^# Your branch is up to date with/m.test(code) ||
    /^# Changes to be committed:/m.test(code) ||
    /Your branch is up to date with 'origin\/main'/.test(code)
  ) {
    return 'Texto (Git)';
  }

  if (/^[a-zA-ZÀ-ú0-9\s.,!?'"()-]+$/.test(code)) {
    return 'Texto';
  }

  return 'Comece a escrever seus códigos e veja a linguagem aqui!';
}


// Evento para download do arquivo com extensão correta
document.getElementById('download-file').addEventListener('click', () => {
  const code = window.editor.getValue();
  const language = detectLanguage(code);

  if (!code.trim()) {
    alert('O código está vazio!');
    return;
  }

  const extensionMap = {
    JavaScript: 'js',
    Python: 'py',
    Java: 'java',
    HTML: 'html',
    CSS: 'css',
    'Batch (BAT/CMD)': 'bat',
    Arduino: 'ino',
    JSON: 'json',
    C: 'c',
    'C++': 'cpp',
    'C#': 'cs',
    SQL: 'sql',
    Kotlin: 'kt',
    SBV: 'sbv',
    ADB: 'bat',
    VCF: 'vcf',
    Markdown: 'md', // 👈 Aqui
    Git: 'git' // 👈 Aqui

  };

  const extension = extensionMap[language] || 'txt';
  const fileName = prompt('Nome do arquivo:', 'meuCodigo');
  if (!fileName) return;

  const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${fileName}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

// Função para abrir HTML em nova janela
function execute() {
  const code = window.editor.getValue();
  const language = detectLanguage(code);

  if (language === "HTML") {
    // Abre HTML como antes
    const newWindow = window.open();
    newWindow.document.open();
    newWindow.document.write(code);
    newWindow.document.close();
  } else if (language === "JavaScript") {
    // Abre terminal JS em nova aba
    const safeCode = code.replace(/<\/script>/gi, '<\\/script>');
    const newTab = window.open();
    newTab.document.open();
    newTab.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>Terminal JS — DarkStudio</title>
          <style>
            html,body{height:100%;margin:0}
            body{background:#071012;color:#00ff88;font-family:monospace;padding:12px;box-sizing:border-box}
            #output{white-space:pre-wrap;overflow:auto;height:calc(100% - 40px);border-top:1px solid rgba(255,255,255,0.04);padding-top:8px}
            .error{color:#ff6b6b}
          </style>
        </head>
        <body>
          <div id="output"></div>
          <script>
            (function(){
              const out = document.getElementById('output');
              const originalLog = console.log;
              const originalError = console.error;
              console.log = function(...args){
                originalLog.apply(console, args);
                out.textContent += args.map(a => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' ') + '\\n';
              };
              console.error = function(...args){
                originalError.apply(console, args);
                out.innerHTML += '<span class="error">' + args.map(a => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' ') + '</span>' + '\\n';
              };
              try {
                ${safeCode}
              } catch (e) {
                console.error('Erro:', e);
              }
            })();
          <\/script>
        </body>
      </html>
    `);
    newTab.document.close();
  } else {
    alert("O conteúdo atual não é HTML nem JavaScript!");
  }
}


// Funções para salvar e carregar código do localStorage
function saveCode() {
  const code = window.editor.getValue();
  localStorage.setItem('codigoSalvo', code);
  alert('Código salvo!');
}

function loadCode() {
  const savedCode = localStorage.getItem('codigoSalvo');
  if (savedCode !== null) {
    window.editor.setValue(savedCode);
    alert('Código carregado!');
  } else {
    alert('Nenhum código salvo encontrado.');
  }
}