# DarkStudio
O que ele é

O Dark Studio é um editor de código web baseado no Monaco Editor (o mesmo do VS Code), totalmente personalizado com tema escuro, integração com Spotify, detecção de linguagem automática, e recursos de salvar/carregar códigos.

Funcionalidades principais

Editor de código

Monaco Editor incorporado (window.editor).

Tema escuro personalizado (darkStudio) com cores específicas por tipo de token.

Detecção de linguagem dinâmica (HTML, JS, Python, Arduino, SQL, C++, C#, Kotlin, Batch, JSON, etc.).

Auto layout e fonte ajustável (fontSize: 14 por padrão).

Salvamento e carregamento

Salvamento automático no localStorage com debounce de 1s.

Botões para Carregar (do localStorage ou de arquivo) e Download com extensão correta.

Botão Limpar para resetar o editor.

Execução de código

Botão Executar aparece se a linguagem for HTML ou JS.

Cria uma nova aba ou iframe para rodar o código.

Tratamento de logs e erros para JS.

Integração com Spotify

Mostra música atual, capa do álbum e foto de perfil do usuário.

Tela cheia opcional (full-screen) com cores dinâmicas baseadas na capa do álbum usando Color Thief.

Login OAuth via Spotify (PKCE flow) com refresh automático de token.

Ajuste de cores do editor de acordo com a capa da música, incluindo contraste automático.

Interface e UI

Botões de upload, download, limpar, executar e criar iframe.

Display de linguagem do código (#code-language) atualizado em tempo real.

Efeitos visuais: fade de tela cheia, controle de opacidade e cores.

Detecção inteligente

Detecta links (YouTube, GitHub, Spotify, Google Drive, etc.).

Analisa o conteúdo do código para determinar a linguagem.

Diferencia CSS de JS, HTML de JS e SBV (legendas), Arduino, ADB, etc.

Extras

Copia HTML para iframe diretamente no clipboard.

Tema escuro personalizado com destaque para comentários, strings, números, keywords, variáveis e delimiters.

Minimapa e número de linhas com cores customizadas.

Responsividade e suporte a telas pequenas.

Resumo

O Dark Studio não é só um editor, é quase um mini VS Code web com:

Tema escuro, cores personalizadas por linguagem.

Salvamento automático + carregamento de arquivo.

Execução de HTML/JS.

Integração visual com Spotify (tela cheia dinâmica).

Detecção automática de linguagem.

UI limpa e responsiva.

Se eu fosse resumir em uma frase:

“Dark Studio é seu VS Code custom, com vibe dark e música no beat.” 🎵💻
