// ─────────────────────────────────────────────
// 🌑 DarkStudio — Main Script / Script Principal
// ─────────────────────────────────────────────

let chatOpen = false;
let config = false;

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

import { blockWeb, getDevMode } from "./config.js";

if (blockWeb) {
  document.body.innerHTML = `
    <div style="
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      height:100vh;
      background-color:red;
      color:#fff;
      font-family:sans-serif;
      text-align:center;
      padding:20px;
      box-sizing:border-box;">
      <h1>Site Bloqueado :(</h1>
      <p>DarkStudio está temporariamente indisponível, desculpe!</p>
      <h5>Por: CDP 💚</h5>
    </div>
  `;

  document.title = "DarkStudio :(";
  const favicon = document.getElementById('favicon');
  if (favicon) {
    favicon.href = "https://cdn-0.emojis.wiki/emoji-pics/twitter/red-square-twitter.png";
  }

} else {

// ─────────────────────────────────────────────
// 🧠 Element References / Referências de Elementos
// ─────────────────────────────────────────────

const languageDisplay = document.querySelector('#code-language h4');
const executeButton   = document.getElementById('execute');
const iframeButton    = document.getElementById('new-iframe-button');
const downloadButton  = document.getElementById('download-file');
const clearButton     = document.getElementById('clear');
const editor          = document.getElementById('Editor');
const configMenu          = document.getElementById('config');

// ─────────────────────────────────────────────
// 🗺️ Monaco Mode Map / Mapeamento de Linguagens
// ─────────────────────────────────────────────

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
  Markdown: 'markdown',
  Git: 'plaintext',
  Texto: 'plaintext'
};

// ─────────────────────────────────────────────
// 🔄 Auto Language Detection / Detecção Automática
// ─────────────────────────────────────────────

