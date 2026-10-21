// Простановка микроразметки Schema.org Article на страницы статей.
// Запуск: node tools/add-jsonld.mjs
// Проставляет в каждый article-*.html блок ld+json (Article + FAQPage не нужен:
// FAQ не должно раздувать разметку без реальных вопросов-ответов на странице).
//
// Параметры берутся из самого HTML: <title>, <meta name="description">, <h1>, <h2> —
// ничего не выдумывается, только структурируется уже написанный текст.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, "..");
const BASE = "https://jobotdel-dot.github.io";

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const pick = (html, re) => (html.match(re) || [])[1]?.trim() || "";
const strip = (s) => s.replace(/\s+/g, " ").trim();

const files = readdirSync(SITE).filter((f) => /^article-.*\.html$/.test(f));
let done = 0;

for (const f of files) {
  const p = resolve(SITE, f);
  let html = readFileSync(p, "utf8");

  if (html.includes("application/ld+json")) {
    console.log("уже есть разметка: " + f);
    continue;
  }

  const title = strip(pick(html, /<h1>([\s\S]*?)<\/h1>/) || pick(html, /<title>([\s\S]*?)<\/title>/));
  const desc = strip(pick(html, /<meta name="description" content="([^"]*)"/));
  const kicker = strip(pick(html, /<span class="tag">([\s\S]*?)<\/span>/));
  const lead = strip(pick(html, /<header class="hero">[\s\S]*?<p>([\s\S]*?)<\/p>/));
  const updated = strip(pick(html, /<div class="updated">Обновлено: ([^<]*)<\/div>/));
  const dateMatch = updated.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  const RU_MONTH = {
    января: "01", февраля: "02", марта: "03", апреля: "04", мая: "05", июня: "06",
    июля: "07", августа: "08", сентября: "09", октября: "10", ноября: "11", декабря: "12",
  };
  const datePublished = dateMatch
    ? `${dateMatch[3]}-${RU_MONTH[dateMatch[2]] || "01"}-${String(dateMatch[1]).padStart(2, "0")}`
    : "2026-10-21";
  const wordCount = strip(html.replace(/<[^>]+>/g, " ")).split(/\s+/).length;

  // заголовки разделов → оглавление статьи
  const headings = [...html.matchAll(/<h2>([\s\S]*?)<\/h2>/g)]
    .map((m) => strip(m[1]))
    .slice(0, 12);

  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description: desc || lead,
    inLanguage: "ru-RU",
    datePublished,
    dateModified: datePublished,
    wordCount,
    articleSection: kicker || "Бухгалтерские разборы",
    mainEntityOfPage: { "@type": "WebPage", "@id": `${BASE}/${f}` },
    url: `${BASE}/${f}`,
    image: `${BASE}/og-image.png`,
    author: { "@type": "Organization", name: "По косточкам" },
    publisher: {
      "@type": "Organization",
      name: "По косточкам",
      logo: { "@type": "ImageObject", url: `${BASE}/og-image.png` },
    },
  };
  if (headings.length) {
    data.articleSection = kicker || "Бухгалтерские разборы";
    data.hasPart = headings.map((h) => ({
      "@type": "WebPageElement",
      name: h,
      url: `${BASE}/${f}#${slugify(h)}`,
    }));
  }

  const block =
    `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;

  // canonical
  const canon = `<link rel="canonical" href="${BASE}/${f}">`;

  if (/<link rel="canonical"/.test(html)) {
    html = html.replace(/<link rel="canonical"[^>]*>/, canon);
  } else {
    html = html.replace(/<link rel="stylesheet"/, canon + "\n<link rel=\"stylesheet\"");
  }

  html = html.replace("</head>", block + "\n</head>");
  writeFileSync(p, html, "utf8");
  done++;
  console.log("OK " + f + "  «" + title.slice(0, 55) + "»  слов: " + wordCount);
}

console.log("Готово: " + done + " страниц");

function slugify(s) {
  const map = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
    и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
    с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
    ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  return strip(s.toLowerCase())
    .replace(/[а-яё]/g, (c) => map[c] ?? c)
    .replace(/[^a-z0-9а-яё]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
