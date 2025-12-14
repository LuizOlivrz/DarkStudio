// ─────────────────────────────────────────────
// 🌐 Dev Mode Utilities / Utilitários do Modo Dev
// ─────────────────────────────────────────────

/**
 * Get the current Dev Mode state from localStorage
 * Obtém o estado atual do Modo Dev do localStorage
 */
export function getDevMode() {
  return localStorage.getItem('devMode') === 'true';
}

/**
 * Set the Dev Mode state in localStorage
 * Define o estado do Modo Dev no localStorage
 * @param {boolean} value - true to enable, false to disable / true para ativar, false para desativar
 */
export function setDevMode(value) {
  localStorage.setItem('devMode', String(value));
}

// ─────────────────────────────────────────────
// 📱 Device Detection / Detecção de Dispositivo
// ─────────────────────────────────────────────

let device = "Detectando"; // current device status / status atual do dispositivo
let block = false;         // whether to block access / se deve bloquear o acesso

if (!block) detectDevice();

/**
 * Detects whether the user is on a mobile device
 * Detecta se o usuário está em um dispositivo móvel
 */
function detectDevice() {
  const isMobileDevice = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent);
  device = isMobileDevice ? "Mobile" : "Desktop";

  if (getDevMode()) console.log("Dispositivo / Device:", device);

  // ✅ If it's a mobile device, block access
  // ✅ Se for um dispositivo móvel, bloqueia o acesso
  if (device === "Mobile") block = true;
}

// ─────────────────────────────────────────────
// 🧩 Dev Mode Logging / Log do Modo Dev
// ─────────────────────────────────────────────

if (getDevMode() && !block) console.log("Dev Mode:", getDevMode());

// ─────────────────────────────────────────────
// 🚫 Exported Flag / Flag Exportada
// ─────────────────────────────────────────────

/**
 * Indicates if the web app should be blocked (mobile users)
 * Indica se o app web deve ser bloqueado (usuários mobile)
 */
export const blockWeb = block;

/**
 * Carrega qualquer arquivo JS dinamicamente
 * @param {string} name - nome do arquivo JS (sem .js) dentro da pasta Code
 */
function js(name) {
  const script = document.createElement('script');
  script.src = `Code/${name}.js`; // ajusta o caminho da sua pasta
  script.type = 'module';         // importante pra aceitar import/export
  document.body.appendChild(script);

  if (getDevMode()) console.log(`🎵 Script '${name}.js' carregado com sucesso!`);
}

// Garante que o body já existe antes de adicionar scripts
function loadJS(name) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => js(name));
  } else {
    js(name);
  }
}

/**
 * Carrega um script externo (CDN) dinamicamente
 * @param {string} url - URL do script
 * @returns {Promise<void>}
 */
export function loadExternalScript(url) {
  return new Promise((resolve, reject) => {
    // evita carregar duas vezes
    if (document.querySelector(`script[src="${url}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = url;
    script.defer = true;
    script.onload = () => {
      if (getDevMode()) console.log("📦 Script externo carregado:", url);
      resolve();
    };
    script.onerror = () => reject(`Erro ao carregar ${url}`);

    document.head.appendChild(script);
  });
}

/**
 * Carrega um arquivo CSS dinamicamente
 * @param {string} href - caminho do CSS
 */
export function loadCSS(href) {
  if (document.querySelector(`link[rel="stylesheet"][href="${href}"]`)) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;

  document.head.appendChild(link);

  if (getDevMode()) console.log("🎨 CSS carregado:", href);
  setTimeout(() => {
    document.getElementById('Website-Container').style.opacity = '1'; // mostra o body após carregar o CSS
  }, 750); // delay pra garantir que o CSS foi aplicado
}

/**
 * Define o favicon dinamicamente
 * @param {string} href - URL do favicon
 */
export function loadFavicon(href) {
  let favicon = document.getElementById("favicon");

  if (!favicon) {
    favicon = document.createElement("link");
    favicon.id = "favicon";
    favicon.rel = "icon";
    favicon.type = "image/jpeg";
    document.head.appendChild(favicon);
  }

  favicon.href = href;

  if (getDevMode()) console.log("⭐ Favicon aplicado:", href);
}

// ─────────────────────────────────────────────
// 🚦 Main Loader / Carregador Principal
// ─────────────────────────────────────────────

if (!block) {

  // Exemplo de uso
  loadJS('spotify');
  loadJS('monaco');
  loadJS('main');
  loadJS('AI');
  await loadExternalScript("https://cdnjs.cloudflare.com/ajax/libs/color-thief/2.3.2/color-thief.umd.js");
  loadCSS("Code/Dark.css");
  loadFavicon("https://i.postimg.cc/1txBHHJn/Design-sem-nome-4.png");


} else {
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
  
      <h1>Site Blocked :(</h1>
      <p>Your favorite code editing website is temporarily unavailable!</p>
      <h5>By: CDP 💚</h5>

      <div style="margin-top:20px; font-size:12px;">
        <strong>Reason:</strong><br/>
        This site is not compatible with mobile devices at the moment.<br/>
        Please access it from a desktop computer to enjoy all available features.
      </div>
    </div>

  `;

  document.title = "DarkStudio :(";
  const favicon = document.getElementById('favicon');
  if (favicon) {
    favicon.href = "https://cdn-0.emojis.wiki/emoji-pics/twitter/red-square-twitter.png";
  }
}