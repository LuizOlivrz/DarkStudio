(() => {
  const supportedLanguages = ["en-US", "pt-BR", "ru", "ja", "ko", "zh-CN", "de", "es"];
  let savedLanguage = null;
  try {
    savedLanguage = localStorage.getItem("darkstudio-language");
  } catch {
    // Browser language detection still works when storage is unavailable.
  }
   if (supportedLanguages.includes(savedLanguage)) {
    document.documentElement.lang = savedLanguage;
    return;
  }
   const browserLanguages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language || "en-US"];
  const normalizedLanguages = browserLanguages.map((locale) =>
    String(locale).toLowerCase(),
  );
  const exactMatch = normalizedLanguages
    .map((locale) =>
      supportedLanguages.find((code) => code.toLowerCase() === locale),
    )
    .find(Boolean);
  const languageMatch =
    normalizedLanguages.some((locale) => locale.startsWith("pt"))
      ? "pt-BR"
      : normalizedLanguages.some((locale) => locale.startsWith("ru"))
        ? "ru"
        : "en-US";
   document.documentElement.lang = exactMatch || languageMatch;
})();
