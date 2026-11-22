const OWNER = "Tal do Lhuyz";
const OWNER_EMAIL = "luiz.olivrz@proton.me";
const STATE_KEY = "darkstudio.desktop-extensions.v1";
const PANIC_KEY = "darkstudio.extensions.panic.v1";
const VERIFIED = "✓";

const definitions = [
  { id: "darkstudio.gitlens", name: "GitLens", description: "Git, commits, diferenças, sincronização e grafo do repositório (somente desktop).", view: "git" },
  { id: "darkstudio.serial-lab", name: "Serial Monitor & Arduino", description: "Portas seriais, detecção de placas e upload com Arduino CLI (somente desktop).", view: "serial" },
  { id: "darkstudio.circuit-studio", name: "Circuit Studio", description: "Protótipo visual de placas e conexões; simulação lógica básica no navegador.", view: "circuit" },
];

const desktop = () => window.darkStudioDesktop?.isDesktop === true;
const readState = () => { try { return JSON.parse(localStorage.getItem(STATE_KEY) || "{}"); } catch { return {}; } };
const saveState = (value) => localStorage.setItem(STATE_KEY, JSON.stringify(value));
const el = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
const button = (text, action) => { const node = el("button", text); node.type = "button"; node.addEventListener("click", action); return node; };

export async function registerDesktopTools({ list, panicButton, customExtensions }) {
  if (!list || !desktop()) { panicButton?.remove(); return; }
  let state = readState();
  let panic = localStorage.getItem(PANIC_KEY) === "1";
  const cardNodes = new Map();
  const tools = new Map();
  const syncToolTabs = () => {
    const terminal = document.getElementById("desktop-terminal");
    const terminalTabs = terminal?.querySelector(".ds-terminal-tabs");
    if (!terminal || !terminalTabs) return;
    let tabs = terminal.querySelector(".ds-extension-tabs");
    if (!tabs) {
      tabs = el("nav", null, "ds-terminal-tabs ds-extension-tabs");
      tabs.setAttribute("aria-label", "Extensões do painel inferior");
      terminalTabs.insertAdjacentElement("afterend", tabs);
    }
    tabs.querySelectorAll("[data-ds-extension-tab]").forEach((node) => node.remove());
    const active = definitions.filter((definition) => state[definition.id] && !panic);
    if (!active.length) return;
    const addTab = (id, label, activate) => {
      const tab = button(label, activate);
      tab.className = "ds-terminal-tab ds-addon-terminal-tab";
      tab.dataset.dsExtensionTab = id;
      tab.dataset.toolTab = id;
      tab.setAttribute("aria-label", label);
      tabs.appendChild(tab);
    };
    const firstTool = tools.values().next().value;
    addTab("terminal", "Terminal", () => firstTool?.showTerminal());
    for (const definition of active) {
      addTab(definition.view, definition.name, () => { void window.darkStudioOpenDesktopExtension?.(definition.id); });
    }
  };

  const setPanic = (value) => {
    panic = value;
    localStorage.setItem(PANIC_KEY, value ? "1" : "0");
    if (panicButton) {
      panicButton.textContent = value ? "Reativar extensões habilitadas" : "Desativar todas as extensões";
      panicButton.setAttribute("aria-pressed", String(value));
      panicButton.classList.toggle("is-panic-active", value);
    }
    customExtensions?.(value);
    for (const [id, tool] of tools) {
      if (value) tool.stop?.();
      else if (state[id]) tool.start?.();
    }
    syncToolTabs();
    for (const [id, card] of cardNodes) renderCard(id, card);
  };
  window.addEventListener("darkstudio:extension-panic", (event) => setPanic(Boolean(event.detail?.active)));
  panicButton?.addEventListener("click", () => setPanic(!panic));

  const renderCard = (id, card) => {
    const enabled = Boolean(state[id]);
    const toggle = card.querySelector("button");
    toggle.textContent = enabled ? "Desativar" : "Ativar";
    toggle.disabled = panic;
    card.classList.toggle("is-disabled-by-panic", panic);
  };

  for (const definition of definitions) {
    const card = el("article", null, "ds-extension-card ds-bundled-extension");
    const info = el("div");
    const title = el("h2", definition.name);
    const description = el("p", definition.description);
    const author = el("p", null, "ds-extension-author");
    author.append(document.createTextNode(`${VERIFIED} `));
    const authorLink = el("a", OWNER);
    authorLink.href = `mailto:${OWNER_EMAIL}`;
    author.append(authorLink, document.createTextNode(` · ${OWNER_EMAIL}`));
    info.append(title, description, author);
    const toggle = button("Ativar", async () => {
      state[definition.id] = !state[definition.id];
      saveState(state);
      renderCard(definition.id, card);
      syncToolTabs();
      if (panic) return;
      if (state[definition.id]) await tool.start(); else tool.stop();
    });
    card.append(info, toggle);
    list.appendChild(card);
    cardNodes.set(definition.id, card);
    const tool = createTool(definition.view);
    tools.set(definition.id, tool);
    if (state[definition.id] && !panic) await tool.start();
    renderCard(definition.id, card);
  }
  window.darkStudioSyncDesktopExtensionTabs = syncToolTabs;
  window.darkStudioOpenDesktopExtension = async (id) => {
    const definition = definitions.find((item) => item.id === id);
    if (!definition || !state[id] || panic) {
      window.darkStudioSetActiveView?.("map");
      return false;
    }
    const tool = tools.get(id);
    if (tool) await tool.start();
    const terminal = document.getElementById("desktop-terminal");
    if (terminal?.hidden) window.dispatchEvent(new Event("darkstudio:toggle-terminal"));
    const tab = definition.view;
    terminal?.querySelector(`[data-tool-tab="${tab}"]`)?.click();
    return true;
  };
  setPanic(panic);
}

