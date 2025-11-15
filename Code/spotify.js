import { setDevMode, blockWeb, getDevMode } from "./config.js";

if (!blockWeb) {

// Spotify ID e escopos
const clientId = '602dd626c8014779aab8a1b118c80012';
const redirectUri = window.location.origin + window.location.pathname;
const scopes = 'user-read-currently-playing user-read-playback-state';

const trackNameFullEl = document.getElementById('track-name-full');
const artistNameFullEl = document.getElementById('artist-name-full');
const trackNameEl = document.getElementById('track-name');
const artistNameEl = document.getElementById('artist-name');
const albumArtEl = document.getElementById('album-art');
const albumArtEl2 = document.getElementById('album-art-full');
const full = document.getElementById('full-screen');
const trackInfoEl = document.getElementById('track-info');
const trackInfoFullEl = document.getElementById('track-info-full');
const profilePicEl = document.getElementById('spotify-profile-pic');
const viewCode = document.getElementById('code-language');
const closeBtn = document.getElementById('close');
const options = document.getElementById('options')
const editor = document.getElementById('Editor')

const path = document.querySelector("#spotify-logo-full path");
const btns = document.querySelector('#options').querySelectorAll('button');
let fullscreenLock = false;
let fullscreen = false;
let autoBackground = true;
let spotify = true;

// Função para gerar code verifier PKCE
function generateCodeVerifier(length = 128) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let verifier = '';
  for (let i = 0; i < length; i++) {
    verifier += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return verifier;
}

// Base64 URL encode
function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Gera o code challenge (SHA256 + base64url)
async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(digest));
  const hashStr = String.fromCharCode(...hashArray);
  return base64UrlEncode(hashStr);
}

// Redireciona para autorização do Spotify
async function redirectToSpotifyAuth() {
  const codeVerifier = generateCodeVerifier();
  sessionStorage.setItem('code_verifier', codeVerifier);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const authUrl =
    `https://accounts.spotify.com/authorize?` +
    `client_id=${clientId}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&code_challenge_method=S256` +
    `&code_challenge=${codeChallenge}`;

  window.location = authUrl;
}

// Troca o código recebido por access_token e refresh_token
async function fetchAccessToken(code) {
  const codeVerifier = sessionStorage.getItem('code_verifier');
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  const data = await response.json();

  if (data.access_token) {
    sessionStorage.setItem('access_token', data.access_token);
    sessionStorage.setItem('refresh_token', data.refresh_token);
    sessionStorage.setItem('expires_at', Date.now() + data.expires_in * 1000);
  } else {
    console.error('Erro ao buscar access token:', data);
  }

  return data;
}

// Renova access token usando refresh token
async function refreshAccessToken() {
  const refreshToken = sessionStorage.getItem('refresh_token');
  if (!refreshToken) {
    console.error('Refresh token não disponível');
    return;
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId
  });

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    if (!response.ok) throw new Error('Falha ao renovar token');

    const data = await response.json();

    sessionStorage.setItem('access_token', data.access_token);

    if (data.expires_in) {
      sessionStorage.setItem('expires_at', Date.now() + data.expires_in * 1000);
    }

    if (data.refresh_token) {
      // Algumas vezes o refresh token é retornado novamente
      sessionStorage.setItem('refresh_token', data.refresh_token);
    }

    console.log('Token renovado com sucesso!');
  } catch (err) {
    console.error('Erro ao renovar token:', err);
    // Aqui você pode forçar logout ou redirecionar para login novamente
  }
}

// Faz requisição com token válido (renova se necessário)
async function fetchWithToken(url, options = {}) {
  const expiresAt = parseInt(sessionStorage.getItem('expires_at'), 10) || 0;
  if (Date.now() > expiresAt - 60000) { // renova 1 min antes
    console.log('Token expirando, renovando...');
    await refreshAccessToken();
  }

  const accessToken = sessionStorage.getItem('access_token');
  options.headers = options.headers || {};
  options.headers['Authorization'] = `Bearer ${accessToken}`;

  return fetch(url, options);
}

// Trata o redirecionamento do Spotify com o código
async function handleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');

  if (code) {
    await fetchAccessToken(code);
    window.history.replaceState({}, document.title, redirectUri); // limpa query string
  }
}


