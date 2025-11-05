// config.js

setDevMode(false)

export function getDevMode() {
  return localStorage.getItem('devMode') === 'true';
}
export function setDevMode(value) {
  localStorage.setItem('devMode', String(value));
}

let device = "Detectando";
const block = false;

isMobile();

function isMobile() {
  device = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent);
  if (getDevMode())console.log(device)
}
if (getDevMode()) console.log(getDevMode())
if (device) block = true;
export const blockWeb = block;