function createTool(view) {
  let root = null;
  let cleanup = () => {};
  let activeTab = view;
  async function ensureRoot() {
    if (!desktop()) throw new Error("Disponível somente no aplicativo desktop.");
    if (!document.getElementById("desktop-terminal")) window.dispatchEvent(new Event("darkstudio:toggle-terminal"));
    for (let tries = 0; tries < 40 && !document.getElementById("desktop-terminal"); tries++) await new Promise((resolve) => setTimeout(resolve, 50));
    const terminal = document.getElementById("desktop-terminal");
    if (!terminal) throw new Error("Não foi possível abrir o painel inferior.");
    let body = terminal.querySelector(".ds-tools-body");
    if (!body) {
      const body = el("div", null, "ds-tools-body");
      terminal.append(body);
      terminal.dataset.toolsInstalled = "true";
      document.head.appendChild(Object.assign(el("style"), { textContent: `#desktop-terminal{position:relative}#desktop-terminal .ds-tools-body{display:flex;flex:1;min-height:0;overflow:auto;padding:10px;box-sizing:border-box;font:13px 'Segoe UI',sans-serif;color:#ddd}#desktop-terminal .ds-tools-body[hidden]{display:none!important}#desktop-terminal .ds-terminal-body{display:none!important}#desktop-terminal .ds-tool-view{display:none;width:100%;min-width:0}#desktop-terminal .ds-tool-view.is-active{display:block}#desktop-terminal .ds-tool-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 10px}#desktop-terminal .ds-tool-row input,#desktop-terminal .ds-tool-row select,#desktop-terminal .ds-tool-view textarea{background:#1d1d1d;color:#eee;border:1px solid #555;border-radius:4px;padding:6px}#desktop-terminal .ds-tool-view button{background:#2d2d2d;color:#eee;border:1px solid #555;border-radius:4px;padding:6px 10px;cursor:pointer}#desktop-terminal .ds-tool-output{white-space:pre-wrap;overflow:auto;max-height:48vh;background:#101010;padding:8px;border-radius:4px;font:12px Consolas,monospace}#desktop-terminal .ds-tool-files{display:grid;grid-template-columns:minmax(120px,1fr) 2fr;gap:5px;margin:8px 0}#desktop-terminal .ds-tool-files button{text-align:left;overflow:hidden;text-overflow:ellipsis}#desktop-terminal .ds-circuit-board{position:relative;display:block;width:min(100%,900px);height:auto;aspect-ratio:9/5;min-height:320px;overflow:hidden;padding:0;background:#13281f;border:2px solid #5a9c71;border-radius:28px;touch-action:none}#desktop-terminal .ds-circuit-canvas{display:block;width:100%;height:100%;cursor:grab}#desktop-terminal .ds-circuit-canvas:active{cursor:grabbing}#desktop-terminal .ds-circuit-hint{color:#aaa;font-size:12px}#desktop-terminal .ds-circuit-tool-actions{display:flex;gap:8px;flex-wrap:wrap}#desktop-terminal .ds-addon-terminal-tab{flex:0 1 auto;width:auto;min-width:0;padding:4px 9px;font:12px 'Segoe UI',sans-serif;white-space:nowrap}` }));
      window.darkStudioSyncDesktopExtensionTabs?.();
    }
    body = terminal.querySelector(".ds-tools-body");
    root = body.querySelector(`[data-tool-view="${view}"]`);
    if (!root) { root = el("section", null, "ds-tool-view"); root.dataset.toolView = view; body.appendChild(root); }
    activateTab(activeTab);
    return root;
  }
  function activateTab(id) {
    activeTab = id;
    const terminal = document.getElementById("desktop-terminal");
    const showTerminal = id === "terminal";
    const toolsBody = terminal?.querySelector(".ds-tools-body");
    const terminalBody = terminal?.querySelector(".ds-terminal-body");
    if (toolsBody) toolsBody.hidden = showTerminal;
    if (terminalBody) terminalBody.style.setProperty("display", showTerminal ? "flex" : "none", "important");
    terminal?.querySelectorAll(".ds-tool-view").forEach((node) => node.classList.toggle("is-active", node.dataset.toolView === id));
    terminal?.querySelectorAll("[data-tool-tab]").forEach((node) => node.setAttribute("aria-selected", String(node.dataset.toolTab === id)));
  }
  const tool = {
    showTerminal: () => activateTab("terminal"),
    start: async () => {
      cleanup();
      root = await ensureRoot();
      root.replaceChildren();
      if (view === "git") cleanup = await renderGit(root, () => activateTab("git"));
      if (view === "serial") cleanup = await renderSerial(root, () => activateTab("serial"));
      if (view === "circuit") cleanup = await renderCircuit(root, () => activateTab("circuit"));
      activateTab(view);
    },
    stop: () => { cleanup(); cleanup = () => {}; root?.replaceChildren(); activateTab("terminal"); },
  };
  return tool;
}

