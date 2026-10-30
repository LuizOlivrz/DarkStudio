// DarkStudio — Panel Resizers
// Redimensionamento pelas divisórias invisíveis entre os painéis.

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
  const layout = () => requestAnimationFrame(() => window.editor?.layout());

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

  // As pseudo-áreas transparentes ficam sobre as divisórias, sem alças visíveis.
  options.addEventListener("pointerdown", event => {
    if (event.clientX >= options.getBoundingClientRect().right - 8) beginResize(event, "options");
  });
  editor.addEventListener("pointerdown", event => {
    // O chat abaixo do editor usa a largura da coluna; não deve abrir o painel lateral.
    if (WebsiteContainer.classList.contains("chat-below-editor")) return;
    if (event.clientX >= editor.getBoundingClientRect().right - 8) beginResize(event, "chat");
  });
  window.addEventListener("resize", () => {
    setOptionsWidth(current("--options-width"));
    if (!WebsiteContainer.classList.contains("chat-resize-hidden")) {
      setChatWidth(current("--chat-width"));
    }
  });
}