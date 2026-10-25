# API de extensões do DarkStudio

O runtime atual executa o código importado de um arquivo `.dsx.json` em um iframe isolado. O objeto global `DS` expõe somente os métodos abaixo; a extensão não recebe acesso direto ao DOM principal nem ao conteúdo do editor.

## Métodos disponíveis

- `DS.query(selector = "body")`: consulta elementos permitidos e retorna descrições com `handle`, `tagName`, `id`, `className`, `text` e atributos.
- `DS.getText(handle)`: lê o texto de um elemento permitido.
- `DS.setText(handle, value)`: altera o texto de um elemento sem elementos filhos.
- `DS.getAttribute(handle, name)`: lê um atributo.
- `DS.getStyle(handle, property)`: lê um valor de estilo calculado.
- `DS.setStyle(handle, property, value)`: aplica uma propriedade de estilo.
- `DS.setAttribute(handle, name, value)`: altera somente atributos permitidos.
- `DS.appendHTML(handle, html)`: adiciona HTML sanitizado a um elemento.
- `DS.addCSS(css)`: adiciona CSS sem recursos externos.
- `DS.on(eventName, selector, callback)`: ouve eventos permitidos: `click`, `input`, `change`, `submit`, `keydown`, `pointerdown` e `pointerup`.

Os métodos assíncronos retornam Promises. Use os handles retornados por `DS.query`; não tente contornar as restrições de segurança para acessar o editor ou elementos protegidos.

## Limitações importantes

- A API atual não fornece acesso geral a arquivos locais, sistema de arquivos ou rede.
- O runtime atual de instalação usa o campo `code` no manifesto `.dsx.json`; ele não carrega automaticamente `main.js`, `styles.css` nem recursos de uma pasta.
- A estrutura de pastas documentada em `LEIA-ME.md` organiza propostas da comunidade no repositório. A conversão desse formato em um pacote instalável requer uma implementação explícita no gerenciador de extensões.
- Toda proposta deve passar por revisão de segurança antes de ser aprovada.
