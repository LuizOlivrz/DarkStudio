// ============================================================
// DarkStudio — Mind Map + Project Workspace
// Workspace visual, arquivos, pastas, conexões e Monaco Editor
// ============================================================

import { devLog } from "./config.js";
import {
  TEXT_FILE_EXTENSIONS,
  WORKSPACE_LANGUAGES,
  getWorkspaceLanguage,
  getWorkspaceLanguageForFile,
  getFileExtension,
  getLanguageFromFile,
} from "./workspace-language.js";
const STORAGE_KEY = "darkstudio_mindmap_v1";
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
function saveState() {
  const snapshot = getWorkspaceSnapshot();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      nodes, connections, workspaceName, workspaceDescription, workspaceTags, workspacePan,
    }));
    const workspaces = readWorkspaceRegistry();
    const index = workspaces.findIndex((item) => item.id === workspaceId);
    if (index >= 0) workspaces[index] = snapshot; else workspaces.push(snapshot);
    localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces));
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
  } catch (error) {
    console.warn("DarkStudio: não foi possível salvar o Workspace.", error);
  }
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
  try {
    const db = await openWorkspaceDB();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("workspace", "readwrite");
      transaction.objectStore("workspace").put(getWorkspaceSnapshot(), workspaceId || "current");
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch (error) {
    // localStorage remains the fallback for browsers with IndexedDB disabled.
    console.warn("DarkStudio: persistência ampliada indisponível.", error);
  }
}