setInterval(() => {
  if (!window.editor) return;

  const code = window.editor.getValue();
  const language = detectLanguage(code);

  const display = document.querySelector('#code-language h4');
  display.textContent = language;

  const monacoLang  = modeMap[language];
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
  const savedCode = localStorage.getItem('codigoSalvo');
  if (savedCode) window.editor.setValue(savedCode);

  // 2️⃣ Detecta linguagem inicial e configura botões
  updateUI();

  // 3️⃣ Atualiza a interface sempre que o usuário digitar
  window.editor.onDidChangeModelContent(updateUI);
}

/**
 * Atualiza os botões e linguagem com base no código atual
 * Updates the buttons and language display based on current code
 */
function updateUI() {
  const code = window.editor.getValue().trim();
  const language = detectLanguage(code);
  const isEmpty = code === '';

  languageDisplay.textContent = language;
  executeButton.style.display = (language === "HTML" || language === "JavaScript") ? 'block' : 'none';
  iframeButton.style.display  = (language === "HTML") ? 'block' : 'none';
  downloadButton.style.display = isEmpty ? 'none' : 'inline-block';
  clearButton.style.display    = isEmpty ? 'none' : 'inline-block';
}

initEditorEvents();

// ─────────────────────────────────────────────
// 🧩 Language Detection / Detecção de Linguagem
// ─────────────────────────────────────────────

function detectLanguage(code) {
  if (code.trim() === '') return 'Start writing your code and see the language here!';

  // 🔗 Detect common URLs / Detecta links e plataformas
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

  if (/^https?:\/\/[^\s]+$/i.test(code.trim())) {
    return detectLink(code.trim());
  }

  // 📝 Markdown detection / Detecção de Markdown
  if (
    (
      /^#{1,6}\s.+/m.test(code) ||
      /^>/.test(code) ||
      /^```[\s\S]+```/m.test(code) ||
      /\[.+\]\(.+\)/.test(code) ||
      /^[-*+]\s/m.test(code) ||
      /\*\*.+\*\*/.test(code) ||
      /_.+_/.test(code)
    ) &&
    !/(function|const|let|var|=>|if\s*\(|for\s*\(|console\.log)/.test(code) &&
    !/<[a-z!]/i.test(code)
  ) return 'Markdown';

  // Linguagem pura: JS / Arduino / Java / C++ / etc.
  if (!/<[a-z!]/i.test(code) && /(function\s+\w+\s*\(|console\.log|let\s+|const\s+|var\s+)/.test(code)) return 'JavaScript';
  if (/\bvoid\s+setup\s*\(\)|\bvoid\s+loop\s*\(\)/.test(code)) return 'Arduino';
  if (/public\s+class\s+\w+|static\s+void\s+main/.test(code)) return 'Java';
  if (/#include\s*<[^>]+>|std::|cout\s*<<|cin\s*>>/.test(code)) return 'C++';
  if (/using\s+\w+;|Console\.WriteLine/.test(code)) return 'C#';
  if (/def\s+\w+\(.*\):|print\(/.test(code)) return 'Python';
  if (/<(html|head|body|script|style|div)/i.test(code)) return 'HTML';
  if (/[.#]?[a-zA-Z][\w-]*\s*\{[^}]*:[^;]+;[^}]*\}/.test(code)) return 'CSS';
  if (/fun\s+\w+\s*\(.*\)/.test(code)) return 'Kotlin';
  if (/\bSELECT\b[\s\S]+?\bFROM\b/i.test(code)) return 'SQL';
  if (/^\s*\{[\s\S]*?\}/.test(code) && /"\s*[^"]+"\s*:\s*/.test(code)) {
    try { JSON.parse(code); return 'JSON'; } catch {}
  }
  if (/adb\s+(shell|devices|install|pull|push)/i.test(code)) return 'ADB';
  if (/BEGIN:VCARD/.test(code)) return 'VCF';
  if (/^@echo\s+off|set\s+\w+=|pause/i.test(code)) return 'Batch (BAT/CMD)';
  if (/^# Please enter the commit message|On branch/m.test(code)) return 'Texto (Git)';
  if (/^[a-zA-ZÀ-ú0-9\s.,!?'"()-]+$/.test(code)) return 'Text';

  return 'Start writing your code and see the language here!';
}

// ─────────────────────────────────────────────
// 💾 File Download / Download de Arquivo
// ─────────────────────────────────────────────

document.getElementById('download-file').addEventListener('click', () => {
  const code = window.editor.getValue();
  const language = detectLanguage(code);

  if (!code.trim()) {
    alert('O código está vazio!');
    return;
  }

  const extensionMap = {
    JavaScript: 'js', Python: 'py', Java: 'java', HTML: 'html',
    CSS: 'css', 'Batch (BAT/CMD)': 'bat', Arduino: 'ino', JSON: 'json',
    C: 'c', 'C++': 'cpp', 'C#': 'cs', SQL: 'sql', Kotlin: 'kt',
    SBV: 'sbv', ADB: 'bat', VCF: 'vcf', Markdown: 'md', Git: 'git'
  };

  const extension = extensionMap[language] || 'txt';
  const fileName = prompt('Nome do arquivo:', 'meuCodigo');
  if (!fileName) return;

  const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
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
    newWindow.document.write(code);
    newWindow.document.close();
  } else if (language === "JavaScript") {
    alert("O Terminal JS esta temporariamente indisponível.");
    return;
    const safeCode = code.replace(/<\/script>/gi, '<\\/script>');
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
    alert("O conteúdo atual não é HTML nem JavaScript!");
  }
}

window.execute = execute;

// ─────────────────────────────────────────────
// ⚙️ Config Panel / Painel de Configuração
// ─────────────────────────────────────────────

function config() {
  const configDiv = document.getElementById('config');
  if (!configDiv) return;

  if (configDiv.style.opacity === "1") {
    configDiv.style.opacity = "0";
    configDiv.style.pointerEvents = "none";
    config = false;
  } else {
    if (document.getElementById('full-screen').style.width === '99.3%') fullScreenVerif();
    configDiv.style.opacity = "1";
    configDiv.style.pointerEvents = "auto";
    config = true;
  }
}
window.config = config;

// ─────────────────────────────────────────────
// 🖥️ Screen Size Check / Verificação de Tela
// ─────────────────────────────────────────────

function checkScreenWidth() {
  const existing = document.getElementById('min-width-overlay');

  if (window.innerWidth < 715 || window.innerHeight < 800) {
    if (!existing) {
      document.body.dataset.prevOverflow = document.body.style.overflow || '';
      document.body.style.overflow = 'hidden';

      const overlay = document.createElement('div');
      overlay.id = 'min-width-overlay';
      Object.assign(overlay.style, {
        position: 'fixed', top: '0', left: '0',
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'red', color: '#fff',
        fontFamily: 'sans-serif', textAlign: 'center',
        padding: '20px', boxSizing: 'border-box',
        zIndex: '999999'
      });
      overlay.innerHTML = `
        <h1>Largura, ou altura :(</h1>
        <p>Por favor, redimensione ou remova o zoom para utilizar.</p>
      `;
      document.body.appendChild(overlay);
    }
  } else if (existing) {
    existing.remove();
    document.body.style.overflow = document.body.dataset.prevOverflow || '';
    delete document.body.dataset.prevOverflow;
  }
}

window.addEventListener('load', checkScreenWidth);
window.addEventListener('resize', checkScreenWidth);

// ─────────────────────────────────────────────
// ⚙️ Shortcuts / Atalhos
// ─────────────────────────────────────────────

document.addEventListener("keydown", function (event) {
  if (event.ctrlKey && event.key === ",") {
    event.preventDefault(); // impede o comportamento padrão do browser
    config();    // chama sua função
  }
});

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && (e.key === "`" || e.code === "Backquote")) {
    execute();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === "i") {
    if (document.getElementById('full-screen').style.opacity === '1') return; // Se o full screen estiver aberto, não faz nada
    e.preventDefault();
    const chat = document.getElementById('chat');
    const input = document.getElementById("input");
    
    // Se Shift estiver pressionado, apenas fullscreen
    if (e.shiftKey ) {

      if (chat.style.opacity !== '1') return; // Se o chat estiver oculto, não faz nada

      if (chat.style.width !== '41vh') {
        chat.style.width = '41vh';
        editor.style.opacity = '1';
      } else {
        chat.style.width = '127.5vh';
        editor.style.opacity = '0';
      }
    } else {
      // Sem Shift, comportamento normal
      if (chat.style.opacity === '1') {
        chat.style.opacity = '0';
        chat.style.pointerEvents = 'none';
        document.getElementById("Editor-Input").focus();
        editor.style.width = 'calc(100% - 97px)';
        configMenu.style.width = 'calc(100% - 91px)';
        chatOpen = false;
      } else {
        chat.style.display = 'block';
        chat.style.opacity = '1';
        chat.style.pointerEvents = 'auto';
        input.focus();
        editor.style.width = '60%';
        configMenu.style.width = '60.5%';
        chatOpen = true;
      }

      if (chat.style.width !== '41vh') {
        chat.style.width = '41vh';
        editor.style.opacity = '1';
        //configMenu.style.width = 'calc(100% - 97px)';
      }
    }
  }
});

// ─────────────────────────────────────────────
// 🌐 Network Status / Status da Conexão
// ─────────────────────────────────────────────

function handleNetworkChange() {
  const aviso = document.getElementById("network-status");
  const login = document.getElementById("login");

  if (!navigator.onLine) {
    if (getDevMode()) console.warn("🔴 Você está offline!");
    if (aviso && login) {
      aviso.textContent = "Sem conexão com a internet 😢";
      aviso.style.display = "block";
      login.style.opacity = "0";
    }
  } else {
    if (getDevMode()) console.log("🟢 Conexão restabelecida!");
    if (aviso) aviso.style.display = "none";
    if (login) login.style.opacity = "1";
  }
}

window.addEventListener('online', handleNetworkChange);
window.addEventListener('offline', handleNetworkChange);

}