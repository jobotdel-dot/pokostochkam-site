// Публикация статьи: от Markdown до живого сайта одной командой.
//
// Запуск: node tools/publish-article.mjs src/08-novaya-tema.md [--no-push] [--force]
//
// Что делает (по шагам):
//   1. ЛИНТ       — проверяет статью по правилам редакции (tools/lint-article.mjs).
//                   Блокирующие замечания останавливают публикацию.
//   2. ВЁРСТКА    — Markdown → HTML страницы портала (tools/md-to-html.mjs).
//   3. МИКРОРАЗМЕТКА и ЯКОРЯ — Schema.org + id для заголовков.
//   4. ПЕРЕЛИНКОВКА — блок «Другие разборы» + страница articles.html.
//   5. КАРТА САЙТА и RSS — новая страница попадает в sitemap.xml и feed.xml.
//   6. ГЛАВНАЯ    — карточка новой статьи добавляется на главную.
//   7. ПРОВЕРКИ   — целостность ссылок и полнота переноса текста.
//   8. PUSH       — коммит и отправка в GitHub; сайт обновится через 1–3 минуты.
//
// Источник правды — папка pokostochkam-site. Живой репозиторий Pages — github-io-root.
// Скрипт сам синхронизирует их перед push.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, readdirSync, copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { lintArticle, printLint } from "./lint-core.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, "..");                        // pokostochkam-site — источник правды
const WORKSPACE = resolve(SITE, "..");
const BLOG = resolve(WORKSPACE, "default-workspace", "blog-usn-2026"); // исходники статей
const LIVE = resolve(WORKSPACE, "github-io-root");        // репозиторий с GitHub Pages
const TOOLS = HERE;                                       // все инструменты — здесь
const GIT = { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" };

const NO_PUSH = process.argv.includes("--no-push");
const FORCE = process.argv.includes("--force");

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: "utf8", env: GIT, stdio: "pipe", ...opts });

const step = (n, title) => console.log(`\n[${n}] ${title}`);
const ok = (msg) => console.log("    ✓ " + msg);
const info = (msg) => console.log("    " + msg);

