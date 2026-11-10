"use strict";

const fs = require("node:fs");

exports.default = async function corrigirProjetoMsiSemIcone(caminhoProjeto) {
  if (!fs.existsSync(caminhoProjeto) || !fs.statSync(caminhoProjeto).isFile()) {
    throw new Error("O Electron Builder não forneceu o arquivo WiX do MSI.");
  }

  const xmlOriginal = fs.readFileSync(caminhoProjeto, "utf8");

  // Sem uma declaração <Icon>, o WiX não pode receber referências Icon nos atalhos.
  if (/<Icon\s+Id=/.test(xmlOriginal)) {
    console.log("Projeto MSI já declara um ícone; nenhuma alteração necessária.");
    return;
  }

  const xmlCorrigido = xmlOriginal.replace(
    /(<(?:Shortcut|ProgId)\b[^>]*?)\s+Icon="[^"]+"/g,
    "$1"
  );

  if (xmlCorrigido === xmlOriginal && /\sIcon="[^"]+"/.test(xmlOriginal)) {
    throw new Error("Foram encontradas referências de ícone no MSI, mas não foi possível removê-las com segurança.");
  }

  if (/<Shortcut\b[^>]*\sIcon="/.test(xmlCorrigido)) {
    throw new Error("Ainda existe uma referência a ícone em um atalho MSI.");
  }

  fs.writeFileSync(caminhoProjeto, xmlCorrigido, "utf8");
  console.log("Referências a ícones removidas do projeto WiX; os atalhos foram preservados.");
};
