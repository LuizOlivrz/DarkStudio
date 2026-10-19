import { blockWeb, getDevMode, language, t } from "./config.js";

if (!blockWeb) {
  const API_ENDPOINT = "/.netlify/functions/nightcoder";
  const STORAGE_KEY = "nightcoder_chat";
  const MAX_MESSAGES = 10;
  let firstTime = true;
  const primaryPrompt =
    "You are NightCoder, an AI focused on helping with programming or any other topic, The editor currently being used by the user is Dark Studio by LUIZzz.";
  const getDefaultSystemPrompt = () => {
    const responseLanguage = {
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

  async function requestChatCompletion(messages) {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        typeof data.error === "string"
          ? data.error
          : "The AI service is unavailable. Please try again later.",
      );
    }
    if (typeof data.reply !== "string") {
      throw new Error("The AI service returned an invalid response.");
    }
    return data.reply;
  }

  function saveChatToStorage() {
    const systemMessage = chatHistory.find((message) => message.role === "system");
    const recentMessages = chatHistory
      .filter((message) => message.role === "user" || message.role === "assistant")
      .slice(-MAX_MESSAGES);

    // Keep in-memory history bounded too, not just the persisted copy.
    chatHistory.splice(0, chatHistory.length, ...(systemMessage ? [systemMessage] : []), ...recentMessages);
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
        ) continue;
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

    // Chama API
    let reply;
    try {
      reply = await requestChatCompletion(chatHistory);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The AI service is unavailable.";
      messages.insertAdjacentHTML("beforeend", `<div class="ai">${escapeHTML(message)}</div>`);
      messages.scrollTop = messages.scrollHeight;
      return;
    }

    // Mostra resposta
    messages.innerHTML += `<div class='ai'>${renderMessage(reply)}</div>`;
    messages.scrollTop = messages.scrollHeight;

    chatHistory.push({ role: "assistant", content: reply });
    saveChatToStorage();
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

  window.sendInlineRequest = async function (content) {
    chatHistory.push({ role: "user", content });

    return requestChatCompletion(chatHistory);
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

    if (getDevMode() === "true") alert(t("promptSaved"));
  }

  window.saveSystemPrompt = saveSystemPrompt;
  loadSystemPromptEditor();

  function deleteSystemPrompt() {
    localStorage.removeItem(SYSTEM_PROMPT_KEY);
    textarea.value = getDefaultSystemPrompt();
    chatHistory[0].content = `${primaryPrompt} ${getDefaultSystemPrompt()}`;
  }

  window.deleteSystemPrompt = deleteSystemPrompt;
}
