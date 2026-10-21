// Конвертер: разбор из блога (Markdown) → страница портала (HTML).
//
// Запуск:  node tools/md-to-html.mjs <путь-к-md> [выходной-html]
// Пример:  node tools/md-to-html.mjs src/04-rsv-1-kvartal.md
//           → ../../buh-portal/article-rsv-1-kvartal.html
//
// Что делает:
//   - читает front-matter (@kicker/@meta/@desc/@lead) и тело;
//   - переводит Markdown в HTML: заголовки, абзацы, таблицы, списки, **жирный**, код, ссылки;
//   - блоки :::example / :::judgment / :::checklist → карточки .scen / .note / .flag
//     (внутри них Markdown рендерится полноценно, включая вложенные списки);
//   - подставляет шапку, «Обновлено», пометку об ИИ, дисклеймер и футер;
//   - НИЧЕГО не выдумывает: текст статьи переносится дословно.
//
// Важно: это вёрстка, а не редактура. Финальный текст перед публикацией
// всё равно сверяется человеком (см. fetch-act.mjs и README).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = resolve(HERE, "..");
const PORTAL_DIR = resolve(BLOG_DIR, "..", "..", "buh-portal");

const RU_DATE = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Moscow",
});

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="nofollow">$1</a>');

function splitFrontMatter(text) {
  const meta = {};
  const lines = text.split(/\r?\n/);
  let i = 0;
  for (; i < lines.length; i++) {
    const m = lines[i].match(/^@(\w+):\s*(.*)$/);
    if (!m) {
      if (lines[i].trim() === "") continue;
      break;
    }
    meta[m[1]] = m[2].trim();
  }
  return { meta, body: lines.slice(i).join("\n") };
}

const FENCE_CLASS = { example: "scen", judgment: "note", checklist: "flag" };

function mdToHtml(md) {
  const out = [];
  const lines = md.split(/\r?\n/);
  let i = 0;
  const para = [];

  const flush = () => {
    if (para.length) {
      out.push("<p>" + inline(para.join(" ")) + "</p>");
      para.length = 0;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // --- блок :::example / :::judgment / :::checklist ---
    const fence = line.match(/^:::\s*(\w+)\s*$/);
    if (fence) {
      flush();
      const type = fence[1];
      const body = [];
      i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // закрывающий :::
      const cls = FENCE_CLASS[type] || "note";
      const head = (body[0] || "").match(/^\*\*(.+)\*\*$/);
      const inner = head ? body.slice(1) : body;
      const title = head ? `<b class="letter">${esc(head[1])}</b>` : "";
      out.push(`<div class="${cls}">${title}${mdToHtml(inner.join("\n"))}</div>`);
      continue;
    }

    // --- таблица ---
    if (/^\|/.test(line) && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1] || "")) {
      flush();
      const cells = (l) => l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        rows.push(cells(lines[i]));
        i++;
      }
      out.push(
        '<table class="mdtable"><thead><tr>' +
          head.map((h) => "<th>" + inline(h) + "</th>").join("") +
          "</tr></thead><tbody>" +
          rows.map((r) => "<tr>" + r.map((c) => "<td>" + inline(c) + "</td>").join("") + "</tr>").join("") +
          "</tbody></table>"
      );
      continue;
    }

    // --- заголовки ---
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flush();
      const lvl = h[1].length;
      if (lvl === 1) {
        out.push(`<!--H1:${esc(h[2])}-->`);
      } else {
        const tag = Math.min(4, lvl);
        out.push(`<h${tag}>${inline(h[2])}</h${tag}>`);
      }
      i++;
      continue;
    }

    // --- списки (в т.ч. вложенные) ---
    if (/^(\s*)([-*]|\d+\.)\s+/.test(line)) {
      flush();
      const baseIndent = line.match(/^(\s*)/)[1].length;
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        if (!m) break;
        const indent = m[1].length;
        if (indent < baseIndent) break;
        if (indent > baseIndent) {
          // вложенный элемент: дочитываем подсписок
          const sub = [];
          i++;
          while (i < lines.length) {
            const mm = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
            if (!mm || mm[1].length <= baseIndent) break;
            sub.push(lines[i]);
            i++;
          }
          const subHtml = mdToHtml(sub.join("\n"));
          if (items.length) items[items.length - 1] += subHtml;
          continue;
        }
        const text = m[3];
        i++;
        items.push("<li>" + inline(text) + "</li>");
      }
      const tag = ordered ? "ol" : "ul";
      const cls = ordered ? ' class="steps"' : "";
      out.push(`<${tag}${cls}>` + items.join("") + `</${tag}>`);
      continue;
    }

    // --- разделитель / пустая строка ---
    if (/^---+$/.test(line) || line.trim() === "") {
      flush();
      i++;
      continue;
    }

    para.push(line.trim());
    i++;
  }
  flush();
  return out.join("\n");
}

if (!process.argv[2]) {
  console.error("Укажите файл: node tools/md-to-html.mjs src/04-rsv-1-kvartal.md");
  process.exit(1);
}

const srcPath = resolve(process.argv[2]);
const slug = basename(srcPath).replace(/\.md$/, "");
const outPath = resolve(
  process.argv[3] || resolve(PORTAL_DIR, `article-${slug.replace(/^\d+-/, "")}.html`)
);

const raw = readFileSync(srcPath, "utf8");
const { meta, body } = splitFrontMatter(raw);
const chunks = mdToHtml(body);

const h1m = chunks.match(/<!--H1:(.*?)-->/);
const title = h1m ? h1m[1] : meta.title || slug;
const content = chunks.replace(/<!--H1:.*?-->\n?/, "").trim();

const now = RU_DATE.format(new Date());
const kicker = meta.kicker || "Разбор ситуации";
const desc = meta.desc || meta.lead || "";
const lead = meta.lead || meta.desc || "";

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${esc(desc)}">
<title>${esc(title)} — По косточкам</title>
<link rel="stylesheet" href="style.css">
</head>
<body>

<div class="top">
  <div class="logo">По косточкам<span>· для бухгалтеров и предпринимателей РФ</span></div>
  <a href="index.html">Назад к порталу</a>
  <a href="index.html#calculators">Калькуляторы</a>
</div>

<div class="wrap">

<header class="hero">
  <span class="tag">${esc(kicker)}</span>
  <h1>${esc(title)}</h1>
  <p>${esc(lead)}</p>
</header>

<section class="art">
<div class="updated">Обновлено: ${now}${meta.meta ? " · " + esc(meta.meta) : ""}</div>

${content}

<div class="badge">Материал подготовлен с помощью ИИ и проверен редактором</div>

<div class="disclaimer"><b>Дисклеймер:</b> этот материал носит информационный характер и не заменяет консультацию с вашим бухгалтером или юристом. Ставки, суммы и процедуры могут меняться. Перед действием проверьте текущую редакцию норм на pravo.gov.ru и разъяснения ФНС на nalog.gov.ru.</div>
</section>

</div>

<footer>
По косточкам · Разбор ситуаций по законодательству РФ · Не юридическая консультация
</footer>

</body>
</html>
`;

writeFileSync(outPath, html, "utf8");
console.error("OK: " + outPath + " (" + html.length + " Б)");
