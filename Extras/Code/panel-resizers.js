// DarkStudio — Panel Resizers
// Redimensionamento pelas barras entre os painéis.

export function setupPanelResizers(WebsiteContainer, onChatOpen = () => {}) {
  const storedNumber = (key, fallback, minimum, maximum) => {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value >= minimum && value <= maximum ? value : fallback;
  };
  const compact = window.innerWidth <= 700;
  const optionMin = compact ? 116 : 148;
  const optionDefault = compact ? 126 : 160;
  const chatDefault = compact ? 310 : 350;
  const chatMax = () => Math.max(310, Math.min(720, WebsiteContainer.clientWidth * .58));
  const optionsMax = () => Math.max(optionMin, Math.min(360, WebsiteContainer.clientWidth * .42));

  WebsiteContainer.style.setProperty("--options-width", `${storedNumber("darkstudio-options-width", optionDefault, optionMin, 360)}px`);
  WebsiteContainer.style.setProperty("--chat-width", `${storedNumber("darkstudio-chat-width", chatDefault, 310, 720)}px`);

  const editor = document.getElementById("main-content");
  const options = document.getElementById("options");
  const chat = document.getElementById("chat");
  if (!editor || !options || !chat) return;

  const current = variable => {
    const value = Number.parseFloat(getComputedStyle(WebsiteContainer).getPropertyValue(variable));
    return Number.isFinite(value) ? value : 0;
  };
  const optionsHandle = document.createElement("div");
  optionsHandle.className = "panel-resize-bar";
  optionsHandle.setAttribute("aria-hidden", "true");
  WebsiteContainer.appendChild(optionsHandle);

  const chatHandle = document.createElement("div");
  chatHandle.className = "panel-resize-bar";
  chatHandle.setAttribute("aria-hidden", "true");
  WebsiteContainer.appendChild(chatHandle);

  const editorPanels = [
    editor,
    document.getElementById("config"),
    document.getElementById("mindmap-container"),
    document.getElementById("extensions-panel")
  ];
  const visibleEditor = () => editorPanels.find(panel => {
    if (!panel || getComputedStyle(panel).display === "none") return false;
    const rect = panel.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });

  const positionHandle = (handle, left, visible, containerRect) => {
    if (!visible || !Number.isFinite(left)) {
      handle.hidden = true;
      return;
    }
    handle.hidden = false;
    handle.style.left = `${left - containerRect.left - WebsiteContainer.clientLeft - 2}px`;
  };

  const updateHandles = () => {
    const containerRect = WebsiteContainer.getBoundingClientRect();
    const editorPanel = visibleEditor();
    const optionsRect = options.getBoundingClientRect();
    const editorRect = editorPanel?.getBoundingClientRect();
    const optionsGap = editorRect ? editorRect.left - optionsRect.right : 0;
    const optionsIsVisible = !options.hidden &&
      getComputedStyle(options).display !== "none" &&
      optionsRect.width > 0 &&
      optionsRect.height > 0;
    positionHandle(
      optionsHandle,
      optionsRect.right + optionsGap / 2,
      optionsIsVisible && optionsGap > 0,
      containerRect
    );

    const chatIsVisible = WebsiteContainer.classList.contains("with-chat") &&
      getComputedStyle(chat).display !== "none";
    const chatRect = chat.getBoundingClientRect();
    const chatGap = chatIsVisible && editorRect ? chatRect.left - editorRect.right : 0;
    const paddingRight = Number.parseFloat(getComputedStyle(WebsiteContainer).paddingRight || "0");
    const chatHandleCenter = chatIsVisible && editorRect
      ? editorRect.right + chatGap / 2
      : containerRect.left + WebsiteContainer.clientLeft + WebsiteContainer.clientWidth - paddingRight / 2;
    positionHandle(
      chatHandle,
      chatHandleCenter,
      Boolean(editorRect) && (chatIsVisible ? chatGap > 0 : true),
      containerRect
    );
  };

  const layout = () => requestAnimationFrame(() => {
    window.editor?.layout();
    updateHandles();
  });

  const setOptionsWidth = value => {
    const clamped = Math.max(optionMin, Math.min(optionsMax(), value));
    WebsiteContainer.style.setProperty("--options-width", `${clamped}px`);
    localStorage.setItem("darkstudio-options-width", String(clamped));
    layout();
  };

  const setChatWidth = value => {
    const closed = WebsiteContainer.classList.contains("no-chat");
    const collapsed = WebsiteContainer.classList.contains("chat-resize-hidden");

    if (!closed && !collapsed && value <= 295) {
      // Reuse the original two-column layout when the chat is hidden,
      // so no empty third grid track or extra right-side gap remains.
      WebsiteContainer.classList.remove("with-chat", "chat-resize-hidden");
      WebsiteContainer.classList.add("no-chat");
      chat.style.display = "none";
      WebsiteContainer.style.setProperty("--chat-width", "310px");
      layout();
      return;
    }

    // Arrastar a borda do editor para dentro deve realmente abrir o chat,
    // não apenas alterar a largura de um painel que continua em display:none.
    if ((closed || collapsed) && value < 310) return;
    if (closed || collapsed) {
      chat.style.display = "flex";
      chat.style.pointerEvents = "auto";
      WebsiteContainer.classList.remove("no-chat", "chat-resize-hidden");
      WebsiteContainer.classList.add("with-chat");
      onChatOpen();
    }

    const clamped = Math.max(310, Math.min(chatMax(), value));
    WebsiteContainer.style.setProperty("--chat-width", `${clamped}px`);
    localStorage.setItem("darkstudio-chat-width", String(clamped));
    layout();
  };

  const beginResize = (event, type) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const chatIsHidden = WebsiteContainer.classList.contains("no-chat") ||
      WebsiteContainer.classList.contains("chat-resize-hidden");
    // Enquanto o chat está fechado, a largura começa visualmente em zero.
    // Ele só aparece quando o arrasto alcançar os 310 px mínimos.
    const startWidth = type === "chat" && chatIsHidden
      ? 0
      : current(type === "options" ? "--options-width" : "--chat-width");
    const direction = type === "options" ? 1 : -1;
    const move = nextEvent => {
      const delta = (nextEvent.clientX - startX) * direction;
      const nextWidth = startWidth + delta;
      if (type === "options") {
        setOptionsWidth(nextWidth);
      } else if (!chatIsHidden && delta >= 50) {
        // Fecha o chat quando o usuário o arrasta pelo menos 50 px para dentro.
        setChatWidth(295);
      } else {
        setChatWidth(nextWidth);
      }
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  };

  optionsHandle.addEventListener("pointerdown", event => beginResize(event, "options"));
  chatHandle.addEventListener("pointerdown", event => beginResize(event, "chat"));

  const panelResizeObserver = new ResizeObserver(updateHandles);
  [WebsiteContainer, options, ...editorPanels, chat]
    .filter(Boolean)
    .forEach(panel => panelResizeObserver.observe(panel));
  requestAnimationFrame(updateHandles);

  window.addEventListener("resize", () => {
    setOptionsWidth(current("--options-width"));

    // Redimensionar a janela nunca deve abrir o NightCoder.
    // Atualiza a largura somente se o chat já estiver aberto.
    if (WebsiteContainer.classList.contains("with-chat")) {
      setChatWidth(current("--chat-width"));
    }
    updateHandles();
  });
}
