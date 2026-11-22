const { contextBridge, ipcRenderer } = require("electron");

// Renderer-safe desktop API; file access is mediated by native dialogs in the main process.
contextBridge.exposeInMainWorld("darkStudioDesktop", Object.freeze({
  isDesktop: true,
  platform: process.platform,
  version: "1.0.0",
  openFile: () => ipcRenderer.invoke("darkstudio:open-file"),
  saveFile: (options) => ipcRenderer.invoke("darkstudio:save-file", options),
  restoreLastFile: () => ipcRenderer.invoke("darkstudio:restore-last-file"),
  saveCurrentFile: (options) => ipcRenderer.invoke("darkstudio:save-current-file", options),
  openWorkspaceFolder: (options) => ipcRenderer.invoke("darkstudio:workspace:open-folder", options),
  restoreWorkspaceFolder: (options) => ipcRenderer.invoke("darkstudio:workspace:restore-folder", options),
  refreshWorkspaceFolder: (options) => ipcRenderer.invoke("darkstudio:workspace:refresh", options),
  readWorkspaceFile: (relativePath) => ipcRenderer.invoke("darkstudio:workspace:read-file", relativePath),
  writeWorkspaceFile: (options) => ipcRenderer.invoke("darkstudio:workspace:write-file", options),
  gitStatus: () => ipcRenderer.invoke("darkstudio:git:status"),
  gitGraph: () => ipcRenderer.invoke("darkstudio:git:graph"),
  gitDiff: (options) => ipcRenderer.invoke("darkstudio:git:diff", options),
  gitChangeIndex: (options) => ipcRenderer.invoke("darkstudio:git:change-index", options),
  gitCommit: (options) => ipcRenderer.invoke("darkstudio:git:commit", options),
  gitSync: (options) => ipcRenderer.invoke("darkstudio:git:sync", options),
  gitAuthStatus: () => ipcRenderer.invoke("darkstudio:git:auth-status"),
  gitAuthLogin: () => ipcRenderer.invoke("darkstudio:git:auth-login"),
  gitOpenDownload: () => ipcRenderer.invoke("darkstudio:git:open-download"),
  gitOpenGhDownload: () => ipcRenderer.invoke("darkstudio:git:open-gh-download"),
  arduinoDetect: () => ipcRenderer.invoke("darkstudio:arduino:detect"),
  arduinoUpload: (options) => ipcRenderer.invoke("darkstudio:arduino:upload", options),
  openArduinoCliDownload: () => ipcRenderer.invoke("darkstudio:arduino:open-download"),
  serialList: () => ipcRenderer.invoke("darkstudio:serial:list"),
  serialMonitorStart: (options) => ipcRenderer.invoke("darkstudio:serial:monitor-start", options),
  serialMonitorSend: (options) => ipcRenderer.invoke("darkstudio:serial:send", options),
  serialMonitorStop: () => ipcRenderer.invoke("darkstudio:serial:monitor-stop"),
  onGitAuthOutput: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("darkstudio:git:auth-output", listener);
    return () => ipcRenderer.removeListener("darkstudio:git:auth-output", listener);
  },
  onSerialData: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("darkstudio:serial:data", listener);
    return () => ipcRenderer.removeListener("darkstudio:serial:data", listener);
  },
  checkForUpdates: () => ipcRenderer.invoke("darkstudio:check-for-updates"),
  terminalStart: (options) => ipcRenderer.invoke("darkstudio:terminal:start", options),
  terminalWrite: (options) => ipcRenderer.invoke("darkstudio:terminal:write", options),
  terminalStop: (options) => ipcRenderer.invoke("darkstudio:terminal:stop", options),
  getNowPlaying: () => ipcRenderer.invoke("darkstudio:media-session:get"),
  onNowPlaying: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on("darkstudio:media-session", listener);
    void ipcRenderer.invoke("darkstudio:media-session:start").catch(() => {});
    return () => {
      ipcRenderer.removeListener("darkstudio:media-session", listener);
      void ipcRenderer.invoke("darkstudio:media-session:stop").catch(() => {});
    };
  },
  onTerminalData: (callback) => {
    const listener = (_event, details) => callback(details);
    ipcRenderer.on("darkstudio:terminal:data", listener);
    return () => ipcRenderer.removeListener("darkstudio:terminal:data", listener);
  },
  onTerminalExit: (callback) => {
    const listener = (_event, details) => callback(details);
    ipcRenderer.on("darkstudio:terminal:exit", listener);
    return () => ipcRenderer.removeListener("darkstudio:terminal:exit", listener);
  }
}));
