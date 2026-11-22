const path = require("node:path");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const { app, BrowserWindow, shell, dialog, ipcMain, protocol, net, Menu, screen } = require("electron");
const { pathToFileURL } = require("node:url");
const extract = (archive, options) => import("@electron-internal/extract-zip")
  .then(({ default: extractZip }) => extractZip(archive, options));
const { spawn } = require("node:child_process");
const os = require("node:os");
const { startMediaSessionMonitor, stopMediaSessionMonitor } = require("./media-session");

app.setName("DarkStudio");
if (process.platform === "win32") app.setAppUserModelId("dev.darkstudio.desktop");

protocol.registerSchemesAsPrivileged([{
  scheme: "app",
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
}]);

// Public update manifest; the desktop client never accesses the private source repository.
const UPDATE_MANIFEST_URLS = [
  "https://raw.githubusercontent.com/LuizOlivrz/DarkStudio/main/Extras/Publico/version.json",
  "https://cdn.jsdelivr.net/gh/LuizOlivrz/DarkStudio@main/Extras/Publico/version.json",
];
const UPDATE_ROOT = () => path.join(app.getPath("userData"), "official-updates");
const ACTIVE_VERSION_FILE = () => path.join(UPDATE_ROOT(), "active.json");
const PROJECT_ROOT = path.resolve(__dirname, "..");
const VERSION_PATTERN = /export\s+const\s+version\s*=\s*["']([^"']+)["']/;

const LAST_OPEN_FILE_FILE = () => path.join(app.getPath("userData"), "last-open-file.json");

async function rememberLastOpenedFile(filePath) {
  await fs.mkdir(path.dirname(LAST_OPEN_FILE_FILE()), { recursive: true });
  await fs.writeFile(LAST_OPEN_FILE_FILE(), JSON.stringify({ filePath }, null, 2), "utf8");
}

async function isBinaryFilePath(filePath) {
  let handle;
  try {
    handle = await fs.open(filePath, "r");
    const sample = Buffer.alloc(8192);
    const { bytesRead } = await handle.read(sample, 0, sample.length, 0);
    if (!bytesRead) return false;
    const bytes = sample.subarray(0, bytesRead);
    const hasUtf16Bom = bytes.length >= 2 &&
      ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff));
    if (bytes.includes(0) && !hasUtf16Bom) return true;
    let invalidUtf8 = false;
    try {
      const encoding = hasUtf16Bom ? (bytes[0] === 0xff ? "utf-16le" : "utf-16be") : "utf-8";
      new TextDecoder(encoding, { fatal: true }).decode(bytes.subarray(0, bytes.length > 4 ? bytes.length - 4 : bytes.length));
    } catch {
      if (hasUtf16Bom) return true;
      invalidUtf8 = true;
    }
    if (hasUtf16Bom) return false;
    let controls = 0;
    let highBytes = 0;
    for (const byte of bytes) {
      if (byte >= 0x80) highBytes++;
      if (byte < 0x20 && byte !== 0x08 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0c && byte !== 0x0d) controls++;
    }
    return controls / bytes.length > 0.02 || (invalidUtf8 && highBytes / bytes.length > 0.25);
  } finally {
    await handle?.close().catch(() => {});
  }
}

ipcMain.handle("darkstudio:restore-last-file", async () => {
  try {
    const saved = JSON.parse(await fs.readFile(LAST_OPEN_FILE_FILE(), "utf8"));
    if (typeof saved.filePath !== "string" || !path.isAbsolute(saved.filePath)) return null;
    const fileName = path.basename(saved.filePath);
    if (await isBinaryFilePath(saved.filePath)) {
      return { filePath: saved.filePath, fileName, isBinary: true };
    }
    const content = await fs.readFile(saved.filePath, "utf8");
    return { filePath: saved.filePath, fileName, content };
  } catch {
    return null;
  }
});

ipcMain.handle("darkstudio:save-current-file", async (_event, options = {}) => {
  try {
    const saved = JSON.parse(await fs.readFile(LAST_OPEN_FILE_FILE(), "utf8"));
    if (typeof saved.filePath !== "string" || !path.isAbsolute(saved.filePath)) {
      return { saved: false, reason: "no-current-file" };
    }
    await fs.writeFile(saved.filePath, String(options.content ?? ""), "utf8");
    return { saved: true, filePath: saved.filePath, fileName: path.basename(saved.filePath) };
  } catch (error) {
    return { saved: false, reason: "write-failed", message: String(error?.message || error) };
  }
});

ipcMain.handle("darkstudio:open-file", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Code and text files", extensions: ["js", "html", "css", "txt", "json", "java", "py", "cpp", "c", "bat", "md"] }, { name: "All files", extensions: ["*"] }]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  const fileName = path.basename(filePath);
  if (await isBinaryFilePath(filePath)) return { filePath, fileName, isBinary: true };
  const content = await fs.readFile(filePath, "utf8");
  await rememberLastOpenedFile(filePath);
  return { filePath, fileName, content };
});

ipcMain.handle("darkstudio:save-file", async (_event, options = {}) => {
  const extension = String(options.extension || "txt").replace(/[^a-z0-9]/gi, "") || "txt";
  const defaultName = String(options.defaultName || `untitled.${extension}`).replace(/[\\\\/]/g, "_");
  const result = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: extension.toUpperCase() + " files", extensions: [extension] }, { name: "All files", extensions: ["*"] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  await fs.writeFile(result.filePath, String(options.content ?? ""), "utf8");
  await rememberLastOpenedFile(result.filePath);
  return { canceled: false, filePath: result.filePath, fileName: path.basename(result.filePath) };
});