async function renderGit(root, openTab) {
  const title = el("h3", "GitLens — repositório local");
  const controls = el("div", null, "ds-tool-row");
  const refresh = button("Atualizar", update);
  const login = button("Entrar no GitHub", async () => { const r = await window.darkStudioDesktop.gitAuthLogin(); if (!r.ok) status.textContent = r.message || "Instale GitHub CLI para autenticar."; await auth(); });
  const pull = button("Pull (fast-forward)", async () => { const r = await window.darkStudioDesktop.gitSync({ direction: "pull" }); status.textContent = r.message || (r.ok ? "Pull concluído." : "Falha no pull."); await update(); });
  const push = button("Push", async () => { const r = await window.darkStudioDesktop.gitSync({ direction: "push" }); status.textContent = r.message || (r.ok ? "Push concluído." : "Falha no push."); await update(); });
  const graphButton = button("Grafo", showGraph);
  const status = el("p", "Selecione uma pasta de workspace para começar.");
  const files = el("div", null, "ds-tool-files");
  const diff = el("pre", "", "ds-tool-output");
  const authOutput = el("pre", "", "ds-tool-output"); authOutput.hidden = true;
  const message = document.createElement("textarea"); message.placeholder = "Mensagem do commit"; message.rows = 2; message.style.width = "min(600px,100%)";
  const commit = button("Commit dos arquivos preparados", async () => { const result = await window.darkStudioDesktop.gitCommit({ message: message.value }); status.textContent = result.message || (result.ok ? "Commit criado." : "Falha ao criar commit."); if (result.ok) message.value = ""; await update(); });
  const graph = el("pre", "", "ds-tool-output"); graph.hidden = true;
  controls.append(refresh, login, pull, push, graphButton);
  root.append(title, controls, status, authOutput, files, message, commit, diff, graph);
  const unsubscribeAuthOutput = window.darkStudioDesktop.onGitAuthOutput((chunk) => {
    authOutput.hidden = false;
    authOutput.textContent = (authOutput.textContent + String(chunk || "")).slice(-8000);
  });
  async function auth() {
    const result = await window.darkStudioDesktop.gitAuthStatus();
    if (!result.ghInstalled) {
      status.textContent = "Para autenticar com GitHub, instale GitHub CLI pelo site oficial.";
      if (!controls.querySelector("[data-github-cli-download]")) {
        const install = button("Baixar GitHub CLI", () => window.darkStudioDesktop.gitOpenGhDownload());
        install.dataset.githubCliDownload = "true";
        controls.appendChild(install);
      }
    } else if (!result.authenticated && result.detail) status.textContent = result.detail;
  }
  async function update() {
    const result = await window.darkStudioDesktop.gitStatus();
    files.replaceChildren();
    if (!result.ok) {
      const msg = result.error === "git-missing" ? "Git não instalado. Instale pelo site oficial:" : result.error === "no-folder" ? "Abra a pasta do workspace com Ctrl+K e depois O." : result.error === "not-repository" ? "A pasta aberta não contém um repositório Git. Abra a raiz do repositório com Ctrl+K e depois O." : result.message || "Não foi possível ler o status Git.";
      status.textContent = msg;
      if (result.error === "git-missing" && !controls.querySelector("[data-git-install]")) { const link = button("Abrir downloads oficiais do Git", () => window.darkStudioDesktop.gitOpenDownload()); link.dataset.gitInstall = "true"; controls.append(link); }
      return;
    }
    status.textContent = `${result.root} · ${result.branch || "sem branch"} · ${result.ahead} à frente / ${result.behind} atrás`;
    for (const file of result.files) {
      const label = el("span", `${file.index}${file.worktree}  ${file.path}`);
      const actions = el("div", null, "ds-tool-row");
      const diffButton = button("Diff", async () => { const r = await window.darkStudioDesktop.gitDiff({ path: file.path, staged: file.index !== " " }); diff.textContent = r.diff || r.message || "Sem diferenças"; });
      const stageButton = button(file.index !== " " && file.index !== "?" ? "Tirar do stage" : "Preparar", async () => { await window.darkStudioDesktop.gitChangeIndex({ path: file.path, action: file.index !== " " && file.index !== "?" ? "unstage" : "stage" }); await update(); });
      actions.append(diffButton, stageButton); files.append(label, actions);
    }
  }
  async function showGraph() { openTab(); graph.hidden = false; const r = await window.darkStudioDesktop.gitGraph(); graph.textContent = r.rows?.join("\n") || r.message || (r.error === "no-folder" ? "Abra uma pasta de workspace." : "Sem commits para mostrar."); }
  update(); auth();
  return unsubscribeAuthOutput;
}

