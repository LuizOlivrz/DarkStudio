const { contextBridge, ipcRenderer } = require("electron");

// Renderer-safe desktop API; file access is mediated by native dialogs in the main process.
contextBridge.exposeInMainWorld("darkStudioDesktop", Object.freeze({
  isDesktop: true,
  platform: process.platform,
  version: "1.0.0",
  openFile: () => ipcRenderer.invoke("darkstudio:open-file"),
  saveFile: (options) => ipcRenderer.invoke("darkstudio:save-file", options)
}));
