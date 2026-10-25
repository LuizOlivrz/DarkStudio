// Eventos que antes eram declarados diretamente no HTML.
document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  switch (target.dataset.action) {
    case "hide-all":
      if (typeof window.hideAll === "function") window.hideAll();
      break;
    case "clear-ai-chat":
      if (typeof window.clearChatStorage === "function") window.clearChatStorage();
      break;
    case "save-ai-prompt":
      if (typeof window.saveSystemPrompt === "function") window.saveSystemPrompt();
      break;
    case "reset-ai-prompt":
      if (typeof window.deleteSystemPrompt === "function") window.deleteSystemPrompt();
      break;
    case "toggle-settings":
      if (typeof window.config === "function") window.config();
      break;
    case "focus-signature":
      if (!document.getElementById("Website-Container")?.classList.contains("settings-active") && typeof window.config === "function") window.config();
      document.getElementById("signature-input")?.focus();
      break;
  }
});

document.addEventListener("keydown", (event) => {
  const target = event.target.closest('[data-action="toggle-settings"]');
  if (!target || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  if (typeof window.config === "function") window.config();
});