async function renderSerial(root) {
  const title = el("h3", "Monitor serial e Arduino");
  const controls = el("div", null, "ds-tool-row");
  const port = document.createElement("select");
  const baud = document.createElement("select");
  for (const value of [9600, 19200, 38400, 57600, 115200, 230400]) { const option = el("option", String(value)); option.value = String(value); if (value === 115200) option.selected = true; baud.append(option); }
  const refresh = button("Detectar placas / portas", detect);
  const start = button("Iniciar monitor", startMonitor);
  const stop = button("Parar", () => window.darkStudioDesktop.serialMonitorStop());
  controls.append(port, baud, refresh, start, stop);
  const output = el("pre", "", "ds-tool-output");
  const input = document.createElement("input"); input.placeholder = "Texto para enviar";
  const send = button("Enviar", async () => { const result = await window.darkStudioDesktop.serialMonitorSend({ port: port.value, data: input.value + "\n" }); if (!result.ok) output.textContent += `\n${result.message}`; else input.value = ""; });
  const uploadRow = el("div", null, "ds-tool-row");
  const fqbn = document.createElement("input"); fqbn.placeholder = "FQBN (ex.: arduino:avr:uno)"; fqbn.style.minWidth = "260px";
  const upload = button("Enviar código aberto à placa…", async () => {
    const content = window.editor?.getValue?.() || document.getElementById("Editor-Input")?.value || "";
    if (!content) { output.textContent += "\nAbra um sketch ou cole o código no editor."; return; }
    if (!confirm(`Enviar o código atual para ${fqbn.value} pela porta ${port.value}?`)) return;
    const result = await window.darkStudioDesktop.arduinoUpload({ fqbn: fqbn.value, port: port.value, content });
    output.textContent += `\n${result.output || ""}\n${result.message || (result.ok ? "Upload concluído." : "Falha no upload.")}`;
  });
  const cli = button("Instalar Arduino CLI (site oficial)", () => window.darkStudioDesktop.openArduinoCliDownload());
  uploadRow.append(fqbn, upload, cli);
  root.append(title, controls, el("p", "Selecione uma porta e baud rate. Envio físico exige confirmação."), input, send, uploadRow, output);
  const unsubscribe = window.darkStudioDesktop.onSerialData((data) => { output.textContent = (output.textContent + data).slice(-30000); output.scrollTop = output.scrollHeight; });
  async function detect() {
    port.replaceChildren();
    const [result, serialPorts] = await Promise.all([window.darkStudioDesktop.arduinoDetect(), window.darkStudioDesktop.serialList()]);
    if (!result.cliInstalled) output.textContent = `${result.message} Use o botão Arduino CLI para abrir a documentação oficial.`;
    for (const name of serialPorts.ports || result.ports || []) { const option = el("option", name); option.value = name; port.append(option); }
    const match = result.detected?.flatMap((entry) => entry.boards?.map((board) => ({ ...board, port: entry.port })) || []).find((entry) => entry.port === port.value) || result.detected?.flatMap((entry) => entry.boards?.map((board) => ({ ...board, port: entry.port })) || [])[0];
    if (match) { fqbn.value = match.fqbn; if ([...port.options].some((item) => item.value === match.port)) port.value = match.port; output.textContent = `Detectado: ${match.name} (${match.fqbn}) em ${match.port}`; }
    else if (result.cliInstalled) output.textContent = "Nenhuma placa reconhecida. Escolha a porta e informe o FQBN manualmente. Sem placa conectada, use Visualizar placa para testar conexões.";
  }
  async function startMonitor() { const result = await window.darkStudioDesktop.serialMonitorStart({ port: port.value, baud: Number(baud.value) }); if (!result.ok) output.textContent += `\n${result.message}`; else output.textContent += `\nMonitor aberto em ${result.port} (${result.baud}).`; }
  await detect();
  return () => { unsubscribe(); void window.darkStudioDesktop.serialMonitorStop(); };
}

