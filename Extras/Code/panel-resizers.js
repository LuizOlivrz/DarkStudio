// DarkStudio — Panel Resizers
// Responsabilidade: redimensionar os painéis de opções e chat.

export function setupPanelResizers(WebsiteContainer) {
  const storedNumber = (key, fallback, minimum, maximum) => {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value >= minimum && value <= maximum ? value : fallback;
  };
  const isCompact = window.innerWidth <= 700;
  const optionMinimum = isCompact ? 116 : 148;
  const optionDefault = isCompact ? 126 : 160;
  const chatDefault = window.innerWidth <= 700 ? 240 : 350;
  const chatMax = Math.max(180, Math.min(720, window.innerWidth * .58));
  const optionsMax = Math.max(optionMinimum, Math.min(360, window.innerWidth * .42));
  const optionsWidth = storedNumber("darkstudio-options-width", Math.min(optionDefault, optionsMax), optionMinimum, optionsMax);
  const chatWidth = storedNumber("darkstudio-chat-width", Math.min(chatDefault, chatMax), 180, chatMax);
  WebsiteContainer.style.setProperty("--options-width", `${optionsWidth}px`);
  WebsiteContainer.style.setProperty("--chat-width", `${chatWidth}px`);

  const constraints = {
    "options-resize-handle": {
      key: "darkstudio-options-width", variable: "--options-width", axis: "x", direction: 1,
      min: optionMinimum, max: () => Math.max(optionMinimum, Math.min(360, WebsiteContainer.clientWidth * .42)), initial: optionDefault, unit: "px",
    },
    "chat-resize-handle": {
      key: "darkstudio-chat-width", variable: "--chat-width", axis: "x", direction: -1,
      min: 180, max: () => Math.min(720, WebsiteContainer.clientWidth * .58), initial: chatDefault, unit: "px",
    },
  };

  for (const [id, config] of Object.entries(constraints)) {
    const handle = document.getElementById(id);
    if (!handle) continue;
    const current = () => {
      const raw = getComputedStyle(WebsiteContainer).getPropertyValue(config.variable).trim();
      const value = Number.parseFloat(raw);
      return Number.isFinite(value) ? value : config.initial;
    };
    const apply = (value) => {
      const maximum = typeof config.max === "function" ? config.max() : (config.max ?? 98);
      const clamped = Math.min(maximum, Math.max(config.min, value));
      WebsiteContainer.style.setProperty(config.variable, `${clamped}${config.unit}`);
      localStorage.setItem(config.key, String(clamped));
      requestAnimationFrame(() => window.editor?.layout());
    };
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handle.setPointerCapture?.(event.pointerId);
      const startValue = current();
      const startPoint = config.axis === "x" ? event.clientX : event.clientY;
      const move = (nextEvent) => {
        const delta = (config.axis === "x" ? nextEvent.clientX : nextEvent.clientY) - startPoint;
        const scaledDelta = config.unit === "dvh" ? (delta / window.innerHeight) * 100 : delta;
        apply(startValue + scaledDelta * config.direction);
      };
      const stop = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop, { once: true });
      window.addEventListener("pointercancel", stop, { once: true });
    });
    handle.addEventListener("keydown", (event) => {
      const keys = config.axis === "x" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const delta = event.key === keys[1] ? 12 : -12;
      apply(current() + delta * config.direction);
    });
    window.addEventListener("resize", () => {
      const maximum = typeof config.max === "function" ? config.max() : (config.max ?? 98);
      if (current() > maximum) apply(maximum);
    });
  }
}

se