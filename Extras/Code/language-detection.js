// DarkStudio — Language Detection
// Responsabilidade: identificar linguagem/formato de trechos de código.
import { t } from "./config.js";

function stripMarkdownCode(code) {
  return code
    .replace(/```[\s\S]*?```/g, "") // blocos
    .replace(/`[^`]*`/g, ""); // inline
}

// ─────────────────────────────────────────────
// 🧩 Language Detection / Detecção de Linguagem
// ─────────────────────────────────────────────

export function detectLanguage(code) {
  if (code.trim() === "") {
    return t("startWriting");
  }

  // 👉 código limpo (sem inline/block code do Markdown)
  const cleanCode = stripMarkdownCode(code);

  // 🔗 Detecção genérica de URL: não exige lista de domínios.
  // Só classifica como link quando o conteúdo inteiro é uma URL, para não
  // confundir código-fonte que contém URLs com um link isolado.
  const linkCandidate = code.trim().replace(/[),.;!?]+$/, "");
  try {
    const parsedUrl = new URL(
      /^https?:\/\//i.test(linkCandidate)
        ? linkCandidate
        : `https://${linkCandidate}`
    );
    if (
      /^(https?:\/\/)/i.test(linkCandidate) &&
      ["http:", "https:"].includes(parsedUrl.protocol) &&
      parsedUrl.hostname.includes(".")
    ) {
      return "Link (URL)";
    }
  } catch {
    // Não é uma URL válida; continue a detecção normal da linguagem.
  }

  const isGit =
    (/^# Please enter the commit message/m.test(code) ||
      /^On branch\s+\w+/m.test(code)) &&
    !/\b(function|const|let|var|import|export|document\.)\b/.test(
      cleanCode,
    ) &&
    !/[{};]/.test(cleanCode);

  if (isGit) return t("gitText");

  // 📝 Markdown detection / Detecção de Markdown
  const isMarkdown =
    (/^#{1,6}\s+\S+/m.test(code) ||
      /^\s*>.+/m.test(code) ||
      /^```[\s\S]+```$/m.test(code.trim()) ||
      /\[[^\]]+\]\([^)]+\)/.test(code) ||
      /^\s*[-*+]\s+\S+/m.test(code) ||
      /\*\*[^*]+\*\*/.test(code) ||
      /_[^_]+_/.test(code)) &&
    !/[{}();]/.test(cleanCode) && // mata JS/CSS disfarçado
    !/<\/?[a-z][\s\S]*>/i.test(cleanCode);

  if (isMarkdown) return "Markdown";

  // SVG tem prioridade sobre HTML porque também usa marcação XML.
  if (/<svg(?:\s|>)/i.test(cleanCode) && /<\/svg\s*>/i.test(cleanCode)) {
    return "SVG";
  }

  // HTML tem prioridade sobre JavaScript e CSS
  const hasHtmlStructure =
    /<!doctype\s+html\b/i.test(cleanCode) ||
    /<html(?:\s[^>]*)?>/i.test(cleanCode) ||
    /<head(?:\s[^>]*)?>/i.test(cleanCode) ||
    /<body(?:\s[^>]*)?>/i.test(cleanCode);

  if (hasHtmlStructure) {
    return "HTML";
  }

  // Fragmentos HTML sem documento completo
  const hasHtmlElements =
    /<(div|main|section|header|footer|nav|article|form|button|script|style|h[1-6])\b[^>]*>/i.test(
      cleanCode,
    );

  if (hasHtmlElements) {
    return "HTML";
  }

  // XML: declaração explícita ou elemento raiz com namespace XML.
  if (
    /^\s*<\?xml\b/i.test(cleanCode) ||
    (/<[A-Za-z_][\w:.-]*(?:\s[^>]*)?\bxmlns(?::[\w.-]+)?\s*=/i.test(cleanCode) &&
      /<\/[A-Za-z_][\w:.-]*\s*>/i.test(cleanCode))
  ) {
    return "XML";
  }

  // 👇 SÓ DEPOIS disso vem o JS
  const isJavaScript =
    (/\b(import|export)\s+.*from\s+['"]/.test(cleanCode) ||
      /\b(function\s+\w+|\(\)\s*=>|=>\s*\{)/.test(cleanCode) ||
      /\b(const|let|var)\s+\w+\s*=/.test(cleanCode) ||
      /\bconsole\.(log|warn|error)\s*\(/.test(cleanCode)) &&
    !/^\s*:(root)|@keyframes/.test(cleanCode);

  if (isJavaScript) return "JavaScript";

  if (/\bvoid\s+setup\s*\(\)|\bvoid\s+loop\s*\(\)/.test(cleanCode))
    return "Arduino";

  if (/public\s+class\s+\w+|static\s+void\s+main/.test(cleanCode))
    return "Java";

  if (/#include\s*<[^>]+>|cout\s*<<|cin\s*>>/.test(cleanCode)) return "C++";

  if (/using\s+\w+;|Console\.WriteLine/.test(cleanCode)) return "C#";

  if (/def\s+\w+\(.*\):|print\(/.test(cleanCode)) return "Python";

  if (/<(html|head|body|script|style|div)/i.test(cleanCode)) return "HTML";

  if (/^\/\*[\s\S]*?\*\//.test(cleanCode) && /:\s*[^;]+;/.test(cleanCode)) {
    return "CSS";
  }

  // CSS fallback forte (arquivo inteiro)
  if (
    /[a-zA-Z-]+\s*:\s*[^;]+;/.test(cleanCode) &&
    /{[\s\S]*}/.test(cleanCode) &&
    !/<\/?[a-z]/i.test(cleanCode) &&
    !/\b(fn|let|mut|println!|use\s+std::|impl|struct|enum)\b/.test(cleanCode)
  ) {
    return "CSS";
  }

  if (/fun\s+\w+\s*\(.*\)/.test(cleanCode)) return "Kotlin";

  const isRust =
    (/\bfn\s+main\s*\(\s*\)/.test(cleanCode) || // fn main()
      /\bfn\s+\w+\s*\([^)]*\)\s*(->\s*\w+)?\s*\{/.test(cleanCode) || // fn foo() {}
      /\blet\s+(mut\s+)?\w+/.test(cleanCode) || // let / let mut
      /\bprintln!\s*\(/.test(cleanCode) || // println!
      /\buse\s+[\w:]+;/.test(cleanCode) || // use std::...
      /\bimpl\s+\w+/.test(cleanCode) || // impl Struct
      /\bstruct\s+\w+/.test(cleanCode) || // struct
      /\benum\s+\w+/.test(cleanCode)) && // enum
    !/#include|cout\s*<<|Console\.WriteLine|print\(/.test(cleanCode) && // evita C++/C#/Python
    !/function\s+|=>/.test(cleanCode); // evita JS

  if (isRust) return "Rust";

  const isSQL =
    /^\s*(SELECT|INSERT|UPDATE|DELETE)\s+[\s\S]+?\s+(FROM|INTO|SET)\s+/im.test(
      cleanCode,
    ) &&
    /;\s*$|$/m.test(cleanCode) && // normalmente termina comando
    !/[{}]/.test(cleanCode) && // CSS/JS usam {}
    !/--bg|--[a-z-]+:/i.test(cleanCode); // variáveis CSS

  if (isSQL) return "SQL";

  const isJSON =
    /^\s*[\[{]/.test(cleanCode) && // começa com { ou [
    /"\s*[^"]+"\s*:\s*/.test(cleanCode) && // chave válida
    !/[;()=]/.test(cleanCode); // não é JS

  if (isJSON) {
    try {
      JSON.parse(cleanCode);
      return "JSON";
    } catch {}
  }

  if (/adb\s+(shell|devices|install|pull|push)/i.test(cleanCode))
    return "ADB";

  if (/BEGIN:VCARD/.test(cleanCode)) return "VCF";

  if (/^@echo\s+off|set\s+\w+=|pause/i.test(cleanCode))
    return "Batch (BAT/CMD)";

  const normalized = cleanCode.replace(/\s+/g, "");

  const isMathExpression =
    /^[0-9+\-*\/%().,]+$/.test(normalized) && /[+\-*\/%]/.test(normalized);

  if (isMathExpression) {
    try {
      const expression = normalized.replace(/(\d),(\d)/g, "$1.$2");

      const result = Function(`"use strict"; return (${expression})`)();

      return `${t("mathResult")} ${result.toLocaleString("pt-BR")}`;
    } catch (e) {
      console.error(e);
      return `${t("mathError")}`;
    }
  }

  if (/^[a-zA-ZÀ-ú0-9\s.,!?'"()-]+$/.test(cleanCode)) return t("text");

  return t("startWriting");
}

