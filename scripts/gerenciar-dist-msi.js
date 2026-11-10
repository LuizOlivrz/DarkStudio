"use strict";

const fs = require("node:fs");
const path = require("node:path");

const raiz = path.resolve(__dirname, "..");
const pastaDist = path.join(raiz, "dist");
const arquivoTemporario = path.join(raiz, "são");
const etapa = process.argv[2];

function preparar() {
  // Remove resultados antigos para nunca confundir um MSI anterior com o novo build.
  fs.rmSync(pastaDist, { recursive: true, force: true });
  fs.mkdirSync(pastaDist, { recursive: true });
}

function finalizar() {
  if (!fs.existsSync(pastaDist)) {
    throw new Error("A pasta dist não foi criada durante a compilação.");
  }

  const itens = fs.readdirSync(pastaDist, { withFileTypes: true });
  const instaladores = itens.filter(
    (item) => item.isFile() && item.name.toLowerCase().endsWith(".msi")
  );

  // Só executa a limpeza após confirmar que o MSI foi realmente gerado.
  if (instaladores.length === 0) {
    throw new Error("A compilação terminou, mas nenhum arquivo MSI foi encontrado.");
  }

  for (const item of itens) {
    if (!instaladores.some((instalador) => instalador.name === item.name)) {
      fs.rmSync(path.join(pastaDist, item.name), { recursive: true, force: true });
    }
  }

  // Remove o arquivo temporário da raiz do projeto após a criação bem-sucedida do MSI.
  fs.rmSync(arquivoTemporario, { force: true });
}

if (etapa === "preparar") {
  preparar();
} else if (etapa === "finalizar") {
  finalizar();
} else {
  process.exitCode = 1;
}
