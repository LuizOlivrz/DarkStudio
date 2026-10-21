// Desktop-only bridge injected into the renderer. It never exposes filesystem paths or arbitrary file access.
(() => {
  if (!window.darkStudioDesktop?.isDesktop) return;

  const extensionForCurrentEditor = () => {
    const language = document.querySelector("#code-language h4")?.textContent?.trim()?.toLowerCase();
    const extensions = { javascript: "js", html: "html", css: "css", json: "json", python: "py", java: "java", "c++": "cpp", c: "c", "c#": "cs", sql: "sql", markdown: "md", rust: "rs" };
    return extensions[language] || "txt";
  };

  document.addEventListener("click", async (event) => {
    const loadButton = event.target.closest?.("#load-button");
    const saveButton = event.target.closest?.("#save-button");
    if (!loadButton && !saveButton) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    try {
      if (loadButton) {
        const file = await window.darkStudioDesktop.openFile();
        if (!file) return;
        if (window.editor?.setValue) {
          window.editor.setValue(file.content);
          window.editor.focus?.();
        }
        window.dispatchEvent(new CustomEvent("darkstudio:file-opened", { detail: { fileName: file.fileName } }));
        return;
      }

      if (saveButton) {
        const content = window.editor?.getValue?.();
        if (typeof content !== "string") return;
        await window.darkStudioDesktop.saveFile({
          content,
          extension: extensionForCurrentEditor(),
          defaultName: `untitled.${extensionForCurrentEditor()}`
        });
      }
    } catch (error) {
      console.error("DarkStudio desktop file operation failed.", error);
    }
  }, true);
})();
