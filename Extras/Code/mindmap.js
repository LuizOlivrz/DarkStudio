// Mapa Mental básico para DarkStudio
// Permite adicionar arquivos via file input, criar nós arrastáveis,
// conectar nós e abrir o conteúdo no editor ao clicar.

const STORAGE_KEY = "darkstudio_mindmap_v1";

let nodes = [];
let previousDisplays = {};
let connections = [];
let connectMode = false;
let connectSource = null;
const container = document.getElementById("mindmap-container");

const parentRect = container.getBoundingClientRect();

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, connections }));
  } catch (e) {
    console.warn("Could not save mindmap state:", e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    nodes = parsed.nodes || [];
    connections = parsed.connections || [];
  } catch (e) {
    console.warn("Could not load mindmap state:", e);
  }
}

function createStyle() {
  const css = `
  .mm-node{position:absolute;padding:10px 12px;border-radius:8px;background:rgba(30,30,30,0.95);color:#fff;border:1px solid rgba(255,255,255,0.06);cursor:grab;user-select:none;box-shadow:0 6px 18px rgba(0,0,0,0.6);display:flex;align-items:center;gap:8px}
  .mm-node.selected{outline:2px solid var(--accent-color,#ff6700)}
  .mm-node .name{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}
  .mm-node img.thumb{width:36px;height:36px;object-fit:cover;border-radius:6px}
  `;
  const s = document.createElement("style");
  s.id = "mindmap-styles";
  s.textContent = css;
  document.head.appendChild(s);
}

function createNodeElement(node) {
  const el = document.createElement("div");
  el.className = "mm-node";
  el.dataset.id = node.id;
  el.style.left = node.x + "px";
  el.style.top = node.y + "px";
  el.style.zIndex = 1000;

  if (node.type === "image") {
    const img = document.createElement("img");
    img.className = "thumb";
    img.src = node.content;
    img.alt = node.name;
    el.appendChild(img);

    // Hover preview (larger) — overlay attached to mindmap container
    el.addEventListener("mouseenter", (ev) => {
      try {
        const container = document.getElementById("mindmap-container");
        if (!container) return;
        let prev = document.getElementById("mindmap-hover-preview");
        if (prev) prev.remove();

        const rect = el.getBoundingClientRect();
        const parentRect = container.getBoundingClientRect();
        const cx = rect.left - parentRect.left + rect.width / 2;
        const cy = rect.top - parentRect.top + rect.height / 2;

        prev = document.createElement("div");
        prev.id = "mindmap-hover-preview";
        Object.assign(prev.style, {
          position: "absolute",
          left: cx + "px",
          top: cy + "px",
          transform: "translate(-50%, -120%)",
          pointerEvents: "none",
          zIndex: 99998,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "6px",
        });

        const largeImg = document.createElement("img");
        largeImg.src = node.content;
        largeImg.alt = node.name;
        Object.assign(largeImg.style, {
          maxWidth: "min(640px, 10vw)",
          maxHeight: "70vh",
          borderRadius: "8px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
          display: "block",
        });

        prev.appendChild(largeImg);
        container.appendChild(prev);
      } catch (e) {
        console.warn("preview error", e);
      }
    });

    el.addEventListener("mouseleave", () => {
      const prev = document.getElementById("mindmap-hover-preview");
      if (prev) prev.remove();
    });
  }

  const nameDiv = document.createElement("div");
  nameDiv.className = "name";
  nameDiv.textContent = node.name;
  el.appendChild(nameDiv);

  let offsetX = 0;
  let offsetY = 0;
  let dragging = false;
  let moved = false;

  el.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    moved = false;
    dragging = true;
    offsetX = e.clientX - el.getBoundingClientRect().left;
    offsetY = e.clientY - el.getBoundingClientRect().top;
    el.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    el.style.cursor = "grab";
    document.body.style.userSelect = "";
    const id = el.dataset.id;
    const rect = el.getBoundingClientRect();
    const parentRect = el.parentElement.getBoundingClientRect();
    const nodeObj = nodes.find((n) => n.id === id);
    if (nodeObj) {
      nodeObj.x = rect.left - parentRect.left;
      nodeObj.y = rect.top - parentRect.top;
      saveState();
      updateConnections();
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    moved = true;
    const parentRect = el.parentElement.getBoundingClientRect();

    let nx = e.clientX - parentRect.left - offsetX;
    let ny = e.clientY - parentRect.top - offsetY;

    const maxX = parentRect.width - el.offsetWidth;
    const maxY = parentRect.height - el.offsetHeight;

    nx = Math.max(0, Math.min(nx, maxX));
    ny = Math.max(0, Math.min(ny, maxY));
    el.style.left = nx + "px";
    el.style.top = ny + "px";
    updateConnections();
  });

  el.addEventListener("click", (e) => {
    e.stopPropagation();

    // foi arrastado, não abre
    if (moved) {
      moved = false;
      return;
    }

    if (connectMode) {
      handleConnectClick(node.id, el);
      return;
    }

    if (node.type !== "image") {
      openNodeInEditor(node);
    }
  });

  return el;
}

