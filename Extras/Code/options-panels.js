import { detectLanguage } from "./language-detection.js";

const container = document.getElementById("Website-Container");
const fileLauncher = document.getElementById("file-gutter-icon");
const debuggerLauncher = document.getElementById("debugger-launcher");
const chatLauncher = document.getElementById("nightcoder-launcher");
const isCompactLayout = window.matchMedia("(max-width: 700px)");
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

// Mede a gaveta móvel e reserva essa altura no layout do editor, evitando sobreposição.
let mobileOptionsLayoutFrame = 0;
function syncMobileOptionsSpace() {
  if (mobileOptionsLayoutFrame) cancelAnimationFrame(mobileOptionsLayoutFrame);
  mobileOptionsLayoutFrame = requestAnimationFrame(() => {
    mobileOptionsLayoutFrame = 0;
    const isOpen = isCompactLayout.matches && container?.classList.contains("mobile-options-open");
    const height = isOpen && optionsPanel ? Math.ceil(optionsPanel.getBoundingClientRect().height) : 0;
    container?.style.setProperty("--mobile-options-height", `${height}px`);
    window.editor?.layout?.();
  });
}

if (optionsPanel && typeof ResizeObserver !== "undefined") {
  const optionsResizeObserver = new ResizeObserver(syncMobileOptionsSpace);
  optionsResizeObserver.observe(optionsPanel);
}
if (container && typeof MutationObserver !== "undefined") {
  const optionsClassObserver = new MutationObserver(syncMobileOptionsSpace);
  optionsClassObserver.observe(container, { attributes: true, attributeFilter: ["class"] });
}
window.addEventListener("resize", syncMobileOptionsSpace, { passive: true });

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
  if (view === activeView) {
    // Extensões permanece como tela ativa mesmo quando o SVG é clicado novamente.
    // Manter activeView como "map" permite que o próximo atalho restaure o editor.
    if (activeView === "map") {
      syncMobileOptionsSpace();
      return;
    }

    // Um segundo clique nos demais seletores recolhe o painel atual.
    activeView = null;
    if (optionsPanel) optionsPanel.hidden = true;
    if (fileView) fileView.hidden = true;
    if (debuggerView) debuggerView.hidden = true;
    fileLauncher?.classList.remove("is-active");
    fileLauncher?.setAttribute("aria-pressed", "false");
    mapLauncher?.classList.remove("is-active");
    mapLauncher?.setAttribute("aria-pressed", "false");
    debuggerLauncher?.classList.remove("is-active");
    debuggerLauncher?.setAttribute("aria-pressed", "false");
    clearUnsupportedState();
    syncMobileOptionsSpace();
    return;
  }

  const showMap = view === "map";
  const showDebugger = view === "debugger";

  // Extensões controla a própria área de conteúdo; não aciona o recolhimento de Options.
  if (optionsPanel) optionsPanel.hidden = false;
  if (fileView) fileView.hidden = view !== "files";
  if (debuggerView) debuggerView.hidden = !showDebugger;

  fileLauncher?.classList.toggle("is-active", view === "files");
  fileLauncher?.setAttribute("aria-pressed", String(view === "files"));
  mapLauncher?.classList.toggle("is-active", showMap);
  mapLauncher?.setAttribute("aria-pressed", String(showMap));
  debuggerLauncher?.classList.toggle("is-active", showDebugger);
  debuggerLauncher?.setAttribute("aria-pressed", String(showDebugger));

  if (showMap) {
    // O host e os runtimes das extensões só são carregados quando a tela é solicitada.
    const loading = window.darkStudioLoadExtensions?.();
    if (loading?.then) {
      void loading.then(() => {
        if (activeView === "map") {
          window.darkStudioShowExtensions?.();
        }
      }).catch((error) => console.error("DarkStudio: não foi possível carregar Extensões.", error));
    } else {
      window.darkStudioShowExtensions?.();
    }
  } else if (activeView === "map") {
    window.darkStudioShowWorkspaceEditor?.();
  }

  activeView = view;
  if (!showMap && !window.darkStudioSettingsTransition &&
      !container?.classList.contains("settings-active") &&
      !container?.classList.contains("extensions-active")) {
    window.dispatchEvent(new Event("darkstudio:editor-requested"));
  }
  clearUnsupportedState();
}