async function readActiveUpdate() {
  try {
    const data = JSON.parse(await fs.readFile(ACTIVE_VERSION_FILE(), "utf8"));
    if (
      typeof data.version !== "string" ||
      !/^[a-zA-Z0-9._-]{1,80}$/.test(data.version) ||
      data.directory !== `version-${data.version}`
    ) return null;
    const indexPath = path.join(UPDATE_ROOT(), data.directory, "index.html");
    const configPath = path.join(UPDATE_ROOT(), data.directory, "Extras", "Code", "config.js");
    await Promise.all([fs.access(indexPath), fs.access(configPath)]);

    // An MSI upgrade installs a newer bundled version but preserves userData.
    // Do not let an older ZIP overlay shadow the newly installed application.
    const bundledConfigPath = path.join(PROJECT_ROOT, "Extras", "Code", "config.js");
    const bundledConfig = await fs.readFile(bundledConfigPath, "utf8");
    const bundledVersion = bundledConfig.match(VERSION_PATTERN)?.[1];
    const activeVersionNumber = parseOfficialVersion(data.version);
    const bundledVersionNumber = parseOfficialVersion(bundledVersion);
    if (
      activeVersionNumber !== null &&
      bundledVersionNumber !== null &&
      bundledVersionNumber > activeVersionNumber
    ) {
      await fs.rm(ACTIVE_VERSION_FILE(), { force: true });
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

async function getLocalVersion() {
  const active = await readActiveUpdate();
  if (active) return active.version;
  try {
    const source = await fs.readFile(path.join(PROJECT_ROOT, "Extras", "Code", "config.js"), "utf8");
    return source.match(VERSION_PATTERN)?.[1] || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function fetchText(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "DarkStudio-Desktop-Updater", "Cache-Control": "no-cache" }, cache: "no-store", redirect: "follow" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchUpdateManifest() {
  let lastError;
  for (const url of UPDATE_MANIFEST_URLS) {
    try {
      const manifest = JSON.parse(await fetchText(url));
      if (
        manifest.product !== "DarkStudio" ||
        typeof manifest.version !== "string" ||
        !/^[a-zA-Z0-9._-]{1,80}$/.test(manifest.version)
      ) throw new Error("Metadados de atualização inválidos.");
      return manifest;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Não foi possível consultar as atualizações.");
}

// Official website versions use DD.MM.YY (day.month.two-digit-year), not semver.
function parseOfficialVersion(value) {
  if (typeof value !== "string" || !/^(0[1-9]|[12]\d|3[01])\.(0[1-9]|1[0-2])\.\d{2}$/.test(value)) {
    return null;
  }

  const [day, month, shortYear] = value.split(".").map(Number);
  const year = 2000 + shortYear;
  const date = new Date(Date.UTC(year, month - 1, day));

  // Reject impossible calendar dates such as 31.02.26.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;

  return year * 10000 + month * 100 + day;
}

async function checkForUpdates(options = {}) {
  const manual = options.manual === true;
  if (process.platform !== "win32" || !app.isPackaged) {
    if (manual) {
      await dialog.showMessageBox({
        type: "info",
        title: "Atualizações do DarkStudio",
        message: "A verificação está disponível somente no aplicativo desktop Windows instalado."
      });
    }
    return { status: "unsupported" };
  }

  let manifest;
  try {
    manifest = await fetchUpdateManifest();
  } catch (error) {
    console.warn("DarkStudio: não foi possível verificar atualizações; mantendo a versão local.", error);
    if (manual) {
      await dialog.showMessageBox({
        type: "error",
        title: "Falha ao verificar atualizações",
        message: "Não foi possível consultar o servidor de atualizações.",
        detail: String(error?.message || error),
        buttons: ["OK"]
      });
    }
    return { status: "error", message: String(error?.message || error) };
  }

  const localVersion = await getLocalVersion();
  const officialVersion = manifest.version;
  const installedVersionNumber = parseOfficialVersion(localVersion);
  const officialVersionNumber = parseOfficialVersion(officialVersion);

  if (installedVersionNumber === null || officialVersionNumber === null) {
    console.warn(
      "DarkStudio: formato de versão inválido; a comparação esperada é DD.MM.YY.",
      { installedVersion: localVersion, officialVersion }
    );
    if (manual) {
      await dialog.showMessageBox({
        type: "error",
        title: "Versão inválida",
        message: "Não foi possível comparar as versões do DarkStudio.",
        detail: `Versão instalada: ${localVersion}; versão publicada: ${officialVersion}.`,
        buttons: ["OK"]
      });
    }
    return { status: "invalid-version" };
  }

  // Only offer an update when the official calendar version is strictly newer.
  // For example, 27.10.26 > 26.10.26, while 25.10.26 and 26.10.26 are not updates.
  if (officialVersionNumber <= installedVersionNumber) {
    console.info(
      `DarkStudio: sem atualização. Versão instalada: ${localVersion}; versão oficial: ${officialVersion}.`
    );
    if (manual) {
      await dialog.showMessageBox({
        type: "info",
        title: "DarkStudio atualizado",
        message: `Você já está usando a versão mais recente (${localVersion}).`,
        buttons: ["OK"]
      });
    }
    return { status: "up-to-date", localVersion, officialVersion };
  }

  // Never prompt for an update until a public package has actually been published.
  if (typeof manifest.updatePackageUrl !== "string" || !manifest.updatePackageUrl.trim()) {
    console.warn(`DarkStudio: a versão ${officialVersion} está anunciada, mas ainda não há pacote publicado.`);
    if (manual) {
      await dialog.showMessageBox({
        type: "info",
        title: "Atualização ainda não disponível",
        message: `A versão ${officialVersion} foi anunciada, mas o pacote ainda não foi publicado.`,
        buttons: ["OK"]
      });
    }
    return { status: "package-unavailable", officialVersion };
  }

  let packageUrl;
  try {
    packageUrl = new URL(manifest.updatePackageUrl);
    if (packageUrl.protocol !== "https:") throw new Error("A URL do pacote precisa usar HTTPS.");
  } catch {
    console.error("DarkStudio: URL do pacote de atualização inválida.");
    if (manual) {
      await dialog.showMessageBox({
        type: "error",
        title: "Link de atualização inválido",
        message: "O endereço do pacote publicado não é válido.",
        buttons: ["OK"]
      });
    }
    return { status: "invalid-package-url" };
  }

  const choice = await dialog.showMessageBox({
    type: "info",
    title: "Atualização do DarkStudio",
    message: "Uma nova versão do DarkStudio está disponível.",
    detail: `Versão instalada: ${localVersion}\\nVersão oficial: ${officialVersion}\\n\\nDeseja baixar e instalar a atualização agora? A versão instalada continuará disponível offline.`,
    buttons: ["Atualizar agora", "Depois"],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  });
  if (choice.response !== 0) return { status: "cancelled", localVersion, officialVersion };

  let stagingDir;
  try {
    await fs.mkdir(UPDATE_ROOT(), { recursive: true });
    const tempRoot = path.join(UPDATE_ROOT(), "staging");
    stagingDir = tempRoot;
    await fs.rm(tempRoot, { recursive: true, force: true });
    await fs.mkdir(tempRoot, { recursive: true });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    let archive;
    try {
      const response = await fetch(packageUrl.toString(), {
        signal: controller.signal,
        headers: { "User-Agent": "DarkStudio-Desktop-Updater" },
        redirect: "follow"
      });
      if (!response.ok) throw new Error(`Download falhou (HTTP ${response.status}).`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 150 * 1024 * 1024) {
        throw new Error("O arquivo de atualização tem tamanho inválido.");
      }
      archive = path.join(tempRoot, "update.zip");
      await fs.writeFile(archive, bytes);
    } finally {
      clearTimeout(timer);
    }

    const extractedDir = path.join(tempRoot, "extracted");
    await fs.mkdir(extractedDir, { recursive: true });
    await extract(archive, { dir: extractedDir });
    const roots = await fs.readdir(extractedDir, { withFileTypes: true });
    const sourceRoot = roots.find((entry) => entry.isDirectory() && /^[^/]+$/.test(entry.name));
    if (!sourceRoot) throw new Error("O pacote de atualização não contém uma pasta válida.");
    const officialRoot = path.join(extractedDir, sourceRoot.name);
    const officialConfigPath = path.join(officialRoot, "Extras", "Code", "config.js");
    let configSource = await fs.readFile(officialConfigPath, "utf8");
    const downloadedVersion = configSource.match(VERSION_PATTERN)?.[1];
    if (!downloadedVersion || downloadedVersion !== officialVersion) {
      throw new Error("A versão do pacote baixado não corresponde à versão anunciada.");
    }

    // Keep the desktop-specific origin exception when applying web assets.
    if (!configSource.includes("window.darkStudioDesktop?.isDesktop")) {
      const guard = 'if (!OFFICIAL_ORIGINS.has(window.location.origin)) {';
      if (!configSource.includes(guard)) throw new Error("A verificação de origem oficial mudou; atualização cancelada por segurança.");
      configSource = configSource.replace(
        guard,
        'const isDesktopApp = window.darkStudioDesktop?.isDesktop === true;' + String.fromCharCode(10) + 'if (!isDesktopApp && !OFFICIAL_ORIGINS.has(window.location.origin)) {'
      );
    }
    await fs.writeFile(officialConfigPath, configSource, "utf8");

    const bridgeSource = await fs.readFile(path.join(__dirname, "desktop-bridge.js"), "utf8");
    await fs.mkdir(path.join(officialRoot, "desktop"), { recursive: true });
    await fs.writeFile(path.join(officialRoot, "desktop", "desktop-bridge.js"), bridgeSource, "utf8");
    const htmlPath = path.join(officialRoot, "index.html");
    let html = await fs.readFile(htmlPath, "utf8");
    if (!html.includes('src="desktop/desktop-bridge.js"')) {
      html = html.replace("</body>", '  <script src="desktop/desktop-bridge.js"></script>\n</body>');
    }
    if (!html.includes('src="desktop/desktop-bridge.js"')) throw new Error("Não foi possível preparar a interface para desktop.");
    await fs.writeFile(htmlPath, html, "utf8");

    const versionDir = path.join(UPDATE_ROOT(), `version-${officialVersion}`);
    await fs.rm(versionDir, { recursive: true, force: true });
    await fs.rename(officialRoot, versionDir);
    const activeTemp = path.join(UPDATE_ROOT(), "active.json.tmp");
    await fs.writeFile(activeTemp, JSON.stringify({ version: officialVersion, directory: path.basename(versionDir) }, null, 2), "utf8");
    await fs.rename(activeTemp, ACTIVE_VERSION_FILE());

    await dialog.showMessageBox({
      type: "info",
      title: "Atualização concluída",
      message: `DarkStudio foi atualizado para a versão ${officialVersion}.`,
      detail: "A versão baixada ficará armazenada localmente e continuará funcionando sem internet.",
      buttons: ["Reiniciar agora"],
      defaultId: 0
    });
    app.relaunch();
    app.exit(0);
    return { status: "updated", officialVersion };
  } catch (error) {
    await dialog.showMessageBox({
      type: "error",
      title: "Não foi possível atualizar",
      message: "A atualização não foi aplicada. A versão atual do DarkStudio foi mantida.",
      detail: String(error?.message || error),
      buttons: ["OK"]
    });
    if (stagingDir) await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => {});
    return { status: "error", message: String(error?.message || error) };
  }
}

ipcMain.handle("darkstudio:check-for-updates", async (event) => {
  const senderUrl = String(event.senderFrame?.url || "");
  if (event.sender.isDestroyed() || !senderUrl.startsWith("app://darkstudio/")) {
    throw new Error("Origem não autorizada para verificar atualizações.");
  }
  return checkForUpdates({ manual: true });
});

const WINDOW_STATE_FILE = () => path.join(app.getPath("userData"), "window-state.json");
const DEFAULT_WINDOW_BOUNDS = { width: 1440, height: 920 };
let latestMediaSessionSnapshot = null;
let mediaSessionMonitorStop = null;
let mediaSessionMonitorPromise = null;
const mediaSessionSubscribers = new Map();

async function ensureMediaSessionMonitor() {
  if (mediaSessionMonitorStop) return mediaSessionMonitorStop;
  if (mediaSessionMonitorPromise) return mediaSessionMonitorPromise;

  mediaSessionMonitorPromise = startMediaSessionMonitor((snapshot) => {
    latestMediaSessionSnapshot = snapshot;
    for (const senderId of mediaSessionSubscribers.keys()) {
      const window = BrowserWindow.getAllWindows().find((candidate) => candidate.webContents.id === senderId);
      if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) {
        window.webContents.send("darkstudio:media-session", snapshot);
      }
    }
  }).then((stop) => {
    mediaSessionMonitorStop = stop;
    return stop;
  }).catch((error) => {
    console.warn("DarkStudio: monitor de mídia não inicializado.", error);
    return null;
  }).finally(() => {
    mediaSessionMonitorPromise = null;
  });

  return mediaSessionMonitorPromise;
}

async function stopMediaSessionMonitorWhenUnused() {
  if (mediaSessionSubscribers.size) return;
  if (mediaSessionMonitorPromise) await mediaSessionMonitorPromise;
  if (mediaSessionSubscribers.size) return;
  const stop = mediaSessionMonitorStop;
  mediaSessionMonitorStop = null;
  if (typeof stop === "function") await stop();
  else await stopMediaSessionMonitor();
}

ipcMain.handle("darkstudio:media-session:start", async (event) => {
  if (!isTrustedTerminalEvent(event)) return null;
  const senderId = event.sender.id;
  mediaSessionSubscribers.set(senderId, (mediaSessionSubscribers.get(senderId) || 0) + 1);
  await ensureMediaSessionMonitor();
  return latestMediaSessionSnapshot;
});

ipcMain.handle("darkstudio:media-session:stop", async (event) => {
  if (!isTrustedTerminalEvent(event)) return false;
  const senderId = event.sender.id;
  const count = mediaSessionSubscribers.get(senderId) || 0;
  if (count <= 1) mediaSessionSubscribers.delete(senderId);
  else mediaSessionSubscribers.set(senderId, count - 1);
  await stopMediaSessionMonitorWhenUnused();
  return true;
});

ipcMain.handle("darkstudio:media-session:get", async (event) => {
  if (!isTrustedTerminalEvent(event)) return null;
  await ensureMediaSessionMonitor();
  const snapshot = latestMediaSessionSnapshot;
  await stopMediaSessionMonitorWhenUnused();
  return snapshot;
});

function readWindowState() {
  try {
    const state = JSON.parse(fsSync.readFileSync(WINDOW_STATE_FILE(), "utf8"));
    if (!state || !Number.isFinite(state.width) || !Number.isFinite(state.height)) return {};
    const width = Math.max(900, Math.min(Math.round(state.width), 10000));
    const height = Math.max(620, Math.min(Math.round(state.height), 10000));
    const saved = { width, height };
    if (Number.isFinite(state.x) && Number.isFinite(state.y)) {
      saved.x = Math.round(state.x);
      saved.y = Math.round(state.y);
      // If the saved window is off-screen (for example, a monitor was removed),
      // fall back to a visible display instead of opening an unreachable window.
      const visible = screen.getAllDisplays().some((display) => {
        const area = display.workArea;
        return saved.x < area.x + area.width &&
          saved.x + width > area.x &&
          saved.y < area.y + area.height &&
          saved.y + height > area.y;
      });
      if (!visible) {
        delete saved.x;
        delete saved.y;
      }
    }
    saved.isMaximized = state.isMaximized === true;
    return saved;
  } catch {
    return {};
  }
}

function createWindow() {
  const savedState = readWindowState();
  const win = new BrowserWindow({
    ...DEFAULT_WINDOW_BOUNDS,
    ...savedState,
    minWidth: 900,
    minHeight: 620,
    title: "DarkStudio",
    icon: path.join(PROJECT_ROOT, "Extras", "Assets", "White Favicon.ico"),
    backgroundColor: "#000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  let saveWindowStateTimer;
  const saveWindowState = () => {
    if (win.isDestroyed()) return;
    clearTimeout(saveWindowStateTimer);
    saveWindowStateTimer = setTimeout(() => {
      if (win.isDestroyed()) return;
      try {
        const bounds = win.isMaximized() || win.isMinimized()
          ? win.getNormalBounds()
          : win.getBounds();
        fsSync.mkdirSync(path.dirname(WINDOW_STATE_FILE()), { recursive: true });
        fsSync.writeFileSync(WINDOW_STATE_FILE(), JSON.stringify({
          ...bounds,
          isMaximized: win.isMaximized()
        }, null, 2), "utf8");
      } catch (error) {
        console.warn("DarkStudio: não foi possível salvar o tamanho/posição da janela.", error);
      }
    }, 250);
  };

  win.on("resize", saveWindowState);
  win.on("move", saveWindowState);
  win.on("maximize", saveWindowState);
  win.on("unmaximize", saveWindowState);
  win.on("close", () => {
    clearTimeout(saveWindowStateTimer);
    // Persist synchronously so closing the app immediately does not lose the last bounds.
    try {
      const bounds = win.isMaximized() || win.isMinimized()
        ? win.getNormalBounds()
        : win.getBounds();
      fsSync.mkdirSync(path.dirname(WINDOW_STATE_FILE()), { recursive: true });
      fsSync.writeFileSync(WINDOW_STATE_FILE(), JSON.stringify({
        ...bounds,
        isMaximized: win.isMaximized()
      }, null, 2), "utf8");
    } catch (error) {
      console.warn("DarkStudio: não foi possível salvar o estado da janela ao fechar.", error);
    }
  });

  if (savedState.isMaximized) win.maximize();

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  const terminalOwnerId = win.webContents.id;
  win.on("closed", () => {
    // Cada janela pode possuir várias abas/terminais, identificados por senderId:terminalId.
    const ownerPrefix = `${terminalOwnerId}:`;
    workspaceFolders.delete(terminalOwnerId);
    workspaceFolderWatchers.get(String(terminalOwnerId))?.close();
    workspaceFolderWatchers.delete(String(terminalOwnerId));
    workspaceFolderDirty.delete(String(terminalOwnerId));
    const gitAuth = gitAuthProcesses.get(terminalOwnerId);
    gitAuth?.kill();
    gitAuthProcesses.delete(terminalOwnerId);
    const serialMonitor = serialMonitorProcesses.get(String(terminalOwnerId));
    serialMonitor?.kill();
    serialMonitorProcesses.delete(String(terminalOwnerId));
    for (const [key, session] of terminalSessions) {
      if (!key.startsWith(ownerPrefix)) continue;
      terminalSessions.delete(key);
      if (!session.child.killed && session.child.exitCode === null) {
        session.child.kill();
      }
    }
    mediaSessionSubscribers.delete(terminalOwnerId);
    void stopMediaSessionMonitorWhenUnused();
  });

  win.loadURL("app://darkstudio/index.html");
}

app.whenReady().then(async () => {
  await protocol.handle("app", async (request) => {
    const requestUrl = new URL(request.url);
    const requestedPath = decodeURIComponent(requestUrl.pathname || "/index.html");
    const relativePath = requestedPath.replace(/^[/\\]+/, "");
    const safeRelativePath = path.normalize(relativePath);
    if (safeRelativePath.startsWith("..") || path.isAbsolute(safeRelativePath)) {
      return new Response("Not found", { status: 404 });
    }

    const active = await readActiveUpdate();
    if (active) {
      const overlayRoot = path.join(UPDATE_ROOT(), active.directory);
      const overlayPath = path.resolve(overlayRoot, safeRelativePath);
      if (overlayPath.startsWith(overlayRoot + path.sep) || overlayPath === overlayRoot) {
        try {
          const stat = await fs.stat(overlayPath);
          if (stat.isFile()) return net.fetch(pathToFileURL(overlayPath).toString());
        } catch {}
      }
    }

    const bundledPath = path.resolve(PROJECT_ROOT, safeRelativePath);
    if (bundledPath !== PROJECT_ROOT && !bundledPath.startsWith(PROJECT_ROOT + path.sep)) {
      return new Response("Not found", { status: 404 });
    }
    return net.fetch(pathToFileURL(bundledPath).toString());
  });
  Menu.setApplicationMenu(null);
  createWindow();
  // O monitor de mídia só inicia quando um renderer solicita leitura/assinatura.
  // Atualizações automáticas são exclusivas do executável desktop Windows empacotado.
  if (process.platform === "win32" && app.isPackaged) {
    void checkForUpdates();
  }
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

 
// Sessões de terminal isoladas por janela e por aba (CMD ou PowerShell).
const terminalSessions = new Map();

function isTrustedTerminalEvent(event) {
  return !event.sender.isDestroyed() &&
    String(event.senderFrame?.url || "").startsWith("app://darkstudio/");
}

function terminalSessionKey(senderId, terminalId) {
  return String(senderId) + ":" + String(terminalId || "terminal-1");
}

// A folder is granted only after the native picker returns it. Renderer calls
// can then address files by relative path; they never receive arbitrary fs APIs.
const workspaceFolders = new Map();
const workspaceFolderWatchers = new Map();
const workspaceFolderDirty = new Set();
const gitAuthProcesses = new Map();
const serialMonitorProcesses = new Map();
const LAST_WORKSPACE_ROOT_FILE = () => path.join(app.getPath("userData"), "last-workspace-root.json");

async function listWorkspaceFiles(root, includeHidden = false) {
  const entries = [];
  const ignored = new Set([".git", "node_modules", ".DS_Store"]);
  const walk = async (directory, relative = "", depth = 0) => {
    if (depth > 18 || entries.length >= 5000) return;
    let children;
    try { children = await fs.readdir(directory, { withFileTypes: true }); } catch { return; }
    children.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    for (const child of children) {
      if ((!includeHidden && (ignored.has(child.name) || child.name.startsWith("."))) || child.isSymbolicLink()) continue;
      const relativePath = path.posix.join(relative.split(path.sep).join("/"), child.name);
      if (child.isDirectory()) {
        entries.push({ name: child.name, path: relativePath, type: "folder" });
        await walk(path.join(directory, child.name), relativePath, depth + 1);
      } else if (child.isFile()) {
        entries.push({ name: child.name, path: relativePath, type: "file" });
        if (entries.length >= 5000) break;
      }
    }
  };
  await walk(root);
  return entries;
}

function watchWorkspaceFolder(senderId, root) {
  const key = String(senderId);
  workspaceFolderWatchers.get(key)?.close();
  workspaceFolderDirty.add(key);
  try {
    const watcher = fsSync.watch(root, { recursive: true }, () => workspaceFolderDirty.add(key));
    watcher.on("error", () => workspaceFolderDirty.add(key));
    workspaceFolderWatchers.set(key, watcher);
  } catch {
    // The renderer will fall back to a one-second refresh if recursive watch is unavailable.
    workspaceFolderWatchers.delete(key);
  }
}

async function resolveWorkspaceFile(senderId, relativePath) {
  const root = workspaceFolders.get(senderId);
  if (!root || typeof relativePath !== "string" || !relativePath || relativePath.length > 2048) return null;
  const normalized = path.normalize(relativePath.replace(/[\\/]+/g, path.sep));
  if (path.isAbsolute(normalized) || normalized === ".." || normalized.startsWith(`..${path.sep}`)) return null;
  const candidate = path.resolve(root, normalized);
  if (candidate !== root && !candidate.startsWith(root + path.sep)) return null;
  try {
    const [realRoot, realFile, stat] = await Promise.all([fs.realpath(root), fs.realpath(candidate), fs.stat(candidate)]);
    if (realFile !== realRoot && !realFile.startsWith(realRoot + path.sep)) return null;
    if (!stat.isFile()) return null;
    return realFile;
  } catch { return null; }
}

ipcMain.handle("darkstudio:workspace:open-folder", async (event, options = {}) => {
  if (!isTrustedTerminalEvent(event)) throw new Error("Origem não autorizada para abrir pastas.");
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  if (result.canceled || !result.filePaths[0]) return null;
  const root = await fs.realpath(result.filePaths[0]);
  workspaceFolders.set(event.sender.id, root);
  watchWorkspaceFolder(event.sender.id, root);
  await fs.writeFile(LAST_WORKSPACE_ROOT_FILE(), JSON.stringify({ root }, null, 2), "utf8");
  return { name: path.basename(root), root, entries: await listWorkspaceFiles(root, options.includeHidden === true) };
});

ipcMain.handle("darkstudio:workspace:restore-folder", async (event, options = {}) => {
  if (!isTrustedTerminalEvent(event)) throw new Error("Origem não autorizada para restaurar pastas.");
  try {
    const saved = JSON.parse(await fs.readFile(LAST_WORKSPACE_ROOT_FILE(), "utf8"));
    if (typeof saved.root !== "string" || !path.isAbsolute(saved.root)) return null;
    const root = await fs.realpath(saved.root);
    workspaceFolders.set(event.sender.id, root);
    watchWorkspaceFolder(event.sender.id, root);
    return { name: path.basename(root), root, entries: await listWorkspaceFiles(root, options.includeHidden === true) };
  } catch { return null; }
});

ipcMain.handle("darkstudio:workspace:refresh", async (event, options = {}) => {
  if (!isTrustedTerminalEvent(event)) throw new Error("Origem não autorizada para atualizar o workspace.");
  const root = workspaceFolders.get(event.sender.id);
  if (!root) return { ok: false, changed: false, error: "no-folder" };
  const key = String(event.sender.id);
  if (options.force !== true && workspaceFolderWatchers.has(key) && !workspaceFolderDirty.has(key)) return { ok: true, changed: false };
  workspaceFolderDirty.delete(key);
  try {
    const entries = await listWorkspaceFiles(root, options.includeHidden === true);
    return { ok: true, changed: true, name: path.basename(root), root, entries };
  } catch (error) {
    return { ok: false, changed: false, message: String(error?.message || error) };
  }
});

ipcMain.handle("darkstudio:workspace:read-file", async (event, relativePath) => {
  if (!isTrustedTerminalEvent(event)) throw new Error("Origem não autorizada para ler arquivos.");
  const filePath = await resolveWorkspaceFile(event.sender.id, relativePath);
  if (!filePath || await isBinaryFilePath(filePath)) return { ok: false, binary: true };
  try { return { ok: true, content: await fs.readFile(filePath, "utf8") }; }
  catch (error) { return { ok: false, message: String(error?.message || error) }; }
});

ipcMain.handle("darkstudio:workspace:write-file", async (event, options = {}) => {
  if (!isTrustedTerminalEvent(event)) throw new Error("Origem não autorizada para gravar arquivos.");
  if (typeof options.content !== "string" || options.content.length > 20_000_000) return { ok: false, message: "Conteúdo inválido." };
  const filePath = await resolveWorkspaceFile(event.sender.id, options.path);
  if (!filePath) return { ok: false, message: "O arquivo não pertence à pasta aberta." };
  try { await fs.writeFile(filePath, options.content, "utf8"); return { ok: true }; }
  catch (error) { return { ok: false, message: String(error?.message || error) }; }
});

function runLocalCommand(command, args, cwd, timeoutMs = 15000, maxOutput = 3_000_000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const append = (current, chunk) => (current + chunk.toString("utf8")).slice(-maxOutput);
    child.stdout.on("data", (chunk) => { stdout = append(stdout, chunk); });
    child.stderr.on("data", (chunk) => { stderr = append(stderr, chunk); });
    child.on("error", (error) => finish({ ok: false, unavailable: error.code === "ENOENT", message: String(error.message || error) }));
    child.on("close", (code) => finish({ ok: code === 0, code, stdout, stderr }));
    const timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, timeout: true, stdout, stderr, message: "O comando excedeu o tempo limite." });
    }, timeoutMs);
  });
}

async function getGitRoot(senderId) {
  const selected = workspaceFolders.get(senderId);
  if (!selected) return { error: "no-folder" };
  const result = await runLocalCommand("git", ["-C", selected, "rev-parse", "--show-toplevel"], selected, 5000, 20000);
  if (result.unavailable) return { error: "git-missing" };
  if (!result.ok) return { error: "not-repository", message: (result.stderr || result.stdout || "").trim() };
  const root = path.resolve(result.stdout.trim());
  if (root !== selected && !root.startsWith(selected + path.sep)) return { error: "repository-outside-folder" };
  return { root };
}

function cleanGitRelativePath(value) {
  if (typeof value !== "string" || !value || value.length > 2048 || path.isAbsolute(value)) return "";
  const normalized = path.normalize(value.replace(/[\\/]+/g, path.sep));
  if (normalized === ".." || normalized.startsWith(`..${path.sep}`) || normalized.includes("\0")) return "";
  return normalized;
}

ipcMain.handle("darkstudio:git:status", async (event) => {
  if (!isTrustedTerminalEvent(event)) throw new Error("Origem não autorizada para Git.");
  const repo = await getGitRoot(event.sender.id);
  if (repo.error) return { ok: false, ...repo };
  const [status, branch, remotes, counts] = await Promise.all([
    runLocalCommand("git", ["-C", repo.root, "status", "--porcelain=v1", "-b"], repo.root),
    runLocalCommand("git", ["-C", repo.root, "branch", "--show-current"], repo.root, 5000, 20000),
    runLocalCommand("git", ["-C", repo.root, "remote", "-v"], repo.root, 5000, 20000),
    runLocalCommand("git", ["-C", repo.root, "rev-list", "--left-right", "--count", "@{upstream}...HEAD"], repo.root, 5000, 20000)
  ]);
  if (status.unavailable) return { ok: false, error: "git-missing" };
  const files = status.stdout.split(/\r?\n/).filter((line) => line && !line.startsWith("## ")).map((line) => ({
    index: line.slice(0, 1), worktree: line.slice(1, 2), path: line.slice(3)
  }));
  const aheadBehind = counts.ok ? counts.stdout.trim().split(/\s+/).map(Number) : [0, 0];
  return {
    ok: status.ok,
    root: repo.root,
    branch: branch.stdout.trim(),
    files,
    remotes: remotes.stdout.trim(),
    behind: aheadBehind[0] || 0,
    ahead: aheadBehind[1] || 0,
    message: status.stderr || ""
  };
});

ipcMain.handle("darkstudio:git:graph", async (event) => {
  if (!isTrustedTerminalEvent(event)) throw new Error("Origem não autorizada para Git.");
  const repo = await getGitRoot(event.sender.id);
  if (repo.error) return { ok: false, ...repo };
  const result = await runLocalCommand("git", ["-C", repo.root, "log", "--graph", "--decorate", "--all", "--date=relative", "--pretty=format:%h%x09%an%x09%ar%x09%s%x09%D", "-n", "70"], repo.root);
  return result.ok ? { ok: true, rows: result.stdout.split(/\r?\n/).filter(Boolean) } : { ok: false, message: result.stderr };
});

ipcMain.handle("darkstudio:git:diff", async (event, options = {}) => {
  if (!isTrustedTerminalEvent(event)) throw new Error("Origem não autorizada para Git.");
  const repo = await getGitRoot(event.sender.id);
  if (repo.error) return { ok: false, ...repo };
  const relativePath = cleanGitRelativePath(options.path || "");
  const args = ["-C", repo.root, "diff", "--no-ext-diff", ...(options.staged ? ["--cached"] : []), "--", ...(relativePath ? [relativePath] : [])];
  const result = await runLocalCommand("git", args, repo.root, 15000, 1_500_000);
  if (result.unavailable) return { ok: false, error: "git-missing" };
  return { ok: result.ok, diff: result.stdout, message: result.stderr };
});

ipcMain.handle("darkstudio:git:change-index", async (event, options = {}) => {
  if (!isTrustedTerminalEvent(event)) throw new Error("Origem não autorizada para Git.");
  const repo = await getGitRoot(event.sender.id);
  if (repo.error) return { ok: false, ...repo };
  const submittedPaths = Array.isArray(options.paths) ? options.paths : [options.path];
  const paths = submittedPaths.map(cleanGitRelativePath).filter(Boolean).slice(0, 100);
  if (!paths.length) return { ok: false, message: "Selecione pelo menos um arquivo." };
  const args = options.action === "unstage"
    ? ["-C", repo.root, "restore", "--staged", "--", ...paths]
    : ["-C", repo.root, "add", "--", ...paths];
  const result = await runLocalCommand("git", args, repo.root);
  return { ok: result.ok, message: result.stderr };
});

ipcMain.handle("darkstudio:git:commit", async (event, options = {}) => {
  if (!isTrustedTerminalEvent(event)) throw new Error("Origem não autorizada para Git.");
  const repo = await getGitRoot(event.sender.id);
  if (repo.error) return { ok: false, ...repo };
  const message = String(options.message || "").trim().slice(0, 500);
  if (!message) return { ok: false, message: "Escreva uma mensagem para o commit." };
  const result = await runLocalCommand("git", ["-C", repo.root, "commit", "-m", message], repo.root, 30000);
  return { ok: result.ok, output: result.stdout, message: result.stderr };
});

ipcMain.handle("darkstudio:git:sync", async (event, options = {}) => {
  if (!isTrustedTerminalEvent(event)) throw new Error("Origem não autorizada para Git.");
  const repo = await getGitRoot(event.sender.id);
  if (repo.error) return { ok: false, ...repo };
  const action = options.action === "pull" || options.direction === "pull" ? "pull" : "push";
  const result = await runLocalCommand("git", ["-C", repo.root, action, ...(action === "pull" ? ["--ff-only"] : [])], repo.root, 60000);
  return { ok: result.ok, output: result.stdout, message: result.stderr };
});

ipcMain.handle("darkstudio:git:auth-status", async (event) => {
  if (!isTrustedTerminalEvent(event)) throw new Error("Origem não autorizada para Git.");
  const gh = await runLocalCommand("gh", ["auth", "status", "--hostname", "github.com"], os.homedir(), 8000, 50000);
  const helper = await runLocalCommand("git", ["config", "--global", "--get", "credential.helper"], os.homedir(), 5000, 20000);
  return { ok: true, authenticated: gh.ok, ghInstalled: !gh.unavailable, credentialHelper: helper.stdout.trim(), detail: gh.stdout || gh.stderr };
});

ipcMain.handle("darkstudio:git:auth-login", async (event) => {
  if (!isTrustedTerminalEvent(event)) throw new Error("Origem não autorizada para Git.");
  const key = event.sender.id;
  const running = gitAuthProcesses.get(key);
  if (running) return { ok: true, running: true };
  const child = spawn("gh", ["auth", "login", "--hostname", "github.com", "--git-protocol", "https", "--web"], { cwd: os.homedir(), windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  gitAuthProcesses.set(key, child);
  const forward = (chunk) => {
    if (!event.sender.isDestroyed()) event.sender.send("darkstudio:git:auth-output", chunk.toString("utf8").slice(-4000));
  };
  child.stdout.on("data", forward);
  child.stderr.on("data", forward);
  return await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (gitAuthProcesses.get(key) === child && child.exitCode === null) child.kill();
    }, 180000);
    child.on("error", (error) => {
      clearTimeout(timeout);
      gitAuthProcesses.delete(key);
      resolve({ ok: false, unavailable: error.code === "ENOENT", message: String(error.message || error) });
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      gitAuthProcesses.delete(key);
      resolve({ ok: code === 0, code });
    });
  });
});

ipcMain.handle("darkstudio:git:open-download", async (event) => {
  if (!isTrustedTerminalEvent(event)) throw new Error("Origem não autorizada para Git.");
  await shell.openExternal("https://git-scm.com/downloads");
  return true;
});

ipcMain.handle("darkstudio:git:open-gh-download", async (event) => {
  if (!isTrustedTerminalEvent(event)) throw new Error("Origem não autorizada para GitHub CLI.");
  await shell.openExternal("https://cli.github.com/");
  return true;
});

ipcMain.handle("darkstudio:serial:list", async (event) => {
  if (!isTrustedTerminalEvent(event)) throw new Error("Origem não autorizada para portas seriais.");
  if (process.platform !== "win32") return { ok: false, message: "A detecção de portas está configurada para Windows." };
  const script = "[System.IO.Ports.SerialPort]::GetPortNames() | ConvertTo-Json -Compress";
  const result = await runLocalCommand("powershell.exe", ["-NoLogo", "-NoProfile", "-Command", script], os.homedir(), 10000, 20000);
  if (result.unavailable) return { ok: false, message: "PowerShell não encontrado." };
  let ports = [];
  try { const parsed = JSON.parse(result.stdout.trim() || "[]"); ports = Array.isArray(parsed) ? parsed : parsed ? [parsed] : []; } catch {}
  return { ok: result.ok, ports: ports.map(String), message: result.stderr };
});

ipcMain.handle("darkstudio:serial:monitor-start", async (event, options = {}) => {
  if (!isTrustedTerminalEvent(event)) throw new Error("Origem não autorizada para monitor serial.");
  const port = String(options.port || "").toUpperCase();
  if (!/^COM\d{1,3}$/.test(port)) return { ok: false, message: "Porta serial inválida." };
  const sessionKey = String(event.sender.id);
  const old = serialMonitorProcesses.get(sessionKey);
  if (old) { old.kill(); serialMonitorProcesses.delete(sessionKey); }
  const baud = Math.max(300, Math.min(2000000, Math.round(Number(options.baud) || 115200)));
  const script = `$p=New-Object System.IO.Ports.SerialPort('${port}',${baud}); try{$p.Open(); while($true){while([Console]::In.Peek() -ge 0){$line=[Console]::In.ReadLine(); if($line -eq '__darkstudio_exit__'){break}; $bytes=[Convert]::FromBase64String($line); $p.Write($bytes,0,$bytes.Length)}; if($p.BytesToRead -gt 0){[Console]::Write($p.ReadExisting())}; Start-Sleep -Milliseconds 10}} finally {if($p.IsOpen){$p.Close()}}`;
  const child = spawn("powershell.exe", ["-NoLogo", "-NoProfile", "-Command", script], { cwd: os.homedir(), windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  serialMonitorProcesses.set(sessionKey, child);
  const send = (chunk) => { if (!event.sender.isDestroyed()) event.sender.send("darkstudio:serial:data", chunk.toString("utf8").slice(-8000)); };
  child.stdout.on("data", send);
  child.stderr.on("data", send);
  child.on("close", () => { if (serialMonitorProcesses.get(sessionKey) === child) serialMonitorProcesses.delete(sessionKey); });
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: true, port, baud }), 500);
    child.once("error", (error) => { clearTimeout(timer); serialMonitorProcesses.delete(sessionKey); resolve({ ok: false, message: String(error.message || error) }); });
  });
});