// ───────────────────────────────────────────────────────────
const main = async () => {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Укажите файл: node tools/publish-article.mjs src/08-tema.md");
    process.exit(1);
  }
  // путь ищем и относительно папки блога, и относительно текущей — как удобнее
  const candidates = [
    resolve(BLOG, arg),
    resolve(process.cwd(), arg),
    resolve(SITE, arg),
  ];
  const srcPath = candidates.find((p) => existsSync(p));
  if (!srcPath) {
    console.error("Файл не найден. Проверенные пути:");
    candidates.forEach((p) => console.error("  " + p));
    process.exit(1);
  }
  const slug = basename(srcPath).replace(/\.md$/, "");
  const num = (slug.match(/^(\d+)/) || [])[1] || "00";
  const pageName = `article-${slug.replace(/^\d+-/, "")}.html`;

  console.log("═".repeat(64));
  console.log("ПУБЛИКАЦИЯ: " + slug);
  console.log("═".repeat(64));

  // ── 1. ЛИНТ ──────────────────────────────────────────────
  step(1, "Проверка статьи по правилам редакции");
  // логику линтера импортируем напрямую: запуск вложенного node-процесса здесь ненадёжен
  const lintResult = lintArticle(srcPath);
  printLint(lintResult);
  if (lintResult.errors.length && !FORCE) {
    console.log("\n✗ Есть блокирующие замечания. Исправьте статью или запустите с --force.");
    process.exit(1);
  }
  if (lintResult.errors.length) console.log("    ⚠ публикуем с --force, несмотря на замечания");

  // ── 2. ВЁРСТКА ───────────────────────────────────────────
  step(2, "Вёрстка страницы");
  const mdToHtml = run("node", [resolve(HERE, "md-to-html.mjs"), srcPath, resolve(SITE, pageName)]);
  info(mdToHtml.trim().split("\n").pop());
  // новая страница собирается с нуля — возвращаем на неё счётчик Метрики
  // (номер берётся с уже размеченных страниц, поэтому аргумент не нужен)
  const metrika = run("node", [resolve(HERE, "add-metrika.mjs")]);
  const metrikaLine = metrika.trim().split("\n").find((l) => /^✓|^↻/.test(l)) || "счётчик на месте";
  info(metrikaLine.trim());

  // ── 3. МИКРОРАЗМЕТКА + ЯКОРЯ ─────────────────────────────
  step(3, "Микроразметка и якоря");
  run("node", [resolve(HERE, "add-jsonld.mjs")]);
  run("node", [resolve(HERE, "add-anchors.mjs")]);
  run("node", [resolve(HERE, "add-breadcrumbs.mjs")]);
  // favicon и og:image: новая страница собирается с нуля, без этого шага
  // иконка на вкладке пропадает (служебные файлы подтверждения инструмент пропускает)
  run("node", [resolve(HERE, "add-head-assets.mjs")]);
  ok("Schema.org Article, крошки, id заголовков, favicon, og:image и RSS");

  // ── 4. ПЕРЕЛИНКОВКА ─────────────────────────────────────
  step(4, "Перелинковка и страница «Все разборы»");
  run("node", [resolve(HERE, "add-related.mjs")]);
  ok("блок «Другие разборы», articles.html, feed.xml");

  // ── 5. КАРТА САЙТА ───────────────────────────────────────
  step(5, "Карта сайта");
  const sitemapPath = resolve(SITE, "sitemap.xml");
  let sitemap = readFileSync(sitemapPath, "utf8");
  const loc = `https://jobotdel-dot.github.io/${pageName}`;
  if (!sitemap.includes(loc)) {
    sitemap = sitemap.replace(
      "</urlset>",
      `  <url>
    <loc>${loc}</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`
    );
    writeFileSync(sitemapPath, sitemap, "utf8");
    ok("добавлен URL: " + pageName);
  } else {
    ok("URL уже в карте сайта");
  }

  // ── 6. ГЛАВНАЯ ───────────────────────────────────────────
  step(6, "Карточка на главной");
  const indexPath = resolve(SITE, "index.html");
  let index = readFileSync(indexPath, "utf8");
  if (index.includes(pageName)) {
    ok("карточка уже есть");
  } else {
    const raw = readFileSync(srcPath, "utf8");
    const grab = (tag) => {
      const m = raw.match(new RegExp(`^${tag}:\\s*(.*)$`, "m"));
      return m ? m[1].trim() : "";
    };
    const kicker = grab("@kicker") || "Разбор";
    const desc = grab("@desc") || "";
    const title = (raw.match(/^#\s+(.*)$/m) || [])[1] || slug;
    const card = `  <a class="card" href="${pageName}">
    <div class="kicker">${kicker.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>
    <h3>${title.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</h3>
    <p>${desc.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>
  </a>
`;
    // вставляем в конец списка карточек (после последней </a> внутри .cards)
    const cardsEnd = index.indexOf("</div>\n</section>\n\n<section id=\"how\">");
    if (cardsEnd > 0) {
      index = index.slice(0, cardsEnd) + card + index.slice(cardsEnd);
    } else {
      const marker = "</div>\n</section>";
      const at = index.indexOf(marker);
      index = index.slice(0, at) + card + index.slice(at);
    }
    writeFileSync(indexPath, index, "utf8");
    ok("карточка добавлена: " + title.slice(0, 50));
  }

  // ── 7. ПРОВЕРКИ ──────────────────────────────────────────
  step(7, "Проверки целостности");
  const siteCheck = run("node", [resolve(SITE, "tools", "check-site.mjs")]);
  const siteOk = siteCheck.includes("проблем: 0");
  console.log("    " + siteCheck.trim().split("\n").slice(-2).join(" · "));
  if (!siteOk) {
    console.log("    ✗ есть проблемы со ссылками — публикация остановлена");
    process.exit(1);
  }
  const contentCheck = run("node", [resolve(SITE, "tools", "check-content.mjs")]);
  const lost = (contentCheck.match(/Итого потеряно фрагментов:\s*(\d+)/) || [])[1];
  info("потеряно фрагментов при вёрстке: " + lost);

  // ── 8. PUSH ──────────────────────────────────────────────
  step(8, "Синхронизация и отправка");
  // копируем изменённые файлы в живой репозиторий
  const COPY = [".html", ".css", ".js", ".xml", ".txt", ".svg", ".png", ".md"];
  let copied = 0;
  for (const f of readdirSync(SITE)) {
    if (!COPY.includes(f.slice(f.lastIndexOf(".")))) continue;
    const from = resolve(SITE, f);
    const to = resolve(LIVE, f);
    if (!existsSync(to) || readFileSync(from).length !== readFileSync(to).length ||
        readFileSync(from).toString("utf8") !== readFileSync(to).toString("utf8")) {
      copyFileSync(from, to);
      copied++;
    }
  }
  if (!existsSync(resolve(LIVE, "tools"))) mkdirSync(resolve(LIVE, "tools"), { recursive: true });
  for (const f of readdirSync(resolve(SITE, "tools"))) {
    copyFileSync(resolve(SITE, "tools", f), resolve(LIVE, "tools", f));
  }
  ok(`синхронизировано файлов: ${copied}`);

  if (NO_PUSH) {
    console.log("\n--no-push: изменения оставлены локально.");
    return;
  }

  for (const [name, dir] of [["pokostochkam-site", SITE], ["github-io-root", LIVE]]) {
    try {
      run("git", ["add", "-A"], { cwd: dir });
      const st = run("git", ["status", "--porcelain"], { cwd: dir }).trim();
      if (st) {
        run("git", ["commit", "-m", `Статья: ${slug}`], { cwd: dir });
        run("git", ["push"], { cwd: dir });
        ok(name + ": отправлено");
      } else {
        ok(name + ": изменений нет");
      }
    } catch (e) {
      console.log("    ! " + name + ": " + (e.stderr || e.message).split("\n")[0]);
    }
  }

  console.log("\n" + "═".repeat(64));
  console.log("✓ Опубликовано: " + pageName);
  console.log("  Через 1–3 минуты: https://jobotdel-dot.github.io/" + pageName);
  console.log("═".repeat(64));
};

main().catch((e) => {
  console.error("\nОшибка: " + (e.stderr || e.message).split("\n")[0]);
  process.exit(1);
});