// Busca a música que está tocando no momento
async  function getNowPlaying() {
  if (navigator.onLine) {
  if (spotify) {

    if (!fullscreen) {
      trackInfoEl.style.opacity = '1';
      albumArtEl.style.opacity = '1';
    }

  const token = sessionStorage.getItem('access_token');
  if (!token) return;

let response;
try {
  response = await fetchWithToken('https://api.spotify.com/v1/me/player/currently-playing');
} catch (err) {
  console.error('Erro ao buscar música:', err);
  return;
}

// Evita o erro "Unexpected end of JSON input"
if (!response.ok || response.status === 204) {
  return showNoMusic();
}

let data;
try {
  data = await response.json();
} catch (e) {
  console.error("Erro ao interpretar JSON:", e);
  return showNoMusic();
}

if (!data.item) return showNoMusic();


  // Se chegou aqui, tem música tocando
  if (!getDevMode()) console.clear();

  albumArtEl2.setAttribute('title', `${data.item.name} - ${data.item.artists.map(artist => artist.name).join(', ')} (Spotify)`);
  trackNameFullEl.textContent = data.item.name;
  albumArtEl2.style.width = '600px';
  artistNameFullEl.textContent = data.item.artists.map(artist => artist.name).join(', ');
  trackNameEl.textContent = data.item.name;
  artistNameEl.textContent = data.item.artists.map(artist => artist.name).join(', ');
  albumArtEl.crossOrigin = 'anonymous';
  albumArtEl.src = data.item.album.images[0].url;
  albumArtEl2.src = data.item.album.images[0].url;
  albumArtEl.style.display = 'block';

if (albumArtEl && albumArtEl.src) {
albumArtEl.onload = () => {
  try {
    const colorThief = new ColorThief();
    const dominantColor = colorThief.getColor(albumArtEl);
    const brightness = getBrightness(dominantColor);
    const back = `rgb(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]})`;

    // Ajuste automático com base no brilho
    let adjustedColor;
    if (brightness > 210) {
      // capa muito clara → escurece um pouco
      adjustedColor = darkenRGB(dominantColor, 20);
    } else if (brightness < 30) {
      // capa muito escura → clareia um pouco
      adjustedColor = lightenRGB(dominantColor, 20);
    } else {
      // brilho médio → mantém igual
      adjustedColor = `rgb(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]})`;
    }

    const textColor = brightness < 100
      ? lightenRGB(dominantColor, 55)
      : darkenRGB(dominantColor, 50);

    trackNameEl.style.color = adjustedColor;
    artistNameEl.style.color = adjustedColor;
    trackNameFullEl.style.color = textColor;
    artistNameFullEl.style.color = textColor;

    btns.forEach(btn => {
      btn.style.color = textColor;
      btn.style.borderColor = textColor;
    });

    path.style.fill = textColor;
    full.style.backgroundColor = back;
    

    if (autoBackground) {
      document.getElementById('options').style.backgroundColor = back;
      document.getElementById('options').style.borderColor = textColor;
      document.getElementById('youtube-logo').style.fill = textColor;
      document.getElementById('options').style.color = textColor;
      document.getElementById('Editor').style.backgroundColor = back;
      closeBtn.style.backgroundColor = back;
      closeBtn.style.color = textColor;
      closeBtn.style.borderColor = textColor;
      viewCode.style.backgroundColor = back;
      viewCode.style.borderColor = textColor;
      viewCode.style.color = textColor;
      document.getElementById('config').style.backgroundColor = back;
      document.getElementById('config').style.color = textColor;
      document.getElementById('theme-select').style.color = textColor;
      document.getElementById('theme-select').style.borderColor = textColor;
      document.getElementById('theme-select').style.backgroundColor = back;
    } else {
      resetTextColors();
    }

  } catch (error) {
    console.log("Erro ao pegar cor dominante:", error);
    full.style.backgroundColor = "#090909";
    resetTextColors();
  }
};
}
} else {
  resetTextColors();
}
  } else {
      document.getElementById('spotify-now-playing').style.opacity = '0';
      document.getElementById('spotify-now-playing').style.pointerEvents = 'none';
      resetTextColors();
  }
}

// Busca a foto do perfil do usuário
async function getUserProfilePicture() {
  const token = sessionStorage.getItem('access_token');
  if (!token) return;

  const response = await fetchWithToken('https://api.spotify.com/v1/me');

  if (!response.ok) {
    console.error('Erro ao buscar perfil do Spotify');
    return;
  }

  const data = await response.json();
  const imgUrl = data.images && data.images[0] ? data.images[0].url : null;
  const displayName = data.display_name || 'Usuário Spotify';

  if (imgUrl) {
    profilePicEl.src = imgUrl;
    profilePicEl.setAttribute('title', displayName);
  }
}