ipcMain.handle("darkstudio:serial:send", async (event, options = {}) => {
  if (!isTrustedTerminalEvent(event)) throw new Error("Origem não autorizada para enviar dados seriais.");
  const port = String(options.port || "").toUpperCase();
  const data = typeof options.data === "string" ? options.data.slice(0, 4096) : "";
  if (!/^COM\d{1,3}$/.test(port)) return { ok: false, message: "Porta serial inválida." };
  const child = serialMonitorProcesses.get(String(event.sender.id));
  if (!child || child.killed || child.exitCode !== null) return { ok: false, message: "Inicie o monitor serial antes de enviar dados." };
  try {
    child.stdin.write(Buffer.from(data, "utf8").toString("base64") + "\r\n");
    return { ok: true };
  } catch (error) { return { ok: false, message: String(error.message || error) }; }
});

ipcMain.handle("darkstudio:serial:monitor-stop", async (event) => {
  if (!isTrustedTerminalEvent(event)) throw new Error("Origem não autorizada para encerrar monitor serial.");
  const key = String(event.sender.id);
  const child = serialMonitorProcesses.get(key);
  if (child) child.kill();
  serialMonitorProcesses.delete(key);
  return { ok: true };
});

ipcMain.handle("darkstudio:arduino:detect", async (event) => {
  if (!isTrustedTerminalEvent(event)) throw new Error("Origem não autorizada para Arduino.");
  const cli = await runLocalCommand("arduino-cli", ["version"], os.homedir(), 8000, 20000);
  if (cli.unavailable) return { ok: false, cliInstalled: false, ports: [], message: "Instale o Arduino CLI pelo site oficial para compilar e enviar código." };
  const [ports, boards] = await Promise.all([
    runLocalCommand("powershell.exe", ["-NoLogo", "-NoProfile", "-Command", "[System.IO.Ports.SerialPort]::GetPortNames() | ConvertTo-Json -Compress"], os.homedir(), 10000, 20000),
    runLocalCommand("arduino-cli", ["board", "list", "--format", "json"], os.homedir(), 15000, 100000)
  ]);
  let portNames = [];
  try { const parsed = JSON.parse(ports.stdout?.trim() || "[]"); portNames = Array.isArray(parsed) ? parsed : parsed ? [parsed] : []; } catch {}
  let detected = [];
  try {
    const json = JSON.parse(boards.stdout || "{}");
    detected = (json.detected_ports || []).map((item) => ({
      port: item.port?.address || "",
      protocol: item.port?.protocol || "",
      boards: (item.matching_boards || []).map((board) => ({ name: board.name || "", fqbn: board.fqbn || "" }))
    }));
  } catch {}
  return { ok: true, cliInstalled: true, cliVersion: cli.stdout.trim(), ports: portNames.map(String), detected, boardMessage: boards.stderr || "" };
});

