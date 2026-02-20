/**
 * 🎨 Theme Switcher Plugin
 * Plugin de exemplo para o Dark Studio
 */

api.log("🎨 Theme Switcher carregado"); // Trocando o 'console.log' por 'api.log' caso use 'console.log' forçadamente irá aparecer um erro no console!

// Simula inicialização do plugin
api.log("⏳ Aplicando tema especial...");
api.loadTheme("halloween"); // Usando loadTheme para carregar um thema oficial do DarkStudio Supondo que 'halloween' seja um tema pré-definido no sistema do DS
api.log("🎃 Tema Halloween aplicado com sucesso!");

api.log("Lendo código do editor...");
const code = api.editor.read();

api.log(code); // Lendo o código do editor usando a API fornecida!
api.log(api.version); // Exibindo a versão do Dark Studio usando a API!