const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packagePath = path.join(root, "package.json");
const configPath = path.join(root, "Extras", "Code", "config.js");

const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const configSource = fs.readFileSync(configPath, "utf8");
const match = configSource.match(/export\s+const\s+version\s*=\s*["'](\d{2})\.(\d{2})\.(\d{2})["']/);

if (!match) {
  throw new Error("Não foi possível identificar a versão DD.MM.YY em Extras/Code/config.js.");
}

const [, dayText, monthText, yearText] = match;
const day = Number(dayText);
const month = Number(monthText);
const year = 2000 + Number(yearText);
const date = new Date(Date.UTC(year, month - 1, day));

if (
  date.getUTCFullYear() !== year ||
  date.getUTCMonth() !== month - 1 ||
  date.getUTCDate() !== day
) {
  throw new Error("A versão em Extras/Code/config.js contém uma data inválida.");
}

// MSI uses a numeric three-part product version. YY.MM.DD preserves chronological
// upgrade ordering while the application keeps displaying DD.MM.YY.
packageJson.version = yearText + "." + monthText + "." + dayText;
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + "\n", "utf8");

console.log("Versão do instalador sincronizada: " + packageJson.version +
  " (versão do app: " + dayText + "." + monthText + "." + yearText + ").");