ipcMain.handle("darkstudio:arduino:upload", async (event, options = {}) => {
  if (!isTrustedTerminalEvent(event)) throw new Error("Origem não autorizada para upload de placa.");
  const fqbn = String(options.fqbn || "").trim();
  const port = String(options.port || "").toUpperCase();
  const content = typeof options.content === "string" ? options.content : "";
  if (!/^[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+$/.test(fqbn)) return { ok: false, message: "Selecione um identificador de placa FQBN válido." };
  if (!/^COM\d{1,3}$/.test(port)) return { ok: false, message: "Selecione uma porta COM válida." };
  if (!content || content.length > 5_000_000) return { ok: false, message: "O código está vazio ou excede 5 MB." };
  const cli = await runLocalCommand("arduino-cli", ["version"], os.homedir(), 8000, 20000);
  if (cli.unavailable) return { ok: false, cliInstalled: false, message: "Instale o Arduino CLI pelo site oficial." };
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "darkstudio-arduino-"));
  const sketchDirectory = path.join(temporaryRoot, "DarkStudioSketch");
  const sketchPath = path.join(sketchDirectory, "DarkStudioSketch.ino");
  try {
    await fs.mkdir(sketchDirectory, { recursive: true });
    await fs.writeFile(sketchPath, content, "utf8");
    const compile = await runLocalCommand("arduino-cli", ["compile", "--fqbn", fqbn, sketchDirectory], temporaryRoot, 300000, 200000);
    if (!compile.ok) return { ok: false, stage: "compile", output: compile.stdout, message: compile.stderr || compile.message };
    const upload = await runLocalCommand("arduino-cli", ["upload", "--fqbn", fqbn, "--port", port, sketchDirectory], temporaryRoot, 180000, 200000);
    return { ok: upload.ok, stage: "upload", output: upload.stdout, message: upload.stderr || upload.message };
  } finally { await fs.rm(temporaryRoot, { recursive: true, force: true }).catch(() => {}); }
});

