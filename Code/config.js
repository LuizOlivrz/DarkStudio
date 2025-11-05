setDevMode(false);

export function getDevMode() {
  return localStorage.getItem('devMode') === 'true';
}

export function setDevMode(value) {
  localStorage.setItem('devMode', String(value));
}

let device = "Detectando";
let block = false; // ✅ troquei const por let

isMobile();

function isMobile() {
  device = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent);
  if (getDevMode()) console.log("Dispositivo:", device);
  
  // ✅ se for um dispositivo móvel, bloqueia
  if (device) {
    block = true;
  }
}

if (getDevMode()) console.log("Dev Mode:", getDevMode());

// ✅ exporta o valor atualizado
export const blockWeb = block;
