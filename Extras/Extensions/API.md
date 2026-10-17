# API de Extensões do DarkStudio

As extensões são arquivos JSON com o sufixo `.dsx.json`. O código é executado em um `iframe` com `sandbox="allow-scripts"`, uma origem opaca e uma Política de Segurança de Conteúdo (CSP) restritiva. Ele não pode acessar `window.editor`, os modelos do Monaco, o DOM do editor, o armazenamento local (`localStorage`) nem os arquivos-fonte do DarkStudio.

O ambiente de execução das extensões disponibiliza apenas a API de comandos `DS`. Intencionalmente, não existe nenhum comando para remover nós do DOM, limpar estilos ou excluir dados do aplicativo. Uma extensão pode ocultar ou modificar a aparência de elementos existentes da interface usando CSS e adicionar HTML sanitizado. Ao desativar uma extensão, sua folha de estilos é desativada e o HTML que ela adicionou fica oculto; nada é removido da página.

## Manifesto

```json
{
  "id": "sample.hello-world",
  "name": "Hello World",
  "version": "1.0.0",
  "description": "Adiciona uma pequena mensagem de boas-vindas ao painel de opções.",
  "code": "(async () => { const [options] = await DS.query('#options'); if (options) await DS.appendHTML(options.handle, '<p class=\"hello-extension\">Olá, vindo de uma extensão do DarkStudio.</p>'); await DS.addCSS('.hello-extension { padding: 8px; color: var(--accent-color); }'); })();"
}
```

O campo `id` deve ser único e conter entre 2 e 64 caracteres, usando letras, números, pontos, sublinhados ou hífens.

Cada arquivo de extensão tem um limite de 256 KiB. O tamanho total de todas as extensões instaladas não pode ultrapassar 2 MiB.

## Comandos

- `await DS.query(selector)`: retorna até 100 elementos correspondentes ao seletor, apresentados como descritores seguros com as propriedades `handle`, `tagName`, `id`, `className`, `text` e `attributes`. Os nós do editor e o campo de entrada de texto oculto do Monaco são excluídos. Ao consultar um elemento pai que contenha o editor, a subárvore do editor é removida do texto retornado.

- `await DS.getText(handle)`: retorna o texto sanitizado de um elemento.

- `await DS.setText(handle, text)`: altera o texto somente de elementos que não possuem elementos filhos, impedindo a remoção de HTML aninhado.

- `await DS.getAttribute(handle, name)`: lê o valor de um atributo.

- `await DS.getStyle(handle, property)`: lê o valor calculado de uma propriedade CSS.

- `await DS.setStyle(handle, property, value)`: define um estilo CSS diretamente no elemento. Os valores `display: none` e `opacity` são permitidos para ocultar elementos da interface.

- `await DS.setAttribute(handle, name, value)`: altera um atributo permitido relacionado à acessibilidade ou à apresentação visual.

- `await DS.appendHTML(handle, markup)`: adiciona HTML construído a partir de uma lista permitida de elementos seguros. Elementos de script, manipuladores de eventos, `iframe`, formulários e elementos que incorporam recursos externos não são inseridos. Imagens podem usar apenas URLs `data:` incorporadas diretamente. Os atributos `id` são removidos para evitar conflitos.

- `await DS.addCSS(css)`: adiciona uma folha de estilos. As regras `@import`, `url(...)` e `image-set(...)` são rejeitadas, inclusive quando escritas com caracteres escapados em CSS, para impedir que os estilos das extensões façam requisições de rede.

- `DS.on(eventName, selector, callback)`: registra um ouvinte para os eventos `click`, `input`, `change`, `submit`, `keydown`, `pointerdown` ou `pointerup`. Eventos originados dentro do editor não são entregues às extensões. Não existe uma operação para cancelar a inscrição de eventos nem para remover nós.

## Exemplo de manipulador de eventos

```javascript
DS.on("click", "#execute", async (event) => {
  console.log("Botão de execução clicado", event.target.id);
});
```

As extensões importadas contêm código fornecido pelos próprios usuários. Revise uma extensão antes de instalá-la. O ambiente isolado impede o acesso direto à página e ao editor, enquanto os comandos disponibilizados ainda permitem que uma extensão inspecione e personalize partes da interface que não pertencem ao editor.