import { detectLanguage } from "./language-detection.js";

const container = document.getElementById("Website-Container");
const fileLauncher = document.getElementById("file-gutter-icon");
const debuggerLauncher = document.getElementById("debugger-launcher");
const fileView = document.getElementById("file-manager-view");
const debuggerView = document.getElementById("debugger-view");
const debuggerSection = document.getElementById("debugger-section");
const debuggerToggle = document.getElementById("debugger-toggle");
const debuggerRunButton = document.getElementById("debugger-run-button");
const unsupportedOverlay = document.getElementById("debugger-unsupported-overlay");

function clearUnsupportedState() {
  container?.classList.remove("debugger-unsupported");
  if (unsupportedOverlay) unsupportedOverlay.hidden = true;
}

function setActiveView(view) {
  const showDebugger = view === "debugger";
  if (fileView) fileView.hidden = showDebugger;
  if (debuggerView) debuggerView.hidden = !showDebugger;

  fileLauncher?.classList.toggle("is-active", !showDebugger);
  fileLauncher?.setAttribute("aria-pressed", String(!showDebugger));
  debuggerLauncher?.classList.toggle("is-active", showDebugger);
  debuggerLauncher?.setAttribute("aria-pressed", String(showDebugger));

  if (showDebugger) {
    debuggerSection?.classList.add("debugger-open");
    debuggerToggle?.setAttribute("aria-expanded", "true");
  }
  clearUnsupportedState();
}

fileLauncher?.addEventListener("click", () => setActiveView("files"));
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
