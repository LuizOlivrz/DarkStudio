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

const launcherRail = document.getElementById("workspace-launcher-rail");
const launcherOrderKey = "darkstudio.workspace-launcher-order.v1";
let draggedLauncher = null;

function getLaunchers() {
  return launcherRail ? [...launcherRail.querySelectorAll(":scope > .workspace-launcher")] : [];
}

function restoreLauncherOrder() {
  if (!launcherRail) return;
  try {
    const savedOrder = JSON.parse(localStorage.getItem(launcherOrderKey) || "[]");
    if (!Array.isArray(savedOrder)) return;
    const launchers = getLaunchers();
    const order = new Map(savedOrder.map((id, index) => [id, index]));
    launchers
      .sort((a, b) => {
        const aIndex = order.has(a.id) ? order.get(a.id) : Number.MAX_SAFE_INTEGER;
        const bIndex = order.has(b.id) ? order.get(b.id) : Number.MAX_SAFE_INTEGER;
        return aIndex - bIndex;
      })
      .forEach((button) => launcherRail.appendChild(button));
  } catch (error) {
    console.warn("DarkStudio: não foi possível restaurar a ordem dos ícones.", error);
  }
}

function saveLauncherOrder() {
  try {
    localStorage.setItem(launcherOrderKey, JSON.stringify(getLaunchers().map((button) => button.id)));
  } catch (error) {
    console.warn("DarkStudio: não foi possível salvar a ordem dos ícones.", error);
  }
}

launcherRail?.addEventListener("dragstart", (event) => {
  const launcher = event.target.closest(".workspace-launcher");
  if (!launcher || !launcherRail.contains(launcher)) return;
  draggedLauncher = launcher;
  launcher.classList.add("is-dragging");
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", launcher.id);
  }
});

launcherRail?.addEventListener("dragover", (event) => {
  if (!draggedLauncher) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";

  const target = event.target.closest(".workspace-launcher");
  if (!target || target === draggedLauncher || !launcherRail.contains(target)) return;

  const bounds = target.getBoundingClientRect();
  const insertAfter = event.clientY > bounds.top + bounds.height / 2;
  launcherRail.insertBefore(draggedLauncher, insertAfter ? target.nextElementSibling : target);
});

launcherRail?.addEventListener("drop", (event) => {
  if (!draggedLauncher) return;
  event.preventDefault();
  saveLauncherOrder();
});

function finishLauncherDrag() {
  if (!draggedLauncher) return;
  draggedLauncher.classList.remove("is-dragging");
  draggedLauncher = null;
  saveLauncherOrder();
}

launcherRail?.addEventListener("dragend", finishLauncherDrag);
restoreLauncherOrder();

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
    // O SVG de mapa abre a mesma tela do botão Extensões.
    window.darkStudioShowExtensions?.();
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
