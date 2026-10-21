// DarkStudio — Workspace Language Utilities
// Responsabilidade: mapear extensões de arquivos para linguagens do Monaco.

export const TEXT_FILE_EXTENSIONS = new Set([
  "html", "htm", "css", "js", "mjs", "cjs", "json", "txt", "md",
  "xml", "svg", "csv", "tsv", "yaml", "yml", "toml", "ini", "ts",
  "jsx", "tsx", "vue", "svelte", "scss", "sass", "less", "php", "py",
  "rb", "java", "c", "h", "cpp", "hpp", "cs", "go", "rs", "sh",
  "bat", "ps1", "sql", "graphql", "webmanifest", "ino", "sbv", "vcf", "git",
]);

export const WORKSPACE_LANGUAGES = [
  { label: "JavaScript", extension: "js", monaco: "javascript" },
  { label: "Python", extension: "py", monaco: "python" },
  { label: "Java", extension: "java", monaco: "java" },
  { label: "HTML", extension: "html", monaco: "html" },
  { label: "CSS", extension: "css", monaco: "css" },
  { label: "Batch (BAT/CMD)", extension: "bat", monaco: "bat" },
  { label: "Arduino", extension: "ino", monaco: "cpp" },
  { label: "JSON", extension: "json", monaco: "json" },
  { label: "C", extension: "c", monaco: "c" },
  { label: "C++", extension: "cpp", monaco: "cpp" },
  { label: "C#", extension: "cs", monaco: "csharp" },
  { label: "SQL", extension: "sql", monaco: "sql" },
  { label: "Kotlin", extension: "kt", monaco: "kotlin" },
  { label: "ADB", extension: "txt", monaco: "bat" },
  { label: "SBV", extension: "sbv", monaco: "plaintext" },
  { label: "VCF", extension: "vcf", monaco: "plaintext" },
  { label: "Markdown", extension: "md", monaco: "markdown" },
  { label: "Git", extension: "git", monaco: "plaintext" },
  { label: "Texto", extension: "txt", monaco: "plaintext" },
  { label: "Rust", extension: "rs", monaco: "rust" },
];

export function getWorkspaceLanguage(label) {
  const normalized = String(label || "").trim().toLowerCase();
  return WORKSPACE_LANGUAGES.find((item) =>
    item.label.toLowerCase() === normalized ||
    (normalized === "text" && item.label === "Texto")
  ) || null;
}

export function getWorkspaceLanguageForFile(filename) {
  const extension = getFileExtension(filename);
  if (extension === "txt") return getWorkspaceLanguage("Texto");

  const aliases = {
    mjs: "JavaScript", cjs: "JavaScript", jsx: "JavaScript",
    htm: "HTML", ts: "JavaScript", tsx: "JavaScript",
    cmd: "Batch (BAT/CMD)", ino: "Arduino", h: "C", hpp: "C++",
    markdown: "Markdown", bash: "Batch (BAT/CMD)",
  };
  const alias = aliases[extension];
  if (alias) return getWorkspaceLanguage(alias);
  return WORKSPACE_LANGUAGES.find((item) => item.extension === extension) || null;
}

export function getFileExtension(filename) {
  const name = String(filename || "");
  const index = name.lastIndexOf(".");

  return index > 0 ? name.slice(index + 1).toLowerCase() : "";
}

export function getLanguageFromFile(filename) {
  const languages = {
    js: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    ts: "typescript",
    jsx: "javascript",
    tsx: "typescript",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    less: "less",
    json: "json",
    md: "markdown",
    markdown: "markdown",
    py: "python",
    java: "java",
    c: "c",
    h: "c",
    cpp: "cpp",
    hpp: "cpp",
    cs: "csharp",
    sql: "sql",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    sh: "shell",
    bash: "shell",
    bat: "bat",
    cmd: "bat",
    php: "php",
    rs: "rust",
    go: "go",
    kt: "kotlin",
    ino: "cpp",
    sbv: "plaintext",
    vcf: "plaintext",
    git: "plaintext",
    txt: "plaintext",
    log: "plaintext",
  };

  return languages[getFileExtension(filename)] || "plaintext";
}
