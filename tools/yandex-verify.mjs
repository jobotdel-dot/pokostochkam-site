// Вставка кода подтверждения из Вебмастера Яндекса — универсальный вариант.
//
// Запуск: node tools/yandex-verify.mjs <код> [имя-файла]
// Пример: node tools/yandex-verify.mjs 8f2a1b3c4d5e6f7a
//         node tools/yandex-verify.mjs 8f2a1b3c4d5e6f7a verification.html
//
// Скрипт сам выбирает имя файла, если вы его не указали:
//   - если код содержит «html» → считается именем файла;
//   - иначе ищет в корне уже существующий файл yandex-verification*.html
//     и дописывает в него код; если такого нет — создаёт verification.html.
//
// Что делает:
//   1. создаёт/дополняет файл подтверждения в корне сайта;
//   2. добавляет <meta name="yandex-verification" content="КОД"> в index.html;
//   3. коммитит и отправляет в GitHub;
//   4. проверяет, что код доступен на живом сайте.
//
// Если код уже пришёл строкой вида:
//   yandex-verification-code-1234567890.html
//   a1b2c3d4e5f6
// (имя и содержимое на разных строках) — передайте обе строки:
//   node tools/yandex-verify.mjs "yandex-verification-code-1234567890.html" "a1b2c3d4e5f6"

import { writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, "..");
const DOMAIN = "jobotdel-dot.github.io";
const GIT = { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" };

const a = (process.argv[2] || "").trim();
const b = (process.argv[3] || "").trim();
if (!a) {
  console.error(
    "Использование:\n" +
      '  node tools/yandex-verify.mjs <код> [имя-файла]\n' +
      '  node tools/yandex-verify.mjs <имя-файла> <код>'
  );
  process.exit(1);
}

// определяем, что есть что
let code = a, fileName = b;
if (/^yandex-verification.*\.html$/i.test(a)) {
  fileName = a;
  code = b || "";
} else if (a.includes(":") && !a.includes("://")) {
  const i = a.indexOf(":");
  fileName = a.slice(0, i).trim();
  code = a.slice(i + 1).trim();
}

// режим --clip: читаем код из буфера обмена (скопировали в Вебмастере — и всё)
if (process.argv.includes("--clip") || !code) {
  const clip = await readClipboard();
  if (clip) {
    console.log("Прочитан код из буфера обмена.");
    code = clip.code;
    if (!fileName && clip.file) fileName = clip.file;
  }
}

// если имя файла не задано — ищем существующий yandex-verification*.html
if (!fileName) {
  const existing = readdirSync(SITE).find((f) => /^yandex-verification.*\.html$/i.test(f));
  fileName = existing || "verification.html";
}

if (!code) {
  console.error("Не указан код подтверждения.");
  console.error("Формат: node tools/yandex-verify.mjs <код> [имя-файла]");
  process.exit(1);
}
if (!/^[A-Za-z0-9._-]+$/.test(fileName)) {
  console.error("Некорректное имя файла: " + fileName);
  process.exit(1);
}

const run = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", env: GIT });

const main = async () => {
  console.log("Домен: " + DOMAIN);
  console.log("Файл:  " + fileName);
  console.log("Код:   " + code.slice(0, 10) + (code.length > 10 ? "…" : "") + "\n");

  // 1. файл подтверждения
  const filePath = resolve(SITE, fileName);
  let content = code;
  if (existsSync(filePath)) {
    const prev = readFileSync(filePath, "utf8");
    // не дублируем код, если он уже там
    content = prev.includes(code) ? prev : prev + "\n" + code;
  }
  writeFileSync(filePath, content, "utf8");
  console.log("Файл записан: " + fileName);

  // 2. мета-тег
  const indexPath = resolve(SITE, "index.html");
  let html = readFileSync(indexPath, "utf8");
  const tag = `<meta name="yandex-verification" content="${code}">`;
  if (html.includes('name="yandex-verification"')) {
    html = html.replace(/<meta name="yandex-verification"[^>]*>/, tag);
    console.log("Мета-тег обновлён");
  } else {
    html = html.replace(/<link rel="stylesheet"/, tag + "\n<link rel=\"stylesheet\"");
    console.log("Мета-тег добавлен");
  }
  writeFileSync(indexPath, html, "utf8");

  // 3. коммит + push
  try {
    run("git", ["add", "-A"]);
    if (run("git", ["status", "--porcelain"]).trim()) {
      run("git", ["commit", "-m", "Подтверждение прав в Вебмастере Яндекса (" + fileName + ")"]);
      run("git", ["push"]);
      console.log("Отправлено в GitHub");
    } else {
      console.log("Изменений нет");
    }
  } catch (e) {
    console.error("Ошибка отправки: " + (e.stderr || e.message));
  }

  // 4. проверка живой версии
  console.log("\nПроверка на живом сайте (Pages пересобирается 1–3 минуты):");
  for (const u of [`https://${DOMAIN}/${fileName}`, `https://${DOMAIN}/`]) {
    try {
      const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" } });
      const t = await r.text();
      const ok = t.includes(code);
      console.log(`  HTTP ${r.status}  ${u}  ${ok ? "код найден ✓" : "код пока не виден"}`);
    } catch (e) {
      console.log(`  ${u} — ${e.message}`);
    }
  }
  console.log("\nДальше: в Вебмастере нажмите «Подтвердить», затем отправьте sitemap и переобход.");
};

main().catch((e) => {
  console.error("Ошибка: " + e.message);
  process.exit(1);
});
