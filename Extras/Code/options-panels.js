import { detectLanguage } from "./language-detection.js";

const container = document.getElementById("Website-Container");
const fileLauncher = document.getElementById("file-gutter-icon");
const debuggerLauncher = document.getElementById("debugger-launcher");
const mapLauncher = document.getElementById("workspace-map-launcher");
const optionsPanel = document.getElementById("options");
const fileView = document.getElementById("file-manager-view");
const debuggerView = document.getElementById("debugger-view");
const debuggerSection = document.getElementById("debugger-section");
const debuggerToggle = document.getElementById("debugger-toggle");
const debuggerRunButton = document.getElementById("debugger-run-button");
const unsupportedOverlay = document.getElementById("debugger-unsupported-overlay");
let activeView = null;

function clearUnsupportedState() {
  container?.classList.remove("debugger-unsupported");
  if (unsupportedOverlay) unsupportedOverlay.hidden = true;
}

function setActiveView(view) {
  if (view === activeView) return;

  const showMap = view === "map";
  const showDebugger = view === "debugger";

  if (optionsPanel) optionsPanel.hidden = showMap;
  if (fileView) fileView.hidden = view !== "files";
  if (debuggerView) debuggerView.hidden = !showDebugger;

  fileLauncher?.classList.toggle("is-active", view === "files");
  fileLauncher?.setAttribute("aria-pressed", String(view === "files"));
  mapLauncher?.classList.toggle("is-active", showMap);
  mapLauncher?.setAttribute("aria-pressed", String(showMap));
  debuggerLauncher?.classList.toggle("is-active", showDebugger);
  debuggerLauncher?.setAttribute("aria-pressed", String(showDebugger));

  if (showMap) {
    window.darkStudioShowWorkspaceMap?.();
  } else if (activeView === "map") {
    window.darkStudioShowWorkspaceEditor?.();
  }

  if (showDebugger) {
    debuggerSection?.classList.add("debugger-open");
    debuggerToggle?.setAttribute("aria-expanded", "true");
  }

  activeView = view;
  clearUnsupportedState();
}

fileLauncher?.addEventListener("click", () => setActiveView("files"));
mapLauncher?.addEventListener("click", () => setActiveView("map"));
debuggerLauncher?.addEventListener("click", () => setActiveView("debugger"));

debuggerToggle?.addEventListener("click", () => {
  const isOpen = debuggerSection?.classList.toggle("debugger-open") ?? false;
  debuggerToggle.setAttribute("aria-expanded", String(isOpen));
});

debuggerRunButton?.addEventListener("click", () => {
  const editor = window.editor;
  const code = editor?.getValue?.() ?? "";
  const language = detectLanguage(code);

  clearUnsupportedState();
  if (!code.trim()) {
    debuggerRunButton.blur();
    return;
  }

  if (language !== "HTML" && language !== "JavaScript") {
    if (unsupportedOverlay) unsupportedOverlay.hidden = false;
    container?.classList.add("debugger-unsupported");
    return;
  }

  if (typeof window.execute === "function") {
    window.execute();
  } else {
    console.warn("DarkStudio: o executor ainda não está disponível.");
  }
});

function watchEditor() {
  if (!window.editor) {
    window.setTimeout(watchEditor, 250);
    return;
  }

  window.editor.onDidChangeModelContent?.(clearUnsupportedState);
  window.editor.onDidChangeModel?.(clearUnsupportedState);
}

watchEditor();
setActiveView("files");