function resetTextColors() {


  document.getElementById('options').style.backgroundColor = "#090909";
  document.getElementById('options').style.color = "#090909";
  document.getElementById('options').style.borderColor = "#3c3c3c";
  viewCode.style.borderColor = "#3c3c3c";
  document.getElementById('youtube-logo').style.fill = "#FF6700";
  document.getElementById('Editor').style.backgroundColor = "#3c3c3c";
  document.getElementById('close').style.backgroundColor = "#090909";
  document.getElementById('close').style.color = "#FF6700";
  document.getElementById('close').style.borderColor = "#3c3c3c";
  viewCode.style.backgroundColor = "#090909";
  viewCode.style.color = "#FF6700";
  document.getElementById('config').style.backgroundColor = "#090909";
  document.getElementById('youtube-logo').style.fill = "#FF6700";
  document.getElementById('config').style.color = "#FF6700";
  document.getElementById('theme-select').style.color = "#FF6700";
  document.getElementById('theme-select').style.borderColor = "#FF6700";
  document.getElementById('theme-select').style.backgroundColor = "#090909";
  path.style.fill = "#1ED760";

  btns.forEach(btn => {
    btn.style.color = "#FF6700";
    btn.style.borderColor = "#FF6700";
  });

  getNowPlaying();
}

function fullScreenVerif() {
  if (fullscreenLock) return; // se estiver bloqueado, não faz nada
  fullscreenLock = true; // bloqueia

  fullScreen(); // chama sua função normal

  setTimeout(() => {
    fullscreenLock = false; // libera depois de 1 segundo
  }, 980);
}


function getBrightness([r, g, b]) {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

// Função para alternar tela cheia
function fullScreen() {
  const img = document.getElementById('album-art-full');
  if (!img.src) return; // Não faz nada se não houver imagem
  const img2 = document.getElementById('album-art');
  const closeBtn = document.getElementById('close');
  const isVisible = full.style.width >= '50%';

  closeBtn.style.display = 'block';
  full.style.width = isVisible ? '0.1px' : '99.3%';
  full.style.opacity = isVisible ? '0' : '1';
  img.style.opacity = isVisible ? '0' : '1';
  img2.style.opacity = isVisible ? '1' : '0';
  full.style.pointerEvents = isVisible ? 'none' : 'auto';
  trackInfoEl.style.opacity = isVisible ? '1' : '0';
  options.style.opacity = isVisible ? '1' : '0';
  trackInfoFullEl.style.opacity = isVisible ? '0' : '1';
  closeBtn.style.pointerEvents = isVisible ? 'none' : 'auto';
  editor.style.opacity = isVisible ? '1' : '0';

fullScreenCalc();
}

function fullScreenCalc() {
    const notVisible = full.style.width <= '10px';
    const closeBtn = document.getElementById('close');

if (notVisible) {
  viewCode.style.display = 'block';
  setTimeout(() => {
    viewCode.style.opacity = 1;
  }, 1000);
      closeBtn.style.opacity = 0;
      closeBtn.style.pointerEvents = 'none';
  setTimeout(() => {
  viewCode.style.pointerEvents = 'auto';
  }, 1500);

  fullscreen = 'false';

} else {
  viewCode.style.opacity = 0;
  viewCode.style.pointerEvents = 'none';
  setTimeout(() => {
    closeBtn.style.opacity = 1;
    closeBtn.style.pointerEvents = 'auto';
    viewCode.style.display = 'none';
  }, 500);
    fullscreen = 'true';

}
if (getDevMode()) console.log("Tela cheia:",fullscreen)
}

// Inicialização
(async () => {
  await handleRedirect();

  const token = sessionStorage.getItem('access_token');
  const loginBtn = document.getElementById('login');

  if (token) {
    loginBtn.style.display = 'none';
    setInterval(getNowPlaying, 2000);
    getUserProfilePicture();
  } else {
    loginBtn.style.display = 'block';
    loginBtn.addEventListener('click', redirectToSpotifyAuth);
  }
})();

function lightenRGB([r, g, b], percent = 20) {
  const newR = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
  const newG = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
  const newB = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));
  return `rgb(${newR}, ${newG}, ${newB})`;
}

function darkenRGB([r, g, b], percent = 20) {
  const newR = Math.max(0, Math.floor(r - r * (percent / 100)));
  const newG = Math.max(0, Math.floor(g - g * (percent / 100)));
  const newB = Math.max(0, Math.floor(b - b * (percent / 100)));
  return `rgb(${newR}, ${newG}, ${newB})`;
}

const devModeCheckbox = document.getElementById('dev-mode-checkbox');

// Função para atualizar o valor da variável com o estado atual do checkbox
document.getElementById('auto-background-checkbox').addEventListener('change', function() {
  autoBackground = this.checked;
  saveCheckboxState();
});

document.getElementById('spotify-checkbox').addEventListener('change', function() {
  spotify = this.checked;
  Spotify();
  saveCheckboxState();
});

// Ao mudar o checkbox
devModeCheckbox.addEventListener('change', function() {
  const newValue = this.checked;
  setDevMode(newValue);
  console.log("Dev Mode atualizado:", getDevMode());

});


const autoCheckbox = document.getElementById('auto-background-checkbox');
const spotifyCheckbox = document.getElementById('spotify-checkbox');

