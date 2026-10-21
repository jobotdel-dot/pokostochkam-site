// Подтверждение прав на сайт в Вебмастере Яндекса.
//
// Запуск: node tools/yandex-verify.mjs <код-подтверждения> [файл]
//
// Что делает:
//   1. создаёт в корне сайта файл подтверждения (по умолчанию verification.html)
//      с содержимым, которое выдаёт Вебмастер;
//   2. добавляет в index.html мета-тег
//      <meta name="yandex-verification" content="КОД">;
//   3. коммитит и отправляет изменения в GitHub;
//   4. проверяет, что файл и тег стали доступны на живом сайте.
//
// Где взять код:
//   Вебмастер Яндекса → «Добавить сайт» → «Доменное имя» → jobotdel-dot.github.io
//   → «Подтвердить права» → выберите «Файл» → Яндекс покажет ИМЯ ФАЙЛА и СОДЕРЖИМОЕ.
//   Вставьте содержимое (или весь блок) в эту команду.
//
// Пример:
//   node tools/yandex-verify.mjs "a1b2c3d4e5f6"
//   node tools/yandex-verify.mjs "yandex-verification-code-123.html:код-подтверждения"
//
// Если код уже вставлен в meta-тег на website.com — всё равно нужен файл:
//   Яндекс проверяет оба способа, но файл надёжнее (meta-тег должен быть в <head>).

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, "..");
const DOMAIN = "jobotdel-dot.github.io";
const GIT = { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" };

const arg = (process.argv[2] || "").trim();
if (!arg) {
  console.error(
    "Укажите код подтверждения из Вебмастера:\n" +
      "  node tools/yandex-verify.mjs <код>\n" +
      "  node tools/yandex-verify.mjs <имя-файла>:<содержимое>"
  );
  process.exit(1);
}

// разбираем ввод: либо "код", либо "имя-файла:содержимое"
let fileName = "verification.html";
let code = arg;
if (arg.includes(":") && !arg.includes("://")) {
  const i = arg.indexOf(":");
  fileName = arg.slice(0, i).trim();
  code = arg.slice(i + 1).trim();
}
if (!/^[A-Za-z0-9._-]+$/.test(fileName)) {
  console.error("Некорректное имя файла: " + fileName);
  process.exit(1);
}
if (!code) {
  console.error("Пустой код подтверждения");
  process.exit(1);
}

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: "utf8", env: GIT, ...opts });

const main = async () => {
  console.log("Домен: " + DOMAIN);
  console.log("Код:   " + code.slice(0, 12) + (code.length > 12 ? "…" : ""));
  console.log("Файл:  " + fileName + "\n");

  // 1. файл подтверждения
  const filePath = resolve(SITE, fileName);
  const body = code.includes("<") ? code : code;
  writeFileSync(filePath, body, "utf8");
  console.log("Записан файл: " + fileName);

  // 2. мета-тег в index.html
  const indexPath = resolve(SITE, "index.html");
  let html = readFileSync(indexPath, "utf8");
  const tag = `<meta name="yandex-verification" content="${code}">`;
  if (html.includes('name="yandex-verification"')) {
    html = html.replace(/<meta name="yandex-verification"[^>]*>/, tag);
    console.log("Обновлён мета-тег в index.html");
  } else {
    html = html.replace(/<link rel="stylesheet"/, tag + "\n<link rel=\"stylesheet\"");
    console.log("Добавлен мета-тег в index.html");
  }
  writeFileSync(indexPath, html, "utf8");

  // 3. коммит и push
  try {
    run("git", ["add", "-A"]);
    const st = run("git", ["status", "--porcelain"]).trim();
    if (!st) {
      console.log("Изменений нет — нечего отправлять");
    } else {
      run("git", ["commit", "-m", "Подтверждение прав в Вебмастере Яндекса (" + fileName + ")"]);
      run("git", ["push"]);
      console.log("Отправлено в GitHub");
    }
  } catch (e) {
    console.error("Не удалось отправить в GitHub: " + (e.stderr || e.message));
    console.error("Скопируйте файлы в репозиторий вручную: " + fileName + " и index.html");
  }

  // 4. проверка на живом сайте
  console.log("\nПроверка (GitHub Pages собирается 1–3 минуты, подождите и перезапустите):");
  const live = `https://${DOMAIN}/${fileName}`;
  try {
    const r = await fetch(live, { headers: { "User-Agent": "Mozilla/5.0" } });
    const t = await r.text();
    const ok = t.includes(code) || t.trim() === code;
    console.log(`  ${live}\n  HTTP ${r.status} · ${r.ok && ok ? "код найден ✓" : "код пока не виден"}`);
  } catch (e) {
    console.log("  " + live + " — " + e.message);
  }

  try {
    const r = await fetch(`https://${DOMAIN}/`, { headers: { "User-Agent": "Mozilla/5.0" } });
    const t = await r.text();
    console.log(
      `  https://${DOMAIN}/\n  HTTP ${r.status} · мета-тег ${t.includes('name="yandex-verification"') ? "на месте ✓" : "пока не на месте"}`
    );
  } catch (e) {
    console.log("  главная: " + e.message);
  }

  console.log("\nЧто дальше: вернитесь в Вебмастер и нажмите «Подтвердить».");
  console.log("После подтверждения выполните: node tools/yandex-sitemap.mjs");
};

main().catch((e) => {
  console.error("Ошибка: " + e.message);
  process.exit(1);
});
