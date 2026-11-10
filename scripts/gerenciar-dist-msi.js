"use strict";

const fs = require("node:fs");
const path = require("node:path");

const pastaDist = path.resolve(__dirname, "..", "dist");
const etapa = process.argv[2];

function preparar() {
  // Remove resultados antigos para nunca confundir um MSI anterior com o novo build.
  fs.rmSync(pastaDist, { recursive: true, force: true });
  fs.mkdirSync(pastaDist, { recursive: true });
  console.log("Pasta dist preparada para gerar somente o instalador MSI.");
}

function finalizar() {
  if (!fs.existsSync(pastaDist)) {
    throw new Error("A pasta dist não foi criada durante a compilação.");
  }

  const itens = fs.readdirSync(pastaDist, { withFileTypes: true });
  const instaladores = itens.filter(
    (item) => item.isFile() && item.name.toLowerCase().endsWith(".msi")
  );

  // Não apaga os arquivos temporários se o MSI não tiver sido produzido.
  if (instaladores.length === 0) {
    throw new Error("A compilação terminou, mas nenhum arquivo MSI foi encontrado. Os arquivos de diagnóstico foram preservados.");
  }

  for (const item of itens) {
    if (!instaladores.some((instalador) => instalador.name === item.name)) {
      fs.rmSync(path.join(pastaDist, item.name), { recursive: true, force: true });
    }
  }

  console.log("Limpeza concluída. Arquivo(s) MSI preservado(s):");
  for (const instalador of instaladores) {
    console.log(" - " + instalador.name);
  }
}

if (etapa === "preparar") {
  preparar();
} else if (etapa === "finalizar") {
  finalizar();
} else {
  console.error("Uso: node scripts/gerenciar-dist-msi.js <preparar|finalizar>");
  process.exitCode = 1;
}
