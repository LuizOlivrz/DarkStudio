const API_KEY = "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";
const MODEL = "llama-3.1-8b-instant";

const chatHistory = [
  {
    role: "system",
    content:
      "You are NightCoder, an AI focused on helping with programming or any other topic. No intros, no greetings, no DarkStudio mentions unless requested. Be direct like an intelligent terminal. Explain code changes at the end. Always speak in user language."
  }
];

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

  // Mostra texto do usuário
  messages.innerHTML += `<div class='user'>${escapeHTML(content)}</div>`;
  chatHistory.push({ role: "user", content });
  input.value = "";

  messages.scrollTop = messages.scrollHeight;

  // Chama API
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: chatHistory,
    }),
  });

  const data = await res.json();
  const reply = data.choices[0].message.content;

  // Mostra resposta
  messages.innerHTML += `<div class='ai'>${renderMessage(reply)}</div>`;
  messages.scrollTop = messages.scrollHeight;

  chatHistory.push({ role: "assistant", content: reply });
}

function escapeHTML(str) {
  return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderMessage(text) {
  // 1️⃣ escapa HTML
  text = escapeHTML(text);

  // 2️⃣ guarda blocos de código temporariamente
  const codeBlocks = [];
  text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const index = codeBlocks.length;
    codeBlocks.push({ lang, code });
    return `@@CODEBLOCK_${index}@@`;
  });

  // 3️⃣ negrito **texto**
  text = text.replace(/\*\*(.*?)\*\*/g, "<h2><strong style='color: #00ff22ff; font-weight: bold'>$1</strong></h2>");

  // 3️⃣ strong **texto**
  text = text.replace(/\*(.*?)\*/g, "<strong style='color: #ff0055ff; font-weight: bold'>$1</strong>");

  // 4️⃣ itálico `texto`
  text = text.replace(/`([^`]+)`/g, "<em>$1</em>");

  // 5️⃣ devolve os blocos de código
  codeBlocks.forEach((block, i) => {
    text = text.replace(
      `@@CODEBLOCK_${i}@@`,
      `
      <div class="code-block">
        <div class="code-lang">${block.lang || "code"}:</div>
        <pre><code>${block.code}</code></pre>
      </div>
      `
    );
  });

  return text;
}

