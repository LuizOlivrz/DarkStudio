# DarkStudio Extension API

Extensions are JSON files with the `.dsx.json` suffix. The code runs in an iframe with `sandbox="allow-scripts"`, an opaque origin, and a restrictive Content Security Policy. It cannot access `window.editor`, Monaco models, the editor DOM, local storage, or the DarkStudio source files.

The extension host exposes only the `DS` command API. There is intentionally no command to remove DOM nodes, clear styles, or delete app data. An extension may hide or restyle existing interface elements with CSS, and may append sanitized HTML. Disabling an extension disables its stylesheet and hides its contributed HTML; nothing is removed from the page.

## Manifest

```json
{
  "id": "sample.hello-world",
  "name": "Hello World",
  "version": "1.0.0",
  "description": "Adds a small welcome note to the options panel.",
  "code": "(async () => { const [options] = await DS.query('#options'); if (options) await DS.appendHTML(options.handle, '<p class=\"hello-extension\">Hello from a DarkStudio extension.</p>'); await DS.addCSS('.hello-extension { padding: 8px; color: var(--accent-color); }'); })();"
}
```

The `id` must be unique and contain 2–64 letters, numbers, dots, underscores, or hyphens. Extension files are limited to 256 KiB; installed extensions together are limited to 2 MiB.

## Commands

- `await DS.query(selector)` returns up to 100 matching elements as safe descriptors: `handle`, `tagName`, `id`, `className`, `text`, and `attributes`. Editor nodes and Monaco's hidden text input are excluded. When querying a parent that contains the editor, its editor subtree is removed from the returned text.
- `await DS.getText(handle)` returns sanitized text for an element.
- `await DS.setText(handle, text)` changes text only on elements without child elements, so it cannot remove nested HTML.
- `await DS.getAttribute(handle, name)` reads an attribute.
- `await DS.getStyle(handle, property)` reads a computed CSS property.
- `await DS.setStyle(handle, property, value)` sets an inline style. `display: none` and `opacity` are allowed for hiding interface elements.
- `await DS.setAttribute(handle, name, value)` changes an allowed accessible or presentational attribute.
- `await DS.appendHTML(handle, markup)` appends HTML built from a safe element allowlist. Script, event-handler, iframe, form, and embedded-resource elements are not inserted. Images can use inline `data:` URLs only; IDs are stripped to avoid collisions.
- `await DS.addCSS(css)` appends a stylesheet. `@import`, `url(...)`, and `image-set(...)` are rejected (including CSS-escaped spellings) to keep extension styles from making network requests.
- `DS.on(eventName, selector, callback)` subscribes to `click`, `input`, `change`, `submit`, `keydown`, `pointerdown`, or `pointerup`. Events originating in the editor are not delivered. There is no unsubscribe or remove-node operation.

Example event handler:

```js
DS.on("click", "#execute", async (event) => {
  console.log("Run button clicked", event.target.id);
});
```

Imported extensions are user code. Review an extension before installing it. The sandbox prevents direct page and editor access, while commands still let an extension inspect and customize non-editor UI.
