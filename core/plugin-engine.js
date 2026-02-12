import { runSandboxedPlugin } from "./sandbox.js";
import { getDevMode, version } from "../Extras/Code/config.js";

export async function loadPlugins(editor) {
  if (!editor || !window.monaco) return;

  const plugins = ["plugins/theme-switcher"];

  const api = Object.freeze({
    editor: Object.freeze({
      read() {
        return editor.getValue();
      },
    }),

    loadTheme: window.loadTheme,
    version: version,

    log(msg) {
      if (getDevMode()) {
        console.log(`🔌 [Plugin] ${msg}`);
      }
    },
  });

  for (const path of plugins) {
    try {
      const manifest = await fetch(`${path}/plugin.json`).then((r) => r.json());
      const code = await fetch(`${path}/${manifest.main}`).then((r) =>
        r.text(),
      );

      runSandboxedPlugin(code, api);

      api.log(`Carregado: ${manifest.name}`);
    } catch (e) {
      console.error(`❌ Plugin falhou (${path})`, e);
    }
  }
}
