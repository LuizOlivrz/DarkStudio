# DarkStudio

## O que é

O **Dark Studio** é um editor de código web baseado no **Monaco Editor** (o mesmo do VS Code), totalmente personalizado com **tema escuro**, detecção automática de linguagem e recursos de salvar/carregar códigos.

---

## Funcionalidades principais

### Editor de código

- Monaco Editor incorporado (`window.editor`).
- Tema escuro personalizado (`darkStudio`) com cores específicas por tipo de token.
- Detecção de linguagem dinâmica: HTML, JS, Python, Arduino, SQL, C++, C#, Kotlin, Batch, JSON e mais.
- Auto layout e fonte ajustável (padrão: 14px).

### Salvamento e carregamento

- Salvamento automático no `localStorage` com debounce de 1s.
- Botões para **Carregar** (do `localStorage` ou arquivo) e **Download** com extensão correta.
- Botão **Limpar** para resetar o editor.

### Execução de código

- Botão **Executar** disponível para HTML e JS.
- Cria nova aba ou iframe para rodar o código.
- Tratamento de logs e erros em JS.

### Links detectados

- Detecta links populares em código e exibe um rótulo genérico.
- Reconhece YouTube, GitHub, Google Drive, ChatGPT/OpenAI e outros.

### Interface e UI

- Botões: upload, download, limpar, executar e criar iframe.
- Display de linguagem do código (`#code-language`) atualizado em tempo real.
- Efeitos visuais: fade de tela cheia, controle de opacidade e cores.

### Detecção inteligente

- Detecta links (YouTube, GitHub, Google Drive, etc.).
- Analisa o conteúdo do código para determinar a linguagem.
- Diferencia CSS de JS, HTML de JS e SBV (legendas), Arduino, ADB, etc.

### Extras

- Copia HTML para iframe diretamente no clipboard.
- Tema escuro com destaque para comentários, strings, números, keywords, variáveis e delimiters.
- Minimapa e número de linhas com cores customizadas.
- Responsivo e compatível com telas pequenas.

---

## Resumo

O **Dark Studio** não é só um editor, é quase um mini VS Code web com:

- Tema escuro e cores personalizadas por linguagem.
- Salvamento automático + carregamento de arquivo.
- Execução de HTML/JS.
- Detecção automática de linguagem.
- UI limpa e responsiva.

💬 **Em uma frase:**  
_"Dark Studio é seu VS Code custom, com vibe dark e música no beat."_ 🎵💻
