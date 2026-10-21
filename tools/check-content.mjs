// Сверка: сколько текста из Markdown попало в HTML (ничего не потеряно).
import { readFileSync } from "node:fs";
import { dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "..", "src");
const PORTAL = resolve(HERE, "..", "..", "..", "buh-portal");
const files = [
  "01-avans-usn-2026", "02-reforma-3-0", "03-rashody-usn-2026", "04-rsv-1-kvartal",
  "05-uvedomleniya-aprel", "06-shtrafy-kkt", "07-deklaraciya-nds",
];

const plain = (s) =>
  s.replace(/```[\s\S]*?```/g, " ").replace(/[*#>`|:\-]+/g, " ").replace(/\s+/g, " ").trim();

let totalLost = 0;
for (const f of files) {
  const md = readFileSync(resolve(SRC, f + ".md"), "utf8");
  const html = readFileSync(resolve(PORTAL, `article-${f.replace(/^\d+-/, "")}.html`), "utf8");
  const m = plain(md);
  const h = plain(html.replace(/<style[\s\S]*?<\/style>/g, " "));
  // каждое «содержательное» слово md должно встречаться в html
  const words = [...new Set(m.split(" ").filter((w) => w.length > 4))];
  const missing = words.filter((w) => !h.includes(w));
  const pct = ((words.length - missing.length) / words.length) * 100;
  console.log(`${f}: слов ${words.length}, потеряно ${missing.length} (${pct.toFixed(1)}% перенесено)`);
  if (missing.length) console.log("   потеряно:", missing.slice(0, 12).join(" "));
  totalLost += missing.length;
}
console.log("Итого потеряно фрагментов:", totalLost);
