import { t } from "./config.js";

// DarkStudio Link Reader — deterministic extraction, no AI.
const form = document.getElementById("link-reader-form");
const urlInput = document.getElementById("link-reader-url");
const submitButton = document.getElementById("link-reader-submit");
const statusElement = document.getElementById("link-reader-status");
const resultElement = document.getElementById("link-reader-result");
const titleElement = document.getElementById("link-reader-title");
const sourceElement = document.getElementById("link-reader-source");
const contentElement = document.getElementById("link-reader-content");
const copyButton = document.getElementById("link-reader-copy");

const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_DISPLAY_CHARS = 120_000;
const REQUEST_TIMEOUT_MS = 15_000;

function normalizeUrl(value) {
  const trimmed = value.trim().replace(/[),.;!?]+$/, "");
  const url = new URL(trimmed);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(t("linkReaderOnlyHttp"));
  }
  if (
    url.username || url.password ||
    url.hostname === "localhost" ||
    url.hostname.endsWith(".localhost") ||
    url.hostname === "0.0.0.0" ||
    url.hostname === "::1" ||
    /^127\./.test(url.hostname) ||
    /^10\./.test(url.hostname) ||
    /^192\.168\./.test(url.hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname)
  ) {
    throw new Error(t("linkReaderPrivateUrl"));
  }
  return url;
}

function getFetchTarget(url) {
  const githubFile = url.hostname === "github.com"
    ? url.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/)
    : null;

  if (githubFile) {
    const [, owner, repo, ref, filePath] = githubFile;
    return {
      url: `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath.split("/").map(encodeURIComponent).join("/")}`,
      label: t("linkReaderGithubFile"),
      forceText: true,
    };
  }

  const githubRepo = url.hostname === "github.com"
    ? url.pathname.match(/^\/([^/]+)\/([^/]+)\/?$/)
    : null;

  if (githubRepo) {
    const [, owner, repo] = githubRepo;
    return {
      url: `https://api.github.com/repos/${owner}/${repo}/readme`,
      label: t("linkReaderGithubReadme"),
      githubApi: true,
      forceText: true,
    };
  }

  if (url.hostname === "raw.githubusercontent.com") {
    return { url: url.href, label: t("linkReaderRawFile"), forceText: true };
  }

  if (url.hostname === "api.github.com" && /^\/repos\/[^/]+\/[^/]+\/contents\//.test(url.pathname)) {
    return { url: url.href, label: t("linkReaderGithubFileGeneric"), githubApi: true, forceText: true };
  }

  return { url: url.href, label: t("linkReaderWebPage"), forceText: false };
}

function decodeBase64Utf8(value) {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

function readableHtml(html, fallbackTitle) {
  const documentContent = new DOMParser().parseFromString(html, "text/html");
  documentContent.querySelectorAll("script, style, noscript, svg, nav, footer, header, form, iframe").forEach((node) => node.remove());
  const title = documentContent.querySelector("title")?.textContent?.trim()
    || documentContent.querySelector('meta[property="og:title"]')?.content?.trim()
    || fallbackTitle;
  const description = documentContent.querySelector('meta[name="description"]')?.content?.trim();
  const bodyText = documentContent.body?.innerText || documentContent.body?.textContent || "";
  return { title, content: [description, bodyText].filter(Boolean).join("\n\n").replace(/\n{3,}/g, "\n\n").trim() };
}

async function readUrl(input) {
  const url = normalizeUrl(input);
  const target = getFetchTarget(url);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(target.url, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      redirect: "follow",
      signal: controller.signal,
      headers: target.githubApi ? { Accept: "application/vnd.github+json" } : { Accept: "text/plain, text/html, application/json, */*;q=0.5" },
    });

    if (!response.ok) throw new Error(t("linkReaderHttpError").replace("{status}", String(response.status)));
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      throw new Error(t("linkReaderTooLarge"));
    }

    const raw = await response.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_RESPONSE_BYTES) {
      throw new Error("The response is too large to display (limit: 1 MB).");
    }

    let title = url.hostname;
    let content = raw;
    const contentType = response.headers.get("content-type") || "";

    if (target.githubApi) {
      let payload;
      try { payload = JSON.parse(raw); } catch { throw new Error(t("linkReaderInvalidApi")); }
      if (payload.encoding === "base64" && payload.content) {
        content = decodeBase64Utf8(payload.content);
        title = payload.name || payload.path || t("linkReaderGithubFileGeneric");
      } else if (typeof payload.content === "string") {
        content = payload.content;
        title = payload.name || payload.path || "GitHub file";
      } else {
        content = JSON.stringify(payload, null, 2);
        title = payload.name || payload.full_name || t("linkReaderGithubContent");
      }
    } else if (!target.forceText && /text\/html/i.test(contentType)) {
      ({ title, content } = readableHtml(raw, title));
    } else if (/application\/json/i.test(contentType) || url.pathname.endsWith(".json")) {
      try { content = JSON.stringify(JSON.parse(raw), null, 2); } catch { /* Keep original response when not valid JSON. */ }
    } else {
      title = url.pathname.split("/").filter(Boolean).pop() || title;
    }

    content = String(content || "").trim();
    if (!content) throw new Error(t("linkReaderNoReadableText"));
    return {
      title,
      content: content.slice(0, MAX_DISPLAY_CHARS),
      source: target.label,
      truncated: content.length > MAX_DISPLAY_CHARS,
      finalUrl: response.url || target.url,
    };
  } catch (error) {
    if (error.name === "AbortError") throw new Error(t("linkReaderTimeout"));
    if (error instanceof TypeError) {
      throw new Error(t("linkReaderCors"));
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  resultElement.hidden = true;
  submitButton.disabled = true;
  submitButton.textContent = t("linkReaderReading");
  statusElement.textContent = t("linkReaderFetching");

  try {
    const result = await readUrl(urlInput.value);
    titleElement.textContent = result.title;
    sourceElement.textContent = `${result.source} · ${result.finalUrl}`;
    contentElement.textContent = result.content + (result.truncated ? "\n\n" + t("linkReaderTruncated") : "");
    resultElement.hidden = false;
    statusElement.textContent = t("linkReaderSuccess");
  } catch (error) {
    statusElement.textContent = error.message || t("linkReaderCouldNotRead");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = t("linkReaderRead");
  }
});

