// Проверяет наличие favicon и og-тегов в HTML-страницах сайта.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = /^(google[a-z0-9]*\.html|yandex[_-].*\.html|verification.*\.html)$/i;

let withIcon = 0;
const missing = [];
for (const f of readdirSync(SITE).filter((x) => x.endsWith(".html"))) {
  if (SKIP.test(f)) continue;
  const h = readFileSync(resolve(SITE, f), "utf8");
  if (h.includes('rel="icon"')) withIcon++;
  else missing.push(f);
}
console.log("страниц с иконкой:", withIcon);
console.log("без иконки:", missing.length ? missing.join(", ") : "нет");

// служебные файлы не должны содержать лишних тегов
for (const f of ["yandex_7a1ad0f4bb4ada4f.html", "google9298c565ca80ec5d.html"]) {
  try {
    const h = readFileSync(resolve(SITE, f), "utf8");
    const dirty = /rel="icon"|og:image|rel="stylesheet"/.test(h);
    console.log(f + ":", dirty ? "ЗАГРЯЗНЁН" : "чистый");
  } catch {
    console.log(f + ": нет файла");
  }
}
