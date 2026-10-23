// Хлебные крошки BreadcrumbList для статей.
// Запуск: node tools/add-breadcrumbs.mjs
//
// Зачем: Яндекс и Google показывают путь «Главная → Все разборы → Статья»
// в результатах поиска. Это заметнее в выдаче и даёт дополнительные ссылки
// на разделы сайта. Разметка строится из реальных ссылок страницы: ничего
// не выдумывается, кроме названий разделов, которые есть в навигации.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, "..");
const BASE = "https://jobotdel-dot.github.io";

const strip = (s) => s.replace(/\s+/g, " ").trim();

const files = readdirSync(SITE).filter((f) => /^article-.*\.html$/.test(f));
let done = 0;

for (const f of files) {
  const p = resolve(SITE, f);
  let html = readFileSync(p, "utf8");

  if (html.includes("BreadcrumbList")) {
    console.log("уже есть крошки: " + f);
    continue;
  }

  const h1 = strip((html.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1] || "");
  if (!h1) {
    console.log("нет h1, пропускаю: " + f);
    continue;
  }

  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: `${BASE}/` },
      { "@type": "ListItem", position: 2, name: "Все разборы", item: `${BASE}/articles.html` },
      { "@type": "ListItem", position: 3, name: h1, item: `${BASE}/${f}` },
    ],
  };

  const block = `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
  html = html.replace("</head>", block + "\n</head>");
  writeFileSync(p, html, "utf8");
  done++;
  console.log("OK " + f + "  «" + h1.slice(0, 50) + "»");
}

console.log("Готово: " + done + " страниц");