async function renderCircuit(root) {
  const title = el("h3", "Visualizar placa — protótipo 2D superior");
  const row = el("div", null, "ds-tool-row");
  const board = document.createElement("select");
  for (const [label, id] of [["Arduino Uno", "uno"], ["ESP32 DevKit", "esp32"], ["Arduino Nano", "nano"]]) { const option = el("option", label); option.value = id; board.append(option); }
  const component = document.createElement("select");
  for (const item of ["LED", "Resistor", "LCD 16x2", "Botão"]) { const option = el("option", `Adicionar ${item}`); option.value = item; component.append(option); }
  let result;
  const components = [];
  const wires = [];
  let selectedComponent = null;
  let wireStart = null;
  let dragState = null;
  let sequence = 0;
  const canvas = document.createElement("canvas");
  canvas.className = "ds-circuit-canvas";
  canvas.width = 900; canvas.height = 500;
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Placa Arduino vista de cima; arraste componentes, use R para girar e conecte pinos com cliques.");
  const workspace = el("div", null, "ds-circuit-board"); workspace.appendChild(canvas);
  const context = canvas.getContext("2d");
  const run = button("Inspecionar o sketch aberto", () => {
    const source = window.editor?.getValue?.() || document.getElementById("Editor-Input")?.value || "";
    const modes = [...source.matchAll(/pinMode\s*\(\s*(\w+)\s*,\s*OUTPUT\s*\)/gi)].map((match) => match[1]);
    const levels = [...source.matchAll(/digitalWrite\s*\(\s*(\w+)\s*,\s*(HIGH|LOW)\s*\)/gi)].map((match) => `${match[1]}=${match[2]}`);
    result.textContent = modes.length || levels.length ? `Placa: ${board.selectedOptions[0].text}\nSaídas: ${modes.join(", ") || "não encontradas"}\nEstados encontrados: ${levels.join(", ") || "nenhum"}\nA ferramenta desenha placa e conexões em 2D; esta leitura do código é estática.` : "Não encontrei pinMode(..., OUTPUT) ou digitalWrite(...).";
  });
  const add = button("Adicionar componente", () => {
    const type = component.value;
    const item = { id: `part-${++sequence}`, type, x: 405 + (sequence % 4) * 34, y: 210 + (sequence % 3) * 32, angle: 0 };
    components.push(item); selectedComponent = item.id; draw();
  });
  const rotate = button("Girar 90°", () => { const item = components.find((part) => part.id === selectedComponent); if (item) { item.angle = (item.angle + 90) % 360; draw(); } });
  const remove = button("Remover selecionado", () => {
    if (!selectedComponent) return;
    components.splice(components.findIndex((part) => part.id === selectedComponent), 1);
    for (let index = wires.length - 1; index >= 0; index--) if (wires[index].a.id === selectedComponent || wires[index].b.id === selectedComponent) wires.splice(index, 1);
    selectedComponent = null; draw();
  });
  const actions = el("div", null, "ds-circuit-tool-actions"); actions.append(add, rotate, remove, run);
  row.append(board, component, actions);
  result = el("pre", "Clique em dois pinos/conectores para ligar um fio. Arraste componentes e selecione para girar.", "ds-tool-output");
  const coordinate = (event) => { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * 900 / rect.width, y: (event.clientY - rect.top) * 500 / rect.height }; };
  const pins = () => {
    const count = board.value === "esp32" ? 18 : 16;
    const left = Array.from({ length: count }, (_, index) => ({ id: `L${index}`, label: board.value === "esp32" ? `GPIO${index}` : `D${index}`, x: 123, y: 132 + index * 14 }));
    const right = Array.from({ length: count }, (_, index) => ({ id: `R${index}`, label: board.value === "esp32" ? `GPIO${index + 18}` : index < 6 ? `A${index}` : `P${index}`, x: 777, y: 132 + index * 14 }));
    return [...left, ...right];
  };
  const partTerminals = (part) => {
    const angle = part.angle * Math.PI / 180;
    return [-1, 1].map((side) => ({ kind: "component", id: part.id, side, label: `${part.type} ${part.id.slice(-1)}`, x: part.x + Math.cos(angle) * side * 30, y: part.y + Math.sin(angle) * side * 30 }));
  };
  const allTerminals = () => [...pins().map((pin) => ({ ...pin, kind: "pin" })), ...components.flatMap(partTerminals)];
  const endpoint = (reference) => allTerminals().find((terminal) => terminal.id === reference.id && (terminal.kind !== "component" || terminal.side === reference.side));
  function drawBoard() {
    const ctx = context;
    ctx.clearRect(0, 0, 900, 500);
    const boardColor = board.value === "esp32" ? "#174b45" : "#178a63";
    ctx.fillStyle = boardColor; ctx.strokeStyle = "#7db5a0"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(64, 35, 772, 430, 24); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#0e5f47"; ctx.fillRect(109, 91, 682, 328);
    for (const [x, y] of [[84, 55], [816, 55], [84, 445], [816, 445]]) { ctx.fillStyle = "#d6c68a"; ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#15231f"; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#d1d6cf"; ctx.fillRect(13, 205, 83, 92); ctx.fillStyle = "#89938c"; ctx.fillRect(18, 216, 46, 68); ctx.fillStyle = "#252b29"; ctx.fillRect(38, 229, 46, 41);
    ctx.fillStyle = "#171b1a"; ctx.fillRect(299, 190, 212, 132); ctx.strokeStyle = "#adb6b1"; ctx.lineWidth = 2; ctx.strokeRect(299, 190, 212, 132);
    ctx.fillStyle = "#252a28"; ctx.fillRect(351, 220, 104, 76); ctx.fillStyle = "#83918a"; ctx.font = "14px Consolas"; ctx.fillText(board.value === "esp32" ? "ESP32" : "ATMEGA328P", 360, 260);
    ctx.fillStyle = "#252b29"; ctx.fillRect(156, 354, 232, 40); ctx.fillStyle = "#b1beb6"; ctx.font = "bold 17px Segoe UI"; ctx.fillText(board.value === "esp32" ? "ESP32 DEVKIT" : board.value === "nano" ? "ARDUINO NANO" : "ARDUINO UNO", 165, 380);
    ctx.fillStyle = "#1e2522"; ctx.fillRect(690, 355, 62, 36); ctx.fillStyle = "#c9c5a3"; ctx.fillRect(707, 364, 27, 18);
    ctx.fillStyle = "#d6c68a"; ctx.font = "10px Consolas";
    for (const pin of pins()) { ctx.beginPath(); ctx.arc(pin.x, pin.y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.fillText(pin.label, pin.x + (pin.x < 450 ? -30 : 9), pin.y + 3); }
    ctx.fillStyle = "#d2d5d0"; ctx.beginPath(); ctx.arc(236, 113, 8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#27352e"; ctx.fillText("RESET", 250, 117);
  }
  function drawParts() {
    const ctx = context;
    for (const part of components) {
      ctx.save(); ctx.translate(part.x, part.y); ctx.rotate(part.angle * Math.PI / 180);
      ctx.shadowColor = "#0009"; ctx.shadowBlur = 9; ctx.shadowOffsetY = 3;
      if (part.type === "LED") {
        ctx.strokeStyle = "#c5c9c3"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-31, 0); ctx.lineTo(31, 0); ctx.stroke();
        ctx.fillStyle = "#dc4949"; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#f4aaaa"; ctx.stroke();
        ctx.fillStyle = "#fff8"; ctx.beginPath(); ctx.arc(-5, -6, 4, 0, Math.PI * 2); ctx.fill();
      } else if (part.type === "Resistor") {
        ctx.strokeStyle = "#c5c9c3"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-38, 0); ctx.lineTo(38, 0); ctx.stroke();
        ctx.fillStyle = "#d8bd86"; ctx.fillRect(-24, -9, 48, 18); ctx.strokeStyle = "#937347"; ctx.strokeRect(-24, -9, 48, 18);
        for (const x of [-13, -3, 8, 17]) { ctx.fillStyle = x === 8 ? "#bd4a30" : "#593b24"; ctx.fillRect(x, -9, 3, 18); }
      } else if (part.type === "LCD 16x2") {
        ctx.fillStyle = "#252d30"; ctx.fillRect(-54, -31, 108, 62); ctx.strokeStyle = "#b7c5c7"; ctx.strokeRect(-54, -31, 108, 62);
        ctx.fillStyle = "#477f68"; ctx.fillRect(-42, -19, 84, 38); ctx.fillStyle = "#bbebc8"; ctx.font = "8px monospace"; ctx.fillText("HELLO WORLD", -35, -2); ctx.fillText("16x2 DISPLAY", -35, 11);
      } else {
        ctx.fillStyle = "#353a3e"; ctx.fillRect(-22, -22, 44, 44); ctx.strokeStyle = "#c4c9c7"; ctx.strokeRect(-22, -22, 44, 44);
        ctx.fillStyle = "#c7c7c2"; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      if (part.id === selectedComponent) { ctx.save(); ctx.strokeStyle = "#ffd45b"; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(part.x, part.y, part.type === "LCD 16x2" ? 66 : 42, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    }
  }
  function draw() {
    drawBoard();
    const ctx = context;
    for (const wire of wires) {
      const a = endpoint(wire.a), b = endpoint(wire.b);
      if (!a || !b) continue;
      ctx.strokeStyle = wire.color; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo((a.x + b.x) / 2, a.y); ctx.lineTo((a.x + b.x) / 2, b.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    const terminals = allTerminals();
    for (const terminal of terminals.filter((entry) => entry.kind === "component")) { ctx.fillStyle = "#e8d79b"; ctx.beginPath(); ctx.arc(terminal.x, terminal.y, 4, 0, Math.PI * 2); ctx.fill(); }
    if (wireStart) { const start = endpoint(wireStart); if (start) { ctx.strokeStyle = "#ffe071"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(start.x, start.y, 9, 0, Math.PI * 2); ctx.stroke(); } }
    drawParts();
  }
  function hitTerminal(point) { return allTerminals().find((terminal) => Math.hypot(point.x - terminal.x, point.y - terminal.y) < 11); }
  function hitPart(point) {
    return [...components].reverse().find((part) => {
      const angle = -part.angle * Math.PI / 180;
      const dx = point.x - part.x, dy = point.y - part.y;
      const x = dx * Math.cos(angle) - dy * Math.sin(angle), y = dx * Math.sin(angle) + dy * Math.cos(angle);
      const halfWidth = part.type === "LCD 16x2" ? 55 : part.type === "Resistor" ? 30 : 23;
      const halfHeight = part.type === "LCD 16x2" ? 32 : part.type === "Resistor" ? 12 : 23;
      return Math.abs(x) <= halfWidth && Math.abs(y) <= halfHeight;
    });
  }
  canvas.addEventListener("pointerdown", (event) => {
    const point = coordinate(event);
    const terminal = hitTerminal(point);
    if (terminal) {
      const ref = { kind: terminal.kind, id: terminal.id, ...(terminal.side == null ? {} : { side: terminal.side }) };
      if (!wireStart) { wireStart = ref; result.textContent = `Conector selecionado: ${terminal.label}. Clique em outro pino ou componente.`; }
      else if (wireStart.id !== ref.id || wireStart.side !== ref.side) { wires.push({ a: wireStart, b: ref, color: ["#f44336", "#32a6ff", "#f0c342", "#e8e8e8"][wires.length % 4] }); wireStart = null; result.textContent = `Fio adicionado. ${wires.length} conexão(ões) desenhada(s).`; }
      else wireStart = null;
      draw(); return;
    }
    const part = hitPart(point);
    if (part) {
      selectedComponent = part.id;
      dragState = { id: part.id, dx: point.x - part.x, dy: point.y - part.y };
      canvas.setPointerCapture(event.pointerId); draw(); return;
    }
    wireStart = null; selectedComponent = null; draw();
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragState) return;
    const part = components.find((entry) => entry.id === dragState.id);
    if (!part) return;
    const point = coordinate(event); part.x = Math.max(90, Math.min(810, point.x - dragState.dx)); part.y = Math.max(70, Math.min(430, point.y - dragState.dy)); draw();
  });
  canvas.addEventListener("pointerup", () => { dragState = null; });
  canvas.addEventListener("keydown", (event) => { if (event.key.toLowerCase() === "r" && selectedComponent) { event.preventDefault(); rotate.click(); } });
  board.addEventListener("change", () => { wires.splice(0); wireStart = null; draw(); });
  root.append(title, row, workspace, el("p", "Desenho superior 2D. Arraste as peças, selecione e gire (botão ou tecla R); clique em dois pinos/conectores para desenhar fios.", "ds-circuit-hint"), result);
  draw();
  return () => {};
}
