// Простановка id-якорей к <h2> на страницах статей.
// Запуск: node tools/add-anchors.mjs
// Нужен, чтобы ссылки из микроразметки hasPart и оглавление вели в нужный раздел.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, "..");

const strip = (s) => s.replace(/\s+/g, " ").trim();
const map = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};
const slugify = (s) =>
  strip(s.toLowerCase())
    .replace(/[а-яё]/g, (c) => map[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

let n = 0;
for (const f of readdirSync(SITE).filter((x) => /^article-.*\.html$/.test(x))) {
  const p = resolve(SITE, f);
  let html = readFileSync(p, "utf8");
  const used = new Set();
  let count = 0;
  html = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (m, inner) => {
    count++;
    let id = slugify(strip(inner.replace(/<[^>]+>/g, "")));
    let u = id;
    let k = 2;
    while (used.has(u)) u = id + "-" + k++;
    used.add(u);
    return `<h2 id="${u}">${inner}</h2>`;
  });
  writeFileSync(p, html, "utf8");
  n += count;
  console.log(`${f}: ${count} якорей`);
}
console.log("Всего: " + n);
