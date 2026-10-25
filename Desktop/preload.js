const { contextBridge, ipcRenderer } = require("electron");

// Renderer-safe desktop API; file access is mediated by native dialogs in the main process.
contextBridge.exposeInMainWorld("darkStudioDesktop", Object.freeze({
  isDesktop: true,
  platform: process.platform,
  version: "1.0.0",
  openFile: () => ipcRenderer.invoke("darkstudio:open-file"),
  saveFile: (options) => ipcRenderer.invoke("darkstudio:save-file", options),
  terminalStart: () => ipcRenderer.invoke("darkstudio:terminal:start"),
  terminalWrite: (data) => ipcRenderer.invoke("darkstudio:terminal:write", data),
  terminalStop: () => ipcRenderer.invoke("darkstudio:terminal:stop"),
  onTerminalData: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("darkstudio:terminal:data", listener);
    return () => ipcRenderer.removeListener("darkstudio:terminal:data", listener);
  },
  onTerminalExit: (callback) => {
    const listener = (_event, details) => callback(details);
    ipcRenderer.on("darkstudio:terminal:exit", listener);
    return () => ipcRenderer.removeListener("darkstudio:terminal:exit", listener);
  }
}));
