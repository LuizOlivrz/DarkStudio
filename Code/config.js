// config.js
export function getDevMode() {
  return localStorage.getItem('devMode') === 'true';
}
export function setDevMode(value) {
  localStorage.setItem('devMode', String(value));
}

export const blockWeb = false;
export let devMode = getDevMode();