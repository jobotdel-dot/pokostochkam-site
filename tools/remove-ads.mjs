// Удаление рекламных слотов с публичных страниц.
// Запуск: node tools/remove-ads.mjs
//
// Слоты нужны только когда на сайте реально идёт показ рекламы. До этого момента
// пустые рамки выглядят как недоделка и снижают доверие. Инструмент add-ads.mjs
// и инструкция ADS-YANDEX.md остаются — вернуть слоты можно одной командой.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, "..");

const SLOT_RE =
  /\n?<!-- Рекламный блок:[^>]*?-->\s*<div class="ad-slot"[\s\S]*?<\/div>\s*/g;

let n = 0;
for (const f of readdirSync(SITE).filter((x) => x.endsWith(".html"))) {
  const p = resolve(SITE, f);
  const html = readFileSync(p, "utf8");
  if (!html.includes("ad-slot")) continue;
  const cleaned = html.replace(SLOT_RE, "\n").replace(/\n{3,}/g, "\n\n");
  writeFileSync(p, cleaned, "utf8");
  n++;
  console.log("OK " + f);
}
console.log("Очищено страниц: " + n);
