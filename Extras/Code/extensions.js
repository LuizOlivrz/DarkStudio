// DarkStudio extension host. Extension code executes in an opaque-origin sandbox.
const STORAGE_KEY = "darkstudio.extensions.v1";
const CHANNEL = "darkstudio-extension";
const MAX_EXTENSION_BYTES = 256 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;
const MAX_QUERY_RESULTS = 100;
const MAX_REQUESTS_PER_SECOND = 120;
const SAFE_TAGS = new Set([
  "a", "article", "aside", "b", "blockquote", "br", "button", "code", "dd", "details", "div", "dl", "dt", "em", "figcaption", "figure", "footer", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "i", "img", "label", "li", "main", "nav", "ol", "p", "pre", "section", "small", "span", "strong", "summary", "table", "tbody", "td", "th", "thead", "tr", "ul",
]);
const SAFE_EVENTS = new Set(["click", "input", "change", "submit", "keydown", "pointerdown", "pointerup"]);

if (window.darkStudioExtensionsLoaded) throw new Error("DarkStudio extensions host was already initialized.");
window.darkStudioExtensionsLoaded = true;

const t = (key) => window.darkStudioTranslate?.(key) || key;
const panel = document.getElementById("extensions-panel");
const list = document.getElementById("extensions-list");
const emptyState = document.getElementById("extensions-empty");
const fileInput = document.getElementById("extensions-file-input");
const records = new Map();
let nextElementHandle = 0;

function readStoredExtensions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(isValidManifest) : [];
  } catch (error) {
    console.warn("DarkStudio: extension catalog could not be read.", error);
    return [];
  }
}

function isValidManifest(item) {
  return Boolean(item && typeof item === "object" &&
    /^[a-z0-9][a-z0-9._-]{1,63}$/i.test(item.id || "") &&
    typeof item.name === "string" && item.name.trim() &&
    typeof item.version === "string" && typeof item.code === "string");
}

function persistExtensions() {
  const serialized = JSON.stringify([...records.values()].map(({ manifest, enabled }) => ({ ...manifest, enabled })));
  if (new Blob([serialized]).size > MAX_TOTAL_BYTES) throw new Error("Extension storage limit exceeded.");
  localStorage.setItem(STORAGE_KEY, serialized);
}

function isEditorElement(element) {
  return Boolean(element?.nodeType === Node.ELEMENT_NODE &&
    (element.matches("#Editor, #Editor-Input, .monaco-editor, .monaco-editor *") ||
      element.closest("#Editor, #Editor-Input, .monaco-editor")));
}

function sanitizedText(element) {
  if (isEditorElement(element)) throw new Error("Editor contents are not available to extensions.");
  const copy = element.cloneNode(true);
  copy.querySelectorAll("#Editor, #Editor-Input, .monaco-editor").forEach((node) => node.remove());
  return String(copy.textContent || "").slice(0, 20000);
}

function describeElement(extension, element) {
  if (!element || isEditorElement(element) || element.nodeType !== Node.ELEMENT_NODE) return null;
  let handle = extension.handles.get(element);
  if (!handle) {
    handle = `e${++nextElementHandle}`;
    extension.handles.set(element, handle);
    extension.elements.set(handle, element);
  }
  const attributes = {};
  for (const attribute of [...element.attributes].slice(0, 80)) {
    if (/^on/i.test(attribute.name) || attribute.name === "value" && element.type === "password") continue;
    attributes[attribute.name] = attribute.value.slice(0, 2000);
  }
  return {
    handle,
    tagName: element.tagName.toLowerCase(),
    id: element.id || "",
    className: typeof element.className === "string" ? element.className.slice(0, 500) : "",
    text: sanitizedText(element),
    attributes,
  };
}

function getElement(extension, handle) {
  const element = extension.elements.get(String(handle));
  if (!element || !element.isConnected || isEditorElement(element)) {
    throw new Error("Element handle is invalid or protected.");
  }
  return element;
}

