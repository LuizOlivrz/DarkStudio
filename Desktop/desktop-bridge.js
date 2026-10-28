// Desktop-only bridge injected into the renderer. It never exposes filesystem paths or arbitrary file access.
(() => {
  if (!window.darkStudioDesktop?.isDesktop) {
    // Navegadores compatíveis: persistir o FileSystemFileHandle no IndexedDB
    // permite restaurar o mesmo arquivo e gravar nele após recarregar a página.
    if (typeof window.showOpenFilePicker === "function" && typeof window.showSaveFilePicker === "function") {
      const WEB_FILE_DB = "DarkStudioFileSessionDB";
      const WEB_FILE_STORE = "session";
      const WEB_FILE_KEY = "last-open-file";
      const WEB_MODE_KEY = "darkstudio-editor-session-mode";
      let webFileHandle = null;
      let webFileName = "";
      let webDraftTimer = null;
      let webEditorListenerInstalled = false;

      const openWebFileDB = () => new Promise((resolve, reject) => {
        const request = indexedDB.open(WEB_FILE_DB, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(WEB_FILE_STORE)) request.result.createObjectStore(WEB_FILE_STORE);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Não foi possível abrir o armazenamento de arquivos."));
      });

      const readWebFileSession = async () => {
        const db = await openWebFileDB();
        return new Promise((resolve, reject) => {
          const request = db.transaction(WEB_FILE_STORE, "readonly").objectStore(WEB_FILE_STORE).get(WEB_FILE_KEY);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        });
      };

      const writeWebFileSession = async (session) => {
        const db = await openWebFileDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(WEB_FILE_STORE, "readwrite");
          transaction.objectStore(WEB_FILE_STORE).put(session, WEB_FILE_KEY);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error || new Error("Falha ao guardar o estado do arquivo."));
        });
      };

      const markWebFileActive = (handle, name) => {
        webFileHandle = handle;
        webFileName = name || handle?.name || "";
        try { localStorage.setItem(WEB_MODE_KEY, "external-file"); } catch {}
        window.dispatchEvent(new CustomEvent("darkstudio:external-file-opened", { detail: { fileName: webFileName } }));
        window.dispatchEvent(new CustomEvent("darkstudio:file-opened", { detail: { fileName: webFileName } }));
      };

      const saveWebDraft = () => {
        if (!webFileHandle || !window.editor?.getValue) return;
        clearTimeout(webDraftTimer);
        webDraftTimer = setTimeout(() => {
          void writeWebFileSession({
            handle: webFileHandle,
            fileName: webFileName,
            content: window.editor.getValue(),
            savedAt: Date.now()
          }).catch((error) => console.warn("DarkStudio: não foi possível guardar o rascunho do arquivo.", error));
        }, 180);
      };

      const installWebEditorAutosave = () => {
        if (webEditorListenerInstalled || !window.editor?.onDidChangeModelContent) return;
        webEditorListenerInstalled = true;
        window.editor.onDidChangeModelContent(saveWebDraft);
      };

      const restoreWebFile = async () => {
        try {
          if (localStorage.getItem(WEB_MODE_KEY) !== "external-file") return;
          const session = await readWebFileSession();
          if (!session?.handle || typeof session.content !== "string" || !window.editor?.setValue) return;
          markWebFileActive(session.handle, session.fileName);
          window.editor.setValue(session.content);
          window.editor.focus?.();
        } catch (error) {
          console.warn("DarkStudio: não foi possível restaurar o último arquivo no navegador.", error);
        }
      };

      const waitForWebEditor = () => {
        let attempts = 0;
        const timer = setInterval(async () => {
          attempts += 1;
          if (window.editor?.setValue) {
            clearInterval(timer);
            await new Promise((resolve) => setTimeout(resolve, 300));
            await restoreWebFile();
            installWebEditorAutosave();
          } else if (attempts >= 120) clearInterval(timer);
        }, 100);
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
            const [handle] = await window.showOpenFilePicker({ multiple: false });
            if (!handle) return;
            const file = await handle.getFile();
            const content = await file.text();
            markWebFileActive(handle, file.name);
            await writeWebFileSession({ handle, fileName: file.name, content, savedAt: Date.now() });
            if (window.editor?.setValue) {
              window.editor.setValue(content);
              window.editor.focus?.();
            }
            installWebEditorAutosave();
            return;
          }

          let handle = webFileHandle;
          if (!handle) {
            const extension = document.querySelector("#code-language h4")?.textContent?.trim()?.toLowerCase();
            const extensions = { javascript: ".js", html: ".html", css: ".css", json: ".json", python: ".py", java: ".java", "c++": ".cpp", c: ".c", markdown: ".md" };
            handle = await window.showSaveFilePicker({
              suggestedName: webFileName || `untitled${extensions[extension] || ".txt"}`,
              excludeAcceptAllOption: false
            });
            webFileName = handle.name;
          }

          const permission = await handle.queryPermission({ mode: "readwrite" });
          const granted = permission === "granted" || await handle.requestPermission({ mode: "readwrite" }) === "granted";
          if (!granted) {
            window.alert("Permita que o DarkStudio grave neste arquivo para salvar as alterações.");
            return;
          }

          const content = window.editor?.getValue?.();
          if (typeof content !== "string") return;
          const writable = await handle.createWritable();
          await writable.write(content);
          await writable.close();
          markWebFileActive(handle, handle.name);
          await writeWebFileSession({ handle, fileName: handle.name, content, savedAt: Date.now() });
        } catch (error) {
          if (error?.name !== "AbortError") {
            console.error("DarkStudio: operação de arquivo no navegador falhou.", error);
            window.alert("Não foi possível abrir ou salvar o arquivo. Verifique as permissões do navegador.");
          }
        }
      }, true);

      window.addEventListener("darkstudio:workspace-file-opened", () => {
        webFileHandle = null;
        webFileName = "";
        try { localStorage.setItem(WEB_MODE_KEY, "workspace"); } catch {}
      });
      waitForWebEditor();
    }
    return;
  }

  const EDITOR_SESSION_MODE_KEY = "darkstudio-editor-session-mode";
  const EXTERNAL_FILE_DRAFT_KEY = "darkstudio-last-open-file-draft";
  let currentExternalFile = null;
  let draftPersistTimer = null;

  const setExternalFile = (file, dispatchExternalEvent = true) => {
    currentExternalFile = file ? { filePath: file.filePath, fileName: file.fileName } : null;
    try {
      localStorage.setItem(EDITOR_SESSION_MODE_KEY, file ? "external-file" : "workspace");
      if (file) localStorage.setItem("darkstudio-last-open-file-info", JSON.stringify(currentExternalFile));
    } catch {}
    if (dispatchExternalEvent) window.dispatchEvent(new CustomEvent("darkstudio:external-file-opened", { detail: currentExternalFile || {} }));
    window.dispatchEvent(new CustomEvent("darkstudio:file-opened", { detail: currentExternalFile || {} }));
  };

  const persistExternalDraft = () => {
    if (!currentExternalFile || !window.editor?.getValue) return;
    clearTimeout(draftPersistTimer);
    draftPersistTimer = setTimeout(() => {
      try {
        localStorage.setItem(EXTERNAL_FILE_DRAFT_KEY, JSON.stringify({
          filePath: currentExternalFile.filePath,
          content: window.editor.getValue(),
          savedAt: Date.now()
        }));
      } catch (error) {
        console.warn("DarkStudio: não foi possível guardar o rascunho local do arquivo.", error);
      }
    }, 180);
  };

  const restoreExternalFileIfNeeded = async () => {
    try {
      if (localStorage.getItem(EDITOR_SESSION_MODE_KEY) !== "external-file") return;
      const file = await window.darkStudioDesktop.restoreLastFile();
      if (!file || !window.editor?.setValue) return;
      let content = file.content;
      try {
        const draft = JSON.parse(localStorage.getItem(EXTERNAL_FILE_DRAFT_KEY) || "null");
        if (draft?.filePath === file.filePath && typeof draft.content === "string") content = draft.content;
      } catch {}
      setExternalFile(file);
      window.editor.setValue(content);
      window.editor.focus?.();
    } catch (error) {
      console.warn("DarkStudio: não foi possível restaurar o último arquivo aberto.", error);
    }
  };

  const waitForEditorAndRestore = () => {
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts += 1;
      if (window.editor?.setValue) {
        clearInterval(timer);
        await new Promise((resolve) => setTimeout(resolve, 300));
        await restoreExternalFileIfNeeded();
        window.editor.onDidChangeModelContent?.(persistExternalDraft);
      } else if (attempts >= 120) clearInterval(timer);
    }, 100);
  };

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
          setExternalFile(file);
          window.editor.setValue(file.content);
          window.editor.focus?.();
          try { localStorage.setItem(EXTERNAL_FILE_DRAFT_KEY, JSON.stringify({ filePath: file.filePath, content: file.content, savedAt: Date.now() })); } catch {}
        }
        return;
      }

      if (saveButton) {
        const content = window.editor?.getValue?.();
        if (typeof content !== "string") return;
        if (currentExternalFile) {
          const result = await window.darkStudioDesktop.saveCurrentFile({ content });
          if (result?.saved) {
            try { localStorage.setItem(EXTERNAL_FILE_DRAFT_KEY, JSON.stringify({ filePath: result.filePath, content, savedAt: Date.now() })); } catch {}
            return;
          }
        }
        const result = await window.darkStudioDesktop.saveFile({
          content,
          extension: extensionForCurrentEditor(),
          defaultName: currentExternalFile?.fileName || `untitled.${extensionForCurrentEditor()}`
        });
        if (!result?.canceled && result?.filePath) {
          currentExternalFile = { filePath: result.filePath, fileName: result.fileName || result.filePath.split(/[\\\\/]/).pop() };
          setExternalFile(currentExternalFile, false);
          try { localStorage.setItem(EXTERNAL_FILE_DRAFT_KEY, JSON.stringify({ filePath: result.filePath, content, savedAt: Date.now() })); } catch {}
        }
      }
    } catch (error) {
      console.error("DarkStudio desktop file operation failed.", error);
    }
  }, true);


  window.addEventListener("darkstudio:workspace-file-opened", () => {
    currentExternalFile = null;
    try { localStorage.setItem(EDITOR_SESSION_MODE_KEY, "workspace"); } catch {}
  });
  waitForEditorAndRestore();

  // Terminal integrado com sessões CMD/PowerShell, abas personalizáveis e tela cheia.
  if (document.getElementById("desktop-terminal")) return;

  const terminalIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M2 6C2 4.34315 3.34315 3 5 3H19C20.6569 3 22 4.34315 22 6V18C22 19.6569 20.6569 21 19 21H5C3.34315 21 2 19.6569 2 18V6ZM5 5C4.44772 5 4 5.44772 4 6V7H20V6C20 5.44772 19.5523 5 19 5H5ZM4 18V9H20V18C20 18.5523 19.5523 19 19 19H5C4.44772 19 4 18.5523 4 18ZM7.70711 11.2929C7.31658 10.9024 6.68342 10.9024 6.29289 11.2929C5.90237 11.6834 5.90237 12.3166 6.29289 12.7071L7.58579 14L6.29289 15.2929C5.90237 15.6834 5.90237 16.3166 6.29289 16.7071C6.68342 17.0976 7.31658 17.0976 7.70711 16.7071L9.70711 14.7071C10.0976 14.3166 10.0976 13.6834 9.70711 13.2929L7.70711 11.2929Z"/></svg>';
  const powershellIconSvg = '<svg class="ds-powershell-icon" xmlns="http://www.w3.org/2000/svg" width="800px" height="800px" viewBox="0 0 16 16" fill="#000000"><path fill-rule="evenodd" clip-rule="evenodd" d="M2.5 1.007l12.999.17.43.501-1.82 12.872-.57.489-13-.17-.43-.502L1.93 1.495l.57-.488zM1.18 13.885l11.998.157 1.68-11.882L2.86 2.003 1.18 13.885zm5.791-3.49l-.14.991 5 .066.14-.99-5-.066zm1.71-2.457l-3.663-2.93-.692.796 2.636 2.112L3.739 9.95l.465.812L8.68 7.938z"/></svg>';
  const fullscreenIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 2H4C2.89543 2 2 2.89543 2 4V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M22 8L22 4C22 2.89543 21.1046 2 20 2H16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M16 22L20 22C21.1046 22 22 21.1046 22 20L22 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M8 22L4 22C2.89543 22 2 21.1046 2 20V16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

  const terminalStyles = document.createElement("style");
  terminalStyles.id = "desktop-terminal-styles";
  terminalStyles.textContent = [
    "#Website-Container.desktop-terminal-open { grid-template-rows: minmax(0, 1fr) minmax(160px, 32vh) !important; }",
    "#Website-Container.desktop-terminal-open #main-content { height: 100% !important; min-height: 0 !important; grid-column: 3 !important; grid-row: 1 !important; overflow: hidden; }",
    "#Website-Container.desktop-terminal-open #options { grid-column: 2 !important; grid-row: 1 !important; height: var(--workspace-height, 88dvh) !important; align-self: start; }",
    "#Website-Container.desktop-terminal-open #chat { grid-column: 4 !important; grid-row: 1 !important; }",
    "#desktop-terminal { grid-column: 3 !important; grid-row: 2 !important; display:flex; flex-direction:column; min-width:0; min-height:0; width:100%; height:100%; box-sizing:border-box; overflow:hidden; color:#cccccc; background:#0c0c0c; border:1px solid #454545; border-radius:6px; font:14px/1.35 Consolas,'Courier New',monospace; }",
    "#desktop-terminal[hidden] { display:none !important; }",
    "#desktop-terminal .ds-terminal-header { display:flex; align-items:center; gap:8px; flex:0 0 36px; min-width:0; padding:0 8px; background:#181818; border-bottom:1px solid #333; color:#ddd; font:12px/1.2 'Segoe UI',sans-serif; user-select:none; }",
    "#desktop-terminal .ds-terminal-title { display:flex; align-items:center; gap:7px; min-width:0; flex:1; height:100%; }",
    "#desktop-terminal .ds-terminal-title-icon { display:grid; place-items:center; flex:0 0 20px; width:20px; height:20px; color:#ccc; }",
    "#desktop-terminal .ds-terminal-title-icon svg { display:block; width:20px; height:20px; }",
    "#desktop-terminal .ds-powershell-icon { filter: invert(1); }",
    "#desktop-terminal .ds-terminal-title-text { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }",
    "#desktop-terminal .ds-terminal-tabs { display:flex; align-items:center; gap:3px; min-width:0; height:100%; }",
    "#desktop-terminal .ds-terminal-tab { display:grid; place-items:center; flex:0 0 30px; width:30px; height:29px; padding:4px; border:1px solid transparent; border-radius:5px; background:transparent; color:var(--ds-terminal-icon-color,#ccc); cursor:grab; }",
    "#desktop-terminal .ds-terminal-tab svg { width:21px; height:21px; display:block; }",
    "#desktop-terminal .ds-terminal-tab.is-active { background:#303030; border-color:#555; }",
    "#desktop-terminal .ds-terminal-tab.is-dragging { opacity:.4; }",
    "#desktop-terminal .ds-terminal-tab:hover { background:#333; }",
    "#desktop-terminal .ds-terminal-action { display:grid; place-items:center; flex:0 0 30px; width:30px; height:28px; padding:5px; border:0; border-radius:4px; background:transparent; color:#bbb; cursor:pointer; }",
    "#desktop-terminal .ds-terminal-action svg { width:20px; height:20px; display:block; }",
    "#desktop-terminal .ds-terminal-action:hover { background:#333; color:#fff; }",
    "#desktop-terminal .ds-terminal-close:hover { background:#5a2525; }",
    "#desktop-terminal .ds-terminal-body { display:flex; flex:1; flex-direction:column; min-height:0; overflow:hidden; padding:8px 10px 7px; box-sizing:border-box; }",
    "#desktop-terminal .ds-terminal-output { flex:1; min-height:0; overflow:auto; margin:0; padding:0; color:#ccc; background:transparent; border:0; font:inherit; white-space:pre-wrap; overflow-wrap:anywhere; user-select:text; }",
    "#desktop-terminal .ds-terminal-prompt { display:flex; align-items:baseline; flex:0 0 auto; min-width:0; white-space:pre; color:#ccc; }",
    "#desktop-terminal .ds-terminal-prompt[hidden] { display:none !important; }",
    "#desktop-terminal .ds-terminal-prompt-label { flex:0 0 auto; white-space:pre; }",
    "#desktop-terminal .ds-terminal-input { flex:1; min-width:0; width:auto !important; margin:0 !important; padding:0 !important; border:0 !important; border-radius:0 !important; outline:0 !important; box-shadow:none !important; color:#ccc !important; background:transparent !important; font:inherit !important; user-select:text; }",
    "#desktop-terminal .ds-terminal-input:disabled { opacity:1; }",
    "#desktop-terminal .ds-terminal-context { position:fixed; z-index:100000; display:flex; flex-direction:column; gap:2px; min-width:185px; padding:5px; border:1px solid #484848; border-radius:7px; background:#202020; color:#eee; box-shadow:0 8px 28px #0009; font:12px 'Segoe UI',sans-serif; }",
    "#desktop-terminal .ds-terminal-context[hidden] { display:none !important; }",
    "#desktop-terminal .ds-terminal-context button { padding:8px 10px; border:0; border-radius:4px; background:transparent; color:inherit; text-align:left; cursor:pointer; }",
    "#desktop-terminal .ds-terminal-context button:hover { background:#383838; }",
    "#desktop-terminal .ds-terminal-context label { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:6px 10px; }",
    "#desktop-terminal.ds-terminal-fullscreen { position:relative; grid-row:1 / -1 !important; grid-column:3 !important; height:100% !important; z-index:50; }",
    "#Website-Container.desktop-terminal-fullscreen { grid-template-rows:minmax(0,1fr) !important; }",
    "#Website-Container.desktop-terminal-fullscreen #main-content { display:none !important; }",
    "#Website-Container.desktop-terminal-fullscreen #desktop-terminal { grid-row:1 !important; height:100% !important; }",
    "@media(max-width:700px){#Website-Container.desktop-terminal-open{grid-template-rows:minmax(0,1fr) minmax(150px,34vh)!important}#desktop-terminal{font-size:12px}#desktop-terminal .ds-terminal-tabs{gap:1px}#desktop-terminal .ds-terminal-tab{flex-basis:26px;width:26px}}"
  ].join("\n");
  document.head.appendChild(terminalStyles);

  const terminalPanel = document.createElement("section");
  terminalPanel.id = "desktop-terminal";
  terminalPanel.hidden = true;
  terminalPanel.setAttribute("aria-label", "Terminal integrado");
  terminalPanel.innerHTML = [
    '<header class="ds-terminal-header">',
    '<div class="ds-terminal-title"><span class="ds-terminal-title-icon">' + terminalIconSvg + '</span><span class="ds-terminal-title-text">Terminal Integrado - CMD</span></div>',
    '<nav class="ds-terminal-tabs" aria-label="Terminais abertos"></nav>',
    '<button type="button" class="ds-terminal-action ds-terminal-fullscreen-button" aria-label="Alternar tela cheia" title="Alternar tela cheia">' + fullscreenIconSvg + '</button>',
    '<button type="button" class="ds-terminal-action ds-terminal-close" aria-label="Fechar terminal integrado" title="Fechar terminal integrado">×</button>',
    '</header>',
    '<div class="ds-terminal-body"><pre class="ds-terminal-output" aria-live="polite"></pre><div class="ds-terminal-prompt" hidden><span class="ds-terminal-prompt-label"></span><input class="ds-terminal-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Comando do terminal" /></div></div>',
    '<div class="ds-terminal-context" hidden role="menu"></div>'
  ].join("");

  const workspace = document.getElementById("Website-Container");
  const editorPanel = document.getElementById("main-content");
  if (!workspace || !editorPanel || editorPanel.parentElement !== workspace) return;
  editorPanel.insertAdjacentElement("afterend", terminalPanel);

  const terminalHeader = terminalPanel.querySelector(".ds-terminal-header");
  const terminalTabs = terminalPanel.querySelector(".ds-terminal-tabs");
  const terminalTitleIcon = terminalPanel.querySelector(".ds-terminal-title-icon");
  const terminalTitle = terminalPanel.querySelector(".ds-terminal-title-text");
  const terminalOutput = terminalPanel.querySelector(".ds-terminal-output");
  const promptRow = terminalPanel.querySelector(".ds-terminal-prompt");
  const promptLabel = terminalPanel.querySelector(".ds-terminal-prompt-label");
  const terminalInput = terminalPanel.querySelector(".ds-terminal-input");
  const closeTerminalButton = terminalPanel.querySelector(".ds-terminal-close");
  const fullscreenButton = terminalPanel.querySelector(".ds-terminal-fullscreen-button");
  const contextMenu = terminalPanel.querySelector(".ds-terminal-context");

  const terminals = [];
  let activeTerminalId = null;
  let nextTerminalId = 1;
  let dragTerminalId = null;
  let fullscreen = false;
  let contextTargetId = null;
  const defaultIconColor = "#cccccc";

  function activeTerminal() {
    return terminals.find((item) => item.id === activeTerminalId) || null;
  }

  function renderActiveTerminal() {
    const item = activeTerminal();
    terminalTitle.textContent = "Terminal Integrado - " + (item ? item.type : "CMD");
    terminalTitleIcon.innerHTML = item?.type === "PowerShell" ? powershellIconSvg : terminalIconSvg;
    const visibleOutput = item ? (item.prompt ? item.buffer.slice(0, item.buffer.length - item.prompt.length) : item.buffer) : "";
    // O prompt é renderizado em uma linha separada; remova a quebra final do buffer
    // para evitar uma linha vazia entre a saída do comando e o próximo prompt.
    terminalOutput.textContent = visibleOutput.replace(/(?:\\r\\n|\\n|\\r)$/, "");
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
    promptRow.hidden = !item || (!item.prompt && !item.busy);
    promptLabel.textContent = item ? item.prompt : "";
    terminalInput.value = item ? item.inputValue || "" : "";
    terminalInput.disabled = !item || (item.prompt ? item.busy : !item.busy);
    terminalInput.setAttribute("aria-label", item ? "Comando " + item.type : "Comando do terminal");
    terminalPanel.setAttribute("aria-label", "Terminal integrado " + (item ? item.type : "CMD"));
    terminalTabs.querySelectorAll(".ds-terminal-tab").forEach((button) => {
      const selected = button.dataset.terminalId === activeTerminalId;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function renderTerminalTabs() {
    terminalTabs.replaceChildren();
    terminals.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ds-terminal-tab";
      button.dataset.terminalId = item.id;
      button.draggable = true;
      button.title = item.type + " — clique para ativar; botão direito para opções";
      button.setAttribute("aria-label", "Ativar terminal " + item.type);
      button.style.setProperty("--ds-terminal-icon-color", item.color || defaultIconColor);
      button.innerHTML = item.type === "PowerShell" ? powershellIconSvg : terminalIconSvg;
      button.addEventListener("click", () => activateTerminal(item.id));
      button.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        contextTargetId = item.id;
        showTerminalContext(event.clientX, event.clientY, true);
      });
      button.addEventListener("dragstart", (event) => {
        dragTerminalId = item.id;
        button.classList.add("is-dragging");
        event.dataTransfer?.setData("text/plain", item.id);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
      });
      button.addEventListener("dragend", () => {
        dragTerminalId = null;
        button.classList.remove("is-dragging");
      });
      button.addEventListener("dragover", (event) => {
        if (!dragTerminalId || dragTerminalId === item.id) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      });
      button.addEventListener("drop", (event) => {
        event.preventDefault();
        const fromId = dragTerminalId || event.dataTransfer?.getData("text/plain");
        if (!fromId || fromId === item.id) return;
        const from = terminals.findIndex((entry) => entry.id === fromId);
        const to = terminals.findIndex((entry) => entry.id === item.id);
        if (from < 0 || to < 0) return;
        const [moved] = terminals.splice(from, 1);
        terminals.splice(to, 0, moved);
        renderTerminalTabs();
      });
      terminalTabs.appendChild(button);
    });
    renderActiveTerminal();
  }

  function appendToTerminal(item, data) {
    item.buffer += String(data || "");
    if (item.buffer.length > 500000) item.buffer = item.buffer.slice(-400000);
    const match = item.buffer.match(/(?:^|\r?\n)((?:PS\s+)?(?:[A-Za-z]:\\|\\\\)[^<>\r\n]*>)$/);
    item.prompt = match ? match[1] : "";
    if (item.prompt) item.busy = false;
    if (item.id === activeTerminalId) {
      renderActiveTerminal();
      if (item.prompt && item.restoreFocusAfterCommand && !terminalPanel.hidden) {
        item.restoreFocusAfterCommand = false;
        terminalInput.focus({ preventScroll: true });
      }
    }
  }

  function startTerminal(item) {
    if (!item || item.started) return;
    item.started = true;
    window.darkStudioDesktop.terminalStart({ terminalId: item.id, shell: item.type }).then((result) => {
      if (!result || !result.ok) {
        item.started = false;
        appendToTerminal(item, String(result?.error || "Não foi possível iniciar o terminal.") + "\r\n");
      }
    }).catch((error) => {
      item.started = false;
      appendToTerminal(item, String(error?.message || error) + "\r\n");
    });
  }

  const unsubscribeTerminalData = window.darkStudioDesktop.onTerminalData((details) => {
    const item = terminals.find((entry) => entry.id === details?.terminalId);
    if (item) appendToTerminal(item, details.data);
  });

  const unsubscribeTerminalExit = window.darkStudioDesktop.onTerminalExit((details) => {
    const item = terminals.find((entry) => entry.id === details?.terminalId);
    if (!item) return;
    item.busy = false;
    item.started = false;
    appendToTerminal(item, "\r\n[" + item.type + " finalizado" + (details.code == null ? "" : " — código " + details.code) + "]\r\n");
  });

  function activateTerminal(id) {
    const item = terminals.find((entry) => entry.id === id);
    if (!item) return;
    activeTerminalId = id;
    renderTerminalTabs();
    terminalInput.value = item.inputValue || "";
    if (item.prompt && !item.busy && !terminalPanel.hidden) terminalInput.focus();
  }

  function createTerminal(type) {
    const normalizedType = type === "PowerShell" ? "PowerShell" : "CMD";
    const item = {
      id: "terminal-" + nextTerminalId++,
      type: normalizedType,
      color: defaultIconColor,
      buffer: "",
      prompt: "",
      busy: false,
      started: false,
      inputValue: "",
      history: [],
      historyIndex: 0,
      restoreFocusAfterCommand: false
    };
    terminals.push(item);
    activeTerminalId = item.id;
    terminalPanel.hidden = false;
    workspace.classList.add("desktop-terminal-open");
    renderTerminalTabs();
    startTerminal(item);
    requestAnimationFrame(() => {
      window.editor?.layout();
      if (item.prompt) terminalInput.focus();
    });
    return item;
  }

  function removeTerminal(id) {
    const index = terminals.findIndex((item) => item.id === id);
    if (index < 0) return;
    const [item] = terminals.splice(index, 1);
    void window.darkStudioDesktop.terminalStop({ terminalId: item.id });
    if (activeTerminalId === id) activeTerminalId = terminals[Math.max(0, index - 1)]?.id || terminals[0]?.id || null;
    if (!terminals.length) {
      // Reproduz o comportamento do atalho Ctrl+Shift+Backquote.
      window.dispatchEvent(new Event("darkstudio:toggle-terminal"));
    } else {
      renderTerminalTabs();
    }
  }

  function showTerminalContext(x, y, forTerminal) {
    contextMenu.replaceChildren();
    contextMenu.hidden = false;
    contextMenu.style.left = Math.max(6, Math.min(x, window.innerWidth - 205)) + "px";
    contextMenu.style.top = Math.max(6, Math.min(y, window.innerHeight - 150)) + "px";
    if (forTerminal && contextTargetId) {
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.textContent = "Apagar este terminal";
      removeButton.addEventListener("click", () => {
        contextMenu.hidden = true;
        removeTerminal(contextTargetId);
      });
      contextMenu.appendChild(removeButton);
      const colorLabel = document.createElement("label");
      colorLabel.textContent = "Cor do ícone";
      const colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.value = terminals.find((item) => item.id === contextTargetId)?.color || defaultIconColor;
      colorInput.setAttribute("aria-label", "Cor do ícone do terminal");
      colorInput.addEventListener("input", () => {
        const item = terminals.find((entry) => entry.id === contextTargetId);
        if (!item) return;
        item.color = colorInput.value;
        const tab = terminalTabs.querySelector('[data-terminal-id="' + item.id + '"]');
        if (tab) tab.style.setProperty("--ds-terminal-icon-color", item.color);
      });
      colorLabel.appendChild(colorInput);
      contextMenu.appendChild(colorLabel);
      const activateButton = document.createElement("button");
      activateButton.type = "button";
      activateButton.textContent = "Ativar este terminal";
      activateButton.addEventListener("click", () => {
        contextMenu.hidden = true;
        activateTerminal(contextTargetId);
      });
      contextMenu.appendChild(activateButton);
    } else {
      [["Criar um terminal CMD", "CMD"], ["Criar um terminal PowerShell", "PowerShell"]].forEach(([label, type]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", () => {
          contextMenu.hidden = true;
          createTerminal(type);
        });
        contextMenu.appendChild(button);
      });
    }
  }

  function closeTerminalContext() {
    contextMenu.hidden = true;
    contextTargetId = null;
  }

  function toggleFullscreen() {
    fullscreen = !fullscreen;
    workspace.classList.toggle("desktop-terminal-fullscreen", fullscreen);
    terminalPanel.classList.toggle("ds-terminal-fullscreen", fullscreen);
    fullscreenButton.title = fullscreen ? "Sair da tela cheia" : "Tela cheia";
    fullscreenButton.setAttribute("aria-label", fullscreen ? "Sair da tela cheia" : "Tela cheia");
    requestAnimationFrame(() => window.editor?.layout());
  }

  function toggleTerminal() {
    if (!terminalPanel.hidden) {
      terminalPanel.hidden = true;
      workspace.classList.remove("desktop-terminal-open");
      if (fullscreen) {
        fullscreen = false;
        workspace.classList.remove("desktop-terminal-fullscreen");
        terminalPanel.classList.remove("ds-terminal-fullscreen");
      }
      closeTerminalContext();
      requestAnimationFrame(() => window.editor?.layout());
      window.editor?.focus();
      return;
    }
    if (!terminals.length) createTerminal("CMD");
    terminalPanel.hidden = false;
    workspace.classList.add("desktop-terminal-open");
    requestAnimationFrame(() => {
      window.editor?.layout();
      const item = activeTerminal();
      if (item?.prompt && !item.busy) terminalInput.focus();
    });
  }

  async function submitTerminalCommand() {
    const item = activeTerminal();
    if (!item) return;
    const command = terminalInput.value;
    item.inputValue = command;
    if (!item.prompt && item.busy && !terminalInput.disabled) {
      item.buffer += command + "\r\n";
      item.inputValue = "";
      terminalInput.value = "";
      renderActiveTerminal();
      const result = await window.darkStudioDesktop.terminalWrite({ terminalId: item.id, data: command + "\r\n" });
      if (!result?.ok) appendToTerminal(item, "\r\n" + String(result?.error || "Falha ao enviar a entrada.") + "\r\n");
      return;
    }
    if (!item.prompt || item.busy || terminalInput.disabled) return;
    if (command.trim()) {
      item.history.push(command);
      if (item.history.length > 100) item.history.shift();
    }
    item.historyIndex = item.history.length;
    if (command.trim().toLowerCase() === "cls" && item.type === "CMD") item.buffer = "";
    else item.buffer += command + "\r\n";
    item.inputValue = "";
    terminalInput.value = "";
    item.busy = true;
    item.restoreFocusAfterCommand = true;
    renderActiveTerminal();
    const result = await window.darkStudioDesktop.terminalWrite({ terminalId: item.id, data: command + "\r\n" });
    if (!result?.ok) {
      item.busy = false;
      item.restoreFocusAfterCommand = false;
      appendToTerminal(item, "\r\n" + String(result?.error || "Falha ao enviar o comando.") + "\r\n");
      if (item.id === activeTerminalId && !terminalPanel.hidden) terminalInput.focus({ preventScroll: true });
    }
  }

  terminalInput.addEventListener("input", () => {
    const item = activeTerminal();
    if (item) item.inputValue = terminalInput.value;
  });
  terminalInput.addEventListener("keydown", (event) => {
    const item = activeTerminal();
    if (!item) return;
    if (event.key === "Enter") {
      event.preventDefault();
      void submitTerminalCommand();
      return;
    }
    if (event.key === "ArrowUp" && item.history.length) {
      event.preventDefault();
      item.historyIndex = Math.max(0, item.historyIndex - 1);
      terminalInput.value = item.history[item.historyIndex] || "";
      item.inputValue = terminalInput.value;
    } else if (event.key === "ArrowDown" && item.history.length) {
      event.preventDefault();
      item.historyIndex = Math.min(item.history.length, item.historyIndex + 1);
      terminalInput.value = item.history[item.historyIndex] || "";
      item.inputValue = terminalInput.value;
    } else if (event.ctrlKey && event.key.toLowerCase() === "c") {
      event.preventDefault();
      void window.darkStudioDesktop.terminalWrite({ terminalId: item.id, data: "\x03" });
    }
  });

  terminalHeader.addEventListener("contextmenu", (event) => {
    if (event.target.closest(".ds-terminal-tab")) return;
    event.preventDefault();
    event.stopPropagation();
    contextTargetId = null;
    showTerminalContext(event.clientX, event.clientY, false);
  });
  terminalPanel.addEventListener("click", (event) => {
    // Só transfere o foco depois de um clique simples em área não interativa.
    // Se o usuário selecionou texto para copiar, não rouba o foco da seleção.
    if (event.button !== 0) return;
    if (event.target.closest(".ds-terminal-action, .ds-terminal-tab, .ds-terminal-context, input, button, label")) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && String(selection).length > 0) return;
    const item = activeTerminal();
    if (item?.prompt && !item.busy) terminalInput.focus({ preventScroll: true });
  });
  fullscreenButton.addEventListener("click", toggleFullscreen);
  closeTerminalButton.addEventListener("click", toggleTerminal);
  contextMenu.addEventListener("contextmenu", (event) => event.stopPropagation());
  document.addEventListener("click", (event) => {
    if (!contextMenu.contains(event.target)) closeTerminalContext();
  });
  window.addEventListener("darkstudio:toggle-terminal", toggleTerminal);
  window.addEventListener("beforeunload", () => {
    unsubscribeTerminalData();
    unsubscribeTerminalExit();
  });

})();
