// Вставка рекламного блока (Яндекс.Директ / РСЯ) на страницы сайта.
//
// Запуск: node tools/add-ads.mjs
//
// Что вставляется:
//   - контейнер <div id="ad-slot-top"> и <div id="ad-slot-bottom"> на каждой странице;
//   - метка ad-slot в разметке для Яндекс.Директа (блок «Рекламная сеть»).
//
// ВАЖНО: сам код объявления вставляется НЕ здесь. Его вставляет Яндекс.Директ
// при создании рекламного блока (или вручную в HTML). Для РСЯ обязательна
// маркировка erid — без неё показ рекламы на сайте с аудиторией из РФ
// нарушает ст. 18.1 Федерального закона «О рекламе» (38-ФЗ).
//
// Куда вставлять код: в разметку страницы перед </body>, например:
//   <div id="ad-slot-top" style="...">ЗДЕСЬ КОД БЛОКА ДИРЕКТА</div>

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, "..");

const TOP_SLOT = `
<!-- Рекламный блок: верх статьи. Вставьте сюда код блока Яндекс.Директа.
     Для РСЯ обязательна маркировка erid (ст. 18.1 38-ФЗ). -->
<div class="ad-slot" id="ad-slot-top" data-ad-slot="top" style="min-height:90px;margin:22px 0;text-align:center;">
  <!-- КОД БЛОКА ДИРЕКТА -->
</div>
`;

const BOTTOM_SLOT = `
<!-- Рекламный блок: низ статьи. -->
<div class="ad-slot" id="ad-slot-bottom" data-ad-slot="bottom" style="min-height:90px;margin:26px 0;text-align:center;">
  <!-- КОД БЛОКА ДИРЕКТА -->
</div>
`;

let n = 0;
for (const f of readdirSync(SITE).filter((x) => x.endsWith(".html") && x !== "404.html")) {
  const p = resolve(SITE, f);
  let html = readFileSync(p, "utf8");
  if (html.includes('id="ad-slot-top"')) {
    console.log("уже есть: " + f);
    continue;
  }

  // верхний слот — перед первым <h2> внутри статьи
  const firstH2 = html.indexOf("<h2");
  if (firstH2 > 0) {
    html = html.slice(0, firstH2) + TOP_SLOT + "\n" + html.slice(firstH2);
  }
  // нижний слот — перед дисклеймером
  const disc = html.indexOf('<div class="disclaimer"');
  if (disc > 0) {
    html = html.slice(0, disc) + BOTTOM_SLOT + "\n" + html.slice(disc);
  }
  writeFileSync(p, html, "utf8");
  n++;
  console.log("OK " + f);
}
console.log("Готово: " + n + " страниц");