function handleConnectClick(id, el) {
  if (!connectSource) {
    connectSource = id;
    el.classList.add("selected");
    return;
  }
  if (connectSource === id) {
    // cancel
    const prev = document.querySelector(`.mm-node[data-id="${connectSource}"]`);
    if (prev) prev.classList.remove("selected");
    connectSource = null;
    return;
  }
  // create connection
  connections.push({ from: connectSource, to: id });
  const prev = document.querySelector(`.mm-node[data-id="${connectSource}"]`);
  if (prev) prev.classList.remove("selected");
  connectSource = null;
  saveState();
  updateConnections();
}

function openNodeInEditor(node) {
  // set editor value then switch to editor view
  try {
    const editor = document.getElementById("Editor");
    const editorInput = document.getElementById("Editor-Input");
    // if image, show image viewer overlay inside Editor
    if (node.type === "image") {
      // If mindmap is visible, show viewer over mindmap and keep map mode
      const mindVisible = mind && mind.style.display === "block";
      if (mindVisible) {
        let viewer = document.getElementById("mindmap-image-viewer");
        if (!viewer) {
          viewer = document.createElement("div");
          viewer.id = "mindmap-image-viewer";
          Object.assign(viewer.style, {
            position: "absolute",
            inset: "0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.85)",
            zIndex: 99999,
          });
          mind.appendChild(viewer);
        }
        viewer.innerHTML = `<div style=\"max-width:100%;max-height:100%;display:flex;flex-direction:column;align-items:center;gap:10px;padding:16px\"><img src=\"${node.content}\" style=\"max-width:90%;max-height:80vh;border-radius:6px\"/><button id=\"mindmap-close-image\">Fechar Imagem</button></div>`;
        const closeBtn = document.getElementById("mindmap-close-image");
        if (closeBtn) {
          closeBtn.addEventListener("click", () => {
            const v = document.getElementById("mindmap-image-viewer");
            if (v) v.remove();
            // keep mindmap visible — do not switch to editor
          });
        }
      } else {
        if (editorInput) editorInput.style.display = "none";
        let viewer = document.getElementById("mindmap-image-viewer");
        if (!viewer) {
          viewer = document.createElement("div");
          viewer.id = "mindmap-image-viewer";
          Object.assign(viewer.style, {
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#000",
          });
          editor.appendChild(viewer);
        }
        viewer.innerHTML = `<div style=\"max-width:100%;max-height:100%;display:flex;flex-direction:column;align-items:center;gap:10px\"><img src=\"${node.content}\" style=\"max-width:90%;max-height:80vh;border-radius:6px\"/><button id=\"mindmap-close-image\">Fechar Imagem</button></div>`;
        const closeBtn = document.getElementById("mindmap-close-image");
        if (closeBtn) {
          closeBtn.addEventListener("click", () => {
            viewer.remove();
            if (editorInput) editorInput.style.display = "block";
          });
        }
      }
    } else {
      if (window.editor && typeof window.editor.setValue === "function") {
        if (typeof node.content === "string")
          window.editor.setValue(node.content || "");
      }
      // ensure monaco/editor visible
      const viewer = document.getElementById("mindmap-image-viewer");
      if (viewer) viewer.remove();
      const editorInputEl = document.getElementById("Editor-Input");
      if (editorInputEl) editorInputEl.style.display = "block";
    }
  } catch (e) {
    console.warn("Editor not available:", e);
  }
  // show editor, hide mindmap
  const editorEl = document.getElementById("Editor");
  const mind = document.getElementById("mindmap-container");
  if (editorEl && mind) {
    mind.style.display = "none";
    editorEl.style.display = "block";
    document
      .getElementById("mindmap-add-files")
      ?.style.setProperty("display", "none");
    document
      .getElementById("mindmap-connect")
      ?.style.setProperty("display", "none");
    document
      .getElementById("mindmap-clear")
      ?.style.setProperty("display", "none");
  }
}

function updateConnections() {
  const svg = document.getElementById("mindmap-svg");
  svg.innerHTML = "";
  connections.forEach((c) => {
    const a = document.querySelector(`.mm-node[data-id="${c.from}"]`);
    const b = document.querySelector(`.mm-node[data-id="${c.to}"]`);
    if (!a || !b) return;
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    const parentRect = document
      .getElementById("mindmap-nodes")
      .getBoundingClientRect();
    const ax = ra.left - parentRect.left + ra.width / 2;
    const ay = ra.top - parentRect.top + ra.height / 2;
    const bx = rb.left - parentRect.left + rb.width / 2;
    const by = rb.top - parentRect.top + rb.height / 2;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", ax);
    line.setAttribute("y1", ay);
    line.setAttribute("x2", bx);
    line.setAttribute("y2", by);
    line.setAttribute("stroke", "rgba(200,200,200,0.35)");
    line.setAttribute("stroke-width", "2");
    svg.appendChild(line);
  });
}

