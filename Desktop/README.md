# DarkStudio Desktop

O aplicativo Electron reutiliza a interface web localizada na raiz deste repositório. Os arquivos exclusivos do desktop ficam nesta pasta.

## Desenvolvimento

Na raiz do repositório, execute `npm install` e depois `npm start`.

## Build

- Windows: `npm run dist:win`
- Linux: `npm run dist:linux`
- macOS: `npm run dist:mac`

A interface compartilhada está em `index.html` e `Extras/`. O Electron usa `desktop/main.js`, `desktop/preload.js` e `desktop/desktop-bridge.js`.
