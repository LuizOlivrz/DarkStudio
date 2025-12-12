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
  messages.innerHTML += `<div class='ai'>${escapeHTML(reply)}</div>`;
  messages.scrollTop = messages.scrollHeight;

  chatHistory.push({ role: "assistant", content: reply });
}

function escapeHTML(str) {
  return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
