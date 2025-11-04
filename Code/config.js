// config.js
export function getDevMode() {
  return localStorage.getItem('devMode') === 'true';
}
export function setDevMode(value) {
  localStorage.setItem('devMode', String(value));
}

const block = false;

function isMobile() {
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent);
}

if (isMobile()) block = true;
export const blockWeb = block;
export let devMode = getDevMode();