function addNodeFromFile(name, content, px = 120, py = 120, type = "text") {
  const id = String(Date.now()) + Math.random().toString(36).slice(2, 8);
  const parent = document.getElementById("mindmap-nodes");
  const node = { id, name, content, x: px, y: py, type };
  nodes.push(node);
  const el = createNodeElement(node);
  parent.appendChild(el);
  saveState();
  updateConnections();
}

function clearMap() {
  nodes = [];
  connections = [];
  const parent = document.getElementById("mindmap-nodes");
  parent.innerHTML = "";
  updateConnections();
  saveState();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function initFromState() {
  const parent = document.getElementById("mindmap-nodes");
  parent.innerHTML = "";
  nodes.forEach((n) => {
    const el = createNodeElement(n);
    parent.appendChild(el);
  });
  updateConnections();
}

function wireUI() {
  const btn = document.getElementById("mindmap-button");
  const mind = document.getElementById("mindmap-container");
  const editor = document.getElementById("Editor");
  const addBtn = document.getElementById("mindmap-add-files");
  const connectBtn = document.getElementById("mindmap-connect");
  const clearBtn = document.getElementById("mindmap-clear");

  const hiddenInput = document.createElement("input");
  hiddenInput.type = "file";
  hiddenInput.multiple = true;
  hiddenInput.accept =
    ".js,.html,.css,.txt,.json,.java,.py,.cpp,.c,.cmd,.pyw,.sbv,.vcf,.bat,.md,image/*";
  hiddenInput.style.display = "none";
  document.body.appendChild(hiddenInput);

  hiddenInput.addEventListener("change", (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((f, idx) => {
      const reader = new FileReader();
      if (f.type && f.type.startsWith("image/")) {
        reader.onload = () => {
          const container = document.getElementById("mindmap-container");

          const px =
            container.clientWidth / 2 - 120 + (Math.random() * 120 - 60);

          const py =
            container.clientHeight / 2 - 60 + (Math.random() * 120 - 60);
          addNodeFromFile(f.name, reader.result, px, py, "image");
        };
        reader.readAsDataURL(f);
      } else {
        reader.onload = () => {
          const container = document.getElementById("mindmap-container");

          const px =
            container.clientWidth / 2 - 120 + (Math.random() * 120 - 60);

          const py =
            container.clientHeight / 2 - 60 + (Math.random() * 120 - 60);
          addNodeFromFile(f.name, reader.result, px, py, "text");
        };
        reader.readAsText(f);
      }
    });
    hiddenInput.value = "";
  });

  addBtn.addEventListener("click", () => hiddenInput.click());

  connectBtn.addEventListener("click", () => {
    connectMode = !connectMode;
    connectSource = null;
    connectBtn.textContent = connectMode
      ? "Conectando (clique em 2 nós)"
      : "Conectar";
  });

  clearBtn.addEventListener("click", () => {
    if (confirm("Limpar todo o mapa mental?")) clearMap();
  });

  let previousDisplays = {};

  btn.addEventListener("click", () => {
    const editorButtons = [
      "download-file",
      "load-button",
      "clear",
      "execute",
      "new-iframe-button",
    ];

    const mapButtons = [addBtn, connectBtn, clearBtn];

    const opening = mind.style.display === "none" || mind.style.display === "";

    if (opening) {
      // abrir mapa
      mind.style.display = "block";

      if (editor) {
        editor.style.display = "none";
      }

      // salvar estado atual dos botões normais
      previousDisplays = {};

      editorButtons.forEach((id) => {
        const el = document.getElementById(id);

        if (!el) return;

        previousDisplays[id] = getComputedStyle(el).display;

        el.style.display = "none";
      });

      // mostrar botões do mapa
      mapButtons.forEach((btn) => {
        if (btn) btn.style.display = "inline-block";
      });

      initFromState();
    } else {
      // fechar mapa
      mind.style.display = "none";

      if (editor) {
        editor.style.display = "block";
      }

      // esconder botões do mapa
      mapButtons.forEach((btn) => {
        if (btn) btn.style.display = "none";
      });

      // restaurar estado original dos botões normais
      editorButtons.forEach((id) => {
        const el = document.getElementById(id);

        if (!el) return;

        el.style.display = previousDisplays[id] || "";
      });
    }
  });

  // click on canvas clears connect selection
  const nodesParent = document.getElementById("mindmap-nodes");
  nodesParent.addEventListener("click", () => {
    if (connectSource) {
      const prev = document.querySelector(
        `.mm-node[data-id="${connectSource}"]`,
      );
      if (prev) prev.classList.remove("selected");
      connectSource = null;
    }
  });
}

function initMindmap() {
  createStyle();
  loadState();
  wireUI();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMindmap);
} else {
  initMindmap();
}

export {};
