// Desktop-only bridge injected into the renderer. It never exposes filesystem paths or arbitrary file access.
(() => {
  if (!window.darkStudioDesktop?.isDesktop) return;

  const extensionForCurrentEditor = () => {
    const language = document.querySelector("#code-language h4")?.textContent?.trim()?.toLowerCase();
    const extensions = { javascript: "js", html: "html", css: "css", json: "json", python: "py", java: "java", "c++": "cpp", c: "c", "c#": "cs", sql: "sql", markdown: "md", rust: "rs" };
    return extensions[language] || "txt";
  };

  document.addEventListener("click", async (event) => {
    const loadButton = event.target.closest?.("#load-button");
    const saveButton = event.target.closest?.("#save-button");
    if (!loadButton && !saveButton) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    try {
      if (loadButton) {
        const file = await window.darkStudioDesktop.openFile();
        if (!file) return;
        if (window.editor?.setValue) {
          window.editor.setValue(file.content);
          window.editor.focus?.();
        }
        window.dispatchEvent(new CustomEvent("darkstudio:file-opened", { detail: { fileName: file.fileName } }));
        return;
      }

      if (saveButton) {
        const content = window.editor?.getValue?.();
        if (typeof content !== "string") return;
        await window.darkStudioDesktop.saveFile({
          content,
          extension: extensionForCurrentEditor(),
          defaultName: `untitled.${extensionForCurrentEditor()}`
        });
      }
    } catch (error) {
      console.error("DarkStudio desktop file operation failed.", error);
    }
  }, true);


  // Terminal CMD integrado: disponível somente no aplicativo Electron.
  if (document.getElementById("desktop-terminal")) return;

  const terminalStyles = document.createElement("style");
  terminalStyles.id = "desktop-terminal-styles";
  terminalStyles.textContent = [
    "#Website-Container.desktop-terminal-open { grid-template-rows: minmax(0, 1fr) minmax(160px, 32vh) !important; }",
    "#Website-Container.desktop-terminal-open #main-content, #Website-Container.desktop-terminal-open #options, #Website-Container.desktop-terminal-open #chat { height: 100% !important; min-height: 0 !important; }",
    "#Website-Container.desktop-terminal-open #main-content { grid-row: 1 !important; overflow: hidden; }",
    "#Website-Container.desktop-terminal-open #options, #Website-Container.desktop-terminal-open #chat { grid-row: 1 !important; }",
    "#desktop-terminal { grid-column: 2 !important; grid-row: 2 !important; display: flex; flex-direction: column; min-width: 0; min-height: 0; width: 100%; height: 100%; box-sizing: border-box; overflow: hidden; color: #cccccc; background: #0c0c0c; border: 1px solid #454545; border-radius: 6px; font: 14px/1.35 Consolas, 'Courier New', monospace; }",
    "#desktop-terminal[hidden] { display: none !important; }",
    "#desktop-terminal .ds-terminal-header { display: flex; align-items: center; justify-content: space-between; flex: 0 0 30px; padding: 0 9px 0 12px; background: #181818; border-bottom: 1px solid #333333; color: #dddddd; font: 12px/1.2 'Segoe UI', sans-serif; user-select: none; }",
    "#desktop-terminal .ds-terminal-close { border: 0; background: transparent; color: #bbbbbb; cursor: pointer; font: 20px/1 Consolas, monospace; padding: 3px 6px; }",
    "#desktop-terminal .ds-terminal-close:hover { color: white; background: #5a2525; }",
    "#desktop-terminal .ds-terminal-body { display: flex; flex: 1; flex-direction: column; min-height: 0; overflow: hidden; padding: 8px 10px 7px; box-sizing: border-box; }",
    "#desktop-terminal .ds-terminal-output { flex: 1; min-height: 0; overflow: auto; margin: 0; padding: 0; color: #cccccc; background: transparent; border: 0; font: inherit; white-space: pre-wrap; overflow-wrap: anywhere; user-select: text; }",
    "#desktop-terminal .ds-terminal-prompt { display: flex; align-items: baseline; flex: 0 0 auto; min-width: 0; white-space: pre; color: #cccccc; }",
    "#desktop-terminal .ds-terminal-prompt[hidden] { display: none !important; }",
    "#desktop-terminal .ds-terminal-prompt-label { flex: 0 0 auto; white-space: pre; }",
    "#desktop-terminal .ds-terminal-input { flex: 1; min-width: 0; width: auto !important; margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; outline: 0 !important; box-shadow: none !important; color: #cccccc !important; background: transparent !important; font: inherit !important; user-select: text; }",
    "#desktop-terminal .ds-terminal-input:disabled { opacity: 1; }",
    "@media (max-width: 700px) { #Website-Container.desktop-terminal-open { grid-template-rows: minmax(0, 1fr) minmax(150px, 34vh) !important; } #desktop-terminal { font-size: 12px; } }"
  ].join("\n");
  document.head.appendChild(terminalStyles);

  const terminalPanel = document.createElement("section");
  terminalPanel.id = "desktop-terminal";
  terminalPanel.hidden = true;
  terminalPanel.setAttribute("aria-label", "Terminal CMD do Windows");
  terminalPanel.innerHTML = [
    '<header class="ds-terminal-header"><span>Prompt de Comando — CMD</span><button type="button" class="ds-terminal-close" aria-label="Fechar terminal" title="Fechar terminal">×</button></header>',
    '<div class="ds-terminal-body"><pre class="ds-terminal-output" aria-live="polite"></pre><div class="ds-terminal-prompt" hidden><span class="ds-terminal-prompt-label"></span><input class="ds-terminal-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Comando CMD" /></div></div>'
  ].join("");

  const workspace = document.getElementById("Website-Container");
  const editorPanel = document.getElementById("main-content");
  if (!workspace || !editorPanel || editorPanel.parentElement !== workspace) return;
  editorPanel.insertAdjacentElement("afterend", terminalPanel);

  const terminalOutput = terminalPanel.querySelector(".ds-terminal-output");
  const promptRow = terminalPanel.querySelector(".ds-terminal-prompt");
  const promptLabel = terminalPanel.querySelector(".ds-terminal-prompt-label");
  const terminalInput = terminalPanel.querySelector(".ds-terminal-input");
  const closeTerminalButton = terminalPanel.querySelector(".ds-terminal-close");
  let terminalBuffer = "";
  let currentPrompt = "";
  let commandBusy = false;
  let terminalStarted = false;
  let focusWhenReady = false;
  let commandHistory = [];
  let historyIndex = 0;

  function renderTerminal() {
    const match = terminalBuffer.match(/(?:^|\r?\n)((?:[A-Za-z]:\\|\\\\)[^<>\r\n]*>)$/);
    currentPrompt = match ? match[1] : "";
    terminalOutput.textContent = currentPrompt
      ? terminalBuffer.slice(0, terminalBuffer.length - currentPrompt.length)
      : terminalBuffer;
    promptRow.hidden = !currentPrompt;
    promptLabel.textContent = currentPrompt;
    terminalInput.disabled = !currentPrompt || commandBusy;
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
    if (currentPrompt && focusWhenReady && !terminalPanel.hidden) {
      focusWhenReady = false;
      terminalInput.focus();
    }
  }

  function appendTerminalOutput(data) {
    terminalBuffer += String(data || "");
    if (terminalBuffer.length > 500000) terminalBuffer = terminalBuffer.slice(-400000);
    renderTerminal();
  }

  async function startTerminalIfNeeded() {
    if (terminalStarted) return;
    terminalStarted = true;
    try {
      const result = await window.darkStudioDesktop.terminalStart();
      if (!result || !result.ok) {
        terminalStarted = false;
        appendTerminalOutput(String(result?.error || "Não foi possível iniciar o CMD.") + "\r\n");
      }
    } catch (error) {
      terminalStarted = false;
      appendTerminalOutput(String(error?.message || error) + "\r\n");
    }
  }

  const unsubscribeTerminalData = window.darkStudioDesktop.onTerminalData((data) => {
    appendTerminalOutput(data);
    if (currentPrompt) commandBusy = false;
    renderTerminal();
  });

  const unsubscribeTerminalExit = window.darkStudioDesktop.onTerminalExit((details) => {
    commandBusy = false;
    terminalStarted = false;
    appendTerminalOutput("\r\n[CMD finalizado" + (details?.code === null ? "" : " — código " + details?.code) + "]\r\n");
  });

  async function submitTerminalCommand() {
    if (!currentPrompt || commandBusy || terminalInput.disabled) return;
    const command = terminalInput.value;
    if (command.trim()) {
      commandHistory.push(command);
      if (commandHistory.length > 100) commandHistory.shift();
    }
    historyIndex = commandHistory.length;
    if (command.trim().toLowerCase() === "cls") {
      terminalBuffer = "";
    } else {
      terminalBuffer += command + "\r\n";
    }
    terminalInput.value = "";
    commandBusy = true;
    renderTerminal();
    try {
      const result = await window.darkStudioDesktop.terminalWrite(command + "\r\n");
      if (!result?.ok) {
        commandBusy = false;
        appendTerminalOutput("\r\n" + String(result?.error || "Falha ao enviar o comando.") + "\r\n");
      }
    } catch (error) {
      commandBusy = false;
      appendTerminalOutput("\r\n" + String(error?.message || error) + "\r\n");
    }
  }

  function toggleTerminal() {
    if (!terminalPanel.hidden) {
      terminalPanel.hidden = true;
      workspace.classList.remove("desktop-terminal-open");
      requestAnimationFrame(() => window.editor?.layout());
      window.editor?.focus();
      return;
    }
    terminalPanel.hidden = false;
    workspace.classList.add("desktop-terminal-open");
    focusWhenReady = true;
    requestAnimationFrame(() => {
      window.editor?.layout();
      if (currentPrompt) terminalInput.focus();
    });
    void startTerminalIfNeeded();
  }

  terminalInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitTerminalCommand();
      return;
    }
    if (event.key === "ArrowUp" && commandHistory.length) {
      event.preventDefault();
      historyIndex = Math.max(0, historyIndex - 1);
      terminalInput.value = commandHistory[historyIndex] || "";
    } else if (event.key === "ArrowDown" && commandHistory.length) {
      event.preventDefault();
      historyIndex = Math.min(commandHistory.length, historyIndex + 1);
      terminalInput.value = commandHistory[historyIndex] || "";
    } else if (event.ctrlKey && event.key.toLowerCase() === "c") {
      event.preventDefault();
      void window.darkStudioDesktop.terminalWrite("\x03");
    }
  });

  closeTerminalButton.addEventListener("click", toggleTerminal);
  window.addEventListener("darkstudio:toggle-terminal", toggleTerminal);

  window.addEventListener("beforeunload", () => {
    unsubscribeTerminalData();
    unsubscribeTerminalExit();
  });
})();