function safeURL(value, allowImageData = false) {
  const raw = String(value || "").trim();
  if (/^javascript:/i.test(raw)) return null;
  if (allowImageData) {
    return /^data:image\/(?:png|gif|jpeg|webp|svg\+xml);/i.test(raw) ? raw : null;
  }
  try {
    const url = new URL(raw, location.href);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? raw : null;
  } catch {
    return raw.startsWith("#") ? raw : null;
  }
}

function hasExternalCSSResource(value) {
  const decoded = value.replace(/\\([0-9a-f]{1,6})\s?|\\(.)/gi, (_, hex, escaped) => {
    if (!hex) return escaped || "";
    const codePoint = Number.parseInt(hex, 16);
    return codePoint === 0 || codePoint > 0x10ffff ? "\uFFFD" : String.fromCodePoint(codePoint);
  });
  return /@import\b|url\s*\(|(?:-webkit-)?image-set\s*\(/i.test(decoded);
}

function safeHTMLNodes(extension, markup) {
  if (typeof markup !== "string" || markup.length > MAX_EXTENSION_BYTES) throw new Error("HTML payload is too large.");
  const template = document.createElement("template");
  template.innerHTML = markup;

  const copyNode = (source) => {
    if (source.nodeType === Node.TEXT_NODE) return document.createTextNode(source.textContent || "");
    if (source.nodeType !== Node.ELEMENT_NODE || !SAFE_TAGS.has(source.tagName.toLowerCase())) return null;
    const clone = document.createElement(source.tagName.toLowerCase());
    for (const attribute of [...source.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;
      if (name.startsWith("on") || ["id", "srcdoc", "srcset", "formaction", "contenteditable"].includes(name)) continue;
      if (["class", "title", "role", "tabindex", "alt", "width", "height", "colspan", "rowspan", "open", "aria-label", "aria-hidden"].includes(name) || name.startsWith("aria-") || name.startsWith("data-")) {
        clone.setAttribute(name, value.slice(0, 2000));
      } else if (name === "href") {
        const url = safeURL(value);
        if (url) clone.setAttribute("href", url);
      } else if (name === "src" && clone.tagName === "IMG") {
        const url = safeURL(value, true);
        if (url) clone.setAttribute("src", url);
      } else if (name === "target" && value === "_blank") {
        clone.setAttribute("target", "_blank");
        clone.setAttribute("rel", "noopener noreferrer");
      } else if (name === "style" && !hasExternalCSSResource(value) && !/(?:expression\s*\(|javascript:)/i.test(value)) {
        clone.style.cssText = value.slice(0, 4000);
      }
    }
    for (const child of source.childNodes) {
      const safeChild = copyNode(child);
      if (safeChild) clone.appendChild(safeChild);
    }
    return clone;
  };

  const fragment = document.createDocumentFragment();
  for (const child of template.content.childNodes) {
    const safeChild = copyNode(child);
    if (safeChild) fragment.appendChild(safeChild);
  }
  return fragment;
}

function runCommand(extension, command, args) {
  switch (command) {
    case "query": {
      if (typeof args.selector !== "string" || args.selector.length > 500) throw new Error("Invalid selector.");
      return [...document.querySelectorAll(args.selector)]
        .filter((element) => !isEditorElement(element))
        .slice(0, MAX_QUERY_RESULTS)
        .map((element) => describeElement(extension, element))
        .filter(Boolean);
    }
    case "getText":
      return sanitizedText(getElement(extension, args.handle));
    case "setText": {
      const value = String(args.value ?? "");
      if (value.length > 20000) throw new Error("Text payload is too large.");
      const target = getElement(extension, args.handle);
      if (target.children.length) throw new Error("Text can only be changed on elements without child elements.");
      target.textContent = value;
      return true;
    }
    case "getAttribute": {
      const name = String(args.name || "").toLowerCase();
      if (!/^[a-z_:][a-z0-9_:.-]*$/i.test(name) || name.startsWith("on")) throw new Error("Invalid attribute name.");
      return getElement(extension, args.handle).getAttribute(name);
    }
    case "getStyle": {
      const property = String(args.property || "");
      if (!/^(?:--[\w-]+|[a-z][a-z-]*)$/i.test(property)) throw new Error("Invalid CSS property.");
      return getComputedStyle(getElement(extension, args.handle)).getPropertyValue(property);
    }
    case "setStyle": {
      const property = String(args.property || "");
      const value = String(args.value ?? "");
      if (!/^(?:--[\w-]+|[a-z][a-z-]*)$/i.test(property) || !value.trim() || value.length > 2000 || hasExternalCSSResource(value) || /expression\s*\(|javascript:/i.test(value)) throw new Error("Invalid style value.");
      const target = getElement(extension, args.handle);
      let handle = extension.styleHandles.get(target);
      if (!handle) {
        handle = `s${++extension.styleHandleCount}`;
        extension.styleHandles.set(target, handle);
        target.setAttribute(extension.targetAttribute, handle);
      }
      let rule = extension.styleRules.get(handle);
      if (!rule) {
        const sheet = extension.elementStyle.sheet;
        if (!sheet) throw new Error("Extension style sheet is unavailable.");
        const ruleIndex = sheet.insertRule(`[${extension.targetAttribute}="${handle}"] {}`, sheet.cssRules.length);
        rule = sheet.cssRules[ruleIndex];
        extension.styleRules.set(handle, rule);
      }
      rule.style.setProperty(property, value, "important");
      if (!rule.style.getPropertyValue(property)) throw new Error("Invalid CSS declaration.");
      return true;
    }
    case "setAttribute": {
      const name = String(args.name || "").toLowerCase();
      const value = String(args.value ?? "");
      if (!/^(?:aria-[a-z0-9-]+|data-[a-z0-9-]+|title|role|tabindex|placeholder|value|alt|href|target|rel)$/i.test(name) || value.length > 4000) throw new Error("Attribute is not writable.");
      const target = getElement(extension, args.handle);
      if (name === "href") {
        const url = safeURL(value);
        if (!url) throw new Error("Unsafe URL.");
        target.setAttribute(name, url);
      } else {
        target.setAttribute(name, value);
      }
      return true;
    }
    case "appendHTML": {
      const target = getElement(extension, args.handle);
      const fragment = safeHTMLNodes(extension, args.html);
      let host = extension.hosts.get(target);
      if (!host) {
        host = document.createElement("div");
        host.className = "ds-extension-content-host";
        host.dataset.dsExtensionHost = extension.manifest.id;
        host.style.display = "contents";
        host.hidden = !extension.enabled;
        extension.hosts.set(target, host);
        target.appendChild(host);
      }
      const count = fragment.childNodes.length;
      host.appendChild(fragment);
      return { appended: count };
    }
    case "addCSS": {
      const css = String(args.css || "");
      if (!css || css.length > MAX_EXTENSION_BYTES || hasExternalCSSResource(css)) throw new Error("CSS is empty, too large, or references external resources.");
      extension.style.textContent += `\n/* extension ${extension.manifest.id} */\n${css}`;
      return true;
    }
    case "listen": {
      const { eventName, selector, subscriptionId } = args;
      if (!SAFE_EVENTS.has(eventName) || typeof selector !== "string" || selector.length > 500) throw new Error("Unsupported event listener.");
      document.querySelector(selector); // Validate the selector before installing the listener.
      if (extension.subscriptions.has(subscriptionId)) throw new Error("Subscription already exists.");
      const listener = (event) => {
        if (!extension.enabled) return;
        const origin = event.target instanceof Element ? event.target.closest(selector) : null;
        if (!origin || isEditorElement(origin)) return;
        extension.frame.contentWindow?.postMessage({
          channel: CHANNEL, token: extension.token, type: "event", subscriptionId,
          payload: { type: event.type, key: event.key || "", target: describeElement(extension, origin) },
        }, "*");
      };
      document.addEventListener(eventName, listener, true);
      extension.subscriptions.set(subscriptionId, listener);
      return true;
    }
    default:
      throw new Error("Unknown extension command.");
  }
}

function handleExtensionMessage(event) {
  const extension = [...records.values()].find((entry) => entry.frame?.contentWindow === event.source);
  const message = event.data;
  if (!extension || !message || message.channel !== CHANNEL || message.token !== extension.token || message.type !== "command") return;
  if (!extension.enabled) {
    extension.frame.contentWindow.postMessage({ channel: CHANNEL, token: extension.token, type: "result", id: message.id, error: "Extension is disabled." }, "*");
    return;
  }
  const now = Date.now();
  extension.requestTimes = extension.requestTimes.filter((time) => now - time < 1000);
  if (extension.requestTimes.length >= MAX_REQUESTS_PER_SECOND) {
    extension.frame.contentWindow.postMessage({ channel: CHANNEL, token: extension.token, type: "result", id: message.id, error: "Command rate limit exceeded." }, "*");
    return;
  }
  extension.requestTimes.push(now);
  try {
    const result = runCommand(extension, message.command, message.args || {});
    extension.frame.contentWindow.postMessage({ channel: CHANNEL, token: extension.token, type: "result", id: message.id, result }, "*");
  } catch (error) {
    extension.frame.contentWindow.postMessage({ channel: CHANNEL, token: extension.token, type: "result", id: message.id, error: String(error?.message || error) }, "*");
  }
}

function sandboxDocument() {
  return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'"><script>
    (() => {
      const channel = ${JSON.stringify(CHANNEL)};
      let token = "";
      let nextId = 0;
      let nextSubscription = 0;
      const pending = new Map();
      const subscriptions = new Map();
      const request = (command, args = {}) => new Promise((resolve, reject) => {
        if (!token) return reject(new Error("Extension host is not ready."));
        const id = "r" + (++nextId);
        pending.set(id, { resolve, reject });
        parent.postMessage({ channel, token, type: "command", id, command, args }, "*");
      });
      window.DS = Object.freeze({
        query: (selector = "body") => request("query", { selector }),
        getText: (handle) => request("getText", { handle }),
        setText: (handle, value) => request("setText", { handle, value }),
        getAttribute: (handle, name) => request("getAttribute", { handle, name }),
        getStyle: (handle, property) => request("getStyle", { handle, property }),
        setStyle: (handle, property, value) => request("setStyle", { handle, property, value }),
        setAttribute: (handle, name, value) => request("setAttribute", { handle, name, value }),
        appendHTML: (handle, html) => request("appendHTML", { handle, html }),
        addCSS: (css) => request("addCSS", { css }),
        on: (eventName, selector, callback) => {
          if (typeof callback !== "function") return Promise.reject(new Error("Callback must be a function."));
          const subscriptionId = "s" + (++nextSubscription);
          subscriptions.set(subscriptionId, callback);
          return request("listen", { eventName, selector, subscriptionId });
        },
      });
      window.addEventListener("message", (event) => {
        if (event.source !== parent || !event.data || event.data.channel !== channel) return;
        const message = event.data;
        if (message.type === "init") {
          token = message.token;
          const script = document.createElement("script");
          script.textContent = message.code;
          document.body.appendChild(script);
          parent.postMessage({ channel, token, type: "ready" }, "*");
          return;
        }
        if (message.token !== token) return;
        if (message.type === "result") {
          const task = pending.get(message.id);
          if (!task) return;
          pending.delete(message.id);
          message.error ? task.reject(new Error(message.error)) : task.resolve(message.result);
        } else if (message.type === "event") {
          try { subscriptions.get(message.subscriptionId)?.(message.payload); }
          catch (error) { console.error("Extension event handler failed", error); }
        }
      });
    })();
  <\/script>`;
}

function createRuntime(extension) {
  if (extension.frame) return;
  extension.token = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  extension.handles = new WeakMap();
  extension.elements = new Map();
  extension.hosts = new WeakMap();
  extension.subscriptions = new Map();
  extension.requestTimes = [];
  extension.targetAttribute = `data-ds-extension-target-${(crypto.randomUUID?.() || Math.random().toString(36).slice(2)).replace(/[^a-z0-9]/gi, "")}`;
  extension.styleHandles = new WeakMap();
  extension.styleRules = new Map();
  extension.styleHandleCount = 0;
  extension.style = document.createElement("style");
  extension.style.dataset.dsExtensionStyle = extension.manifest.id;
  extension.style.disabled = !extension.enabled;
  document.head.appendChild(extension.style);
  extension.elementStyle = document.createElement("style");
  extension.elementStyle.disabled = !extension.enabled;
  document.head.appendChild(extension.elementStyle);
  extension.frame = document.createElement("iframe");
  extension.frame.title = `DarkStudio extension sandbox: ${extension.manifest.name}`;
  extension.frame.setAttribute("sandbox", "allow-scripts");
  extension.frame.hidden = true;
  extension.frame.srcdoc = sandboxDocument();
  extension.frame.addEventListener("load", () => {
    extension.frame.contentWindow?.postMessage({
      channel: CHANNEL, type: "init", token: extension.token, code: extension.manifest.code,
    }, "*");
  }, { once: true });
  document.body.appendChild(extension.frame);
}

function renderExtensions() {
  if (!list || !emptyState) return;
  emptyState.hidden = records.size > 0;
  for (const extension of records.values()) {
    if (!extension.card) {
      const card = document.createElement("article");
      card.className = "ds-extension-card";
      const info = document.createElement("div");
      const title = document.createElement("h2");
      const detail = document.createElement("p");
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.dataset.extensionAction = "toggle";
      toggle.dataset.extensionId = extension.manifest.id;
      const titleText = document.createTextNode("");
      const detailText = document.createTextNode("");
      const buttonText = document.createTextNode("");
      title.appendChild(titleText);
      detail.appendChild(detailText);
      toggle.appendChild(buttonText);
      info.append(title, detail);
      card.append(info, toggle);
      list.appendChild(card);
      extension.card = { card, titleText, detailText, buttonText };
    }
    extension.card.titleText.data = extension.manifest.name;
    extension.card.detailText.data = `${t("extensionVersion")} ${extension.manifest.version} · ${extension.enabled ? t("extensionEnabled") : t("extensionDisabled")}`;
    extension.card.buttonText.data = extension.enabled ? t("extensionDisable") : t("extensionEnable");
  }
}

function installManifest(manifest) {
  if (!isValidManifest(manifest) || new Blob([manifest.code]).size > MAX_EXTENSION_BYTES) {
    throw new Error("Invalid or oversized extension manifest.");
  }
  if (records.has(manifest.id)) throw new Error("An extension with this ID is already installed.");
  const extension = { manifest: { ...manifest, name: manifest.name.trim() }, enabled: manifest.enabled !== false, frame: null };
  records.set(extension.manifest.id, extension);
  try {
    persistExtensions();
  } catch (error) {
    records.delete(extension.manifest.id);
    throw error;
  }
  createRuntime(extension);
  renderExtensions();
  window.dispatchEvent(new CustomEvent("darkstudio:extensions-changed"));
}

for (const manifest of readStoredExtensions()) {
  const extension = { manifest, enabled: manifest.enabled !== false, frame: null };
  records.set(manifest.id, extension);
  if (extension.enabled) createRuntime(extension);
}

async function renderBundledCatalog() {
  if (!panel) return;
  const section = document.createElement("section");
  section.id = "extensions-catalog";
  section.setAttribute("aria-labelledby", "extensions-catalog-heading");
  const heading = document.createElement("h2");
  heading.id = "extensions-catalog-heading";
  heading.textContent = "Contribuições da comunidade";
  const description = document.createElement("p");
  description.textContent = "Esta área organiza propostas de extensões enviadas pela comunidade. Os arquivos aqui não são executados nem instalados automaticamente: o mantenedor revisará cada contribuição e só publicará as aprovadas no catálogo oficial.";
  const catalogList = document.createElement("div");
  catalogList.className = "ds-extension-catalog";
  section.append(heading, description, catalogList);
  panel.appendChild(section);

  try {
    const catalogURL = new URL("../Extensões/Catalogo.json", import.meta.url);
    const response = await fetch(catalogURL, { cache: "no-cache" });
    if (!response.ok) throw new Error("Não foi possível carregar o índice de contribuições.");
    const entries = await response.json();
    if (!Array.isArray(entries)) throw new Error("Formato de índice inválido.");

    for (const entry of entries) {
      if (!entry || typeof entry.name !== "string" || typeof entry.description !== "string") continue;
      const card = document.createElement("article");
      card.className = "ds-extension-card ds-extension-catalog-card";
      const info = document.createElement("div");
      const title = document.createElement("h3");
      title.textContent = entry.name;
      const detail = document.createElement("p");
      detail.textContent = entry.description;
      const status = document.createElement("p");
      status.textContent = "Status: aguardando revisão do mantenedor";
      status.setAttribute("role", "status");
      info.append(title, detail, status);
      card.append(info);
      catalogList.appendChild(card);
    }
    if (!catalogList.childElementCount) {
      const empty = document.createElement("p");
      empty.textContent = "Nenhuma contribuição publicada nesta lista. Consulte Extras/Extensões/LEIA-ME.md para enviar uma proposta.";
      catalogList.appendChild(empty);
    }
  } catch (error) {
    console.warn("DarkStudio: índice de contribuições indisponível.", error);
    const message = document.createElement("p");
    message.textContent = "Não foi possível carregar a lista de contribuições no momento.";
    catalogList.appendChild(message);
  }
}

window.addEventListener("message", handleExtensionMessage);
renderExtensions();
renderBundledCatalog();

document.getElementById("extensions-import-button")?.addEventListener("click", () => fileInput?.click());
fileInput?.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    if (file.size > MAX_EXTENSION_BYTES) throw new Error("Extension file is too large.");
    installManifest(JSON.parse(await file.text()));
  } catch (error) {
    console.error("DarkStudio extension install failed:", error);
    alert(t("extensionError"));
  } finally {
    fileInput.value = "";
  }
});

list?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-extension-action='toggle']");
  if (!button) return;
  const extension = records.get(button.dataset.extensionId);
  if (!extension) return;
  extension.enabled = !extension.enabled;
  if (extension.enabled && !extension.frame) createRuntime(extension);
  if (extension.style) extension.style.disabled = !extension.enabled;
  if (extension.elementStyle) extension.elementStyle.disabled = !extension.enabled;
  document.querySelectorAll(`[data-ds-extension-host="${CSS.escape(extension.manifest.id)}"]`)
    .forEach((host) => { host.hidden = !extension.enabled; });
  persistExtensions();
  renderExtensions();
});

document.getElementById("extensions-button")?.addEventListener("click", () => {
  if (!panel) return;
  const opening = !document.getElementById("Website-Container")?.classList.contains("extensions-active");
  const container = document.getElementById("Website-Container");
  container?.classList.remove("settings-active");
  container?.classList.toggle("extensions-active", opening);
  panel.hidden = !opening;
  requestAnimationFrame(() => window.editor?.layout());
});

window.addEventListener("darkstudio:languagechange", renderExtensions);

export {};
