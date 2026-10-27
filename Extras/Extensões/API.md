# API de extensões do DarkStudio

O runtime executa extensões em um iframe isolado. O gerenciador ainda reconhece arquivos legados `.dsx.json`, mas só ativa pacotes de pasta que comprovem os arquivos obrigatórios. O objeto global `DS` expõe somente os métodos abaixo; a extensão não recebe acesso direto ao DOM principal nem ao conteúdo do editor.

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
- Todo pacote ativo precisa ter sido importado como pasta e conter `manifest.json`, `main.ds` (JavaScript), `Assets/demo/demo.txt` e `Assets/demo/demo.ico`. Arquivos `.dsx.json` antigos podem ser importados para inspeção, mas ficam listados como quebrados e desativados.
- O campo `styles` do manifesto pode apontar para um arquivo CSS relativo, como `styles.css`. Recursos de `Assets/` são disponibilizados em `DS.assets` como URLs de dados.
- Se um pacote estiver incompleto ou inválido, ele é mantido na lista como quebrado, mas permanece desativado e não pode ser ativado até que os arquivos obrigatórios sejam corrigidos.
- Toda proposta deve passar por revisão de segurança antes de ser aprovada.
