// Перелинковка: добавляет блок «Другие разборы» в конец каждой статьи,
// строит страницу «Все разборы» (articles.html) и RSS-ленту (feed.xml).
//
// Запуск: node tools/add-related.mjs
//
// Зачем: для поисковика страницы должны быть связаны между собой —
// это поднимает вес каждой статьи и удерживает читателя на сайте.
// Для читателя это просто удобно: «ещё по этой теме».

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, "..");
const BASE = "https://jobotdel-dot.github.io";

const strip = (s) => s.replace(/\s+/g, " ").trim();
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const files = readdirSync(SITE).filter((f) => /^article-.*\.html$/.test(f));

// собрать метаданные всех статей
const ARTICLES = files.map((f) => {
  const html = readFileSync(resolve(SITE, f), "utf8");
  return {
    file: f,
    title: strip((html.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1] || ""),
    desc: strip((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || ""),
    kicker: strip((html.match(/<span class="tag">([\s\S]*?)<\/span>/) || [])[1] || ""),
    date: strip((html.match(/<div class="updated">Обновлено: ([^<]*)<\/div>/) || [])[1] || ""),
  };
});

// 1. блок «Другие разборы» в каждую статью
let n = 0;
for (const a of ARTICLES) {
  const p = resolve(SITE, a.file);
  let html = readFileSync(p, "utf8");
  if (html.includes('class="related"')) { console.log("уже есть: " + a.file); continue; }

  // 3 похожие: сначала по общим словам заголовка, потом — по порядку
  const words = (s) =>
    new Set(
      s.toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((w) => w.length > 4)
    );
  const aw = words(a.title + " " + a.kicker);
  const others = ARTICLES.filter((x) => x.file !== a.file).map((x) => {
    const xw = words(x.title + " " + x.kicker);
    let common = 0;
    for (const w of aw) if (xw.has(w)) common++;
    return { x, score: common };
  });
  others.sort((p, q) => q.score - p.score);
  const picks = others.slice(0, 3).map((o) => o.x);

  const block = `
<h2>Другие разборы</h2>
<div class="related">
${picks.map((x) => `  <a class="rel" href="${x.file}">
    <span class="kicker">${esc(x.kicker)}</span>
    <span class="t">${esc(x.title)}</span>
  </a>`).join("\n")}
</div>
`;

  // вставляем перед дисклеймером
  const disc = html.indexOf('<div class="disclaimer"');
  if (disc > 0) {
    html = html.slice(0, disc) + block + "\n" + html.slice(disc);
  } else {
    html = html.replace("</section>", block + "\n</section>");
  }
  writeFileSync(p, html, "utf8");
  n++;
  console.log("OK " + a.file);
}
console.log("Блок «Другие разборы» добавлен: " + n);

// 2. страница «Все разборы»
const allRows = ARTICLES.map(
  (a) => `  <a class="rel" href="${a.file}">
    <span class="kicker">${esc(a.kicker)}</span>
    <span class="t">${esc(a.title)}</span>
    <span class="d">${esc(a.desc)}</span>
  </a>`
).join("\n");

const articlesHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Все разборы — По косточкам</title>
<meta name="description" content="Все разборы бухгалтерских ситуаций по законодательству РФ: налоги, отчётность, взносы, штрафы. С примерами расчётов и ссылками на первоисточники.">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/og-image.png">
<link rel="canonical" href="${BASE}/articles.html">
<meta property="og:type" content="website">
<meta property="og:title" content="Все разборы — По косточкам">
<meta property="og:description" content="Разборы налоговых и отчётностных ситуаций для ИП и бухгалтеров РФ.">
<meta property="og:url" content="${BASE}/articles.html">
<meta property="og:image" content="${BASE}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${BASE}/og-image.png">
<link rel="stylesheet" href="/style.css">
</head>
<body>

<div class="top">
  <div class="logo">По косточкам<span>· для бухгалтеров и предпринимателей РФ</span></div>
  <a href="/">На главную</a>
  <a href="/articles.html">Все разборы</a>
  <a href="/feed.xml">RSS</a>
</div>

<div class="wrap">

<header class="hero">
  <span class="tag">${ARTICLES.length} разборов · обновляются 3 раза в неделю</span>
  <h1>Все разборы</h1>
  <p>Каждый разбор — одна ситуация: что произошло, что говорит закон, что делать по шагам и чем может закончиться. Все цифры сверены с первоисточником.</p>
</header>

<section class="art">
<div class="updated">Все материалы · по дате проверки</div>

<div class="related">
${allRows}
</div>

<div class="disclaimer"><b>Дисклеймер:</b> эти материалы носят информационный характер и не заменяют консультацию с вашим бухгалтером или юристом. Ставки, суммы и процедуры могут меняться. Перед действием проверьте текущую редакцию норм на pravo.gov.ru и разъяснения ФНС на nalog.gov.ru.</div>
</section>

</div>

<footer>
По косточкам · Разбор ситуаций по законодательству РФ · Не юридическая консультация
</footer>

</body>
</html>
`;
writeFileSync(resolve(SITE, "articles.html"), articlesHtml, "utf8");
console.log("OK articles.html");

// 3. RSS-лента
const rssItems = ARTICLES.map(
  (a) => `    <item>
      <title>${esc(a.title)}</title>
      <link>${BASE}/${a.file}</link>
      <guid isPermaLink="true">${BASE}/${a.file}</guid>
      <description>${esc(a.desc)}</description>
      <category>${esc(a.kicker)}</category>
    </item>`
).join("\n");

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>По косточкам — разборы бухгалтерских ситуаций</title>
    <link>${BASE}/</link>
    <atom:link href="${BASE}/feed.xml" rel="self" type="application/rss+xml" xmlns:atom="http://www.w3.org/2005/Atom"/>
    <description>Налоги, отчётность, взносы и штрафы для ИП и бухгалтеров РФ. Разборы с примерами расчётов и ссылками на первоисточники.</description>
    <language>ru</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${rssItems}
  </channel>
</rss>
`;
writeFileSync(resolve(SITE, "feed.xml"), rss, "utf8");
console.log("OK feed.xml");
