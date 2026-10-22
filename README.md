# DarkStudio

**As melhores coisas acontecem no escuro.**

O **DarkStudio** é um ambiente de desenvolvimento web focado em praticidade, personalização e produtividade. Com um editor baseado no Monaco Editor, ferramentas para execução de código, assistente de IA e um espaço de trabalho visual, o projeto reúne diferentes recursos de programação em uma única interface.

<p align="center">
  <a href="https://darkstudio-code.netlify.app/">
    <strong>Acessar o DarkStudio</strong>
  </a>
  ·
  <a href="https://darkstudio-code.netlify.app/help/index.html">
    Central de ajuda
  </a>
</p>

---

## Sobre o projeto

O DarkStudio foi desenvolvido para oferecer uma experiência de programação diretamente no navegador, com uma interface personalizável e ferramentas que facilitam o desenvolvimento, a visualização e a organização de código.

O projeto utiliza tecnologias web e integra o **Monaco Editor**, o mesmo editor que serve de base para o Visual Studio Code, além de disponibilizar recursos adicionais para personalização, execução de código, extensões e assistência por inteligência artificial.

## Funcionalidades

### Editor de código

- Editor baseado no Monaco Editor.
- Detecção automática da linguagem a partir do conteúdo digitado.
- Realce de sintaxe para diversas linguagens de programação.
- Numeração de linhas, minimapa e configurações visuais do editor.
- Interface responsiva para diferentes tamanhos de tela.

Entre as linguagens reconhecidas estão HTML, JavaScript, Python, Java, C, C++, C#, Kotlin, SQL, JSON e Batch, além de modos adicionais.

### Arquivos e execução

- Carregamento de arquivos locais compatíveis.
- Download do código com extensão apropriada.
- Limpeza do conteúdo do editor.
- Execução de HTML e JavaScript em um ambiente isolado.
- Visualização de projetos HTML em um `iframe`.

O suporte à execução varia conforme a linguagem: o reconhecimento e o realce de sintaxe não significam que todas as linguagens possam ser compiladas ou executadas pelo DarkStudio.

### NightCoder — assistente de IA

O **NightCoder** é o assistente integrado ao ambiente, projetado para ajudar com programação e outras dúvidas.

- Conversação diretamente na interface.
- Histórico de mensagens armazenado no navegador.
- Personalização das instruções de comportamento do assistente.
- Solicitações relacionadas ao código por meio do chat e da interface integrada.

O NightCoder utiliza um serviço externo de IA, portanto suas respostas dependem de conexão com a internet e da disponibilidade da integração.

### Mind Map — espaço de trabalho visual

O DarkStudio possui um espaço de trabalho inspirado em mapas mentais para organizar itens visualmente.

- Adição de itens ao espaço de trabalho.
- Criação de conexões entre os itens.
- Visualização de relações entre componentes.
- Limpeza do espaço de trabalho.

Esse recurso complementa o editor tradicional e ajuda a organizar elementos de um projeto em uma representação visual.

### Sistema de extensões

O DarkStudio permite importar extensões personalizadas no formato `.dsx.json`.

- Instalação de extensões pela própria interface.
- Ativação e desativação individual.
- Personalização de partes da interface.
- API de comandos documentada para desenvolvedores de extensões.
- Execução em um `iframe` isolado, com permissões restritas.

O sistema foi projetado para limitar o acesso das extensões ao editor, ao seu conteúdo e ao armazenamento local do aplicativo. Ainda assim, revise o código de toda extensão antes de instalá-la.

