const path = require("node:path");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const { app, BrowserWindow, shell, dialog, ipcMain, protocol, net, Menu, screen } = require("electron");
const { pathToFileURL } = require("node:url");
const extract = require("extract-zip");
const { spawn } = require("node:child_process");
const os = require("node:os");

app.setName("DarkStudio");

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

ipcMain.handle("darkstudio:open-file", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Code and text files", extensions: ["js", "html", "css", "txt", "json", "java", "py", "cpp", "c", "bat", "md"] }, { name: "All files", extensions: ["*"] }]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  return { filePath, fileName: path.basename(filePath), content: await fs.readFile(filePath, "utf8") };
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
  return { canceled: false, filePath: result.filePath };
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

async function checkForUpdates() {
  let manifest;
  try {
    manifest = await fetchUpdateManifest();
  } catch (error) {
    console.warn("DarkStudio: não foi possível verificar atualizações; mantendo a versão local.", error);
    return;
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
    return;
  }

  // Only offer an update when the official calendar version is strictly newer.
  // For example, 27.10.26 > 26.10.26, while 25.10.26 and 26.10.26 are not updates.
  if (officialVersionNumber <= installedVersionNumber) {
    console.info(
      `DarkStudio: sem atualização. Versão instalada: ${localVersion}; versão oficial: ${officialVersion}.`
    );
    return;
  }

  // Never prompt for an update until a public package has actually been published.
  if (typeof manifest.updatePackageUrl !== "string" || !manifest.updatePackageUrl.trim()) {
    console.warn(`DarkStudio: a versão ${officialVersion} está anunciada, mas ainda não há pacote publicado.`);
    return;
  }

  let packageUrl;
  try {
    packageUrl = new URL(manifest.updatePackageUrl);
    if (packageUrl.protocol !== "https:") throw new Error("A URL do pacote precisa usar HTTPS.");
  } catch {
    console.error("DarkStudio: URL do pacote de atualização inválida.");
    return;
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
  if (choice.response !== 0) return;

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
  } catch (error) {
    await dialog.showMessageBox({
      type: "error",
      title: "Não foi possível atualizar",
      message: "A atualização não foi aplicada. A versão atual do DarkStudio foi mantida.",
      detail: String(error?.message || error),
      buttons: ["OK"]
    });
    if (stagingDir) await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => {});
  }
}

const WINDOW_STATE_FILE = () => path.join(app.getPath("userData"), "window-state.json");
const DEFAULT_WINDOW_BOUNDS = { width: 1440, height: 920 };

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
    backgroundColor: "#111111",
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
    for (const [key, session] of terminalSessions) {
      if (!key.startsWith(ownerPrefix)) continue;
      terminalSessions.delete(key);
      if (!session.child.killed && session.child.exitCode === null) {
        session.child.kill();
      }
    }
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
  app.setAppUserModelId("dev.darkstudio.desktop");
  Menu.setApplicationMenu(null);
  createWindow();
  // Update checks run after the window is usable; network failure is intentionally silent.
  void checkForUpdates();
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
