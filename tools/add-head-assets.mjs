// Подключение favicon и og-image ко всем страницам сайта.
// Запуск: node tools/add-head-assets.mjs
//
// favicon.svg — иконка во вкладке браузера.
// og-image.png — превью ссылки в Яндексе, Telegram, VK, WhatsApp.
// twitter:card — чтобы ссылка корректно отображалась при отправке в мессенджерах.

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
<link rel="apple-touch-icon" href="/og-image.png">`;

const OG = `<meta property="og:image" content="${BASE}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${BASE}/og-image.png">`;

let n = 0;
for (const f of readdirSync(SITE).filter((x) => x.endsWith(".html"))) {
  const p = resolve(SITE, f);
  let html = readFileSync(p, "utf8");
  if (SKIP.test(f)) { console.log("служебный файл, пропускаю: " + f); continue; }
  if (html.includes('rel="icon"')) { console.log("уже есть: " + f); continue; }

  // favicon — рядом со stylesheet
  html = html.replace(/<link rel="stylesheet"/, FAVICON + "\n<link rel=\"stylesheet\"");

  // og:image — после og:url, если есть; иначе перед </head>
  if (html.includes('property="og:url"')) {
    html = html.replace(/(<meta property="og:url"[^>]*>)/, "$1\n" + OG);
  } else {
    html = html.replace("</head>", OG + "\n</head>");
  }

  writeFileSync(p, html, "utf8");
  n++;
  console.log("OK " + f);
}
console.log("Готово: " + n + " страниц");
