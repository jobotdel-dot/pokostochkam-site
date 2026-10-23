// Подключение favicon, og-image и RSS ко всем страницам сайта.
// Запуск: node tools/add-head-assets.mjs
//
// favicon.svg — иконка во вкладке браузера.
// og-image.png — превью ссылки в Яндексе, Telegram, VK, WhatsApp.
// twitter:card — чтобы ссылка корректно отображалась при отправке в мессенджерах.
// application/rss+xml — автообнаружение ленты: по нему Дзен и агрегаторы
// находят feed.xml, даже если человек не вставил адрес руками.
//
// Каждый элемент проверяется отдельно: страница может уже иметь иконку,
// но не иметь RSS-ссылки — тогда добавляется только недостающее.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, "..");
const BASE = "https://jobotdel-dot.github.io";

// Файлы подтверждения прав поисковиков не трогаем: Яндекс и Google проверяют
// их содержимое строго, любой лишний тег означает «не подтверждено».
const SKIP = /^(google[a-z0-9]*\.html|yandex[_-].*\.html|verification.*\.html)$/i;

const FAVICON = `<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">`;

const RSS = `<link rel="alternate" type="application/rss+xml" title="По косточкам — разборы" href="${BASE}/feed.xml">`;

const OG = `<meta property="og:image" content="${BASE}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${BASE}/og-image.png">`;

let n = 0;
for (const f of readdirSync(SITE).filter((x) => x.endsWith(".html"))) {
  const p = resolve(SITE, f);
  let html = readFileSync(p, "utf8");

  if (SKIP.test(f)) {
    console.log("служебный файл, пропускаю: " + f);
    continue;
  }

  let changed = false;

  // favicon — рядом со stylesheet, если иконки ещё нет
  if (!html.includes('rel="icon"')) {
    html = html.replace(/<link rel="stylesheet"/, FAVICON + '\n<link rel="stylesheet"');
    changed = true;
  }

  // rss — перед </head>, если автообнаружения ещё нет
  if (!html.includes("application/rss+xml")) {
    html = html.replace("</head>", RSS + "\n</head>");
    changed = true;
  }

  // og:image — после og:url, если есть; иначе перед </head>
  if (!html.includes('property="og:image"')) {
    if (html.includes('property="og:url"')) {
      html = html.replace(/(<meta property="og:url"[^>]*>)/, "$1\n" + OG);
    } else {
      html = html.replace("</head>", OG + "\n</head>");
    }
    changed = true;
  }

  if (!changed) {
    console.log("уже всё есть: " + f);
    continue;
  }

  writeFileSync(p, html, "utf8");
  n++;
  console.log("OK " + f);
}
console.log("Готово: " + n + " страниц");