copyButton?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(contentElement.textContent);
    statusElement.textContent = t("linkReaderCopied");
  } catch {
    statusElement.textContent = t("linkReaderClipboardBlocked");
  }
});


// Read public page metadata when the destination permits cross-origin access.
// When CORS blocks the request, the editor still identifies the site from its URL.
let activeAnalysisUrl = "";
let analysisSequence = 0;

async function analyzeDetectedUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
    if (!["http:", "https:"].includes(url.protocol)) return;
    // SVG/XML namespace URLs are identifiers, not web pages to fetch.
    if (url.hostname === "www.w3.org" && url.pathname === "/2000/svg") return;
  } catch {
    return;
  }
  if (url.href === activeAnalysisUrl) return;
  activeAnalysisUrl = url.href;
  const sequence = ++analysisSequence;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(url.href, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      redirect: "follow",
      signal: controller.signal,
      headers: { Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = response.headers.get("content-type") || "";
    if (!/html|xhtml/i.test(type)) {
      window.dispatchEvent(new CustomEvent("darkstudio:site-analysis", { detail: { url: url.href, ok: false } }));
      return;
    }
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html.slice(0, 1_000_000), "text/html");
    const readMeta = (selector) => doc.querySelector(selector)?.content?.trim() || "";
    const absoluteUrl = (value) => {
      if (!value) return "";
      try { return new URL(value, url.href).href; } catch { return value; }
    };
    const title = readMeta("meta[property='og:title']") || doc.querySelector("title")?.textContent?.trim() || url.hostname;
    const description = readMeta("meta[name='description']") || readMeta("meta[property='og:description']");
    const metadata = {
      title,
      description,
      keywords: readMeta("meta[name='keywords']"),
      author: readMeta("meta[name='author']"),
      robots: readMeta("meta[name='robots']"),
      canonical: absoluteUrl(doc.querySelector("link[rel='canonical']")?.getAttribute("href") || ""),
      ogTitle: readMeta("meta[property='og:title']"),
      ogDescription: readMeta("meta[property='og:description']"),
      ogType: readMeta("meta[property='og:type']"),
      ogUrl: absoluteUrl(readMeta("meta[property='og:url']")),
      ogSiteName: readMeta("meta[property='og:site_name']"),
      ogImage: absoluteUrl(readMeta("meta[property='og:image']")),
      ogImageAlt: readMeta("meta[property='og:image:alt']"),
      ogLocale: readMeta("meta[property='og:locale']"),
      twitterCard: readMeta("meta[name='twitter:card']"),
      verification: readMeta("meta[name='google-site-verification']"),
    };
    if (sequence !== analysisSequence) return;
    window.dispatchEvent(new CustomEvent("darkstudio:site-analysis", {
      detail: { url: url.href, ok: true, title, description, metadata },
    }));
  } catch {
    if (sequence !== analysisSequence) return;
    window.dispatchEvent(new CustomEvent("darkstudio:site-analysis", { detail: { url: url.href, ok: false } }));
  } finally {
    window.clearTimeout(timeoutId);
  }
}

window.addEventListener("darkstudio:url-detected", (event) => {
  const url = event.detail?.url;
  if (typeof url === "string") analyzeDetectedUrl(url);
});
