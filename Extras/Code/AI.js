import { blockWeb, getDevMode, language, t } from "./config.js";

if (!blockWeb) {
  const API_ENDPOINT = "/.netlify/functions/nightcoder";
  const STORAGE_KEY = "nightcoder_chat";
  const MAX_MESSAGES = 10;
  let firstTime = true;
  const primaryPrompt =
    "You are NightCoder, the agentic AI assistant integrated into DarkStudio by LUIZzz. Work in an observe-plan-act-evaluate loop: understand the goal and context, make a concise plan, use available Workspace tools when useful, inspect tool results, correct failures, and verify the outcome. Never claim an action succeeded unless a tool confirms it. Use tools only for relevant Workspace operations. Before writing or overwriting any file, explain the intended change and obtain explicit user approval through the confirmation step. Never delete files, access secrets, or invent unavailable capabilities.";
  const getDefaultSystemPrompt = () => {
    const responseLanguage =
      {
        "en-US": "English",
        "pt-BR": "Brazilian Portuguese",
        ru: "Russian",
      }[language] || language;
    return `Be direct. Explain code changes at the end. Always reply in ${responseLanguage} unless the user requests another language.`;
  };
  const SYSTEM_PROMPT_KEY = "nightcoder_system_prompt";
  const textarea = document.getElementById("system-prompt-editor");
  const customSystemPrompt = localStorage.getItem(SYSTEM_PROMPT_KEY);
  const savedSystemPrompt = customSystemPrompt
    ? `${primaryPrompt} ${customSystemPrompt}`
    : `${primaryPrompt} ${getDefaultSystemPrompt()}`;
  const chatHistory = [
    {
      role: "system",
      content: savedSystemPrompt,
    },
  ];

  window.addEventListener("darkstudio:languagechange", () => {
    if (localStorage.getItem(SYSTEM_PROMPT_KEY)) return;
    chatHistory[0].content = `${primaryPrompt} ${getDefaultSystemPrompt()}`;
  });

  function saveChatToStorage() {
    const systemMessage = chatHistory.find(
      (message) => message.role === "system",
    );
    const recentMessages = chatHistory
      .filter(
        (message) => message.role === "user" || message.role === "assistant",
      )
      .slice(-MAX_MESSAGES);

    // Keep in-memory history bounded too, not just the persisted copy.
    chatHistory.splice(
      0,
      chatHistory.length,
      ...(systemMessage ? [systemMessage] : []),
      ...recentMessages,
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recentMessages));
  }

  function loadChatFromStorage() {
    const saved = localStorage.getItem(STORAGE_KEY); // Primeiro acesso: não existe histórico
    // Não é erro e não precisa gerar warning no console.
    if (!saved) {
      firstTime = true;
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      // Proteção contra dados inválidos ou formato antigo.
      if (!Array.isArray(parsed) || parsed.length === 0) {
        firstTime = true;
        return;
      }
      const messages = document.getElementById("messages");
      for (const msg of parsed) {
        if (
          !msg ||
          !["user", "assistant"].includes(msg.role) ||
          typeof msg.content !== "string"
        )
          continue;
        chatHistory.push(msg);
        const divClass = msg.role === "user" ? "user" : "ai";
        const content =
          msg.role === "assistant"
            ? renderMessage(msg.content)
            : escapeHTML(msg.content);
        messages.insertAdjacentHTML(
          "beforeend",
          `<div class="${divClass}">${content}</div>`,
        );
      }
      firstTime = false;
    } catch (error) {
      // Só avisa quando realmente existe um histórico corrompido.
      console.warn("⚠️ Histórico do chat inválido — iniciando novo chat.");
      localStorage.removeItem(STORAGE_KEY);
      firstTime = true;
    }
  }

  loadChatFromStorage();
  updateWelcomeImage();

  function updateWelcomeImage() {
    const img = document.getElementById("chat-welcome");
    if (!img) return;

    if (firstTime) {
      img.style.opacity = "0";
      img.style.display = "block";
      img.style.opacity = "1";
    } else {
      img.style.display = "none";
    }
  }

  document.getElementById("send").onclick = sendMessage;

  // Revela o HTML já renderizado em pequenos trechos, sem reprocessar Markdown
  // ou reconstruir a mensagem a cada caractere.
  function animateAssistantMessage(messageElement) {
    const walker = document.createTreeWalker(messageElement, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let totalCharacters = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.nodeValue) continue;
      textNodes.push(node);
      totalCharacters += Array.from(node.nodeValue).length;
    }
    if (!totalCharacters) return;

    const chunkSize = Math.max(1, Math.min(10, Math.ceil(totalCharacters / 220)));
    const chunks = [];
    for (const node of textNodes) {
      const characters = Array.from(node.nodeValue);
      const fragment = document.createDocumentFragment();
      for (let offset = 0; offset < characters.length; offset += chunkSize) {
        const chunk = document.createElement("span");
        chunk.className = "nightcoder-reveal-chunk";
        chunk.textContent = characters.slice(offset, offset + chunkSize).join("");
        fragment.appendChild(chunk);
        chunks.push(chunk);
      }
      node.parentNode.replaceChild(fragment, node);
    }

    const duration = Math.min(9000, Math.max(1400, 1100 + totalCharacters * 3.2));
    const startedAt = performance.now();
    let revealed = 0;
    let activeIndex = -1;

    const frame = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const nextVisible = progress === 1
        ? chunks.length
        : Math.max(1, Math.ceil(progress * chunks.length));

      while (revealed < nextVisible) {
        chunks[revealed].classList.add("is-visible");
        revealed += 1;
      }

      const nextActive = progress === 1
        ? -1
        : Math.min(chunks.length - 1, Math.floor(progress * chunks.length));
      if (activeIndex !== nextActive) {
        if (activeIndex >= 0) chunks[activeIndex].classList.remove("is-active");
        if (nextActive >= 0) chunks[nextActive].classList.add("is-active");
        activeIndex = nextActive;
      }

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        messageElement.classList.add("nightcoder-reveal-finished");
      }
    };

    requestAnimationFrame(frame);
  }

  // --- ENTER envia / SHIFT+ENTER quebra linha ---
  document.getElementById("input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (e.shiftKey) {
        // quebra de linha
        return;
      } else {
        e.preventDefault();
        sendMessage();
      }
    }
  });

  async function sendMessage() {
    const input = document.getElementById("input");
    const messages = document.getElementById("messages");
    const content = input.value.trim();
    if (!content) return;

    if (firstTime) {
      firstTime = false;
      updateWelcomeImage();
    }

    // Mostra texto do usuário
    messages.innerHTML += `<div class='user'>${escapeHTML(content)}</div>`;
    chatHistory.push({ role: "user", content });
    input.value = "";

    messages.scrollTop = messages.scrollHeight;

    try {
      const reply = await requestNightCoder(chatHistory);

      const assistantMessage = document.createElement("div");
      assistantMessage.className = "ai";
      assistantMessage.innerHTML = renderMessage(reply);
      messages.appendChild(assistantMessage);
      animateAssistantMessage(assistantMessage);
      chatHistory.push({ role: "assistant", content: reply });
      saveChatToStorage();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "NightCoder is temporarily unavailable.";
      messages.insertAdjacentHTML(
        "beforeend",
        `<div class="ai error">${escapeHTML(errorMessage)}</div>`,
      );
    } finally {
      messages.scrollTop = messages.scrollHeight;
    }
  }

  function escapeHTML(str) {
    return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function renderMessage(text) {
    // 1️⃣ Escapa HTML (segurança)
    text = escapeHTML(text);

    // 2️⃣ Guarda blocos de código ``` ```
    const codeBlocks = [];
    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
      const id = codeBlocks.length;
      codeBlocks.push({ lang, code });
      return `@@CODEBLOCK_${id}@@`;
    });

    // 3️⃣ Títulos
    text = text.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    text = text.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    text = text.replace(/^# (.+)$/gm, "<h1>$1</h1>");

    // 4️⃣ Negrito / Itálico
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // 5️⃣ Inline code
    text = text.replace(/`([^`]+)`/g, "<code class='inline'>$1</code>");

    // 6️⃣ Quotes
    text = text.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");

    // 7️⃣ Listas
    text = text.replace(/^\- (.+)$/gm, "<li>$1</li>");
    text = text.replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>");

    // 8️⃣ Tabelas simples
    text = text.replace(
      /\|(.+)\|\n\|([\-\s\|]+)\|\n((?:\|.*\|\n?)*)/g,
      (_, header, separator, rows) => {
        const th = header
          .split("|")
          .map((h) => `<th>${h.trim()}</th>`)
          .join("");

        const trs = rows
          .trim()
          .split("\n")
          .map((row) => {
            const tds = row
              .split("|")
              .filter(Boolean)
              .map((c) => `<td>${c.trim()}</td>`)
              .join("");
            return `<tr>${tds}</tr>`;
          })
          .join("");

        return `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
      },
    );

    // 9️⃣ Quebras de linha
    text = text.replace(/\n{2,}/g, "</p><p>");
    text = `<p>${text}</p>`;

    // 🔟 Restaura blocos de código
    codeBlocks.forEach((block, i) => {
      text = text.replace(
        `@@CODEBLOCK_${i}@@`,
        `
        <div class="code-block">
          <div class="code-lang">${block.lang || "code"}</div>
          <pre><code>${block.code}</code></pre>
        </div>
        `,
      );
    });

    return text;
  }

  const AGENT_TOOL_HANDLERS = {
    list_workspace_files: async () => window.darkStudioAgentTools?.listFiles?.(),
    read_workspace_file: async (args) => window.darkStudioAgentTools?.readFile?.(args),
    write_workspace_file: async (args) => {
      const path = String(args?.path || "").trim();
      const approved = window.confirm(`NightCoder deseja criar ou alterar o arquivo "${path}" no Workspace.\n\nDeseja permitir esta alteração?`);
      if (!approved) return { cancelled: true, message: "O usuário não autorizou a alteração." };
      return window.darkStudioAgentTools?.writeFile?.(args);
    },
  };

  async function requestNightCoder(messages) {
    const workingMessages = messages.map((message) => ({ ...message }));
    const maxAgentSteps = 6;

    for (let step = 0; step < maxAgentSteps; step += 1) {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: workingMessages }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "NightCoder could not complete the request.");
      }

      if (Array.isArray(data.toolCalls) && data.toolCalls.length) {
        workingMessages.push({
          role: "assistant",
          content: typeof data.intermediate === "string" ? data.intermediate : "",
          tool_calls: data.toolCalls,
        });

        for (const call of data.toolCalls) {
          const name = call?.function?.name;
          const handler = AGENT_TOOL_HANDLERS[name];
          let result;
          try {
            if (!handler) throw new Error("Ferramenta não permitida.");
            const args = JSON.parse(call.function.arguments || "{}");
            result = await handler(args);
            if (result === undefined) throw new Error("Ferramentas do Workspace ainda não estão disponíveis.");
          } catch (error) {
            result = { error: error instanceof Error ? error.message : "Falha ao executar a ferramenta." };
          }
          workingMessages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      if (typeof data.reply !== "string") throw new Error("NightCoder returned an invalid response.");
      return data.reply;
    }

    throw new Error("NightCoder atingiu o limite de etapas do agente. Peça para continuar a partir dos resultados obtidos.");
  }

  window.sendInlineRequest = async function (content) {
    const message = String(content || "").trim();
    if (!message) throw new Error("A mensagem não pode estar vazia.");

    const requestHistory = [...chatHistory, { role: "user", content: message }];
    const reply = await requestNightCoder(requestHistory);

    chatHistory.push(
      { role: "user", content: message },
      { role: "assistant", content: reply },
    );
    saveChatToStorage();
    return reply;
  };

  function clearChatStorage() {
    localStorage.removeItem(STORAGE_KEY);

    chatHistory.length = 1;

    const messages = document.getElementById("messages");
    if (messages) messages.innerHTML = "";

    firstTime = true;
    updateWelcomeImage();
  }

  window.clearChatStorage = clearChatStorage;

  function loadSystemPromptEditor() {
    if (!textarea) return;

    textarea.value =
      localStorage.getItem(SYSTEM_PROMPT_KEY) || getDefaultSystemPrompt();
  }

  function saveSystemPrompt() {
    if (!textarea) return;

    const value = textarea.value.trim() || getDefaultSystemPrompt();

    localStorage.setItem(SYSTEM_PROMPT_KEY, value);

    // Atualiza o system prompt em memória
    chatHistory[0].content = `${primaryPrompt} ${value}`;

    if (getDevMode()) alert(t("promptSaved"));
  }

  window.saveSystemPrompt = saveSystemPrompt;
  loadSystemPromptEditor();

  function deleteSystemPrompt() {
    localStorage.removeItem(SYSTEM_PROMPT_KEY);
    if (textarea) textarea.value = getDefaultSystemPrompt();
    chatHistory[0].content = `${primaryPrompt} ${getDefaultSystemPrompt()}`;
  }

  window.deleteSystemPrompt = deleteSystemPrompt;
}