// Salvando o estado do checkbox com localStorage:
function saveCheckboxState() {

  const autoValue = !!(autoCheckbox && autoCheckbox.checked);
  const spotifyValue = !!(spotifyCheckbox && spotifyCheckbox.checked);

  localStorage.setItem('autoBackground', String(autoValue));
  localStorage.setItem('spotify', String(spotifyValue));

}

// Carregar estado salvo ao iniciar
document.addEventListener('DOMContentLoaded', () => {
  const savedState = localStorage.getItem('autoBackground');
  const savedStateSpotify = localStorage.getItem('spotify');
  if (savedState !== null) {
    autoBackground = savedState === 'true';
    const autoCheckbox = document.getElementById('auto-background-checkbox');
    if (autoCheckbox) autoCheckbox.checked = autoBackground;
  }
  if (savedStateSpotify !== null) {
    spotify = savedStateSpotify === 'true';
    const spotifyCheckbox = document.getElementById('spotify-checkbox');
    if (spotifyCheckbox) spotifyCheckbox.checked = spotify;
    Spotify();
  }

  if (devModeCheckbox) devModeCheckbox.checked = getDevMode();
  
});

function Spotify() {
  if (spotify) {
    document.getElementById('spotify-now-playing').style.opacity = '1';
    document.getElementById('spotify-now-playing').style.pointerEvents = 'auto';
    viewCode.style.width = '50%';
    document.getElementById('auto-back-complete').style.opacity = '1';
    
  } else {
    document.getElementById('spotify-now-playing').style.opacity = '0';
    document.getElementById('spotify-now-playing').style.pointerEvents = 'none';
    viewCode.style.width = 'calc(100% - 85px)';
    document.getElementById('auto-back-complete').style.opacity = '0';

  }
}

async function showNoMusic() {
  trackNameEl.textContent = 'Nenhuma música tocando';
  artistNameEl.textContent = '';
  trackNameFullEl.textContent = '';
  artistNameFullEl.textContent = '';
  albumArtEl.src = '';
  albumArtEl.style.display = 'none';

  if (!albumArtEl2.dataset.isProfile) {
    const token = sessionStorage.getItem('access_token');
    if (!token) return;
    const userResponse = await fetchWithToken('https://api.spotify.com/v1/me');
    if (!userResponse.ok) {
      console.error('Erro ao buscar perfil do Spotify para tela cheia');
      return;
    }
    const data = await userResponse.json();
    const imgUrl = data.images?.[0]?.url || null;
    const displayName = data.display_name || 'Usuário Spotify';

    if (imgUrl) {
      albumArtEl2.src = imgUrl;
      albumArtEl2.setAttribute('title', displayName);
      albumArtEl2.dataset.isProfile = "true";
    }
  }

  albumArtEl2.style.width = '700px';
  trackNameEl.style.color = '#fff';
  artistNameEl.style.color = '#bbb';
  full.style.backgroundColor = "#090909";
  resetTextColors();
}


window.fullScreenVerif = fullScreenVerif;

let timer; // Armazena o temporizador
const tempoInatividade = 5000; // 5 segundos

function acaoInativo() {
  // Só executa se a aba estiver ativa!
  if (document.visibilityState !== "visible") return;
  if (fullscreen === "false") return;

  document.body.classList.add("inativo");
  if (getDevMode()) console.log("🕒 Mouse parado por 5 segundos — ação iniciada!");
  document.documentElement.style.cursor = 'none';
  full.style.height = "calc(100% - 11px)";
  full.style.borderRadius = "10px"
  document.getElementById('close').style.opacity = "0";
  document.getElementById('spotify-profile-pic').style.opacity = "0";
}

function acaoVoltar() {

  document.body.classList.remove("inativo");
  full.style.height = "calc(100vh - 67px)";
  full.style.borderRadius = "6px"
  document.documentElement.style.cursor = ''; // volta ao padrão do CSS

  if (fullscreen === "true") {
    document.getElementById('close').style.opacity = "1";
  } else {
    document.getElementById('close').style.opacity = "0";
  }

  document.getElementById('spotify-profile-pic').style.opacity = "1";
}

function resetarTimer() {
  clearTimeout(timer);
  acaoVoltar();

  // Só reinicia o timer se a aba estiver visível
  if (fullscreen && document.visibilityState === "visible") {
    timer = setTimeout(acaoInativo, tempoInatividade);
  }
}

// Detecta atividade do usuário
window.addEventListener("mousemove", resetarTimer);
window.addEventListener("keydown", resetarTimer);

// Detecta mudança de visibilidade da aba (ex: trocou de guia)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    clearTimeout(timer);
  } else {
    resetarTimer();
  }
});

// Inicia o temporizador
resetarTimer();

}