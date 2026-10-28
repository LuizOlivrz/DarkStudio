// ============================================================
// DarkStudio — Mind Map + Project Workspace
// Workspace visual, arquivos, pastas, conexões e Monaco Editor
// ============================================================

import { devLog } from "./config.js";
import { detectLanguage } from "./language-detection.js";
import {
  TEXT_FILE_EXTENSIONS,
  WORKSPACE_LANGUAGES,
  getWorkspaceLanguage,
  getWorkspaceLanguageForFile,
  getFileExtension,
  getLanguageFromFile,
} from "./workspace-language.js";
const STORAGE_KEY = "darkstudio_mindmap_v1";
const MAX_LOCAL_STORAGE_STATE_CHARS = 350_000;
let storageQuotaWarningShown = false;
const SVG_NS = "http://www.w3.org/2000/svg";

function applyLanguageToNode(node, language, manual = false) {
  if (!node || node.type === "folder" || !language) return false;
  const oldName = node.name || tr("newFile");
  const dot = oldName.lastIndexOf(".");
  const baseName = dot > 0 ? oldName.slice(0, dot) : oldName;
  const newName = `${baseName}.${language.extension}`;
  const parent = getParentFolder(node);
  const parentPath = parent?.filePath || "";
  const newPath = parentPath ? `${parentPath}/${newName}` : newName;

  if (nodes.some((item) => item.id !== node.id && item.filePath === newPath)) return false;

  node.name = newName;
  node.filePath = newPath;
  if (manual) {
    node.languageOverride = true;
    node.languageOverrideLabel = language.label;
  } else if (!node.languageOverride) {
    node.languageOverrideLabel = "";
  }

  if (currentEditingNode?.id === node.id) {
    window.darkStudioWorkspaceCurrentFile = node;
    if (window.editor?.getModel() && window.monaco?.editor?.setModelLanguage) {
      window.monaco.editor.setModelLanguage(window.editor.getModel(), language.monaco);
    }
    const display = document.querySelector("#code-language h4");
    if (display) display.textContent = language.label;
  }

  saveState();
  renderNodes();
  updateSelectedNodeUI();
  return true;
}

function syncDetectedWorkspaceLanguage(label) {
  const node = currentEditingNode;
  if (!node || node.type === "folder" || node.languageOverride) return;
  let language = getWorkspaceLanguage(label);
  if (!language && String(label) === tr("text")) language = getWorkspaceLanguage("Texto");
  if (!language && String(label) === tr("gitText")) language = getWorkspaceLanguage("Git");
  if (!language) return;

  // Não redesenhe nem salve o Workspace a cada análise se a extensão já está correta.
  if (getFileExtension(node.name) === language.extension) return;
  applyLanguageToNode(node, language, false);
}
window.darkStudioWorkspaceSyncExtension = syncDetectedWorkspaceLanguage;

