# Integração Android: receber texto compartilhado

O Workspace já expõe uma função JavaScript para transformar um texto recebido pelo aplicativo Android em um **novo item** do Workspace:

```js
window.darkStudioReceiveSharedText(text);
```

Também aceita um objeto com título opcional:

```js
window.darkStudioReceiveSharedText({
  text: "Conteúdo recebido pelo Android",
  title: "Texto compartilhado"
});
```

A função cria um novo nó de texto, persiste o Workspace e mantém os itens existentes. O texto não é enviado ao NightCoder nem a um servidor por essa operação.

## O que o aplicativo Android precisa fazer

O projeto GitHub contém o site e o aplicativo Electron desktop, mas não contém o projeto Android nativo gerado pelo FreeWebsiteToApk. Por isso, a recepção do seletor **Abrir com/Compartilhar** precisa ser habilitada no projeto Android que gera o APK.

A camada nativa Android deve:

1. Declarar um `intent-filter` para `android.intent.action.SEND`, `android.intent.category.DEFAULT` e MIME `text/plain`.
2. Ler o conteúdo recebido por `Intent.EXTRA_TEXT` em `onCreate` e também em `onNewIntent`.
3. Aguardar o carregamento da página do DarkStudio no WebView.
4. Encaminhar o texto à função `window.darkStudioReceiveSharedText(...)`, por exemplo usando `evaluateJavascript` e uma serialização JSON segura.
5. Não substituir o estado atual do Workspace. A função JavaScript já cria um novo item.

Exemplo conceitual no lado Android (Java):

```java
String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
if (sharedText != null && !sharedText.trim().isEmpty()) {
    String argument = org.json.JSONObject.quote(sharedText);
    webView.evaluateJavascript(
        "window.darkStudioReceiveSharedText(" + argument + ")",
        null
    );
}
```

O exemplo deve ser executado somente depois que o WebView terminar de carregar. Não concatene texto recebido diretamente em JavaScript sem serialização JSON.

## Limitação do FreeWebsiteToApk

A integração acima depende de o gerador Android permitir configurar o recebimento de `ACTION_SEND` e encaminhar `EXTRA_TEXT` ao WebView. A documentação pública consultada do FreeWebsiteToApk descreve deep links/App Links, mas não confirma esse fluxo de compartilhamento de texto. Portanto, a função JavaScript está preparada no site, mas o APK não pode ser considerado compatível com **Abrir com** até que essa parte nativa seja configurada e testada no projeto que gera o APK.
