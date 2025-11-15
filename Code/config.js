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

detectDevice();

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

if (getDevMode() === "true") console.log("Dev Mode:", getDevMode());

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

  if (getDevMode() === "true") console.log(`🎵 Script '${name}.js' carregado com sucesso!`);
}

// Garante que o body já existe antes de adicionar scripts
function loadJS(name) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => js(name));
  } else {
    js(name);
  }
}

console.log(getDevMode())

// Exemplo de uso
loadJS('spotify');
loadJS('main');
loadJS('monaco')