ipcMain.handle("darkstudio:arduino:open-download", async (event) => {
  if (!isTrustedTerminalEvent(event)) throw new Error("Origem não autorizada para instalar Arduino CLI.");
  await shell.openExternal("https://arduino.github.io/arduino-cli/latest/installation/");
  return true;
});

function sendTerminalEvent(sender, channel, payload) {
  if (!sender.isDestroyed()) sender.send(channel, payload);
}

ipcMain.handle("darkstudio:terminal:start", async (event, options = {}) => {
  if (!isTrustedTerminalEvent(event)) throw new Error("Origem não autorizada para o terminal.");
  if (process.platform !== "win32") return { ok: false, error: "O terminal integrado está disponível apenas no Windows." };
  const terminalId = String(options.terminalId || "terminal-1").slice(0, 80);
  const shellType = options.shell === "PowerShell" ? "PowerShell" : "CMD";
  const key = terminalSessionKey(event.sender.id, terminalId);
  const existing = terminalSessions.get(key);
  if (existing && !existing.child.killed && existing.child.exitCode === null) {
    return { ok: true, cwd: existing.cwd, reused: true, terminalId, shell: shellType };
  }

  const cwd = os.homedir();
  let command;
  let args;
  if (shellType === "PowerShell") {
    command = process.env.SystemRoot ? path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe") : "powershell.exe";
    args = ["-NoLogo", "-NoProfile", "-Command", "$utf8 = New-Object System.Text.UTF8Encoding $false; [Console]::InputEncoding = $utf8; [Console]::OutputEncoding = $utf8; $OutputEncoding = $utf8; Write-Host ('PS ' + (Get-Location).Path + '>') -NoNewline; while ($null -ne ($line = [Console]::ReadLine())) { try { Invoke-Expression $line } catch { Write-Error $_ }; Write-Host ('PS ' + (Get-Location).Path + '>') -NoNewline }"];
  } else {
    command = process.env.ComSpec || "cmd.exe";
    args = ["/D", "/K", "chcp 65001>nul"];
  }

  const child = spawn(command, args, {
    cwd,
    env: process.env,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"]
  });
  const session = { child, cwd, terminalId, shell: shellType, sender: event.sender };
  terminalSessions.set(key, session);

  const forward = (chunk) => sendTerminalEvent(event.sender, "darkstudio:terminal:data", { terminalId, data: chunk.toString("utf8") });
  child.stdout.on("data", forward);
  child.stderr.on("data", forward);
  child.on("error", (error) => {
    sendTerminalEvent(event.sender, "darkstudio:terminal:data", { terminalId, data: "\r\n" + String(error.message || error) + "\r\n" });
  });
  child.on("exit", (code, signal) => {
    sendTerminalEvent(event.sender, "darkstudio:terminal:exit", { terminalId, code, signal });
    if (terminalSessions.get(key) === session) terminalSessions.delete(key);
  });
  return { ok: true, cwd, reused: false, terminalId, shell: shellType };
});

ipcMain.handle("darkstudio:terminal:write", async (event, options = {}) => {
  if (!isTrustedTerminalEvent(event)) throw new Error("Origem não autorizada para o terminal.");
  const terminalId = String(options.terminalId || "terminal-1").slice(0, 80);
  const data = options.data;
  if (typeof data !== "string" || data.length > 16384) return { ok: false, error: "Entrada do terminal inválida ou muito longa." };
  const session = terminalSessions.get(terminalSessionKey(event.sender.id, terminalId));
  if (!session || session.child.killed || session.child.exitCode !== null) return { ok: false, error: "A sessão do terminal não está ativa." };
  try {
    session.child.stdin.write(data);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error.message || error) };
  }
});

ipcMain.handle("darkstudio:terminal:stop", async (event, options = {}) => {
  if (!isTrustedTerminalEvent(event)) throw new Error("Origem não autorizada para o terminal.");
  const terminalId = String(options.terminalId || "terminal-1").slice(0, 80);
  const key = terminalSessionKey(event.sender.id, terminalId);
  const session = terminalSessions.get(key);
  if (!session) return { ok: true };
  terminalSessions.delete(key);
  session.child.kill();
  return { ok: true };
});


app.on("before-quit", () => { void stopMediaSessionMonitor(); });
