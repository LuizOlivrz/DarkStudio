export async function loadPlugins(editor) {
  const plugins = [
    "plugins/theme-switcher", // plugin de exemplo
  ];

  for (const path of plugins) {
    try {
      const manifest = await fetch(`${path}/plugin.json`).then((r) => r.json());
      const module = await import(`../${path}/${manifest.main}`);

      if (typeof module.activate === "function") {
        module.activate({
          editor,
          monaco,
          loadTheme: window.loadTheme, // usa sua função existente
        });

        console.log(`🔌 Plugin carregado: ${manifest.name}`);
      }
    } catch (err) {
      console.error(`❌ Erro ao carregar plugin ${path}`, err);
    }
  }
}
