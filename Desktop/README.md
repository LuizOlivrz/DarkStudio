# DarkStudio Desktop

O aplicativo desktop é construído com Electron e reutiliza a interface web localizada na raiz deste repositório. Os arquivos exclusivos do desktop ficam em \`Desktop/\`.

## Desenvolvimento

Na raiz do repositório, execute:

\`\`\`powershell
npm install
npm start
\`\`\`

## Compilação

Execute os comandos na raiz do repositório:

| Comando | Resultado |
|---|---|
| \`npm run dist:msi\` | Instalador Windows \`.msi\` x64 |
| \`npm run dist:win\` | Instalador NSIS \`.exe\`, MSI e versão portátil |
| \`npm run dist:linux\` | Pacotes Linux |
| \`npm run dist:mac\` | Pacotes macOS |

Os arquivos gerados ficam em \`dist/\`.

### Versão do instalador

A versão exibida pelo aplicativo é definida em \`Extras/Code/config.js\`, no formato \`DD.MM.YY\`. Antes de compilar, \`scripts/sincronizar-versao.js\` converte essa data para o formato numérico \`YY.MM.DD\` usado pelo Windows Installer. Isso permite que releases posteriores sejam reconhecidas como atualizações pelo MSI.

Mantenha o \`appId\` em \`package.json\` estável entre versões: o Electron Builder deriva dele o identificador de atualização do MSI. Não altere esse identificador depois de distribuir a primeira versão.

## Releases no GitHub

O workflow \`.github/workflows/publicar-msi.yml\` compila o MSI em um runner Windows sempre que uma release é publicada e anexa o arquivo \`DarkStudio-<versão>-Windows-x64.msi\` à própria release.

Também é possível executar o workflow manualmente em Actions, informando a tag de uma release já existente.

## Arquitetura

- \`Desktop/main.js\`: processo principal do Electron, janela, protocolo local, atualização e terminal.
- \`Desktop/preload.js\`: API controlada exposta ao renderer por \`contextBridge\`.
- \`Desktop/desktop-bridge.js\`: integração da interface compartilhada com os recursos desktop.

A interface compartilhada está em \`index.html\` e \`Extras/\`.