function showLanguageContextMenu(node, x, y) {
  document.getElementById("mindmap-language-menu")?.remove();
  if (!node || node.type === "folder" || node.type === "image") return;

  const menu = document.createElement("div");
  menu.id = "mindmap-language-menu";
  Object.assign(menu.style, {
    position: "fixed",
    left: `${Math.max(8, Math.min(x, window.innerWidth - 230))}px`,
    top: `${Math.max(8, Math.min(y, window.innerHeight - 420))}px`,
    zIndex: "1000003", width: "220px", maxHeight: "min(420px, 80vh)",
    overflowY: "auto", padding: "6px", borderRadius: "9px",
    border: "1px solid var(--secondary-color, #5d00ff)",
    background: "#151515", color: "#fff", boxShadow: "0 12px 32px #0009",
  });

  const autoButton = document.createElement("button");
  autoButton.type = "button";
  autoButton.textContent = "Detectar automaticamente";
  Object.assign(autoButton.style, {
    display: "block", width: "100%", padding: "9px 10px", border: "0",
    borderRadius: "5px", background: "transparent", color: "inherit",
    textAlign: "left", font: "inherit", fontSize: "13px", cursor: "pointer",
  });
  autoButton.addEventListener("mouseenter", () => { autoButton.style.background = "rgba(120,90,255,.2)"; });
  autoButton.addEventListener("mouseleave", () => { autoButton.style.background = "transparent"; });
  autoButton.addEventListener("click", () => {
    menu.remove();
    const detected = getFileExtension(node.name) === "ps1"
      ? "PowerShell"
      : detectLanguage(String(node.content || ""));
    node.languageOverride = false;
    node.languageOverrideLabel = "";
    node.detectedLanguageLabel = detected;

    const language = getWorkspaceLanguage(detected) ||
      (detected === tr("text") || detected === tr("gitText") ? getWorkspaceLanguage("Texto") : null);
    if (language && getFileExtension(node.name) !== language.extension) {
      if (!applyLanguageToNode(node, language, false)) {
        alert(tr("fileExists"));
        return;
      }
    } else {
      saveState();
      renderNodes();
    }

    if (currentEditingNode?.id === node.id) {
      window.darkStudioWorkspaceCurrentFile = node;
      const monacoLanguage = language?.monaco || getLanguageFromFile(node.filePath || node.name);
      if (window.editor?.getModel() && window.monaco?.editor?.setModelLanguage) {
        window.monaco.editor.setModelLanguage(window.editor.getModel(), monacoLanguage);
      }
      const display = document.querySelector("#code-language h4");
      if (display) display.textContent = detected;
    }
  });
  menu.appendChild(autoButton);

  const heading = document.createElement("div");
  heading.textContent = "Definir linguagem / extensão";
  Object.assign(heading.style, { padding: "8px 10px", fontSize: "12px", opacity: ".75" });
  menu.appendChild(heading);

  for (const language of WORKSPACE_LANGUAGES) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${language.label} (.${language.extension})`;
    Object.assign(button.style, {
      display: "block", width: "100%", padding: "8px 10px", border: "0",
      borderRadius: "5px", background: "transparent", color: "inherit",
      textAlign: "left", font: "inherit", fontSize: "13px", cursor: "pointer",
    });
    if (node.languageOverrideLabel === language.label) button.style.background = "rgba(120,90,255,.25)";
    button.addEventListener("mouseenter", () => { button.style.background = "rgba(120,90,255,.2)"; });
    button.addEventListener("mouseleave", () => {
      button.style.background = node.languageOverrideLabel === language.label ? "rgba(120,90,255,.25)" : "transparent";
    });
    button.addEventListener("click", () => {
      menu.remove();
      if (!applyLanguageToNode(node, language, true)) {
        alert(tr("fileExists"));
        return;
      }
      if (currentEditingNode?.id === node.id) {
        window.darkStudioWorkspaceCurrentFile = node;
        if (window.editor && typeof window.editor.setValue === "function") {
          window.editor.setValue(node.content || "");
          if (window.editor.getModel() && window.monaco?.editor?.setModelLanguage) {
            window.monaco.editor.setModelLanguage(window.editor.getModel(), language.monaco);
          }
        }
        const display = document.querySelector("#code-language h4");
        if (display) display.textContent = language.label;
      }
    });
    menu.appendChild(button);
  }

  document.body.appendChild(menu);
  const closeMenu = (event) => {
    if (!menu.contains(event.target)) {
      menu.remove();
      document.removeEventListener("pointerdown", closeMenu, true);
    }
  };
  setTimeout(() => document.addEventListener("pointerdown", closeMenu, true), 0);
}

const mind = document.getElementById("mindmap-container");
const nodeLayer = document.getElementById("mindmap-nodes");
const svg = document.getElementById("mindmap-svg");

let nodes = [];
let connections = [];

let currentEditingNode = null;
let connectMode = false;
let connectSource = null;
let activeDrag = null;
let activeResize = null;
let activePan = null;
const WORKSPACE_GRID = 24;
const MIN_NODE_WIDTH = WORKSPACE_GRID * 5;
const MIN_NODE_HEIGHT = WORKSPACE_GRID * 2;

function snapToGrid(value) {
  return Math.round(Number(value) / WORKSPACE_GRID) * WORKSPACE_GRID;
}
let workspacePan = { x: 0, y: 0 };
let folderClickTimer = null;
let previousDisplays = {};

let workspaceName = "workspace 1";
let workspaceDescription = "";
let workspaceTags = [];
let workspacePhoto = "";
let workspaceId = "";
let workspaceManagerView = false;
const WORKSPACES_KEY = "darkstudio_workspaces_v1";
const ACTIVE_WORKSPACE_KEY = "darkstudio_active_workspace_id";
const ACTIVE_WORKSPACE_FILE_PREFIX = "darkstudio_active_file_id:";
let workspaceAutosaveInstalled = false;
let highestNodeZIndex = 10;
let indexedDbPromise = null;

let fileInput;
let folderInput;

function tr(key) {
  return window.darkStudioTranslate?.(key) || key;
}

// ============================================================
// UTILITÁRIOS
// ============================================================

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getNode(id) {
  return nodes.find((node) => node.id === id);
}

function activeWorkspaceFileKey(id = workspaceId) {
  return `${ACTIVE_WORKSPACE_FILE_PREFIX}${id || "current"}`;
}

function rememberActiveWorkspaceFile(node) {
  try {
    if (node?.id) localStorage.setItem(activeWorkspaceFileKey(), node.id);
    else {
      localStorage.removeItem(activeWorkspaceFileKey());
      localStorage.setItem("darkstudio-editor-session-mode", "workspace");
    }
  } catch (error) {
    console.warn("DarkStudio: não foi possível lembrar o arquivo ativo.", error);
  }
}

function restoreActiveWorkspaceFile() {
  try {
    if (localStorage.getItem("darkstudio-editor-session-mode") === "external-file") return false;
  } catch {}
  let savedId = "";
  try { savedId = localStorage.getItem(activeWorkspaceFileKey()) || ""; } catch {}
  const node = savedId ? getNode(savedId) : null;
  if (!node || node.type === "folder" || node.type === "image" || node.type === "binary") return false;
  openNodeInEditor(node);
  return true;
}

function getNodeElement(id) {
  return (
    nodeLayer?.querySelector(`.mm-node[data-id="${CSS.escape(String(id))}"]`) ||
    null
  );
}

function getWorkspacePath(node) {
  return node?.filePath || node?.name || "";
}





function escapeSelector(value) {
  if (window.CSS?.escape) return CSS.escape(String(value));

  return String(value).replace(/["\\]/g, "\\$&");
}

function centerPosition(offset = 0) {
  const rect = mind?.getBoundingClientRect();

  return {
    x: Math.max(12, (rect?.width || 800) / 2 - 90 + offset - workspacePan.x),
    y: Math.max(80, (rect?.height || 600) / 2 - 25 + offset - workspacePan.y),
  };
}

function applyWorkspacePan() {
  const transform = `translate(${workspacePan.x}px, ${workspacePan.y}px)`;
  if (nodeLayer) nodeLayer.style.transform = transform;
  if (svg) svg.style.transform = transform;
  // A grade pertence ao viewport, não à camada dos nós: só a área visível é pintada.
  if (mind) {
    const position = `${workspacePan.x}px ${workspacePan.y}px`;
    mind.style.backgroundPosition = `${position}, ${position}, ${position}, ${position}`;
  }
}

// ============================================================
// PERSISTÊNCIA
// ============================================================

function getWorkspaceSnapshot() {
  return { id: workspaceId, name: workspaceName, description: workspaceDescription,
    tags: [...workspaceTags], photo: workspacePhoto, nodes, connections, workspacePan: { ...workspacePan } };
}
function readWorkspaceRegistry() {
  try {
    const stored = JSON.parse(localStorage.getItem(WORKSPACES_KEY) || "[]");
    return Array.isArray(stored) ? stored.filter((item) => item && typeof item.id === "string") : [];
  } catch { return []; }
}
function makeWorkspaceRegistryEntry(snapshot, includeContent = true) {
  const entry = {
    id: snapshot.id,
    name: snapshot.name || "workspace 1",
    description: snapshot.description || "",
    tags: Array.isArray(snapshot.tags) ? [...snapshot.tags] : [],
    photo: typeof snapshot.photo === "string" && snapshot.photo.length <= 100_000 ? snapshot.photo : "",
    workspacePan: snapshot.workspacePan || { x: 0, y: 0 },
    nodeCount: Array.isArray(snapshot.nodes) ? snapshot.nodes.length : Number(snapshot.nodeCount) || 0,
  };
  if (includeContent) {
    entry.nodes = Array.isArray(snapshot.nodes) ? snapshot.nodes : [];
    entry.connections = Array.isArray(snapshot.connections) ? snapshot.connections : [];
  }
  return entry;
}

function saveState() {
  const snapshot = getWorkspaceSnapshot();
  const state = { nodes, connections, workspaceName, workspaceDescription, workspaceTags, workspacePan };
  // Estime o volume pelo conteúdo antes de serializar para não criar strings
  // gigantes só para descobrir que localStorage não tem espaço suficiente.
  const estimatedContentChars = nodes.reduce(
    (total, node) => total + (typeof node.content === "string" ? node.content.length : 0),
    0,
  );
  const keepContentInLocalStorage = estimatedContentChars <= MAX_LOCAL_STORAGE_STATE_CHARS;
  const serializedState = keepContentInLocalStorage ? JSON.stringify(state) : "";
  const registryEntry = makeWorkspaceRegistryEntry(snapshot, keepContentInLocalStorage);
  const workspaces = readWorkspaceRegistry();
  const index = workspaces.findIndex((item) => item.id === workspaceId);
  if (index >= 0) workspaces[index] = registryEntry;
  else workspaces.push(registryEntry);

  try {
    if (keepContentInLocalStorage) {
      localStorage.setItem(STORAGE_KEY, serializedState);
    } else {
      // Conteúdo grande deve ficar no IndexedDB, não duplicado em localStorage.
      localStorage.removeItem(STORAGE_KEY);
    }
    localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces));
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
  } catch (error) {
    if (error?.name === "QuotaExceededError") {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      try {
        const compactRegistry = workspaces.map((item) => makeWorkspaceRegistryEntry(item, false));
        localStorage.setItem(WORKSPACES_KEY, JSON.stringify(compactRegistry));
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
      } catch {}
      if (!storageQuotaWarningShown) {
        console.warn(
          "DarkStudio: o Workspace é grande para localStorage; os conteúdos serão mantidos no IndexedDB.",
        );
        storageQuotaWarningShown = true;
      }
    } else {
      console.warn("DarkStudio: não foi possível salvar os metadados do Workspace.", error);
    }
  }

  // O IndexedDB armazena o conteúdo completo e suporta Workspaces maiores.
  persistStateToIndexedDB();
  updateWorkspaceNameUI();
  if (workspaceManagerView) renderWorkspaceManager();
}

function openWorkspaceDB() {
  if (indexedDbPromise) return indexedDbPromise;
  indexedDbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error("IndexedDB indisponível"));
    const request = indexedDB.open("DarkStudioWorkspaceDB", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("workspace")) {
        request.result.createObjectStore("workspace");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Falha no IndexedDB"));
  });
  return indexedDbPromise;
}

async function persistStateToIndexedDB() {
  // Capture snapshot and ID before the asynchronous DB open. Otherwise a fast
  // Workspace switch could save the previous contents under the next Workspace ID.
  const snapshot = getWorkspaceSnapshot();
  const id = workspaceId || "current";
  try {
    const db = await openWorkspaceDB();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("workspace", "readwrite");
      transaction.objectStore("workspace").put(snapshot, id);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch (error) {
    // localStorage remains the fallback for browsers with IndexedDB disabled.
    console.warn("DarkStudio: persistência ampliada indisponível.", error);
  }
}

async function restoreStateFromIndexedDB(id = workspaceId) {
  try {
    const db = await openWorkspaceDB();
    const saved = await new Promise((resolve, reject) => {
      const request = db.transaction("workspace", "readonly").objectStore("workspace").get(id || "current");
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    if (!saved || !Array.isArray(saved.nodes)) return false;
    if (Number.isFinite(saved.workspacePan?.x) && Number.isFinite(saved.workspacePan?.y)) {
      workspacePan = { x: saved.workspacePan.x, y: saved.workspacePan.y };
    }
    normalizeWorkspaceData(saved);
    return true;
  } catch (error) {
    console.warn("DarkStudio: não foi possível restaurar o Workspace ampliado.", error);
    return false;
  }
}

function normalizeWorkspaceData(data = {}) {
  nodes = Array.isArray(data.nodes) ? data.nodes : [];
  connections = Array.isArray(data.connections) ? data.connections : [];
  workspaceName = data.name || data.workspaceName || "workspace 1";
  workspaceDescription = typeof data.description === "string" ? data.description : (typeof data.workspaceDescription === "string" ? data.workspaceDescription : "");
  const savedTags = Array.isArray(data.tags) ? data.tags : data.workspaceTags;
  workspaceTags = Array.isArray(savedTags) ? [...new Set(savedTags.filter((tag) => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean))] : [];
  workspacePhoto = typeof data.photo === "string" && data.photo.startsWith("data:image/") ? data.photo : "";
  workspacePan = Number.isFinite(data.workspacePan?.x) && Number.isFinite(data.workspacePan?.y) ? { x: data.workspacePan.x, y: data.workspacePan.y } : { x: 0, y: 0 };
  for (const node of nodes) {
    node.id = String(node.id || makeId()); node.name = node.name || tr("newFile");
    node.content = typeof node.content === "string" ? node.content : ""; node.filePath = node.filePath || node.name; node.type = node.type || "text";
    if (!Number.isFinite(node.x)) node.x = 120; if (!Number.isFinite(node.y)) node.y = 120;
    node.x = snapToGrid(node.x); node.y = snapToGrid(node.y);
    node.width = Math.max(MIN_NODE_WIDTH, snapToGrid(Number(node.width) || 144));
    node.height = Math.max(MIN_NODE_HEIGHT, snapToGrid(Number(node.height) || 48));
    if (!Number.isFinite(node.vx)) node.vx = 0; if (!Number.isFinite(node.vy)) node.vy = 0;
    if (!Number.isFinite(node.zIndex)) node.zIndex = 0; if (node.type === "folder") node.isOpen = node.isOpen !== false;
  }
  connections = connections.filter((connection) => getNode(connection.from) && getNode(connection.to) && connection.from !== connection.to);
  for (const node of nodes) if (node.parentFolderId && !nodes.some((item) => item.id === node.parentFolderId && item.type === "folder")) delete node.parentFolderId;
}
function loadState() {
  try {
    let workspaces = readWorkspaceRegistry();
    const activeId = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
    let active = workspaces.find((item) => item.id === activeId);
    if (!workspaces.length) {
      let legacy = {};
      try { legacy = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch {}
      workspaceId = makeId();
      active = { id: workspaceId, name: legacy.workspaceName || "workspace 1", description: legacy.workspaceDescription || "",
        tags: legacy.workspaceTags || [], photo: "", nodes: legacy.nodes || [], connections: legacy.connections || [], workspacePan: legacy.workspacePan || { x: 0, y: 0 } };
      workspaces = [active];
      localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces)); localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
    } else if (!active) {
      active = workspaces[0]; workspaceId = active.id; localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
    } else workspaceId = active.id;
    normalizeWorkspaceData(active);
  } catch (error) {
    console.warn("DarkStudio: erro ao carregar o Workspace.", error); workspaceId = makeId(); normalizeWorkspaceData({});
  }
}

function setWorkspaceManagerView(enabled) {
  workspaceManagerView = Boolean(enabled);
  if (svg) svg.style.display = workspaceManagerView ? "none" : "";
  if (nodeLayer) nodeLayer.style.display = workspaceManagerView ? "none" : "";
  const detailsButton = document.getElementById("workspace-details-button");
  if (detailsButton) detailsButton.style.display = mind && getComputedStyle(mind).display !== "none" ? "block" : "none";
  let panel = document.getElementById("workspace-manager-view");
  if (workspaceManagerView) {
    if (!panel) {
      panel = document.createElement("section"); panel.id = "workspace-manager-view";
      Object.assign(panel.style, { position: "absolute", inset: "0", overflow: "auto", boxSizing: "border-box", padding: "clamp(18px, 4vw, 48px)", color: "#f5f5f5", background: "#0b0b0b" });
      mind.appendChild(panel);
    }
    panel.style.display = "block"; renderWorkspaceManager();
  } else if (panel) panel.style.display = "none";
}
function renderWorkspaceManager() {
  if (!workspaceManagerView || !mind) return;
  const panel = document.getElementById("workspace-manager-view"); if (!panel) return;
  const workspaces = readWorkspaceRegistry(); panel.replaceChildren();
  const heading = document.createElement("h2"); heading.textContent = tr("workspacesTitle");
  Object.assign(heading.style, { margin: "0 0 8px", fontSize: "clamp(22px, 3vw, 32px)" }); panel.appendChild(heading);
  const intro = document.createElement("p"); intro.textContent = tr("workspacesDescription");
  Object.assign(intro.style, { margin: "0 0 24px", color: "#aaa", lineHeight: "1.5" }); panel.appendChild(intro);
  const createButton = document.createElement("button"); createButton.type = "button";
  createButton.textContent = "+ " + tr("workspaceCreate"); createButton.className = "workspace-manager-primary";
  createButton.addEventListener("click", async () => {
    const name = await showNameDialog("", tr("workspaceCreate")); if (!name || !name.trim()) return;
    saveState();
    const created = { id: makeId(), name: name.trim(), description: "", tags: [], photo: "", nodes: [], connections: [], workspacePan: { x: 0, y: 0 } };
    const all = readWorkspaceRegistry(); all.push(created); localStorage.setItem(WORKSPACES_KEY, JSON.stringify(all)); activateWorkspace(created.id);
  }); panel.appendChild(createButton);
  const list = document.createElement("div");
  Object.assign(list.style, { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 270px), 1fr))", gap: "16px", marginTop: "22px" });
  for (const item of workspaces) {
    const card = document.createElement("article"); card.className = "workspace-card";
    card.style.borderColor = item.id === workspaceId ? "var(--secondary-color, #7654ff)" : "#333";
    if (item.photo) {
      const photoWrap = document.createElement("div"); photoWrap.className = "workspace-card-photo";
      const photo = document.createElement("img"); photo.src = item.photo; photo.alt = tr("workspacePhoto"); photo.draggable = false;
      const clip = document.createElement("span"); clip.className = "workspace-photo-clip"; clip.setAttribute("aria-hidden", "true");
      photoWrap.append(photo, clip); card.appendChild(photoWrap);
    }
    const title = document.createElement("h3"); title.className = "workspace-card-title"; title.textContent = item.name || tr("currentWorkspace"); card.appendChild(title);
    const description = document.createElement("p"); description.className = "workspace-card-description"; description.textContent = item.description || tr("workspaceNoDescription"); card.appendChild(description);
    if (Array.isArray(item.tags) && item.tags.length) {
      const tags = document.createElement("p"); tags.className = "workspace-card-tags"; tags.textContent = item.tags.map((tag) => "#" + tag).join("  "); card.appendChild(tags);
    }
    const actions = document.createElement("div"); actions.className = "workspace-card-actions";
    const openButton = document.createElement("button"); openButton.type = "button";
    openButton.textContent = item.id === workspaceId ? tr("workspaceCurrent") : tr("workspaceOpen");
    openButton.disabled = item.id === workspaceId;
    openButton.addEventListener("click", () => activateWorkspace(item.id)); actions.appendChild(openButton);
    const editButton = document.createElement("button"); editButton.type = "button";
    editButton.textContent = tr("workspaceEdit"); editButton.addEventListener("click", () => showWorkspaceSettings(item.id)); actions.appendChild(editButton);
    if (workspaces.length > 1) {
      const deleteButton = document.createElement("button"); deleteButton.type = "button"; deleteButton.textContent = tr("workspaceDelete");
      deleteButton.addEventListener("click", () => {
        if (!confirm(tr("workspaceDeleteConfirm").replace("{name}", item.name || ""))) return;
        const remaining = readWorkspaceRegistry().filter((entry) => entry.id !== item.id);
        localStorage.setItem(WORKSPACES_KEY, JSON.stringify(remaining));
        if (item.id === workspaceId) {
          const next = remaining[0]; workspaceId = next.id;
          localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId); normalizeWorkspaceData(next);
          currentEditingNode = null; connectMode = false; connectSource = null; applyWorkspacePan(); saveState();
        }
        renderWorkspaceManager();
      }); actions.appendChild(deleteButton);
    }
    card.appendChild(actions); list.appendChild(card);
  }
  panel.appendChild(list);
}

async function activateWorkspace(id) {
  const target = readWorkspaceRegistry().find((item) => item.id === id);
  if (!target) return;
  if (id !== workspaceId) {
    syncCurrentEditorToMap();
    saveState();
    workspaceId = target.id;
    try { localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId); } catch {}
    const restored = await restoreStateFromIndexedDB(workspaceId);
    if (!restored) normalizeWorkspaceData(target);
    currentEditingNode = null;
    window.darkStudioWorkspaceCurrentFile = null;
    connectMode = false;
    connectSource = null;
    applyWorkspacePan();
    saveState();
  }
  try { localStorage.setItem("darkstudio-editor-session-mode", "workspace"); } catch {}
  setWorkspaceManagerView(false);
  renderNodes();
  updateWorkspaceNameUI();
  if (!currentEditingNode) restoreActiveWorkspaceFile();
}

// ============================================================
// ESTILOS DO MAPA
// ============================================================

function injectStyles() {
  if (document.getElementById("darkstudio-workspace-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "darkstudio-workspace-styles";

  style.textContent = `
    #mindmap-container {
      position: relative;
      isolation: isolate;
      overflow: hidden;
      background-color: #090909;
      background-image:
        linear-gradient(rgba(150,150,150,.11) 1px, transparent 1px),
        linear-gradient(90deg, rgba(150,150,150,.11) 1px, transparent 1px),
        linear-gradient(rgba(150,150,150,.045) 1px, transparent 1px),
        linear-gradient(90deg, rgba(150,150,150,.045) 1px, transparent 1px);
      background-size: 120px 120px, 120px 120px, 24px 24px, 24px 24px;
      background-position: 0 0;
    }

    #mindmap-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 0;
      pointer-events: none;
      overflow: visible;
    }

    #mindmap-nodes {
      position: absolute;
      inset: 0;
      z-index: 1;
      overflow: hidden;
      background: transparent;
    }

    .mm-node {
      position: absolute;
      box-sizing: border-box;
      width: 144px;
      height: 48px;
      min-width: 120px;
      min-height: 48px;
      max-width: none;
      padding: 6px 10px;
      display: flex;
      align-items: center;
      gap: 9px;
      border: 1px solid rgba(255,255,255,.13);
      border-radius: 9px;
      background: rgba(25,25,25,.97);
      color: #f5f5f5;
      box-shadow: 0 7px 20px rgba(0,0,0,.30);
      cursor: grab;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
      transition: border-color .12s, box-shadow .12s, background .12s;
      overflow: visible;
    }

    .mm-node:active {
      cursor: grabbing;
    }

    .mm-node.selected {
      outline: 2px solid var(--secondary-color,#5d00ff);
    }

    .mm-node.mm-folder {
      min-width: 144px;
      border-color: rgba(255,177,65,.48);
      background: rgba(43,34,20,.97);
    }

    .mm-node.drop-target {
      border-color: #ffd27a;
      box-shadow:
        0 0 0 3px rgba(255,190,70,.23),
        0 8px 24px rgba(0,0,0,.4);
    }

    .mm-node.current-file {
      border-color: var(--primary-color, #5d00ff);
      box-shadow: 0 0 0 1px var(--primary-color, #5d00ff);
    }

    .mm-node .mm-icon {
      flex: 0 0 auto;
      font-size: 18px;
      line-height: 1;
    }

    .mm-node .name {
      flex: 1 1 auto;
      min-width: 0;
      font-size: 12px;
      max-width: 100%;
      max-height: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: normal;
      overflow-wrap: anywhere;
      font-size: 13px;
      line-height: 1.4;
    }

    .mm-node.mm-folder .name {
      font-weight: 600;
    }

    .mm-node .mm-resize-handle {
      position: absolute;
      z-index: 5;
      display: block;
      touch-action: none;
      opacity: 0;
      background: var(--secondary-color, #5d00ff);
      border-radius: 3px;
    }
    .mm-node:hover .mm-resize-handle,
    .mm-node:focus-within .mm-resize-handle,
    .mm-node.resizing .mm-resize-handle {
      opacity: .9;
    }
    .mm-resize-handle.n, .mm-resize-handle.s {
      left: 10px;
      right: 10px;
      height: 5px;
      cursor: ns-resize;
    }
    .mm-resize-handle.n { top: -2px; }
    .mm-resize-handle.s { bottom: -2px; }
    .mm-resize-handle.e, .mm-resize-handle.w {
      top: 10px;
      bottom: 10px;
      width: 5px;
      cursor: ew-resize;
    }
    .mm-resize-handle.e { right: -2px; }
    .mm-resize-handle.w { left: -2px; }
    .mm-resize-handle.ne, .mm-resize-handle.nw,
    .mm-resize-handle.se, .mm-resize-handle.sw {
      width: 9px;
      height: 9px;
      border: 1px solid #ddd;
      border-radius: 50%;
    }
    .mm-resize-handle.ne { top: -4px; right: -4px; cursor: nesw-resize; }
    .mm-resize-handle.nw { top: -4px; left: -4px; cursor: nwse-resize; }
    .mm-resize-handle.se { bottom: -4px; right: -4px; cursor: nwse-resize; }
    .mm-resize-handle.sw { bottom: -4px; left: -4px; cursor: nesw-resize; }
    .mm-node.resizing { outline: 1px solid var(--secondary-color, #5d00ff); }

    .mm-node img.thumb {
      width: 36px;
      height: 36px;
      object-fit: cover;
      border-radius: 6px;
      pointer-events: none;
    }

    #mindmap-add-menu {
      position: fixed;
      z-index: 1000000;
      min-width: 215px;
      max-width: calc(100vw - 24px);
      padding: 6px;
      display: grid;
      gap: 4px;
      border: 1px solid rgba(var(--secondary-rgb, 93, 0, 255),.65);
      border-radius: 10px;
      background: rgba(16,16,16,.98);
      box-shadow: 0 12px 32px #0009;
    }

    #mindmap-add-menu button {
      width: 100%;
      padding: 10px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: #eee;
      text-align: left;
      font: inherit;
      font-size: 13px;
      cursor: pointer;
    }

    #mindmap-add-menu button:hover {
      background: rgba(var(--secondary-rgb, 93, 0, 255),.16);
    }

    #workspace-name {
      position: absolute;
      right: 14px;
      bottom: 12px;
      z-index: 10;
      max-width: 50%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 7px 10px;
      border: 1px solid rgba(255,255,255,.13);
      border-radius: 7px;
      background: rgba(15,15,15,.9);
      color: #ccc;
      font-size: 12px;
      pointer-events: none;
    }

    .mm-link {
      stroke: rgba(210,210,210,.48);
      stroke-width: 2;
    }

    .mm-folder-link {
      fill: none;
      stroke: rgba(255,177,65,.75);
      stroke-width: 2;
      stroke-linecap: round;
    }

    #mindmap-delete-zone {
      position: absolute;
      top: 12px;
      left: 12px;
      transform: none;
      z-index: 1000001;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 48px;
      border: 1px solid rgba(255,100,100,.6);
      border-radius: 12px;
      background: rgba(100,20,20,.95);
      color: white;
      font-size: 23px;
      box-shadow: 0 6px 20px #0007;
      pointer-events: none;
    }
  `;

  document.head.appendChild(style);
}

// ============================================================
// NOME DO WORKSPACE
// ============================================================

function updateWorkspaceNameUI() {
  if (!mind) return;

  let label = document.getElementById("workspace-name");

  if (!label) {
    label = document.createElement("div");
    label.id = "workspace-name";
    mind.appendChild(label);
  }

  label.textContent = workspaceName;
  label.title = [
    `${tr("currentWorkspace")}: ${workspaceName}`,
    workspaceDescription,
    workspaceTags.length ? `${tr("workspaceTags")}: ${workspaceTags.join(", ")}` : "",
  ].filter(Boolean).join("\n");
}

function showNameDialog(initialName = "", title = "Nome") {
  return new Promise((resolve) => {
    document.getElementById("mindmap-name-popup")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "mindmap-name-popup";

    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "1000002",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      background: "rgba(0,0,0,.72)",
      backdropFilter: "blur(5px)",
    });

    const form = document.createElement("form");

    Object.assign(form.style, {
      width: "100%",
      maxWidth: "360px",
      padding: "22px",
      borderRadius: "13px",
      border: "1px solid rgba(var(--secondary-rgb, 93, 0, 255),.6)",
      background: "#151515",
      color: "#fff",
      boxShadow: "0 20px 60px #0009",
      fontFamily: "inherit",
    });

    const heading = document.createElement("h3");
    heading.textContent = title;

    Object.assign(heading.style, {
      margin: "0 0 16px",
      fontSize: "17px",
    });

    const input = document.createElement("input");
    input.type = "text";
    input.value = initialName;
    input.maxLength = 100;
    input.placeholder = tr("namePlaceholder");
    input.autocomplete = "off";
    input.autocapitalize = "off";
    input.spellcheck = false;
    input.enterKeyHint = "done";
    input.setAttribute("aria-label", title);

    Object.assign(input.style, {
      boxSizing: "border-box",
      width: "100%",
      padding: "11px",
      marginBottom: "17px",
      border: "1px solid #444",
      borderRadius: "7px",
      outline: "none",
      background: "#222",
      color: "#fff",
      fontSize: "14px",
      cursor: "text",
      pointerEvents: "auto",
      userSelect: "text",
      webkitUserSelect: "text",
    });

    const actions = document.createElement("div");

    Object.assign(actions.style, {
      display: "flex",
      justifyContent: "flex-end",
      gap: "9px",
    });

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = tr("cancel");

    const confirm = document.createElement("button");
    confirm.type = "submit";
    confirm.textContent = tr("save");

    for (const button of [cancel, confirm]) {
      Object.assign(button.style, {
        padding: "9px 13px",
        borderRadius: "7px",
        border: "1px solid #444",
        background: button === confirm
          ? "var(--primary-color, #5d00ff)"
          : "#242424",
        color: "#fff",
        cursor: "pointer",
      });
    }

    let completed = false;

    function finish(value) {
      if (completed) return;

      completed = true;
      overlay.remove();
      resolve(value);
    }

    cancel.addEventListener("click", () => finish(null));

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const value = input.value.trim();

      if (!value) {
        input.focus();
        return;
      }

      finish(value);
    });

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish(null);
    });

    overlay.addEventListener("keydown", (event) => {
      // Isola o diálogo dos atalhos globais do editor sem bloquear a digitação nativa.
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        finish(null);
      }
    });

    actions.append(cancel, confirm);
    form.append(heading, input, actions);
    overlay.appendChild(form);
    document.body.appendChild(overlay);

    // Focar no próximo frame evita perder o foco enquanto o overlay entra no DOM.
    requestAnimationFrame(() => {
      if (!overlay.isConnected || completed) return;
      input.focus({ preventScroll: true });
      input.select();
    });
  });
}


function showWorkspaceSettings(targetWorkspaceId = workspaceId) {
  document.getElementById("workspace-settings-popup")?.remove();
  const isActive = targetWorkspaceId === workspaceId;
  const target = isActive ? getWorkspaceSnapshot() : readWorkspaceRegistry().find((item) => item.id === targetWorkspaceId);
  if (!target) return;
  let draftPhoto = target.photo || "";
  let selectedPhotoFile = null;
  const overlay = document.createElement("div"); overlay.id = "workspace-settings-popup";
  Object.assign(overlay.style, { position: "fixed", inset: "0", zIndex: "1000004", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", background: "rgba(0,0,0,.72)", backdropFilter: "blur(5px)" });
  const panel = document.createElement("form");
  Object.assign(panel.style, { width: "100%", maxWidth: "480px", maxHeight: "85vh", overflowY: "auto", padding: "22px", borderRadius: "13px", border: "1px solid var(--secondary-color, #5d00ff)", background: "#151515", color: "#fff", boxShadow: "0 20px 60px #0009", fontFamily: "inherit", display: "grid", gap: "9px" });
  const heading = document.createElement("h3"); heading.textContent = tr("workspaceEdit"); heading.style.margin = "0 0 8px";
  const makeLabel = (text, id) => { const label = document.createElement("label"); label.textContent = text; label.htmlFor = id; label.style.cssText = "font-size:13px;margin-top:5px;"; return label; };
  const makeField = (id, value, placeholder) => { const field = document.createElement("input"); field.id = id; field.value = value; field.placeholder = placeholder; field.style.cssText = "box-sizing:border-box;width:100%;padding:10px;border:1px solid #444;border-radius:7px;background:#202020;color:#fff;font:inherit;"; return field; };
  const name = makeField("workspace-settings-name", target.name || "", tr("workspaceNamePlaceholder")); name.maxLength = 100;
  const description = document.createElement("textarea"); description.id = "workspace-settings-description"; description.value = target.description || ""; description.placeholder = tr("workspaceDescriptionPlaceholder"); description.maxLength = 1000; description.rows = 3;
  description.style.cssText = "box-sizing:border-box;width:100%;resize:vertical;padding:10px;border:1px solid #444;border-radius:7px;background:#202020;color:#fff;font:inherit;";
  const photoInput = document.createElement("input"); photoInput.type = "file"; photoInput.accept = "image/*"; photoInput.id = "workspace-settings-photo"; photoInput.style.cssText = "box-sizing:border-box;width:100%;font:inherit;color:#ccc;";
  const photoHint = document.createElement("p"); photoHint.textContent = tr("workspacePhotoHint"); photoHint.style.cssText = "font-size:12px;color:#aaa;margin:0;";
  const photoPreview = document.createElement("div"); photoPreview.className = "workspace-photo-preview";
  const photoPreviewImage = document.createElement("img"); photoPreviewImage.alt = tr("workspacePhoto"); photoPreviewImage.hidden = true;
  const previewClip = document.createElement("span"); previewClip.className = "workspace-photo-clip"; previewClip.setAttribute("aria-hidden", "true");
  photoPreview.append(photoPreviewImage, previewClip);
  const removePhoto = document.createElement("button"); removePhoto.type = "button"; removePhoto.textContent = tr("workspacePhotoRemove");
  removePhoto.style.cssText = "padding:7px 10px;border:1px solid #444;border-radius:7px;background:#252525;color:#fff;cursor:pointer;justify-self:start;";
  const updatePhotoPreview = () => { photoPreviewImage.hidden = !draftPhoto; if (draftPhoto) photoPreviewImage.src = draftPhoto; removePhoto.hidden = !draftPhoto; };
  updatePhotoPreview();
  photoInput.addEventListener("change", () => {
    const file = photoInput.files?.[0]; if (!file) return;
    if (!file.type.startsWith("image/")) { alert(tr("workspacePhotoHint")); photoInput.value = ""; return; }
    if (file.size > 8 * 1024 * 1024) { alert(tr("workspacePhotoTooLarge")); photoInput.value = ""; return; }
    selectedPhotoFile = file;
    const reader = new FileReader();
    reader.onload = () => { draftPhoto = String(reader.result || ""); updatePhotoPreview(); };
    reader.onerror = () => alert(tr("workspacePhotoHint"));
    reader.readAsDataURL(file);
  });
  removePhoto.addEventListener("click", () => { draftPhoto = ""; selectedPhotoFile = null; photoInput.value = ""; updatePhotoPreview(); });
  const tagInput = makeField("workspace-settings-tag-input", "", tr("workspaceTagPlaceholder"));
  const tagList = document.createElement("div"); Object.assign(tagList.style, { display: "flex", flexWrap: "wrap", gap: "6px", margin: "2px 0 8px" });
  const draftTags = [...(Array.isArray(target.tags) ? target.tags : [])];
  const renderTags = () => {
    tagList.replaceChildren();
    draftTags.forEach((tag, index) => {
      const chip = document.createElement("span"); Object.assign(chip.style, { display: "inline-flex", alignItems: "center", gap: "7px", padding: "5px 8px", borderRadius: "14px", background: "rgba(120,90,255,.2)", border: "1px solid rgba(120,90,255,.45)", fontSize: "12px" });
      const text = document.createElement("span"); text.textContent = tag;
      const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "×"; remove.title = tr("workspaceRemoveTag"); remove.setAttribute("aria-label", `${tr("workspaceRemoveTag")}: ${tag}`);
      remove.style.cssText = "border:0;background:transparent;color:inherit;cursor:pointer;font-size:16px;padding:0;line-height:1;";
      remove.addEventListener("click", () => { draftTags.splice(index, 1); renderTags(); }); chip.append(text, remove); tagList.appendChild(chip);
    });
  };
  const addTag = () => { const value = tagInput.value.trim().replace(/,/g, ""); if (!value) return; if (!draftTags.some((tag) => tag.toLocaleLowerCase() === value.toLocaleLowerCase())) draftTags.push(value); tagInput.value = ""; renderTags(); tagInput.focus(); };
  tagInput.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addTag(); } });
  const addTagButton = document.createElement("button"); addTagButton.type = "button"; addTagButton.textContent = tr("workspaceAddTag"); addTagButton.style.cssText = "padding:8px 10px;border:1px solid #444;border-radius:7px;background:#252525;color:#fff;cursor:pointer;justify-self:start;"; addTagButton.addEventListener("click", addTag);
  const actions = document.createElement("div"); Object.assign(actions.style, { display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" });
  const cancel = document.createElement("button"); cancel.type = "button"; cancel.textContent = tr("cancel");
  const save = document.createElement("button"); save.type = "submit"; save.textContent = tr("save");
  for (const button of [cancel, save]) button.style.cssText = "padding:9px 14px;border:1px solid #444;border-radius:7px;background:#252525;color:#fff;cursor:pointer;";
  save.style.borderColor = "var(--secondary-color, #5d00ff)"; cancel.addEventListener("click", () => overlay.remove()); actions.append(cancel, save);
  panel.append(heading, makeLabel(tr("workspaceName"), name.id), name, makeLabel(tr("workspaceDescription"), description.id), description,
    makeLabel(tr("workspacePhoto"), photoInput.id), photoInput, photoHint, photoPreview, removePhoto,
    makeLabel(tr("workspaceTags"), tagInput.id), tagInput, addTagButton, tagList, actions);
  panel.addEventListener("submit", async (event) => {
    event.preventDefault(); const nextName = name.value.trim(); if (!nextName) { name.focus(); return; }
    if (tagInput.value.trim()) addTag();
    if (selectedPhotoFile) {
      try { draftPhoto = await compressWorkspacePhoto(selectedPhotoFile); }
      catch (error) { alert(tr("workspacePhotoHint")); return; }
    }
    const all = readWorkspaceRegistry();
    const updated = { ...target, name: nextName, description: description.value.trim(), tags: [...draftTags], photo: draftPhoto };
    const index = all.findIndex((item) => item.id === targetWorkspaceId);
    if (index >= 0) all[index] = updated; else all.push(updated);
    localStorage.setItem(WORKSPACES_KEY, JSON.stringify(all));
    if (isActive) { workspaceName = updated.name; workspaceDescription = updated.description; workspaceTags = [...updated.tags]; workspacePhoto = updated.photo; saveState(); }
    else if (workspaceManagerView) renderWorkspaceManager();
    overlay.remove();
  });
  overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });
  overlay.appendChild(panel); document.body.appendChild(overlay); name.focus();
}

function compressWorkspacePhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const maxSide = 720; const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d"); if (!context) { reject(new Error("Canvas unavailable")); return; }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
        if (dataUrl.length > 900000) { reject(new Error("Image too large after compression")); return; }
        resolve(dataUrl);
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

async function renameWorkspace() {
  const name = await showNameDialog(workspaceName, tr("workspaceRename"));

  if (!name) return;

  workspaceName = name;
  saveState();
}

// ============================================================
// CRIAÇÃO DE NÓS
// ============================================================

function addNode(name, content = "", type = "text", position = null) {
  const point = position || centerPosition((nodes.length % 7) * 18);

  const node = {
    id: makeId(),
    name: name || (type === "folder" ? tr("newFolder") : tr("newFile")),
    content: typeof content === "string" ? content : "",
    filePath: name || tr("newFile"),
    type,
    x: snapToGrid(point.x),
    y: snapToGrid(point.y),
    width: 144,
    height: 48,
    vx: 0,
    vy: 0,
  };

  if (type === "folder") {
    node.isOpen = true;
    node.content = "";
  }

  nodes.push(node);

  if (nodeLayer) {
    nodeLayer.appendChild(createNodeElement(node));
  }

  saveState();
  updateFolderVisibility();
  updateConnections();
  refreshExplorerList();

  return node;
}

function addBlankNode() {
  addNode(`${tr("newFile")}.txt`, "", "text");
}

async function addFolder() {
  const name = await showNameDialog("", tr("createFolder"));

  if (!name) return;

  const folder = addNode(name, "", "folder");
  folder.filePath = name;

  saveState();
  renderNodes();
}

// ============================================================
// RENDERIZAÇÃO DOS NÓS
// ============================================================

function createNodeElement(node) {
  const element = document.createElement("div");

  element.className = [
    "mm-node",
    node.type === "folder" ? "mm-folder" : "",
    currentEditingNode?.id === node.id ? "current-file" : "",
  ]
    .filter(Boolean)
    .join(" ");

  element.dataset.id = node.id;
  element.style.left = `${node.x}px`;
  element.style.top = `${node.y}px`;
  element.style.width = `${Number(node.width) || 144}px`;
  element.style.height = `${Number(node.height) || 48}px`;
  element.style.zIndex = String(Number(node.zIndex) || (node.type === "folder" ? 2 : 3));

  if (node.type === "folder") {
    element.setAttribute("aria-expanded", String(node.isOpen !== false));
  }

  const customFileIcon = getNodeIconSvg(node);
  if (node.type === "image" && !customFileIcon) {
    const image = document.createElement("img");
    image.className = "thumb";
    image.src = node.content;
    image.alt = node.name;
    element.appendChild(image);
  } else {
    const icon = document.createElement("span");
    icon.className = "mm-icon";
    if (node.type === "folder") {
      icon.textContent = node.isOpen === false ? "📁" : "📂";
    } else if (customFileIcon) {
      icon.innerHTML = customFileIcon;
      Object.assign(icon.style, {
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: "18px", height: "18px", flex: "0 0 18px",
      });
      const svgIcon = icon.querySelector("svg");
      if (svgIcon) Object.assign(svgIcon.style, { width: "100%", height: "100%", display: "block" });
    } else {
      icon.textContent = getNodeIcon(node);
    }
    element.appendChild(icon);
  }

  const label = document.createElement("div");
  label.className = "name";
  label.textContent = node.name;
  element.appendChild(label);
  if (node.detectedLanguageLabel) {
    element.title = `${node.name} — ${node.detectedLanguageLabel}`;
  }

  for (const edge of ["n", "e", "s", "w", "ne", "nw", "se", "sw"]) {
    const handle = document.createElement("span");
    handle.className = `mm-resize-handle ${edge}`;
    handle.dataset.edge = edge;
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-label", "Resize workspace item");
    handle.addEventListener("pointerdown", (event) => beginNodeResize(event, node, element, edge));
    element.appendChild(handle);
  }

  element.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".mm-resize-handle")) return;
    // Raise the active node without changing its coordinates or graph edges.
    highestNodeZIndex = Math.max(highestNodeZIndex, 10) + 1;
    element.style.zIndex = String(highestNodeZIndex);
    node.zIndex = highestNodeZIndex;
    beginDrag(event, node, element);
  });

  element.addEventListener("click", (event) => {
    event.stopPropagation();

    if (element.dataset.wasResized === "true") {
      element.dataset.wasResized = "false";
      return;
    }

    if (element.dataset.wasDragged === "true") {
      element.dataset.wasDragged = "false";
      return;
    }

    if (connectMode) {
      handleConnectClick(node, element);
      return;
    }

    clearTimeout(folderClickTimer);
    folderClickTimer = setTimeout(() => {
      if (node.type === "folder") toggleFolder(node);
      else openNodeInEditor(node);
    }, 400);
  });

  element.addEventListener("contextmenu", (event) => {
    if (node.type === "folder" || node.type === "image") return;
    event.preventDefault();
    event.stopPropagation();
    showLanguageContextMenu(node, event.clientX, event.clientY);
  });

  element.addEventListener("dblclick", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    clearTimeout(folderClickTimer);

    const name = await showNameDialog(
      node.name,
      tr(node.type === "folder" ? "renameFolder" : "renameFile"),
    );

    if (!name || name === node.name) return;
    if (node.type === "folder") renameFolderNode(node, name);
    else renameFileNode(node, name);
  });

  return element;
}

function getNodeIconSvg(node) {
  const extension = getFileExtension(node?.name);
  const icons = {
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><path d="M6 28L4 3H28L26 28L16 31L6 28Z" fill="#E44D26"/><path d="M26 5H16V29.5L24 27L26 5Z" fill="#F16529"/><path d="M9.5 17.5L8.5 8H24L23.5 11H11.5L12 14.5H23L22 24L16 26L10 24L9.5 19H12.5L13 21.5L16 22.5L19 21.5L19.5 17.5H9.5Z" fill="white"/></svg>`,
    htm: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><path d="M6 28L4 3H28L26 28L16 31L6 28Z" fill="#E44D26"/><path d="M26 5H16V29.5L24 27L26 5Z" fill="#F16529"/><path d="M9.5 17.5L8.5 8H24L23.5 11H11.5L12 14.5H23L22 24L16 26L10 24L9.5 19H12.5L13 21.5L16 22.5L19 21.5L19.5 17.5H9.5Z" fill="white"/></svg>`,
    css: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><title>file_type_css</title><polygon points="5.902 27.201 3.656 2 28.344 2 26.095 27.197 15.985 30 5.902 27.201" style="fill:#1572b6"/><polygon points="16 27.858 24.17 25.593 26.092 4.061 16 4.061 16 27.858" style="fill:#33a9dc"/><polygon points="16 13.191 20.09 13.191 20.372 10.026 16 10.026 16 6.935 16.011 6.935 23.75 6.935 23.676 7.764 22.917 16.282 16 16.282 16 13.191" style="fill:#fff"/><polygon points="16.019 21.218 16.005 21.222 12.563 20.292 12.343 17.827 10.67 17.827 9.24 17.827 9.673 22.68 16.004 24.438 16.019 24.434 16.019 21.218" style="fill:#ebebeb"/><polygon points="19.827 16.151 19.455 20.29 16.008 21.22 16.008 24.436 22.344 22.68 22.391 22.158 22.928 16.151 19.827 16.151" style="fill:#fff"/><polygon points="16.011 6.935 16.011 8.855 16.011 10.018 16.011 10.026 8.555 10.026 8.555 10.026 8.545 10.026 8.483 9.331 8.342 7.764 8.268 6.935 16.011 6.935" style="fill:#ebebeb"/><polygon points="16 13.191 16 15.111 16 16.274 16 16.282 12.611 16.282 12.611 16.282 12.601 16.282 12.539 15.587 12.399 14.02 12.325 13.191 16 13.191" style="fill:#ebebeb"/></svg>`,
    js: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><rect x="2" y="2" width="28" height="28" fill="#FFCA28"/><path d="M19 25.2879L21.0615 23.9237C21.2231 24.4313 22.2462 25.6368 23.5385 25.6368C24.8308 25.6368 25.4308 24.931 25.4308 24.463C25.4308 23.1878 24.1112 22.7382 23.4774 22.5223C23.374 22.4871 23.289 22.4581 23.2308 22.4328C23.2009 22.4198 23.1558 22.4025 23.0979 22.3804C22.393 22.1111 19.7923 21.1175 19.7923 18.2373C19.7923 15.065 22.8538 14.7002 23.5462 14.7002C23.9991 14.7002 26.1769 14.7557 27.2615 16.7939L25.2615 18.1898C24.8231 17.3015 24.0946 17.0081 23.6462 17.0081C22.5385 17.0081 22.3077 17.8201 22.3077 18.1898C22.3077 19.227 23.5112 19.6919 24.5273 20.0844C24.7932 20.1871 25.0462 20.2848 25.2615 20.3866C26.3692 20.91 28 21.7666 28 24.463C28 25.8136 26.8672 28.0002 24.0154 28.0002C20.1846 28.0002 19.1692 25.7003 19 25.2879Z" fill="#3E3E3E"/><path d="M9 25.5587L11.1487 24.1953C11.317 24.7026 11.9713 25.638 12.9205 25.638C13.8698 25.638 14.3557 24.663 14.3557 24.1953V15.0002H16.9982V24.1953C17.041 25.4636 16.3376 28.0002 13.2332 28.0002C10.379 28.0002 9.19242 26.3039 9 25.5587Z" fill="#3E3E3E"/></svg>`,
    png: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 26"><g><path fill="var(--secondary-color, #5d00ff)" d="M22.266,4.207c-0.244-0.24-0.494-0.484-0.74-0.732c-0.248-0.246-0.492-0.496-0.732-0.74C19.082,0.988,18.063,0,17,0H9.046c-2.205,0-4,1.795-4,4v7.2h1.923V3.988c0-1.104,0.896-2,2-2l7.327-0.004c0.721,0.184,0.711,1.07,0.711,1.957v3.047c0,0.551,0.449,1,1,1h3c0.998,0,2,0.005,2,1V22c0,1.104-0.896,2-2,2H8.969c-1.104,0-2-0.896-2-2v-3.2H5.021V22c0,2.205,1.795,4,4,4H21c2.205,0,4-1.795,4-4V8C25,6.938,24.012,5.918,22.266,4.207z"/><g><path fill="var(--secondary-color, #5d00ff)" d="M4.768,13.236c-0.144,0-0.242,0.006-0.31,0.016v1.42c0.061,0.007,0.133,0.01,0.228,0.01c0.529,0,0.832-0.279,0.832-0.765C5.518,13.355,5.109,13.236,4.768,13.236z"/><path fill="var(--secondary-color, #5d00ff)" d="M20,11H2c-0.551,0-1,0.449-1,1v6c0,0.551,0.449,1,1,1h18c0.551,0,1-0.449,1-1v-6C21,11.449,20.551,11,20,11z M6.465,15.343c-0.412,0.426-1.025,0.649-1.772,0.649c-0.088,0-0.165-0.004-0.234-0.009v1.867c0,0.089-0.07,0.16-0.159,0.16H3.156c-0.09,0-0.16-0.071-0.16-0.16v-5.639c0-0.075,0.055-0.141,0.129-0.155c0.424-0.08,0.958-0.121,1.591-0.121c0.746,0,1.291,0.163,1.665,0.498c0.379,0.327,0.599,0.854,0.599,1.44C6.979,14.484,6.796,15.007,6.465,15.343z M12.541,17.851c0,0.089-0.071,0.16-0.158,0.16H11.17c-0.061,0-0.116-0.036-0.144-0.09l-1.091-2.205c-0.168-0.34-0.381-0.786-0.58-1.253c0.012,0.498,0.02,1.045,0.02,1.667v1.721c0,0.089-0.072,0.16-0.159,0.16h-1.06c-0.088,0-0.159-0.071-0.159-0.16v-5.714c0-0.089,0.071-0.159,0.159-0.159h1.348c0.06,0,0.114,0.033,0.142,0.088l1.061,2.094c0.159,0.315,0.323,0.676,0.481,1.058c-0.017-0.425-0.025-0.89-0.025-1.419v-1.661c0-0.089,0.07-0.159,0.16-0.159h1.061c0.087,0,0.158,0.07,0.158,0.159v5.713H12.541z M19.024,17.588c0,0.066-0.041,0.126-0.103,0.149c-0.423,0.161-1.107,0.332-1.763,0.332c-0.96,0-1.675-0.267-2.188-0.814c-0.492-0.532-0.764-1.312-0.764-2.194c0.007-1.91,1.215-3.143,3.074-3.143c0.68,0,1.215,0.148,1.489,0.288c0.065,0.033,0.099,0.106,0.084,0.179l-0.243,1.043c-0.012,0.047-0.043,0.087-0.089,0.107c-0.045,0.021-0.096,0.02-0.139-0.002c-0.22-0.113-0.523-0.229-1.109-0.229c-0.962,0-1.537,0.63-1.537,1.689c0,1.058,0.558,1.714,1.454,1.714c0.177,0,0.314-0.016,0.4-0.035v-0.927h-0.629c-0.088,0-0.159-0.071-0.159-0.158v-1.01c0-0.087,0.071-0.159,0.159-0.159h1.902c0.088,0,0.159,0.072,0.159,0.159v3.011H19.024z"/></g></g></svg>`,
    zip: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><g><path fill="#E9E9E0" d="M36.985,0H7.963C7.155,0,6.5,0.655,6.5,1.926V55c0,0.345,0.655,1,1.463,1h40.074c0.808,0,1.463-0.655,1.463-1V12.978c0-0.696-0.093-0.92-0.257-1.085L37.607,0.257C37.442,0.093,37.218,0,36.985,0z"/><polygon fill="#D9D7CA" points="37.5,0.151 37.5,12 49.349,12"/><rect x="26.5" y="42" fill="#C8BDB8" width="2" height="14"/><polygon fill="#C8BDB8" points="30.5,23 30.5,21 28.5,21 28.5,19 26.5,19 26.5,21 24.5,21 24.5,23 26.5,23 26.5,25 24.5,25 24.5,27 26.5,27 26.5,29 24.5,29 24.5,31 26.5,31 26.5,34 28.5,34 28.5,31 30.5,31 30.5,29 28.5,29 28.5,27 30.5,27 30.5,25 28.5,25 28.5,23"/><rect x="23.5" y="34" fill="#CBB292" width="8" height="8"/><path fill="#5E5F62" d="M32.5,43h-10V33h10V43z M24.5,41h6v-6h-6V41z"/><rect x="23.5" y="36" fill="#5E5F62" width="8" height="2"/></g></svg>`,
    ico: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360" fill="currentColor"><path d="M344.971,127.272h-49.942V77.834L212.006,0H15.029v360h280v-50h49.942V127.272z M314.971,280h-210V157.273h210V280z"/><rect x="137.613" y="182.112" width="12.696" height="65.319"/><path d="M168.847,237.357c2.79,3.16,6.118,5.721,9.982,7.683c3.864,1.964,8.126,2.944,12.788,2.944c2.636,0,5.336-.338,8.096-1.012c2.76-.675,5.351-1.656,7.774-2.944l7.774-4.738c1.933-1.87,3.419-4.032,4.462-6.485l-10.395-5.98c-.736,1.779-1.718,3.297-2.944,4.554-1.227,1.258-2.561,2.286-4.002,3.082-1.441,.798-2.96,1.38-4.554,1.748-1.596,.368-3.128,.552-4.6,.552-2.822,0-5.414-.611-7.774-1.84-2.361-1.227-4.386-2.852-6.072-4.876-1.688-2.024-2.989-4.37-3.91-7.038-.92-2.668-1.38-5.441-1.38-8.326 0-2.576,.398-5.166,1.196-7.773,.797-2.606,1.978-4.937,3.542-6.992 1.564-2.055,3.526-3.727,5.888-5.014 2.36-1.288,5.137-1.932,8.326-1.932 1.472,0,2.975,.169,4.508,.506 1.533,.338,3.005,.873,4.416,1.609 1.41,.736,2.729,1.734,3.956,2.99 1.227,1.258,2.269,2.807,3.128,4.646l9.752-6.717c-2.147-4.232-5.413-7.666-9.798-10.304-4.386-2.636-9.584-3.956-15.594-3.956-5.092,0-9.63,.951-13.616,2.852-3.987,1.902-7.359,4.387-10.12,7.453-2.76,3.066-4.861,6.547-6.302,10.441-1.441,3.895-2.162,7.836-2.162,11.822 0,4.172,.782,8.266,2.347,12.281 1.533,3.926,3.71,7.514,6.501,10.672z"/><path d="M231.223,237.635c2.79,3.098,6.133,5.581,10.028,7.451 3.893,1.871,8.233,2.807,13.018,2.807 4.601,0,8.862-.904,12.788-2.715 3.925-1.809,7.298-4.231,10.12-7.268 2.82-3.036,5.028-6.532,6.624-10.488 1.594-3.955,2.392-8.11,2.392-12.466 0-4.108-.768-8.156-2.3-12.144-1.533-3.986-3.68-7.545-6.44-10.672-2.761-3.129-6.088-5.658-9.982-7.59-3.896-1.933-8.204-2.898-12.926-2.898-4.601,0-8.864,.905-12.788,2.714-3.926,1.81-7.314,4.247-10.166,7.314-2.853,3.068-5.092,6.594-6.716,10.58-1.626,3.988-2.439,8.158-2.439,12.512 0,4.172,.767,8.25,2.3,12.236 1.533,4.0,3.694,7.541,6.486,10.639z"/></svg>`,
    iso: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor"><path d="M30.6,12.8C30.6,12.8,30.6,12.8,30.6,12.8C30.6,12.7,30.6,12.7,30.6,12.8c-1-4.6-4.1-8.4-8.2-10.3c0,0-.1,0-.1-.1c0,0-.1,0-.1,0C20.3,1.5,18.2,1,16,1 7.7,1 1,7.7 1,16c0,1.6.3,3.2.8,4.7 0,0,0,0,0,.1 0,0,0,.1,0,.1.7,2.2,2,4.1,3.6,5.7 0,0,0,0,0,0s0,0,0,0C8.1,29.3,11.9,31,16,31c8.3,0,15-6.7,15-15 0-1.1-.1-2.2-.4-3.2z M12,16c0-2.2,1.8-4,4-4s4,1.8,4,4-1.8,4-4,4-4-1.8-4-4z M16,3c1.6,0,3.1.3,4.6.8l-3,6.4c-.5-.1-1-.2-1.6-.2-3.3,0-6,2.7-6,6 0,.3,0,.6.1.9l-6.7,2.2C3.1,18.1,3,17.1,3,16 3,8.8,8.8,3,16,3z M16,29c-3.2,0-6.2-1.2-8.4-3.1l5-5c1,.7,2.2,1.1,3.5,1.1 3.3,0,6-2.7,6-6 0-.1,0-.2,0-.3l6.9-1.5c.1,.6,.1,1.2,.1,1.8C29,23.2,23.2,29,16,29z"/><path d="M19,16c0-1.7-1.3-3-3-3s-3,1.3-3,3 1.3,3,3,3 3-1.3,3-3z M15,16c0-.6,.4-1,1-1s1,.4,1,1-.4,1-1,1-1-.4-1-1z"/></svg>`,
    exe: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><g><path fill="#E9E9E0" d="M36.985,0H7.963C7.155,0,6.5,0.655,6.5,1.926V55c0,0.345,0.655,1,1.463,1h40.074c0.808,0,1.463-0.655,1.463-1V12.978c0-0.696-0.093-0.92-0.257-1.085L37.607,0.257C37.442,0.093,37.218,0,36.985,0z"/><polygon fill="#D9D7CA" points="37.5,0.151 37.5,12 49.349,12"/><path fill="#9777A8" d="M48.037,56H7.963C7.155,56,6.5,55.345,6.5,54.537V39h43v15.537C49.5,55.345,48.845,56,48.037,56z"/><g fill="#FFFFFF"><path d="M17.082,44.168v3.172h4.211v1.121h-4.211v3.295h4.635V53h-6.303V42.924h6.303v1.244H17.082z"/><path d="M28.58,48.105L31.137,53h-1.9l-1.6-3.801H27.5L25.777,53h-1.9l2.557-4.895l-2.721-5.182h1.873l1.777,4.102H27.5l1.928-4.102h1.873L28.58,48.105z"/><path d="M35.266,44.168v3.172h4.211v1.121h-4.211v3.295H39.9V53h-6.303V42.924H39.9v1.244H35.266z"/></g><path fill="#9777A8" d="M33.5,32c-0.099,0-0.2-0.015-0.299-0.046c-0.527-0.165-0.821-0.726-0.656-1.253l5-16c0.165-0.527,0.726-0.821,1.253-0.656c0.527,0.165,0.821,0.726,0.656,1.253l-5,16C34.321,31.726,33.926,32,33.5,32z"/><circle fill="#9777A8" cx="29" cy="19.5" r="1.5"/><circle fill="#9777A8" cx="29" cy="26.5" r="1.5"/><path fill="#9777A8" d="M23.5,30h-2c-3.86,0-7-3.14-7-7s3.14-7,7-7h2c0.552,0,1,0.448,1,1s-0.448,1-1,1h-2c-2.757,0-5,2.243-5,5s2.243,5,5,5h2c0.552,0,1,0.448,1,1S24.052,30,23.5,30z"/></g></svg>`,
  };
  return icons[extension] || null;
}

function getNodeIcon(node) {
  const extension = getFileExtension(node.name);
  const icons = {
    js: "🟨", mjs: "🟨", ts: "🔷", html: "🌐", htm: "🌐", css: "🎨",
    json: "🧩", md: "📝", py: "🐍", java: "☕", jpg: "🖼️", jpeg: "🖼️",
    gif: "🖼️", svg: "🖼️", txt: "📄",
  };
  return icons[extension] || "▤";
}

function renderNodes() {
  if (!nodeLayer) return;

  nodeLayer.innerHTML = "";

  for (const node of nodes) {
    highestNodeZIndex = Math.max(highestNodeZIndex, Number(node.zIndex) || 0);
    nodeLayer.appendChild(createNodeElement(node));
  }

  updateFolderVisibility();
  updateConnections();
  refreshExplorerList();
}

function refreshExplorerList() {
  const list = document.getElementById("explorer-files");
  if (!list) return;
  list.replaceChildren();

  // Pastas não contam como arquivos para o estado vazio do editor.
  const hasWorkspaceFiles = nodes.some((node) => node.type !== "folder");
  const editorInput = document.getElementById("Editor-Input");
  const emptyState = document.getElementById("workspace-empty-state");
  if (editorInput) editorInput.hidden = !hasWorkspaceFiles;
  if (emptyState) emptyState.hidden = hasWorkspaceFiles;

  if (!nodes.length) {
    const empty = document.createElement("div");
    empty.className = "explorer-empty";
    empty.textContent = tr("explorerEmpty");
    list.appendChild(empty);
    return;
  }

  const compareNames = (a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), undefined, {
      sensitivity: "base",
      numeric: true,
    });
  const childrenOf = (parent) => nodes
    .filter((node) => (node.parentFolderId || null) === (parent?.id || null))
    .sort((a, b) => {
      const aFolder = a.type === "folder";
      const bFolder = b.type === "folder";
      if (aFolder !== bFolder) return aFolder ? -1 : 1;
      return compareNames(a, b);
    });

  const renderBranch = (parent, container) => {
    for (const node of childrenOf(parent)) {
      const row = document.createElement("div");
      row.className = "explorer-entry";
      row.dataset.nodeId = node.id;

      const item = document.createElement("button");
      item.type = "button";
      item.className = "explorer-file";
      item.setAttribute("role", "listitem");
      item.dataset.nodeId = node.id;
      item.title = node.filePath || node.name;
      item.draggable = true;
      item.setAttribute("aria-expanded", node.type === "folder" ? String(node.isOpen !== false) : "false");

      const icon = document.createElement("span");
      icon.className = "explorer-file-icon";
      icon.setAttribute("aria-hidden", "true");
      const customFileIcon = node.type === "folder" ? null : getNodeIconSvg(node);
      if (node.type === "folder") {
        icon.textContent = node.isOpen === false ? "📁" : "📂";
      } else if (customFileIcon) {
        icon.innerHTML = customFileIcon;
        Object.assign(icon.style, {
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: "16px", height: "16px", flex: "0 0 16px",
        });
        const svgIcon = icon.querySelector("svg");
        if (svgIcon) Object.assign(svgIcon.style, { width: "100%", height: "100%", display: "block" });
      } else {
        icon.textContent = node.type === "image" ? "▧" : node.type === "binary" ? "▤" : getNodeIcon(node);
      }

      const label = document.createElement("span");
      label.className = "explorer-file-name";
      label.style.fontSize = "14px";
      label.textContent = node.name;
      item.append(icon, label);
      if (node.detectedLanguageLabel && node.type !== "folder") {
        const languageBadge = document.createElement("span");
        languageBadge.className = "explorer-file-language";
        languageBadge.textContent = node.detectedLanguageLabel;
        languageBadge.title = `Linguagem detectada: ${node.detectedLanguageLabel}`;
        item.appendChild(languageBadge);
      }
      row.appendChild(item);
      container.appendChild(row);

      if (node.type === "folder" && node.isOpen !== false) {
        const branch = document.createElement("div");
        branch.className = "explorer-children";
        branch.dataset.parentFolderId = node.id;
        row.appendChild(branch);
        renderBranch(node, branch);
      }
    }
  };

  renderBranch(null, list);
}

// ============================================================
// PASTAS ANINHADAS
// ============================================================

function getParentFolder(node) {
  return node?.parentFolderId ? getNode(node.parentFolderId) : null;
}

function isInsideClosedFolder(node) {
  let parent = getParentFolder(node);
  const visited = new Set();

  while (parent && !visited.has(parent.id)) {
    visited.add(parent.id);

    if (parent.isOpen === false) return true;

    parent = getParentFolder(parent);
  }

  return false;
}

function updateFolderVisibility() {
  for (const node of nodes) {
    const element = getNodeElement(node.id);

    if (!element) continue;

    element.style.display = isInsideClosedFolder(node) ? "none" : "flex";
  }

  updateConnections();
}

function toggleFolder(folder) {
  if (!folder || folder.type !== "folder") return;

  folder.isOpen = folder.isOpen === false;

  const element = getNodeElement(folder.id);
  const icon = element?.querySelector(".mm-icon");

  if (icon) {
    icon.textContent = folder.isOpen ? "📂" : "📁";
  }

  element?.setAttribute("aria-expanded", String(folder.isOpen));

  saveState();
  updateFolderVisibility();
  refreshExplorerList();
}

function renameFolderNode(folder, newName) {
  if (/[\\/]/.test(newName)) {
    alert(tr("invalidName"));
    return;
  }
  const oldPath = folder.filePath || folder.name;
  const parent = getParentFolder(folder);
  const parentPath = parent?.filePath || "";

  const newPath = parentPath ? `${parentPath}/${newName}` : newName;
  if (nodes.some((node) => node.id !== folder.id && node.filePath === newPath)) {
    alert(tr("fileExists"));
    return;
  }

  folder.name = newName;
  folder.filePath = newPath;

  // Atualiza caminhos dos descendentes.
  for (const node of nodes) {
    if (node.id === folder.id) continue;

    const path = node.filePath || "";

    if (path.startsWith(`${oldPath}/`)) {
      node.filePath = newPath + path.slice(oldPath.length);
    }
  }

  saveState();
  renderNodes();
}

function renameFileNode(file, newName) {
  if (/[\\/]/.test(newName)) {
    alert(tr("invalidName"));
    return;
  }
  const parent = getParentFolder(file);
  const parentPath = parent?.filePath || "";
  const newPath = parentPath ? `${parentPath}/${newName}` : newName;
  const collision = nodes.some((node) => node.id !== file.id && node.filePath === newPath);
  if (collision) {
    alert(tr("fileExists"));
    return;
  }
  const extensionChanged = getFileExtension(file.name) !== getFileExtension(newName);
  file.name = newName;
  file.filePath = newPath;

  if (extensionChanged) {
    const selectedLanguage = getWorkspaceLanguageForFile(newName);
    file.languageOverride = true;
    file.languageOverrideLabel = selectedLanguage?.label || "Texto";
  }

  if (currentEditingNode?.id === file.id) {
    window.darkStudioWorkspaceCurrentFile = file;
    if (file.languageOverride) setEditorLanguage(file);
  }

  saveState();
  renderNodes();
  updateSelectedNodeUI();
}

// ============================================================
// ARRASTAR E SOLTAR
// ============================================================

function beginDrag(event, node, element) {
  if (event.button !== 0 || connectMode) return;

  if (event.target.closest("button, input")) return;

  event.preventDefault();

  const rect = element.getBoundingClientRect();

  activeDrag = {
    node,
    element,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    moved: false,
    dropTarget: null,
  };

  element.setPointerCapture?.(event.pointerId);
  element.style.cursor = "grabbing";
  document.body.style.userSelect = "none";

  document.addEventListener("pointermove", onPointerMove, {
    passive: false,
  });

  document.addEventListener("pointerup", onPointerUp);
  document.addEventListener("pointercancel", onPointerUp);
}

function onPointerMove(event) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
    return;
  }

  event.preventDefault();

  const drag = activeDrag;
  const rect = mind.getBoundingClientRect();

  const x = snapToGrid(event.clientX - rect.left - drag.offsetX - workspacePan.x);
  const y = snapToGrid(event.clientY - rect.top - drag.offsetY - workspacePan.y);

  if (
    Math.abs(event.clientX - drag.startX) +
      Math.abs(event.clientY - drag.startY) >
    5
  ) {
    drag.moved = true;
    drag.element.dataset.wasDragged = "true";
  }

  drag.node.x = x;
  drag.node.y = y;

  drag.element.style.left = `${x}px`;
  drag.element.style.top = `${y}px`;

  highlightDropTarget(drag.node, event.clientX, event.clientY);
  updateConnections();

  if (y < 70) {
    showDeleteZone();
  } else {
    hideDeleteZone();
  }
}

function validFolderTarget(node, folder) {
  if (!node || !folder || folder.type !== "folder") return false;
  if (node.id === folder.id) return false;

  // Impede colocar uma pasta dentro dela própria ou de um descendente.
  let current = folder;

  while (current?.parentFolderId) {
    if (current.parentFolderId === node.id) return false;
    current = getNode(current.parentFolderId);
  }

  return true;
}

function highlightDropTarget(node, clientX, clientY) {
  nodeLayer?.querySelectorAll(".drop-target").forEach((element) => {
    element.classList.remove("drop-target");
  });

  if (!mind) return;

  // Detecta a pasta pela área real, sem depender de elementFromPoint:
  // o elemento arrastado pode ficar por cima e capturar o ponteiro.
  const folder = nodes
    .filter((item) => item.type === "folder" && validFolderTarget(node, item))
    .map((item) => ({ item, element: getNodeElement(item.id) }))
    .filter(({ element }) => {
      if (!element || element.style.display === "none") return false;
      const rect = element.getBoundingClientRect();
      return clientX >= rect.left && clientX <= rect.right &&
        clientY >= rect.top && clientY <= rect.bottom;
    })
    .sort((a, b) => {
      const za = Number(a.element.style.zIndex) || 0;
      const zb = Number(b.element.style.zIndex) || 0;
      return zb - za;
    })[0];

  if (!folder) {
    if (activeDrag) activeDrag.dropTarget = null;
    return;
  }

  folder.element.classList.add("drop-target");
  if (activeDrag) activeDrag.dropTarget = folder.item;
}

function onPointerUp(event) {
  document.removeEventListener("pointermove", onPointerMove);
  document.removeEventListener("pointerup", onPointerUp);
  document.removeEventListener("pointercancel", onPointerUp);

  document.body.style.userSelect = "";

  if (!activeDrag) return;

  const drag = activeDrag;

  drag.element.style.cursor = "grab";
  activeDrag = null;

  const target = drag.dropTarget;

  if (drag.moved) {
    const trash = document.getElementById("mindmap-delete-zone");
    const nodeRect = drag.element.getBoundingClientRect();
    const trashRect = trash?.getBoundingClientRect();

    const droppedInTrash =
      trashRect &&
      nodeRect.left < trashRect.right &&
      nodeRect.right > trashRect.left &&
      nodeRect.top < trashRect.bottom &&
      nodeRect.bottom > trashRect.top;

    if (droppedInTrash) {
      deleteNode(drag.node.id);
    } else if (target && validFolderTarget(drag.node, target)) {
      attachNodeToFolder(drag.node, target);
    } else {
      // Soltar fora de uma pasta desagrupa o nó.
      delete drag.node.parentFolderId;
      delete drag.node.folderOffsetX;
      delete drag.node.folderOffsetY;
    }
  }

  nodeLayer?.querySelectorAll(".drop-target").forEach((element) => {
    element.classList.remove("drop-target");
  });

  hideDeleteZone();
  saveState();
  updateFolderVisibility();
  updateConnections();
}

function beginNodeResize(event, node, element, edge) {
  if (event.button !== 0 || connectMode) return;
  event.preventDefault();
  event.stopPropagation();

  activeResize = {
    node, element, edge, pointerId: event.pointerId,
    startX: event.clientX, startY: event.clientY,
    x: node.x, y: node.y,
    width: Number(node.width) || element.getBoundingClientRect().width || 144,
    height: Number(node.height) || element.getBoundingClientRect().height || 48,
  };
  element.classList.add("resizing");
  element.setPointerCapture?.(event.pointerId);
  document.body.style.userSelect = "none";
  document.addEventListener("pointermove", onNodeResizeMove, { passive: false });
  document.addEventListener("pointerup", endNodeResize);
  document.addEventListener("pointercancel", endNodeResize);
}

function onNodeResizeMove(event) {
  const resize = activeResize;
  if (!resize || event.pointerId !== resize.pointerId) return;
  event.preventDefault();

  const dx = event.clientX - resize.startX;
  const dy = event.clientY - resize.startY;
  const edge = resize.edge;
  let x = resize.x;
  let y = resize.y;
  let width = resize.width;
  let height = resize.height;

  if (edge.includes("e")) width = snapToGrid(Math.max(MIN_NODE_WIDTH, resize.width + dx));
  if (edge.includes("s")) height = snapToGrid(Math.max(MIN_NODE_HEIGHT, resize.height + dy));
  if (edge.includes("w")) {
    width = snapToGrid(Math.max(MIN_NODE_WIDTH, resize.width - dx));
    x = snapToGrid(resize.x + resize.width - width);
  }
  if (edge.includes("n")) {
    height = snapToGrid(Math.max(MIN_NODE_HEIGHT, resize.height - dy));
    y = snapToGrid(resize.y + resize.height - height);
  }

  width = Math.max(MIN_NODE_WIDTH, width);
  height = Math.max(MIN_NODE_HEIGHT, height);
  resize.node.x = x;
  resize.node.y = y;
  resize.node.width = width;
  resize.node.height = height;
  resize.element.style.left = `${x}px`;
  resize.element.style.top = `${y}px`;
  resize.element.style.width = `${width}px`;
  resize.element.style.height = `${height}px`;
  updateConnections();
}

function endNodeResize(event) {
  if (!activeResize || (event?.pointerId != null && event.pointerId !== activeResize.pointerId)) return;
  document.removeEventListener("pointermove", onNodeResizeMove);
  document.removeEventListener("pointerup", endNodeResize);
  document.removeEventListener("pointercancel", endNodeResize);
  activeResize.element.classList.remove("resizing");
  activeResize.element.dataset.wasResized = "true";
  document.body.style.userSelect = "";
  activeResize = null;
  saveState();
  updateConnections();
}

function beginWorkspacePan(event) {
  if (event.button !== 0 || connectMode || activeDrag || event.target.closest(".mm-node, button, input, select, textarea, a")) return;
  if (event.target !== nodeLayer && event.target !== mind) return;
  event.preventDefault();
  activePan = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: workspacePan.x, y: workspacePan.y };
  mind.setPointerCapture?.(event.pointerId);
  mind.style.cursor = "grabbing";
  document.body.style.userSelect = "none";
  document.addEventListener("pointermove", onWorkspacePanMove, { passive: false });
  document.addEventListener("pointerup", endWorkspacePan);
  document.addEventListener("pointercancel", endWorkspacePan);
}

function onWorkspacePanMove(event) {
  if (!activePan || event.pointerId !== activePan.pointerId) return;
  event.preventDefault();
  workspacePan = { x: activePan.x + event.clientX - activePan.startX, y: activePan.y + event.clientY - activePan.startY };
  applyWorkspacePan();
  updateConnections();
}

function endWorkspacePan(event) {
  if (!activePan || (event?.pointerId != null && event.pointerId !== activePan.pointerId)) return;
  document.removeEventListener("pointermove", onWorkspacePanMove);
  document.removeEventListener("pointerup", endWorkspacePan);
  document.removeEventListener("pointercancel", endWorkspacePan);
  document.body.style.userSelect = "";
  mind.style.cursor = "";
  activePan = null;
  saveState();
}

function attachNodeToFolder(node, folder) {
  if (!validFolderTarget(node, folder)) return;

  node.parentFolderId = folder.id;
  // Posiciona o item logo abaixo da pasta para que o vínculo fique visível
  // e a pasta não seja encoberta pelo elemento recém-solto.
  node.x = snapToGrid(folder.x + 24);
  node.y = snapToGrid(folder.y + (Number(folder.height) || MIN_NODE_HEIGHT) + 24);
  node.folderOffsetX = node.x - folder.x;
  node.folderOffsetY = node.y - folder.y;

  const element = getNodeElement(node.id);
  if (element) {
    element.style.left = `${node.x}px`;
    element.style.top = `${node.y}px`;
  }

  folder.isOpen = true;
}

function moveNodeIntoExplorerFolder(node, folder) {
  if (!node || !folder || !validFolderTarget(node, folder)) return false;

  const oldPath = node.filePath || node.name;
  const oldParent = getParentFolder(node);
  const newParentPath = folder.filePath || folder.name;
  const newPath = `${newParentPath}/${node.name}`;
  const affected = node.type === "folder"
    ? nodes.filter((item) => item.id === node.id || String(item.filePath || "").startsWith(`${oldPath}/`))
    : [node];

  const pathFor = (item) => {
    const currentPath = item.filePath || item.name;
    return item.id === node.id
      ? newPath
      : newPath + currentPath.slice(oldPath.length);
  };
  const affectedIds = new Set(affected.map((item) => item.id));
  const nextPaths = new Set();
  for (const item of affected) {
    const nextPath = pathFor(item);
    if (nextPaths.has(nextPath) || nodes.some((other) =>
      !affectedIds.has(other.id) && (other.filePath || other.name) === nextPath
    )) {
      alert(tr("fileExists"));
      return false;
    }
    nextPaths.add(nextPath);
  }

  node.parentFolderId = folder.id;
  attachNodeToFolder(node, folder);
  for (const item of affected) item.filePath = pathFor(item);
  folder.isOpen = true;
  if (oldParent && oldParent.id !== folder.id) oldParent.isOpen = oldParent.isOpen !== false;
  saveState();
  renderNodes();
  return true;
}

function moveNodeToExplorerRoot(node) {
  if (!node || !node.parentFolderId) return false;

  const oldPath = node.filePath || node.name;
  const newPath = node.name;
  const affected = node.type === "folder"
    ? nodes.filter((item) => item.id === node.id || String(item.filePath || "").startsWith(`${oldPath}/`))
    : [node];
  const affectedIds = new Set(affected.map((item) => item.id));
  const pathFor = (item) => item.id === node.id
    ? newPath
    : newPath + String(item.filePath || item.name).slice(oldPath.length);

  const nextPaths = new Set();
  for (const item of affected) {
    const nextPath = pathFor(item);
    if (nextPaths.has(nextPath) || nodes.some((other) =>
      !affectedIds.has(other.id) && (other.filePath || other.name) === nextPath
    )) {
      alert(tr("fileExists"));
      return false;
    }
    nextPaths.add(nextPath);
  }

  node.parentFolderId = null;
  delete node.folderOffsetX;
  delete node.folderOffsetY;
  for (const item of affected) item.filePath = pathFor(item);

  saveState();
  renderNodes();
  return true;
}

function showDeleteZone() {
  if (document.getElementById("mindmap-delete-zone")) return;

  const zone = document.createElement("div");
  zone.id = "mindmap-delete-zone";
  zone.textContent = "🗑️";

  const map = document.getElementById("mindmap-container");
  (map || document.body).appendChild(zone);
}

function hideDeleteZone() {
  document.getElementById("mindmap-delete-zone")?.remove();
}

// ============================================================
// CONEXÕES ENTRE NÓS
// ============================================================

function handleConnectClick(node, element) {
  if (!connectSource) {
    connectSource = node.id;
    element.classList.add("selected");
    return;
  }

  if (connectSource === node.id) {
    getNodeElement(connectSource)?.classList.remove("selected");
    connectSource = null;
    return;
  }

  const index = connections.findIndex((connection) => {
    return (
      (connection.from === connectSource && connection.to === node.id) ||
      (connection.to === connectSource && connection.from === node.id)
    );
  });

  if (index >= 0) {
    connections.splice(index, 1);
  } else {
    connections.push({
      from: connectSource,
      to: node.id,
    });
  }

  getNodeElement(connectSource)?.classList.remove("selected");

  connectSource = null;
  saveState();
  updateConnections();
}

function updateConnections() {
  if (!svg || !nodeLayer) return;

  svg.innerHTML = "";

  const layerRect = nodeLayer.getBoundingClientRect();

  // Conexões criadas manualmente.
  for (const connection of connections) {
    const from = getNode(connection.from);
    const to = getNode(connection.to);

    if (!from || !to) continue;
    if (isInsideClosedFolder(from) || isInsideClosedFolder(to)) continue;

    const a = getNodeElement(from.id);
    const b = getNodeElement(to.id);

    if (!a || !b) continue;

    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();

    const line = document.createElementNS(SVG_NS, "line");

    line.setAttribute("x1", ra.left - layerRect.left + ra.width / 2);
    line.setAttribute("y1", ra.top - layerRect.top + ra.height / 2);
    line.setAttribute("x2", rb.left - layerRect.left + rb.width / 2);
    line.setAttribute("y2", rb.top - layerRect.top + rb.height / 2);
    line.setAttribute("class", "mm-link");

    svg.appendChild(line);
  }

  // Linhas de vínculo entre pastas e seus itens.
  for (const node of nodes) {
    if (!node.parentFolderId || isInsideClosedFolder(node)) continue;

    const parent = getNode(node.parentFolderId);

    if (!parent || isInsideClosedFolder(parent)) continue;

    const a = getNodeElement(parent.id);
    const b = getNodeElement(node.id);

    if (!a || !b) continue;

    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();

    const line = document.createElementNS(SVG_NS, "line");

    line.setAttribute("x1", ra.left - layerRect.left + ra.width / 2);
    line.setAttribute("y1", ra.top - layerRect.top + ra.height / 2);
    line.setAttribute("x2", rb.left - layerRect.left + rb.width / 2);
    line.setAttribute("y2", rb.top - layerRect.top + rb.height / 2);
    line.setAttribute("class", "mm-folder-link");

    svg.appendChild(line);
  }
}

// ============================================================
// ARQUIVOS E PASTAS IMPORTADOS
// ============================================================

function findFolderByPath(path) {
  return nodes.find((node) => node.type === "folder" && node.filePath === path);
}

function ensureFolderPath(path) {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");

  if (!normalized) return null;

  const existing = findFolderByPath(normalized);

  if (existing) return existing;

  const segments = normalized.split("/");
  const folderName = segments.pop();
  const parentPath = segments.join("/");

  let parent = parentPath ? ensureFolderPath(parentPath) : null;

  const folder = addNode(
    folderName,
    "",
    "folder",
    centerPosition((nodes.length % 8) * 16),
  );

  folder.filePath = normalized;

  if (parent) {
    attachNodeToFolder(folder, parent);
  }

  return folder;
}

async function readFileContent(file) {
  const binaryTypes = /^(?:image|audio|video|font)\//i;
  const extension = file.name.split(".").pop().toLowerCase();
  const declaredText = /^text\//i.test(file.type || "");
  if (binaryTypes.test(file.type || "") || (!TEXT_FILE_EXTENSIONS.has(extension) && !declaredText)) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;

      reader.readAsDataURL(file);
    });
  }

  return file.text();
}

const IMPORT_IGNORED_DIRECTORIES = new Set([
  ".git", "node_modules", ".next", ".nuxt", ".output", "dist", "build",
  "coverage", "vendor", ".venv", "venv", "__pycache__", ".pytest_cache",
  ".mypy_cache", ".tox", "target", ".cache", "bower_components"
]);
const MAX_IMPORT_FILE_BYTES = 4 * 1024 * 1024;
const MAX_IMPORT_TOTAL_BYTES = 25 * 1024 * 1024;

function shouldIgnoreImportedPath(path) {
  return String(path || "").replace(/\\/g, "/").split("/").some((part) =>
    IMPORT_IGNORED_DIRECTORIES.has(part.toLowerCase())
  );
}

async function importWorkspaceFiles(fileList, targetFolder = null, options = {}) {
  const files = Array.from(fileList || []);
  const directoryPaths = Array.isArray(options.directoryPaths) ? options.directoryPaths : [];
  const preserveRoot = Boolean(options.preserveRoot);
  const replaceWorkspace = Boolean(options.replaceWorkspace);

  if (!files.length && !directoryPaths.length) return;

  const isDirectoryImport = files.some((file) => file.webkitRelativePath);
  let rootName = "";
  if (isDirectoryImport) {
    const firstPath = files.find((file) => file.webkitRelativePath)?.webkitRelativePath;
    rootName = firstPath?.split("/")[0] || "";
    if (!rootName || files.some((file) => !file.webkitRelativePath)) {
      throw new Error("Não foi possível identificar a pasta importada.");
    }
  }

  const basePath = targetFolder?.filePath || "";
  const importedFolderPaths = new Set();
  const markImportedFolderPath = (path) => {
    const parts = String(path || "").replace(/\\/g, "/").split("/").filter(Boolean);
    for (let i = 1; i <= parts.length; i++) {
      importedFolderPaths.add(parts.slice(0, i).join("/"));
    }
  };
  const prepared = [];
  let ignoredDirectoryFiles = 0;
  let oversizedFiles = 0;
  let overBudgetFiles = 0;
  let totalBytes = 0;

  // Filtra caminhos e tamanhos antes de ler conteúdo para evitar alocar pastas
  // de dependências/builds e arquivos gigantes na memória do navegador.
  for (const file of files) {
    const sourcePath = file.webkitRelativePath || file.name;
    const parts = sourcePath.replace(/\\/g, "/").split("/").filter((part) => part && part !== ".");
    if (parts.some((part) => part === "..")) continue;
    if (shouldIgnoreImportedPath(parts.join("/"))) {
      ignoredDirectoryFiles++;
      continue;
    }
    if (isDirectoryImport && !preserveRoot && parts[0] === rootName) parts.shift();
    if (!parts.length) continue;

    const filename = parts.pop();
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      oversizedFiles++;
      continue;
    }
    if (totalBytes + file.size > MAX_IMPORT_TOTAL_BYTES) {
      overBudgetFiles++;
      continue;
    }

    const relativeDirectoryPath = parts.join("/");
    const directoryPath = [basePath, relativeDirectoryPath].filter(Boolean).join("/");
    if (directoryPath) markImportedFolderPath(directoryPath);
    const filePath = [basePath, relativeDirectoryPath, filename].filter(Boolean).join("/");
    if ((!isDirectoryImport || targetFolder) && nodes.some((node) => (node.filePath || node.name) === filePath)) continue;
    prepared.push({ file, filename, directoryPath, filePath });
    totalBytes += file.size;
  }

  const filteredDirectories = directoryPaths.filter((path) => !shouldIgnoreImportedPath(path));
  if (!prepared.length && !filteredDirectories.length) {
    if (ignoredDirectoryFiles || oversizedFiles || overBudgetFiles) {
      alert("Nenhum arquivo foi importado. Pastas de dependências/build e arquivos grandes são ignorados para evitar falta de memória.");
      return;
    }
    throw new Error("A pasta não contém arquivos importáveis.");
  }

  // Apenas o seletor de pasta usado para abrir projeto substitui o Workspace.
  if (replaceWorkspace && isDirectoryImport && !targetFolder) {
    syncCurrentEditorToMap();
    nodes = [];
    connections = [];
    currentEditingNode = null;
    connectSource = null;
    connectMode = false;
    closeImageViewer();
  }

  for (const directoryPath of filteredDirectories) {
    const normalizedDirectory = String(directoryPath || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    if (!normalizedDirectory) continue;
    const fullDirectoryPath = [basePath, normalizedDirectory].filter(Boolean).join("/");
    markImportedFolderPath(fullDirectoryPath);
    ensureFolderPath(fullDirectoryPath);
  }

  // Leia um arquivo por vez. Não mantenha todas as strings/base64 na memória
  // em um array intermediário, o que multiplicava o pico de uso de RAM.
  let importedCount = 0;
  const seenPaths = new Set();
  for (const entry of prepared) {
    if (seenPaths.has(entry.filePath)) continue;
    seenPaths.add(entry.filePath);
    if ((!isDirectoryImport || targetFolder) && nodes.some((node) => (node.filePath || node.name) === entry.filePath)) continue;

    const parent = entry.directoryPath ? ensureFolderPath(entry.directoryPath) : targetFolder;
    const content = await readFileContent(entry.file);
    const isImage = Boolean(entry.file.type && entry.file.type.startsWith("image/"));
    const extension = entry.filename.split(".").pop().toLowerCase();
    const isText = TEXT_FILE_EXTENSIONS.has(extension) || /^text\//i.test(entry.file.type || "");
    const node = addNode(
      entry.filename,
      content,
      isImage ? "image" : isText ? "text" : "binary",
      centerPosition((nodes.length % 8) * 18),
    );
    node.filePath = entry.filePath;
    if (parent) attachNodeToFolder(node, parent);
    importedCount++;
  }

  if (rootName && replaceWorkspace && !targetFolder) workspaceName = rootName;

  // Toda pasta que pertence à importação começa recolhida no Explorer.
  // A pasta de destino preexistente permanece aberta ao importar dentro dela.
  for (const node of nodes) {
    if (
      node.type === "folder" &&
      node.id !== targetFolder?.id &&
      importedFolderPaths.has(String(node.filePath || node.name).replace(/\\/g, "/"))
    ) {
      node.isOpen = false;
    }
  }

  saveState();
  renderNodes();

  const skipped = ignoredDirectoryFiles + oversizedFiles + overBudgetFiles;
  console.info(`DarkStudio: ${importedCount} arquivo(s) importado(s); ${skipped} ignorado(s) por filtros de memória.`);
  if (skipped) {
    const reasons = [];
    if (ignoredDirectoryFiles) reasons.push(`${ignoredDirectoryFiles} em pastas de dependências/build`);
    if (oversizedFiles) reasons.push(`${oversizedFiles} acima de 4 MB`);
    if (overBudgetFiles) reasons.push(`${overBudgetFiles} além do limite total de 25 MB`);
    alert(`Importação concluída: ${importedCount} arquivo(s) importado(s). Ignorados: ${reasons.join("; ")}.`);
  }
}

function normalizeProjectPath(path) {
  const parts = [];
  for (const part of String(path || "").replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function resolveProjectFile(reference, fromNode = currentEditingNode) {
  const raw = String(reference || "").trim();
  if (!raw || /^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(raw)) return null;

  let path = raw.split(/[?#]/, 1)[0];
  try { path = decodeURIComponent(path); } catch { /* Keep malformed escapes as a literal path. */ }
  path = path.replace(/\\/g, "/");
  if (!path) return null;

  const sourcePath = getWorkspacePath(fromNode);
  const sourceDirectory = sourcePath.includes("/")
    ? sourcePath.slice(0, sourcePath.lastIndexOf("/"))
    : "";
  const targetPath = normalizeProjectPath(path.startsWith("/")
    ? path
    : `${sourceDirectory ? `${sourceDirectory}/` : ""}${path}`);

  let match = nodes.find((node) => node.type !== "folder" && normalizeProjectPath(node.filePath || node.name) === targetPath);
  if (!match) {
    const lowerPath = targetPath.toLowerCase();
    match = nodes.find((node) => node.type !== "folder" && normalizeProjectPath(node.filePath || node.name).toLowerCase() === lowerPath);
  }

  return match ? normalizeProjectPath(match.filePath || match.name) : null;
}

window.darkStudioResolveProjectReference = (reference) => resolveProjectFile(reference);
window.darkStudioOpenProjectFile = (path) => {
  const normalized = normalizeProjectPath(path);
  const node = nodes.find((item) => item.type !== "folder" && normalizeProjectPath(item.filePath || item.name) === normalized);
  if (!node) return false;
  openNodeInEditor(node);
  return true;
};

function previewMime(path) {
  const ext = path.split(".").pop().toLowerCase();
  return ({ html: "text/html", htm: "text/html", css: "text/css", js: "text/javascript", mjs: "text/javascript", json: "application/json", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", ico: "image/x-icon", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf", mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", wav: "audio/wav" })[ext] || "text/plain";
}

function createProjectPreview(node) {
  if (!node || node.type === "folder") return null;
  const files = new Map(nodes.filter((item) => item.type !== "folder" && item.filePath).map((item) => [normalizeProjectPath(item.filePath), item]));
  const index = files.get(normalizeProjectPath(node.filePath));
  if (!index || !/\.html?$/i.test(index.filePath || index.name)) return null;

  const urls = new Map();
  const generatedUrls = new Set();
  for (const [path, item] of files) {
    const mime = previewMime(path);
    const content = String(item.content ?? "");
    const blob = content.startsWith("data:") || /\.css$/i.test(path)
      ? null
      : new Blob([content], { type: mime });
    const resourceUrl = blob ? URL.createObjectURL(blob) : (content.startsWith("data:") ? content : "");
    urls.set(path, resourceUrl);
    if (resourceUrl.startsWith("blob:")) generatedUrls.add(resourceUrl);
  }

  const resolvePath = (reference, fromPath) => {
    const raw = String(reference || "").trim();
    if (!raw || /^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(raw)) return null;
    const clean = raw.split(/[?#]/, 1)[0];
    let decoded;
    try { decoded = decodeURIComponent(clean); } catch { decoded = clean; }
    const parent = fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/")) : "";
    return normalizeProjectPath(decoded.startsWith("/") ? decoded : `${parent ? `${parent}/` : ""}${decoded}`);
  };
  const resolve = (reference, fromPath) => {
    const raw = String(reference || "").trim();
    if (!raw || /^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(raw)) return raw;
    const target = resolvePath(raw, fromPath);
    return urls.get(target) || raw;
  };
  const rewriteCss = (css, path) => css.replace(
    /url\(\s*(['"]?)(.*?)\1\s*\)/gi,
    (all, quote, ref) => `url("${resolve(ref, path)}")`,
  );

  const inlineCss = (css, path, importStack = new Set()) => {
    if (importStack.has(path)) return "";
    const nextStack = new Set(importStack).add(path);
    const withImports = String(css || "").replace(
      /@import\s+(?:url\(\s*)?(?:(['"])(.*?)\1|([^'"\s);]+))\s*\)?\s*([^;]*);/gi,
      (all, quote, quotedPath, unquotedPath, media = "") => {
        const reference = quotedPath || unquotedPath || "";
        const target = resolvePath(reference, path);
        const imported = files.get(target);
        if (!imported || !/\.css$/i.test(target) || nextStack.has(target)) {
          return all.replace(reference, resolve(reference, path));
        }
        const contents = inlineCss(imported.content, target, nextStack);
        return media.trim() ? `@media ${media.trim()} {\n${contents}\n}` : contents;
      },
    );
    return rewriteCss(withImports, path).replace(/<\/style/gi, "\\3C /style");
  };

  // Rewrite relative ES module imports to the matching imported resource URL.
  // This supports common static module graphs without requiring a project server.
  const moduleUrls = new Map();
  const moduleStack = new Set();
  const buildModuleUrl = (path) => {
    if (moduleUrls.has(path)) return moduleUrls.get(path);
    const item = files.get(path);
    if (!item || !/\.(?:m?js|cjs)$/i.test(path)) return urls.get(path);
    if (moduleStack.has(path)) return urls.get(path); // preserve circular edge as an original module URL
    moduleStack.add(path);
    const source = String(item.content || "").replace(
      /\b(from\s*|import\s*(?:\(\s*)?)(["'])(?:(\.{1,2}\/|\/))([^"']+)\2/g,
      (all, prefix, quote, pathPrefix, specifier) => {
        const target = normalizeProjectPath(pathPrefix === "/"
          ? `/${specifier}`
          : `${path.includes("/") ? path.slice(0, path.lastIndexOf("/")) + "/" : ""}${pathPrefix}${specifier}`);
        const url = files.has(target) ? buildModuleUrl(target) : resolve(`${pathPrefix}${specifier}`, path);
        return `${prefix}${quote}${url}${quote}`;
      },
    );
    moduleStack.delete(path);
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    generatedUrls.add(url);
    moduleUrls.set(path, url);
    urls.set(path, url);
    return url;
  };
  for (const path of files.keys()) {
    if (/\.(?:m?js|cjs)$/i.test(path)) buildModuleUrl(path);
  }

  let html = String(index.content || "");
  html = html.replace(/<base\b[^>]*>/gi, "");
  // Inline project stylesheets so the opaque sandboxed srcdoc can render them
  // without relying on cross-origin blob stylesheet requests.
  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    const rel = tag.match(/\brel\s*=\s*(["'])(.*?)\1/i)?.[2] || "";
    const hrefMatch = tag.match(/\bhref\s*=\s*(["'])(.*?)\1/i);
    if (!/\bstylesheet\b/i.test(rel) || !hrefMatch) return tag;
    const target = resolvePath(hrefMatch[2], index.filePath);
    const stylesheet = files.get(target);
    if (!stylesheet || !/\.css$/i.test(target)) return tag;
    const media = tag.match(/\bmedia\s*=\s*(["'])(.*?)\1/i)?.[2];
    return `<style${media ? ` media="${media.replace(/["&<>]/g, "")}"` : ""}>${inlineCss(stylesheet.content, target)}</style>`;
  });
  html = html.replace(/(<(?:script|link|img|source|video|audio|track|iframe|input)\b[^>]*?\b(?:src|href|poster)\s*=\s*)(["'])(.*?)\2/gi,
    (all, prefix, quote, ref) => `${prefix}${quote}${resolve(ref, index.filePath)}${quote}`);
  html = html.replace(/\bsrcset\s*=\s*(["'])(.*?)\1/gi, (all, quote, value) => `srcset=${quote}${value.split(",").map((part) => { const [url, ...descriptor] = part.trim().split(/\s+/); return [resolve(url, index.filePath), ...descriptor].join(" "); }).join(", ")}${quote}`);
  html = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (all, css) => all.replace(css, inlineCss(css, index.filePath)));
  html = html.replace(/\bstyle\s*=\s*(["'])(.*?)\1/gi, (all, quote, css) => `style=${quote}${rewriteCss(css, index.filePath)}${quote}`);
  return { html, revoke: () => generatedUrls.forEach((url) => URL.revokeObjectURL(url)) };
}

window.getMindmapProjectPreview = () => createProjectPreview(currentEditingNode);

// ============================================================
// MENU DE ADIÇÃO
// ============================================================

function closeAddMenu() {
  document.getElementById("mindmap-add-menu")?.remove();
  document.removeEventListener("pointerdown", onOutsideMenuClick);
}

function onOutsideMenuClick(event) {
  const menu = document.getElementById("mindmap-add-menu");
  if (menu?.contains(event.target)) return;
  closeAddMenu();
}

function createAddMenu(position = null) {
  closeAddMenu();

  const menu = document.createElement("div");
  menu.id = "mindmap-add-menu";

  const options = [
    {
      label: `＋ ${tr("newFile")}`,
      action: addBlankNode,
    },
    {
      label: `📁 ${tr("newFolder")}`,
      action: addFolder,
    },
    {
      label: `⇧ ${tr("importFiles")} / ${tr("importFolder")}`,
      action: () => {
        const chooser = document.createElement("div");
        chooser.id = "mindmap-import-choice";
        Object.assign(chooser.style, {
          position: "fixed", inset: "0", zIndex: "1000001",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,.55)"
        });
        const panel = document.createElement("div");
        Object.assign(panel.style, {
          display: "grid", gap: "8px", minWidth: "230px", padding: "16px",
          border: "1px solid var(--secondary-color,#5d00ff)", borderRadius: "10px",
          background: "#151515", color: "#fff"
        });
        const title = document.createElement("strong");
        title.textContent = tr("importFiles");
        const filesButton = document.createElement("button");
        filesButton.type = "button";
        filesButton.textContent = tr("importFiles");
        const folderButton = document.createElement("button");
        folderButton.type = "button";
        folderButton.textContent = tr("importFolder");
        const cancelButton = document.createElement("button");
        cancelButton.type = "button";
        cancelButton.textContent = tr("cancel");
        for (const button of [filesButton, folderButton, cancelButton]) {
          Object.assign(button.style, {
            padding: "9px 12px", borderRadius: "6px", border: "1px solid #444",
            background: "#242424", color: "#fff", cursor: "pointer", textAlign: "left"
          });
        }
        filesButton.addEventListener("click", () => { chooser.remove(); fileInput.click(); });
        folderButton.addEventListener("click", () => { chooser.remove(); folderInput.click(); });
        cancelButton.addEventListener("click", () => chooser.remove());
        chooser.addEventListener("click", (event) => { if (event.target === chooser) chooser.remove(); });
        panel.append(title, filesButton, folderButton, cancelButton);
        chooser.appendChild(panel);
        document.body.appendChild(chooser);
      },
    },
    {
      label: `✎ ${tr("workspaceRename")}`,
      action: renameWorkspace,
    },
    {
      label: `↔ ${connectMode ? tr("connectPrompt") : tr("mindMapConnectTitle")}`,
      action: () => {
        connectMode = !connectMode;
        connectSource = null;
        nodeLayer?.querySelectorAll(".selected").forEach((element) => {
          element.classList.remove("selected");
        });
      },
    },
    {
      label: `⌫ ${tr("mindMapClearTitle")}`,
      action: clearMap,
    },
  ];

  for (const option of options) {
    const item = document.createElement("button");
    item.type = "button";
    item.textContent = option.label;

    item.addEventListener("click", async () => {
      closeAddMenu();

      try {
        await option.action();
      } catch (error) {
        console.error(error);
        alert(tr("actionError"));
      }
    });

    menu.appendChild(item);
  }

  document.body.appendChild(menu);

  const rect = mind?.getBoundingClientRect();
  const menuX = Number.isFinite(position?.x) ? position.x : (rect?.left || 12) + 12;
  const menuY = Number.isFinite(position?.y) ? position.y : (rect?.top || 12) + 12;

  menu.style.left = `${Math.max(
    12,
    Math.min(menuX, window.innerWidth - menu.offsetWidth - 12),
  )}px`;

  menu.style.top = `${Math.max(
    12,
    Math.min(menuY, window.innerHeight - menu.offsetHeight - 12),
  )}px`;

  setTimeout(() => {
    document.addEventListener("pointerdown", onOutsideMenuClick);
  }, 0);
}

// ============================================================
// ABRIR ARQUIVO NO MONACO
// ============================================================

function updateSelectedNodeUI() {
  nodeLayer?.querySelectorAll(".mm-node").forEach((element) => {
    element.classList.toggle(
      "current-file",
      element.dataset.id === currentEditingNode?.id,
    );
  });
}

function setEditorLanguage(node) {
  const editor = window.editor;
  if (!editor || !editor.getModel()) return;

  const selected = node.languageOverride
    ? getWorkspaceLanguage(node.languageOverrideLabel)
    : getWorkspaceLanguageForFile(getWorkspacePath(node));
  const language = selected?.monaco || getLanguageFromFile(getWorkspacePath(node));

  if (window.monaco?.editor?.setModelLanguage) {
    window.monaco.editor.setModelLanguage(editor.getModel(), language);
  }

  const display = document.querySelector("#code-language h4");
  if (display && node.languageOverride) {
    display.textContent = node.languageOverrideLabel || selected?.label || "Texto";
  }
}

function syncCurrentEditorToMap() {
  if (
    !currentEditingNode ||
    !window.editor ||
    typeof window.editor.getValue !== "function"
  ) {
    return;
  }

  currentEditingNode.content = window.editor.getValue();

  saveState();
}

function openNodeInEditor(node) {
  if (!node || node.type === "folder") return;

  if (node.type === "image") {
    showImageViewer(node);
    return;
  }
  if (node.type === "binary") {
    showMap();
    updateSelectedNodeUI();
    return;
  }

  // Guarda o arquivo atual antes de trocar.
  syncCurrentEditorToMap();

  currentEditingNode = node;
  window.darkStudioWorkspaceCurrentFile = node;
  rememberActiveWorkspaceFile(node);
  try { localStorage.setItem("darkstudio-editor-session-mode", "workspace"); } catch {}
  window.dispatchEvent(new CustomEvent("darkstudio:workspace-file-opened", { detail: { nodeId: node.id, fileName: node.name } }));

  if (window.editor && typeof window.editor.setValue === "function") {
    window.editor.setValue(node.content || "");
    setEditorLanguage(node);
  } else {
    console.warn("DarkStudio: o Monaco Editor ainda não está disponível.");
  }

  closeImageViewer();
  updateSelectedNodeUI();
  showEditor();
}

function showEditor() {
  setWorkspaceManagerView(false);
  const details = document.getElementById("workspace-details-button");
  if (details) details.style.display = "none";
  document.getElementById("Website-Container")?.classList.remove("extensions-active");
  const extensionsPanel = document.getElementById("extensions-panel");
  if (extensionsPanel) extensionsPanel.hidden = true;
  if (mind) mind.style.display = "none";

  const editor = document.getElementById("main-content");
  const editorInput = document.getElementById("Editor-Input");
  const configPanel = document.getElementById("config");
  const extensionsView = document.getElementById("extensions-panel");
  if (editor) editor.style.display = "flex";
  if (editorInput) editorInput.hidden = false;
  if (configPanel) configPanel.hidden = true;
  if (extensionsView) extensionsView.hidden = true;

  const extensionsButton = document.getElementById("extensions-button");
  if (extensionsButton) extensionsButton.style.display = previousDisplays["extensions-button"] ?? "";

  for (const id of ["download-file"]) {
    const element = document.getElementById(id);

    if (!element) continue;

    element.style.display = previousDisplays[id] ?? "";
  }

  // Recalcula os botões conforme a linguagem do arquivo recém-aberto.
  // O Workspace pode tê-los ocultado ao alternar para a visão gráfica.
  window.darkStudioRefreshEditorUI?.();
}

function ensureCurrentEditorInWorkspace() {
  if (!window.editor || typeof window.editor.getValue !== "function") return;

  // Se o arquivo atual já está representado no Workspace, apenas sincroniza o conteúdo.
  if (currentEditingNode && nodes.some((node) => node.id === currentEditingNode.id)) {
    window.darkStudioWorkspaceCurrentFile = currentEditingNode;
    syncCurrentEditorToMap();
    return;
  }

  const languageLabel = document.querySelector("#code-language h4")?.textContent?.trim().toLowerCase() || "";
  const extensionByLanguage = {
    javascript: "js", "veloscript - pqpcara": "txt", python: "py", java: "java",
    html: "html", css: "css", "batch (bat/cmd)": "bat", arduino: "ino",
    json: "json", c: "c", "c++": "cpp", "c#": "cs", sql: "sql",
    kotlin: "kt", adb: "txt", sbv: "sbv", vcf: "vcf", markdown: "md",
    git: "git", texto: "txt", rust: "rs"
  };
  const extension = extensionByLanguage[languageLabel] || "txt";
  const name = `${tr("newFile")}.${extension}`;
  const existingNode = nodes.find((node) =>
    node.type !== "folder" && getWorkspacePath(node) === name
  );

  if (existingNode) {
    existingNode.content = window.editor.getValue();
    currentEditingNode = existingNode;
  } else {
    currentEditingNode = addNode(name, window.editor.getValue(), "text");
  }

  window.darkStudioWorkspaceCurrentFile = currentEditingNode;
  updateSelectedNodeUI();
  saveState();
}

function showMap() {
  document.getElementById("Website-Container")?.classList.remove("extensions-active");
  const extensionsPanel = document.getElementById("extensions-panel");
  if (extensionsPanel) extensionsPanel.hidden = true;
  ensureCurrentEditorInWorkspace();

  const editor = document.getElementById("main-content");
  const editorInput = document.getElementById("Editor-Input");
  const configPanel = document.getElementById("config");
  if (editorInput) editorInput.hidden = false;
  if (configPanel) configPanel.hidden = true;
  if (editor) editor.style.display = "none";
  if (mind) mind.style.display = "block";
  setWorkspaceManagerView(false);
  const details = document.getElementById("workspace-details-button");
  if (details) details.style.display = "block";

  for (const id of ["download-file"]) {
    const element = document.getElementById(id);

    if (!element) continue;

    previousDisplays[id] = getComputedStyle(element).display;
    element.style.display = "none";
  }

  const extensionsButton = document.getElementById("extensions-button");
  if (extensionsButton) {
    previousDisplays["extensions-button"] = getComputedStyle(extensionsButton).display;
    extensionsButton.style.display = "none";
  }

  renderNodes();
}

function closeImageViewer() {
  document.getElementById("mindmap-image-viewer")?.remove();

  const input = document.getElementById("Editor-Input");

  if (input) input.style.display = "block";
}

function showImageViewer(node) {
  closeImageViewer();

  const viewer = document.createElement("div");
  viewer.id = "mindmap-image-viewer";

  Object.assign(viewer.style, {
    position: "fixed",
    inset: "0",
    zIndex: "1000001",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "14px",
    padding: "20px",
    background: "rgba(0,0,0,.92)",
  });

  const image = document.createElement("img");
  image.src = node.content;
  image.alt = node.name;

  Object.assign(image.style, {
    maxWidth: "90vw",
    maxHeight: "80vh",
    objectFit: "contain",
    borderRadius: "8px",
  });

  const title = document.createElement("div");
  title.textContent = node.name;
  title.style.color = "#fff";

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = tr("closeImage");

  close.addEventListener("click", closeImageViewer);

  viewer.append(image, title, close);
  document.body.appendChild(viewer);
}

// ============================================================
// SALVAMENTO AUTOMÁTICO DO MONACO
// ============================================================

function installWorkspaceAutosave() {
  if (
    workspaceAutosaveInstalled ||
    !window.editor ||
    typeof window.editor.onDidChangeModelContent !== "function"
  ) {
    return;
  }

  workspaceAutosaveInstalled = true;

  window.editor.onDidChangeModelContent(() => {
    if (!currentEditingNode) return;

    currentEditingNode.content = window.editor.getValue();

    saveState();
  });
}

window.addEventListener("darkstudio:external-file-opened", () => {
  // O conteúdo do Workspace já foi salvo pelo autosave; não associe o arquivo
  // físico aberto à entrada virtual anterior.
  syncCurrentEditorToMap();
  currentEditingNode = null;
  window.darkStudioWorkspaceCurrentFile = null;
});

function waitForEditor() {
  if (window.editor) {
    installWorkspaceAutosave();
    setTimeout(() => {
      if (!currentEditingNode) restoreActiveWorkspaceFile();
    }, 400);
    return;
  }

  setTimeout(waitForEditor, 500);
}

// ============================================================
// APAGAR NÓS E LIMPAR MAPA
// ============================================================

function deleteNode(nodeId) {
  const deleted = getNode(nodeId);

  if (!deleted) return;

  // Remove a pasta e seus descendentes se for uma pasta.
  const idsToDelete = new Set([nodeId]);

  let changed = true;

  while (changed) {
    changed = false;

    for (const node of nodes) {
      if (
        node.parentFolderId &&
        idsToDelete.has(node.parentFolderId) &&
        !idsToDelete.has(node.id)
      ) {
        idsToDelete.add(node.id);
        changed = true;
      }
    }
  }

  nodes = nodes.filter((node) => !idsToDelete.has(node.id));

  connections = connections.filter(
    (connection) =>
      !idsToDelete.has(connection.from) && !idsToDelete.has(connection.to),
  );

  if (currentEditingNode && idsToDelete.has(currentEditingNode.id)) {
    currentEditingNode = null;
    window.darkStudioWorkspaceCurrentFile = null;
    rememberActiveWorkspaceFile(null);
    window.editor?.setValue?.("");
  }

  saveState();
  renderNodes();
}

function clearMap() {
  if (!confirm(tr("workspaceCleared"))) {
    return;
  }

  nodes = [];
  connections = [];
  currentEditingNode = null;
  window.darkStudioWorkspaceCurrentFile = null;
  rememberActiveWorkspaceFile(null);
  connectSource = null;
  connectMode = false;
  workspacePan = { x: 0, y: 0 };
  applyWorkspacePan();

  saveState();
  renderNodes();
}

// ============================================================
// CONFIGURAÇÃO DOS BOTÕES
// ============================================================

window.darkStudioHandleDroppedFiles = async (fileList) => {
  const files = Array.from(fileList || []);
  if (!files.length || !window.editor) return;
  const isTextFile = (file) => {
    const extension = file.name.split(".").pop().toLowerCase();
    return TEXT_FILE_EXTENSIONS.has(extension) || /^text\//i.test(file.type || "");
  };
  const file = files.find(isTextFile);
  if (!file) {
    alert(tr("editorDropTextOnly"));
    return;
  }
  window.editor.setValue(await file.text());
  const language = getWorkspaceLanguageForFile(file.name);
  const label = document.querySelector("#code-language h4");
  if (label && language?.label) label.textContent = language.label;
  window.darkStudioDroppedFileName = file.name;
  window.darkStudioWorkspaceCurrentFile = null;
};

function setupFileInputs() {
  fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.multiple = true;
  fileInput.accept = "*/*";
  fileInput.hidden = true;

  folderInput = document.createElement("input");
  folderInput.type = "file";
  folderInput.multiple = true;
  folderInput.setAttribute("webkitdirectory", "");
  folderInput.setAttribute("directory", "");
  folderInput.hidden = true;

  document.body.append(fileInput, folderInput);

  fileInput.addEventListener("change", async () => {
    try {
      await importWorkspaceFiles(fileInput.files);
    } catch (error) {
      console.error("Erro ao importar arquivos:", error);
      alert(tr("fileImportError"));
    } finally {
      fileInput.value = "";
    }
  });

  folderInput.addEventListener("change", async () => {
    try {
      await importWorkspaceFiles(folderInput.files, null, { replaceWorkspace: true });
    } catch (error) {
      console.error("Erro ao importar pasta:", error);
      alert(tr("folderImportError"));
    } finally {
      folderInput.value = "";
    }
  });
}

function showExplorerContextMenu(node, x, y) {
  document.getElementById("explorer-context-menu")?.remove();
  const menu = document.createElement("div");
  menu.id = "explorer-context-menu";
  Object.assign(menu.style, {
    position: "fixed",
    left: `${Math.max(8, Math.min(x, window.innerWidth - 230))}px`,
    top: `${Math.max(8, Math.min(y, window.innerHeight - 250))}px`,
    zIndex: "1000004", minWidth: "205px", padding: "6px",
    border: "1px solid var(--secondary-color, #5d00ff)", borderRadius: "8px",
    background: "#151515", color: "#fff", boxShadow: "0 12px 32px #0009",
  });

  const addAction = (label, action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    Object.assign(button.style, {
      display: "block", width: "100%", padding: "9px 10px", border: "0",
      borderRadius: "5px", background: "transparent", color: "inherit",
      textAlign: "left", font: "inherit", cursor: "pointer",
    });
    button.addEventListener("mouseenter", () => { button.style.background = "#ffffff18"; });
    button.addEventListener("mouseleave", () => { button.style.background = "transparent"; });
    button.addEventListener("click", async () => {
      menu.remove();
      try { await action(); }
      catch (error) { console.error(error); alert(tr("actionError")); }
    });
    menu.appendChild(button);
  };

  const parentFolder = node?.type === "folder" ? node : getParentFolder(node);
  addAction("＋ " + tr("newFile"), async () => {
    const name = (await showNameDialog("", tr("newFile")) || "").trim();
    if (!name) return;
    if (/[\\/]/.test(name)) { alert(tr("invalidName")); return; }
    const parentPath = parentFolder?.filePath || "";
    const filePath = parentPath ? `${parentPath}/${name}` : name;
    if (nodes.some((item) => item.filePath === filePath)) { alert(tr("fileExists")); return; }
    const file = addNode(name, "", "text", centerPosition((nodes.length % 8) * 18));
    file.filePath = filePath;
    if (parentFolder) attachNodeToFolder(file, parentFolder);
    saveState(); renderNodes();
    openNodeInEditor(file);
  });
  addAction("📁 " + tr("newFolder"), async () => {
    const name = (await showNameDialog("", tr("createFolder")) || "").trim();
    if (!name) return;
    if (/[\\/]/.test(name)) { alert(tr("invalidName")); return; }
    const parentPath = parentFolder?.filePath || "";
    const filePath = parentPath ? `${parentPath}/${name}` : name;
    if (nodes.some((item) => item.filePath === filePath)) { alert(tr("fileExists")); return; }
    const folder = addNode(name, "", "folder", centerPosition((nodes.length % 8) * 18));
    folder.filePath = filePath;
    if (parentFolder) attachNodeToFolder(folder, parentFolder);
    saveState(); renderNodes();
  });
  if (node) {
    addAction("✎ " + tr(node.type === "folder" ? "renameFolder" : "renameFile"), async () => {
      const name = (await showNameDialog(node.name, tr(node.type === "folder" ? "renameFolder" : "renameFile")) || "").trim();
      if (!name || name === node.name) return;
      if (node.type === "folder") renameFolderNode(node, name);
      else renameFileNode(node, name);
    });
    addAction("🗑 Apagar", () => {
      const detail = node.type === "folder" ? " e todo o conteúdo dela" : "";
      if (!confirm(`Deseja apagar "${node.name}"${detail}?`)) return;
      deleteNode(node.id);
    });
  }

  document.body.appendChild(menu);
  const close = (event) => {
    if (!menu.contains(event.target)) {
      menu.remove();
      document.removeEventListener("pointerdown", close, true);
    }
  };
  setTimeout(() => document.addEventListener("pointerdown", close, true), 0);
}

function wireUI() {
  const mapButton = document.getElementById("explorer-graph-button");
  const detailsButton = document.getElementById("workspace-details-button");
  if (detailsButton) detailsButton.style.display = "none";
  detailsButton?.addEventListener("click", () => {
    const isOpen = mind && getComputedStyle(mind).display !== "none";
    if (!isOpen) showMap();
    closeAddMenu();
    setWorkspaceManagerView(true);
  });

  mind?.addEventListener("pointerdown", beginWorkspacePan);

  mind?.addEventListener("contextmenu", (event) => {
    if (event.target.closest(".mm-node")) return;
    if (event.target !== mind && event.target !== nodeLayer && event.target !== svg) return;

    event.preventDefault();
    event.stopPropagation();
    createAddMenu({ x: event.clientX, y: event.clientY });
  });

  const explorer = document.getElementById("explorer");
  const explorerToggle = document.getElementById("explorer-toggle");
  explorerToggle?.addEventListener("click", () => {
    const isOpen = explorer?.classList.toggle("explorer-open") ?? false;
    explorerToggle.setAttribute("aria-expanded", String(isOpen));
  });
  const explorerFiles = document.getElementById("explorer-files");
  explorerFiles?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const button = target?.closest("button.explorer-file[data-node-id]");
    if (!button) return;
    const node = getNode(button.dataset.nodeId);
    if (!node) return;
    if (node.type === "folder") {
      toggleFolder(node);
      refreshExplorerList();
      return;
    }
    openNodeInEditor(node);
    if (node.type !== "image" && node.type !== "binary") {
      requestAnimationFrame(() => window.editor?.focus?.());
    }
  });
  explorerFiles?.addEventListener("dragstart", (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const button = target?.closest("button.explorer-file[data-node-id]");
    const node = button ? getNode(button.dataset.nodeId) : null;
    if (!node || !event.dataTransfer) return;
    event.dataTransfer.setData("application/x-darkstudio-node", node.id);
    event.dataTransfer.setData("text/plain", node.filePath || node.name);
    event.dataTransfer.effectAllowed = "move";
  });
  explorerFiles?.addEventListener("dragover", (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const button = target?.closest("button.explorer-file[data-node-id]");
    const folder = button ? getNode(button.dataset.nodeId) : null;
    if (event.dataTransfer?.types?.includes("application/x-darkstudio-node")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (folder?.type === "folder") button.classList.add("explorer-drop-target");
      else if (!target?.closest(".explorer-children") && !button) explorerFiles.classList.add("explorer-root-drop-target");
    } else if (event.dataTransfer?.types?.includes("Files")) {
      event.preventDefault();
      if (folder?.type === "folder") button.classList.add("explorer-drop-target");
    }
  });
  explorerFiles?.addEventListener("dragleave", (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    target?.closest("button.explorer-file")?.classList.remove("explorer-drop-target");
  });
  explorerFiles?.addEventListener("drop", async (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const button = target?.closest("button.explorer-file[data-node-id]");
    const buttonNode = button ? getNode(button.dataset.nodeId) : null;
    const childrenContainer = target?.closest(".explorer-children");
    const parentId = childrenContainer?.dataset.parentFolderId;
    const destinationFolder = buttonNode?.type === "folder"
      ? buttonNode
      : parentId ? getNode(parentId) : null;
    explorerFiles.querySelectorAll(".explorer-drop-target").forEach((item) => item.classList.remove("explorer-drop-target"));
    explorerFiles.classList.remove("explorer-root-drop-target");
    if (event.dataTransfer?.types?.includes("application/x-darkstudio-node")) {
      event.preventDefault();
      event.stopPropagation();
      const dragged = getNode(event.dataTransfer.getData("application/x-darkstudio-node"));
      if (!dragged) return;
      if (destinationFolder?.type === "folder") {
        moveNodeIntoExplorerFolder(dragged, destinationFolder);
      } else {
        moveNodeToExplorerRoot(dragged);
      }
    }
  });
  explorer?.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const button = target?.closest("button.explorer-file[data-node-id]");
    const node = button ? getNode(button.dataset.nodeId) : null;
    showExplorerContextMenu(node, event.clientX, event.clientY);
  });
  explorer?.addEventListener("dragover", (event) => {
    if (event.dataTransfer?.types?.includes("Files")) {
      event.preventDefault();
      explorer.classList.add("explorer-drop-target");
    }
  });
  for (const eventName of ["dragleave", "drop"]) {
    explorer?.addEventListener(eventName, () => {
      explorer.classList.remove("explorer-drop-target");
      document.getElementById("explorer-files")?.classList.remove("explorer-root-drop-target");
    });
  }

  if (mapButton) {
    mapButton.addEventListener("click", () => {
      const isOpen = mind && getComputedStyle(mind).display !== "none";

      if (isOpen && !workspaceManagerView) {
        showEditor();
      } else {
        closeAddMenu();
        showMap();
        setWorkspaceManagerView(false);
      }
    });
  }

  nodeLayer?.addEventListener("click", (event) => {
    if (event.target !== nodeLayer || !connectSource) return;

    getNodeElement(connectSource)?.classList.remove("selected");
    connectSource = null;
  });

  window.addEventListener("resize", updateConnections);
  window.addEventListener("darkstudio:languagechange", () => {
    const menu = document.getElementById("mindmap-add-menu");
    if (menu) createAddMenu();
  });
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================

async function initMindmap() {
  if (!mind || !nodeLayer || !svg) {
    console.warn(
      "DarkStudio: não encontrei os elementos do mapa mental no HTML.",
    );
    return;
  }

  injectStyles();
  loadState();
  await restoreStateFromIndexedDB();
  applyWorkspacePan();
  setupFileInputs();
  wireUI();
  renderNodes();
  updateWorkspaceNameUI();
  waitForEditor();

  devLog("DarkStudio Workspace inicializado.");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMindmap, {
    once: true,
  });
} else {
  initMindmap();
}

async function readDroppedFileEntry(fileEntry, relativePath, files) {
  const file = await new Promise((resolve, reject) => fileEntry.file(resolve, reject));
  try {
    Object.defineProperty(file, "webkitRelativePath", {
      configurable: true,
      value: relativePath,
    });
  } catch {
    // File objects are normally extensible; retain a wrapper for unusual browsers.
    const original = file;
    files.push(Object.assign(Object.create(original), original, {
      name: original.name,
      type: original.type,
      size: original.size,
      lastModified: original.lastModified,
      webkitRelativePath: relativePath,
      text: () => original.text(),
      arrayBuffer: () => original.arrayBuffer(),
      slice: (...args) => original.slice(...args),
    }));
    return;
  }
  files.push(file);
}

async function readDroppedEntry(entry, parentPath, files, directories) {
  const relativePath = [parentPath, entry.name].filter(Boolean).join("/");
  if (entry.isFile) {
    await readDroppedFileEntry(entry, relativePath, files);
    return;
  }
  if (!entry.isDirectory) return;

  directories.push(relativePath);
  const reader = entry.createReader();
  while (true) {
    const entries = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
    if (!entries.length) break;
    for (const child of entries) {
      await readDroppedEntry(child, relativePath, files, directories);
    }
  }
}

async function collectDroppedItems(dataTransfer) {
  const files = [];
  const directories = [];
  const items = Array.from(dataTransfer?.items || []);
  const entries = items.map((item) => item.webkitGetAsEntry?.()).filter(Boolean);

  if (entries.length) {
    for (const entry of entries) await readDroppedEntry(entry, "", files, directories);
  } else {
    files.push(...Array.from(dataTransfer?.files || []));
  }
  return { files, directories };
}

for (const eventName of ["dragenter", "dragover"]) {
  document.addEventListener(eventName, (event) => {
    if (event.dataTransfer?.types?.includes("Files")) event.preventDefault();
  });
}
document.addEventListener("drop", async (event) => {
  const dataTransfer = event.dataTransfer;
  if (!dataTransfer?.types?.includes("Files")) return;

  event.preventDefault();
  event.stopPropagation();
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  const row = target?.closest("button.explorer-file[data-node-id]");
  const candidate = row ? getNode(row.dataset.nodeId) : null;
  const childrenContainer = target?.closest(".explorer-children");
  const parentId = childrenContainer?.dataset.parentFolderId;
  const targetFolder = candidate?.type === "folder"
    ? candidate
    : parentId ? getNode(parentId) : null;

  try {
    const { files, directories } = await collectDroppedItems(dataTransfer);
    if (!files.length && !directories.length) return;
    await importWorkspaceFiles(files, targetFolder, {
      preserveRoot: true,
      directoryPaths: directories,
    });
    // Importar arquivos não deve trocar a tela para o modo gráfico.
  } catch (error) {
    console.error("Erro ao processar arquivos/pastas arrastados:", error);
    alert(tr("fileImportError"));
  } finally {
    document.querySelectorAll("#explorer .explorer-drop-target").forEach((item) => item.classList.remove("explorer-drop-target"));
    document.getElementById("explorer")?.classList.remove("explorer-drop-target");
    document.getElementById("explorer-files")?.classList.remove("explorer-root-drop-target");
  }
});

// API para a barra lateral alternar entre o editor e o mapa gráfico.
window.darkStudioShowWorkspaceMap = showMap;
window.darkStudioShowWorkspaceEditor = showEditor;

export {};