fileLauncher?.addEventListener("click", () => {
  const wasActive = activeView === "files";
  setActiveView("files");
  if (!isCompactLayout.matches) return;
  container?.classList.toggle("mobile-options-open", !wasActive);
  syncMobileOptionsSpace();
});
mapLauncher?.addEventListener("click", () => {
  // O mesmo atalho abre Extensões; um segundo clique recolhe o painel.
  setActiveView("map");
  container?.classList.remove("mobile-options-open");
  syncMobileOptionsSpace();
});
debuggerLauncher?.addEventListener("click", () => {
  const wasActive = activeView === "debugger";
  setActiveView("debugger");
  if (isCompactLayout.matches) {
    container?.classList.toggle("mobile-options-open", !wasActive);
  }
  syncMobileOptionsSpace();
});
chatLauncher?.addEventListener("click", () => {
  const chatPanel = document.getElementById("chat");
  if (chatPanel?.classList.contains("inline-mode")) {
    window.darkStudioOpenNightCoder?.();
  } else {
    document.dispatchEvent(new KeyboardEvent("keydown", {
      key: "i", ctrlKey: true, bubbles: true, cancelable: true
    }));
  }
  const isOpen = container?.classList.contains("with-chat") ?? false;
  chatLauncher.classList.toggle("is-active", isOpen && !chatPanel?.classList.contains("inline-mode"));
  chatLauncher.setAttribute("aria-pressed", String(isOpen && !chatPanel?.classList.contains("inline-mode")));
});

// Regra genérica: qualquer ferramenta da barra, atual ou futura, fecha o NightCoder
// em telas compactas. O próprio botão do NightCoder permanece como alternador.
launcherRail?.addEventListener("click", (event) => {
  if (!isCompactLayout.matches || !(event.target instanceof Element)) return;

  const launcher = event.target.closest(".workspace-launcher");
  if (!launcher || !launcherRail.contains(launcher) || launcher === chatLauncher) return;

  window.darkStudioCloseNightCoder?.();
});
container?.addEventListener("pointerdown", (event) => {
  if (!isCompactLayout.matches || !container.classList.contains("mobile-options-open")) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (optionsPanel?.contains(target) || fileLauncher?.contains(target) || debuggerLauncher?.contains(target)) return;
  container.classList.remove("mobile-options-open");
  syncMobileOptionsSpace();
});

debuggerToggle?.addEventListener("click", () => {
  const isOpen = debuggerSection?.classList.toggle("debugger-open") ?? false;
  debuggerToggle.setAttribute("aria-expanded", String(isOpen));
});

debuggerRunButton?.addEventListener("click", () => {
  // Se a mensagem já estiver aberta, o botão funciona como um fechamento.
  if (unsupportedOverlay && !unsupportedOverlay.hidden) {
    clearUnsupportedState();
    debuggerRunButton.blur();
    return;
  }

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

// Clicar no próprio blur/mensagem fecha o aviso e devolve o foco ao editor.
unsupportedOverlay?.addEventListener("click", () => {
  clearUnsupportedState();
  window.editor?.focus?.();
});

function watchEditor() {
  if (!window.editor) return;

  // Só conecta os eventos quando o Monaco realmente existir.
  window.editor.layout?.();
  syncMobileOptionsSpace();
  window.editor.onDidChangeModelContent?.(clearUnsupportedState);
  window.editor.onDidChangeModel?.(clearUnsupportedState);
}

if (window.editor) {
  watchEditor();
} else {
  window.addEventListener("darkstudio:editor-ready", watchEditor, { once: true });
}
setActiveView("files");
if (isCompactLayout.matches) {
  container?.classList.add("mobile-layout");
  container?.classList.remove("mobile-options-open");
}
syncMobileOptionsSpace();
isCompactLayout.addEventListener?.("change", (event) => {
  container?.classList.toggle("mobile-layout", event.matches);
  container?.classList.remove("mobile-options-open");
  syncMobileOptionsSpace();
  requestAnimationFrame(() => window.editor?.layout());
});
