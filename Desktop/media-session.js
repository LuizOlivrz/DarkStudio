const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs/promises");
const { fileURLToPath } = require("node:url");

const execFileAsync = promisify(execFile);
let stopPlatformMonitor = null;
let stopWindowsListener = null;
let windowsMediaApi = null;
let stopped = false;
let lastFingerprint = "";

function normalizeSession(session) {
  if (!session || typeof session !== "object") return null;
  const title = String(session.title || "").trim();
  const artist = String(session.artist || "").trim();
  if (!title && !artist) return null;
  return {
    title: title || "Mídia em reprodução",
    artist: artist || "Artista desconhecido",
    album: String(session.albumTitle || session.album || "").trim(),
    artwork: typeof session.thumbnail === "string" ? session.thumbnail : "",
    source: String(session.sourceAppDisplayName || session.source || "").trim()
  };
}

function publishIfChanged(snapshot, onUpdate) {
  const fingerprint = JSON.stringify(snapshot);
  if (fingerprint === lastFingerprint) return;
  lastFingerprint = fingerprint;
  onUpdate(snapshot);
}

async function readLinuxArtwork(value) {
  if (!value) return "";
  if (/^data:image\//i.test(value) || /^https?:\/\//i.test(value)) return value;
  try {
    const filePath = value.startsWith("file:") ? fileURLToPath(value) : value;
    const extension = filePath.toLowerCase().split(".").pop();
    const mime = ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" })[extension] || "image/jpeg";
    const bytes = await fs.readFile(filePath);
    return "data:" + mime + ";base64," + bytes.toString("base64");
  } catch {
    return "";
  }
}

async function readLinuxSession() {
  const format = "{{status}}\t{{title}}\t{{artist}}\t{{album}}\t{{mpris:artUrl}}\t{{playerName}}";
  try {
    const { stdout } = await execFileAsync("playerctl", ["-a", "metadata", "--format", format], {
      timeout: 2500,
      windowsHide: true,
      maxBuffer: 1024 * 1024
    });
    const sessions = stdout.split(/\r?\n/).map((line) => {
      const [status, title, artist, album, artwork, source] = line.split("\t");
      return { status, title, artist, album, artwork, source };
    }).filter((item) => item.status === "Playing" && (item.title || item.artist));
    const selected = sessions[0];
    if (!selected) return null;
    return {
      title: selected.title || "Mídia em reprodução",
      artist: selected.artist || "Artista desconhecido",
      album: selected.album || "",
      artwork: await readLinuxArtwork(selected.artwork),
      source: selected.source || ""
    };
  } catch {
    return null;
  }
}

async function readMacSession() {
  const script = [
    'tell application "System Events"',
    'set appNames to {"Spotify", "Music"}',
    'repeat with appName in appNames',
    'if (exists process (contents of appName)) then',
    'try',
    'if (contents of appName) is "Spotify" then',
    'tell application "Spotify"',
    'if player state is playing then return "PLAYING" & tab & name of current track & tab & artist of current track & tab & album of current track & tab & "Spotify"',
    'end tell',
    'else',
    'tell application "Music"',
    'if player state is playing then return "PLAYING" & tab & name of current track & tab & artist of current track & tab & album of current track & tab & "Music"',
    'end tell',
    'end if',
    'end try',
    'end if',
    'end repeat',
    'end tell',
    'return ""'
  ].join("\n");
  try {
    const { stdout } = await execFileAsync("osascript", ["-e", script], {
      timeout: 3500,
      windowsHide: true,
      maxBuffer: 256 * 1024
    });
    const [status, title, artist, album, source] = stdout.trim().split("\t");
    if (status !== "PLAYING" || (!title && !artist)) return null;
    return { title: title || "Mídia em reprodução", artist: artist || "Artista desconhecido", album: album || "", artwork: "", source: source || "" };
  } catch {
    return null;
  }
}

async function startMediaSessionMonitor(onUpdate) {
  if (typeof onUpdate !== "function") throw new TypeError("onUpdate precisa ser uma função.");
  stopped = false;
  lastFingerprint = "";

  if (process.platform === "win32") {
    try {
      windowsMediaApi = require("windows-media-sessions");
      const emitSessions = (sessions) => {
        if (stopped) return;
        const active = Array.from(sessions || [])
          .filter((session) => session.playbackStatus === "playing")
          .map(normalizeSession)
          .filter(Boolean);
        publishIfChanged(active[0] || null, onUpdate);
      };
      stopWindowsListener = windowsMediaApi.onSessionsChanged(emitSessions);
      try {
        emitSessions(await windowsMediaApi.getActiveSessions());
      } catch (error) {
        console.warn("DarkStudio: não foi possível obter a sessão de mídia inicial.", error);
      }
      return stopMediaSessionMonitor;
    } catch (error) {
      console.warn("DarkStudio: leitura de mídia do Windows indisponível.", error);
      publishIfChanged(null, onUpdate);
      return stopMediaSessionMonitor;
    }
  }

  const read = process.platform === "linux"
    ? readLinuxSession
    : process.platform === "darwin"
      ? readMacSession
      : null;

  if (!read) {
    publishIfChanged(null, onUpdate);
    return stopMediaSessionMonitor;
  }

  let running = false;
  const poll = async () => {
    if (stopped || running) return;
    running = true;
    try {
      publishIfChanged(await read(), onUpdate);
    } finally {
      running = false;
    }
  };
  await poll();
  const interval = setInterval(() => void poll(), process.platform === "linux" ? 2500 : 4000);
  stopPlatformMonitor = () => clearInterval(interval);
  return stopMediaSessionMonitor;
}

async function stopMediaSessionMonitor() {
  stopped = true;
  if (typeof stopWindowsListener === "function") {
    try { stopWindowsListener(); } catch {}
  }
  stopWindowsListener = null;
  if (typeof stopPlatformMonitor === "function") stopPlatformMonitor();
  stopPlatformMonitor = null;
  if (windowsMediaApi?.shutdown) {
    try { await windowsMediaApi.shutdown(); } catch {}
  }
  windowsMediaApi = null;
}

module.exports = { startMediaSessionMonitor, stopMediaSessionMonitor };