async function restoreStateFromIndexedDB() {
  try {
    const db = await openWorkspaceDB();
    const saved = await new Promise((resolve, reject) => {
      const request = db.transaction("workspace", "readonly").objectStore("workspace").get(workspaceId || "current");
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    if (!saved || !Array.isArray(saved.nodes)) return;
    if (Number.isFinite(saved.workspacePan?.x) && Number.isFinite(saved.workspacePan?.y)) {
      workspacePan = { x: saved.workspacePan.x, y: saved.workspacePan.y };
    }
    normalizeWorkspaceData(saved);
  } catch (error) {
    console.warn("DarkStudio: não foi possível restaurar o Workspace ampliado.", error);
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

function activateWorkspace(id) {
  const target = readWorkspaceRegistry().find((item) => item.id === id); if (!target) return;
  if (id !== workspaceId) {
    syncCurrentEditorToMap(); saveState(); workspaceId = target.id;
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId); normalizeWorkspaceData(target);
    currentEditingNode = null; connectMode = false; connectSource = null; applyWorkspacePan(); saveState();
  }
  setWorkspaceManagerView(false); renderNodes(); updateWorkspaceNameUI();
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
    input.value = initialName;
    input.maxLength = 100;
    input.placeholder = tr("namePlaceholder");
    input.autocomplete = "off";

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
      if (event.key === "Escape") finish(null);
    });

    actions.append(cancel, confirm);
    form.append(heading, input, actions);
    overlay.appendChild(form);
    document.body.appendChild(overlay);

    input.focus();
    input.select();
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

  if (node.type === "image") {
    const image = document.createElement("img");
    image.className = "thumb";
    image.src = node.content;
    image.alt = node.name;
    element.appendChild(image);
  } else {
    const icon = document.createElement("span");
    icon.className = "mm-icon";
    icon.textContent =
      node.type === "folder"
        ? node.isOpen === false
          ? "📁"
          : "📂"
        : getNodeIcon(node);
    element.appendChild(icon);
  }

  const label = document.createElement("div");
  label.className = "name";
  label.textContent = node.name;
  element.appendChild(label);

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

function getNodeIcon(node) {
  const extension = getFileExtension(node.name);

  const icons = {
    js: "🟨",
    mjs: "🟨",
    ts: "🔷",
    html: "🌐",
    htm: "🌐",
    css: "🎨",
    json: "🧩",
    md: "📝",
    py: "🐍",
    java: "☕",
    png: "🖼️",
    jpg: "🖼️",
    jpeg: "🖼️",
    gif: "🖼️",
    svg: "🖼️",
    txt: "📄",
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
  if (!nodes.length) {
    const empty = document.createElement("div");
    empty.className = "explorer-empty";
    empty.textContent = tr("explorerEmpty");
    list.appendChild(empty);
    return;
  }

  const depthOf = (node) => {
    let depth = 0;
    let parent = getParentFolder(node);
    const visited = new Set([node.id]);
    while (parent && !visited.has(parent.id)) {
      visited.add(parent.id);
      depth++;
      parent = getParentFolder(parent);
    }
    return depth;
  };
  const ordered = [...nodes].sort((a, b) => {
    const pathA = String(a.filePath || a.name).toLowerCase();
    const pathB = String(b.filePath || b.name).toLowerCase();
    return pathA.localeCompare(pathB);
  });

  for (const node of ordered) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "explorer-file";
    item.setAttribute("role", "listitem");
    item.dataset.nodeId = node.id;
    item.title = node.filePath || node.name;
    item.style.paddingInlineStart = `${8 + depthOf(node) * 16}px`;
    item.hidden = isInsideClosedFolder(node);
    const prefix = node.type === "folder"
      ? (node.isOpen === false ? "▸ " : "▾ ")
      : node.type === "image" ? "▧ " : node.type === "binary" ? "▤ " : "· ";
    item.textContent = prefix + node.name;
    list.appendChild(item);
  }
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

async function importWorkspaceFiles(fileList) {
  const files = Array.from(fileList || []);

  if (!files.length) return;

  const isDirectoryImport = files.some((file) => file.webkitRelativePath);

  let rootName = "";

  if (isDirectoryImport) {
    const firstPath = files.find(
      (file) => file.webkitRelativePath,
    )?.webkitRelativePath;

    rootName = firstPath?.split("/")[0] || "";

    if (!rootName || files.some((file) => !file.webkitRelativePath)) {
      throw new Error("Não foi possível identificar a pasta importada.");
    }
  }

  // Read every file before mutating the current workspace. A failed import
  // leaves the existing project untouched.
  const prepared = [];
  for (const file of files) {
    const sourcePath = file.webkitRelativePath || file.name;

    const parts = sourcePath.replace(/\\/g, "/").split("/").filter((part) => part && part !== ".");
    if (parts.some((part) => part === "..")) continue;

    if (isDirectoryImport && parts[0] === rootName) {
      parts.shift();
    }

    if (!parts.length) continue;

    const filename = parts.pop();
    const directoryPath = parts.join("/");
    const filePath = [...parts, filename].join("/");
    prepared.push({ file, filename, directoryPath, filePath, content: await readFileContent(file) });
  }

  if (!prepared.length) throw new Error("A pasta não contém arquivos importáveis.");

  // Importing a directory represents opening a new project: replace all old
  // nodes and edges only after the complete directory was read successfully.
  if (isDirectoryImport) {
    syncCurrentEditorToMap();
    nodes = [];
    connections = [];
    currentEditingNode = null;
    connectSource = null;
    connectMode = false;
    closeImageViewer();
  }

  let importedCount = 0;
  const seenPaths = new Set();
  for (const entry of prepared) {
    if (seenPaths.has(entry.filePath)) continue;
    seenPaths.add(entry.filePath);
    // Um caminho já existente representa o mesmo arquivo do projeto; evite duplicá-lo.
    if (!isDirectoryImport && nodes.some((node) => (node.filePath || node.name) === entry.filePath)) continue;
    const parent = entry.directoryPath ? ensureFolderPath(entry.directoryPath) : null;
    const isImage = Boolean(entry.file.type && entry.file.type.startsWith("image/"));
    const extension = entry.filename.split(".").pop().toLowerCase();
    const isText = TEXT_FILE_EXTENSIONS.has(extension) || /^text\//i.test(entry.file.type || "");
    const node = addNode(
      entry.filename,
      entry.content,
      isImage ? "image" : isText ? "text" : "binary",
      centerPosition((nodes.length % 8) * 18),
    );

    node.filePath = entry.filePath;

    if (parent) {
      attachNodeToFolder(node, parent);
    }

    importedCount++;
  }

  if (rootName) {
    workspaceName = rootName;
  }

  saveState();
  renderNodes();

  console.info(`DarkStudio: ${importedCount} arquivo(s) importado(s).`);
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

  for (const id of [
    "download-file",
    "clear",
    "execute",
    "new-iframe-button",
  ]) {
    const element = document.getElementById(id);

    if (!element) continue;

    element.style.display = previousDisplays[id] ?? "";
  }
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

  for (const id of [
    "download-file",
    "clear",
    "execute",
    "new-iframe-button",
  ]) {
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

function waitForEditor() {
  if (window.editor) {
    installWorkspaceAutosave();
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
      await importWorkspaceFiles(folderInput.files);
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
    const extension = getFileExtension(name);
    const type = TEXT_FILE_EXTENSIONS.has(extension) ? "text" : "binary";
    const file = addNode(name, "", type, centerPosition((nodes.length % 8) * 18));
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
  const explorer = document.getElementById("explorer");
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
    explorer?.addEventListener(eventName, () => explorer.classList.remove("explorer-drop-target"));
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

for (const eventName of ["dragenter", "dragover"]) {
  document.addEventListener(eventName, (event) => {
    if (event.dataTransfer?.types?.includes("Files")) event.preventDefault();
  });
}
document.addEventListener("drop", async (event) => {
  const files = event.dataTransfer?.files;
  if (!files?.length) return;
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  const droppedOnExplorer = Boolean(target?.closest("#explorer, #explorer-files"));
  const droppedOnEditor = Boolean(target?.closest("#Editor, #Editor-Input, .monaco-editor"));
  if (!droppedOnExplorer && !droppedOnEditor) return;
  event.preventDefault();
  event.stopPropagation();
  try {
    if (droppedOnExplorer) {
      await importWorkspaceFiles(files);
      showMap();
    } else {
      await window.darkStudioHandleDroppedFiles?.(files);
    }
  } catch (error) {
    console.error("Erro ao processar arquivos arrastados:", error);
    alert(tr("fileImportError"));
  }
});

export {};
