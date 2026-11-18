"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ICON_ID = "DarkStudioAppIcon";
const ICON_PATH = path.resolve(__dirname, "..", "Extras", "Assets", "White Favicon.ico");

function escapeXml(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

exports.default = async function aplicarIconeDarkStudioNoMsi(caminhoProjeto) {
  if (!fs.existsSync(caminhoProjeto) || !fs.statSync(caminhoProjeto).isFile()) {
    throw new Error("O Electron Builder não forneceu o arquivo WiX do MSI.");
  }
  if (!fs.existsSync(ICON_PATH)) {
    throw new Error("O ícone White Favicon.ico do DarkStudio não foi encontrado.");
  }

  const xmlOriginal = fs.readFileSync(caminhoProjeto, "utf8");
  const iconElement = `<Icon Id="${ICON_ID}" SourceFile="${escapeXml(ICON_PATH)}" />`;
  let xml = xmlOriginal;

  // Registra o ICO da marca no projeto WiX para que os atalhos MSI não usem o ícone genérico.
  const iconDefinition = new RegExp(`<Icon\\b(?=[^>]*\\bId=["']${ICON_ID}["'])[^>]*/?>`, "i");
  if (iconDefinition.test(xml)) {
    xml = xml.replace(iconDefinition, iconElement);
  } else {
    if (!/<\\/Product>/i.test(xml)) {
      throw new Error("Não foi possível localizar o elemento Product no projeto WiX do MSI.");
    }
    xml = xml.replace(/<\\/Product>/i, `${iconElement}\\n</Product>`);
  }

  let shortcutCount = 0;
  xml = xml.replace(/<Shortcut\\b[^>]*>/gi, (tag) => {
    shortcutCount++;
    const withoutOldIcon = tag.replace(/\\s+Icon=["'][^"']*["']/i, "");
    return withoutOldIcon.replace(/\\s*\\/?\\s*>$/, (ending) => ` Icon="${ICON_ID}"${ending}`);
  });

  // O mesmo recurso visual é usado quando o MSI registra tipos de arquivo.
  xml = xml.replace(/<ProgId\\b[^>]*>/gi, (tag) => {
    const withoutOldIcon = tag.replace(/\\s+Icon=["'][^"']*["']/i, "");
    return withoutOldIcon.replace(/\\s*\\/?\\s*>$/, (ending) => ` Icon="${ICON_ID}"${ending}`);
  });

  if (shortcutCount === 0) {
    throw new Error("Nenhum atalho foi encontrado no projeto WiX do MSI para associar ao ícone do DarkStudio.");
  }
  if (!new RegExp(`<Icon\\b(?=[^>]*\\bId=["']${ICON_ID}["'])`, "i").test(xml)) {
    throw new Error("A declaração do ícone do DarkStudio não foi aplicada ao projeto WiX.");
  }

  fs.writeFileSync(caminhoProjeto, xml, "utf8");
  console.log("Ícone White Favicon.ico aplicado aos atalhos do MSI do DarkStudio.");
};