Documentação: [API de extensões](https://github.com/LuizOlivrz/DarkStudio/blob/main/Extras/Extensions/API.md).

### Personalização da interface

Adapte o ambiente às suas preferências:

- Temas escuro, claro e Solarized.
- Seleção automática de tema.
- Paletas sazonais.
- Personalização das cores de destaque e das bordas.
- Imagem de fundo personalizada com controle de desfoque.
- Cores dinâmicas baseadas na imagem de fundo.
- Ajustes de interface e assinatura pessoal.

### Idiomas

A interface inclui suporte a:

- Português do Brasil (`pt-BR`)
- Inglês (`en-US`)
- Russo (`ru`)

O idioma pode ser escolhido nas configurações, e o projeto também considera o idioma do navegador na seleção inicial.

### Painel dinâmico

A interface conta com um painel que apresenta informações contextuais, incluindo clima atual quando a localização é autorizada, tempo de atividade e mensagens auxiliares.

O clima depende da geolocalização do navegador e de um serviço externo de previsão meteorológica.

### Links e visualizações

O editor reconhece links de serviços populares e identifica tipos de conteúdo compatíveis. Dependendo do link, a interface pode disponibilizar uma visualização ou um mini player integrado.

---

## Tecnologias utilizadas

| Tecnologia | Utilização |
|---|---|
| HTML5 | Estrutura da aplicação |
| CSS3 | Estilização, temas e responsividade |
| JavaScript | Lógica do editor e funcionalidades interativas |
| Monaco Editor | Edição e realce de sintaxe |
| LocalStorage | Persistência de preferências e dados locais |
| Iframes | Execução isolada de código e extensões |
| API externa de IA | Funcionamento do NightCoder |
| Open-Meteo | Consulta de informações meteorológicas |

A aplicação é organizada como um projeto web estático, com arquivos HTML, CSS, JavaScript, recursos visuais e catálogos de idiomas.

## Como utilizar

### Versão online

Acesse diretamente:

**https://darkstudio-code.netlify.app/**

Não é necessário instalar um aplicativo para utilizar a versão hospedada. Algumas funcionalidades dependem de serviços externos ou das permissões concedidas no navegador.

### Executar localmente

O WebSite está disponivel em:
`https://darkstudio-code.netlify.app/`

**Importante:** o projeto possui uma verificação de origem em `Extras/Code/config.js`. Por padrão, acessos por origens não autorizadas podem ser bloqueados. Para desenvolvimento local, revise essa configuração antes de testar a aplicação. Evite desabilitar os controles de produção indiscriminadamente.

## Estrutura do projeto

```text
DarkStudio/
├── index.html
├── README.md
├── help/
│   └── index.html
└── Extras/
    ├── Assets/
    ├── Code/
    │   ├── AI.js
    │   ├── config.js
    │   ├── dark.css
    │   ├── extensions.js
    │   ├── main.js
    │   ├── mindmap.js
    │   ├── mobile.css
    │   └── monaco.js
    ├── Extensions/
    │   ├── API.md
    │   └── hello-world.dsx.json
    ├── Monaco/
    ├── Themes/
    └── languages/
```

### Principais arquivos

- `index.html`: estrutura principal da interface.
- `Extras/Code/config.js`: inicialização, idiomas, configuração e verificação de origem.
- `Extras/Code/main.js`: funcionalidades centrais do editor.
- `Extras/Code/monaco.js`: integração com o Monaco Editor e personalização dos temas.
- `Extras/Code/AI.js`: integração do assistente NightCoder.
- `Extras/Code/mindmap.js`: implementação do espaço de trabalho visual.
- `Extras/Code/extensions.js`: gerenciamento e execução isolada das extensões.
- `Extras/Code/dark.css`: estilos principais da interface.
- `Extras/Code/mobile.css`: estilos e ajustes para dispositivos móveis.
- `Extras/Extensions/API.md`: documentação técnica da API de extensões.
- `Extras/languages/`: arquivos de tradução.
- `Extras/Themes/`: arquivos de configuração de temas.

## Segurança e privacidade

O DarkStudio combina funcionalidades locais com integrações externas.

- Preferências e determinados dados são armazenados no navegador.
- Recursos que consultam serviços externos exigem conexão com a internet.
- A execução de código e o sistema de extensões utilizam ambientes isolados.
- Extensões personalizadas devem ser revisadas antes da instalação.
- Credenciais de serviços externos não devem ser incluídas no código JavaScript entregue ao navegador.

Não utilize o assistente ou extensões com informações sensíveis sem antes avaliar como os dados são processados e transmitidos.

## Desenvolvedor

Desenvolvido por **Luiz.Olivrz**.

- **Website:** https://darkstudio-code.netlify.app/
- **GitHub:** https://github.com/LuizOlivrz

---

<p align="center">
  <em>DarkStudio — As melhores coisas acontecem no escuro...</em>
</p>