export function runSandboxedPlugin(code, api) {
  const sandboxAPI = Object.freeze(api);

  const wrappedCode = `
      "use strict";
  
      // 🔒 Bloqueio por shadowing seguro
      const window = undefined;
      const document = undefined;
      const localStorage = undefined;
      const sessionStorage = undefined;
      const indexedDB = undefined;
      const navigator = undefined;
      const location = undefined;
      const parent = undefined;
      const top = undefined;
      const frames = undefined;
      const console = undefined;
  
      return (function(api) {
        ${code}
      });
    `;

  try {
    const factory = new Function(wrappedCode);
    const pluginFn = factory();
    pluginFn(sandboxAPI);
  } catch (err) {
    throw err;
  }
}
