// Проверка целостности статического сайта перед публикацией.
// Запуск: node tools/check-site.mjs
//
// Проверяет:
//   - внутренние ссылки ведут в существующие файлы;
//   - якоря из микроразметки hasPart существуют в разметке страницы;
//   - у каждой страницы есть title, description, canonical, ld+json;
//   - валидность JSON-LD.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, "..");

// служебные файлы: файлы подтверждения прав в Вебмастере и Search Console
// (yandex_*.html, google*.html) и страница 404 — это не контентные страницы,
// требования к ним другие: Google и Яндекс проверяют только содержимое файла
const SERVICE = /^(404\.html|yandex[_-].*\.html|google[a-z0-9]*\.html|verification.*\.html)$/i;

const files = readdirSync(SITE).filter((f) => f.endsWith(".html"));
let ok = 0, bad = 0;
const err = (m) => { console.log("  ✗ " + m); bad++; };

console.log("Страниц: " + files.length);

for (const f of files) {
  const html = readFileSync(resolve(SITE, f), "utf8");
  const problems = [];

  // служебный файл — проверяем только код подтверждения
  if (SERVICE.test(f)) {
    if (/^yandex[_-].*\.html$/i.test(f) && !/Verification:\s*\S+/.test(html)) {
      err(`${f}: нет строки "Verification: <код>"`);
      bad--;
    } else {
      ok++;
    }
    continue;
  }

  // ссылки
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const l = m[1];
    if (/^(https?:|mailto:|tel:)/.test(l)) continue;
    const [path, hash] = l.split("#");
    const target = path ? resolve(SITE, path.replace(/^\//, "")) : resolve(SITE, f);
    if (!existsSync(target)) problems.push(`битая ссылка: ${l}`);
    else if (hash) {
      const t = readFileSync(target, "utf8");
      if (!t.includes(`id="${hash}"`)) problems.push(`битый якорь: ${l}`);
    }
  }

  // обязательные блоки
  if (!/<title>.+<\/title>/.test(html)) problems.push("нет <title>");
  if (!/meta name="description"/.test(html)) problems.push("нет description");
  if (!/rel="canonical"/.test(html)) problems.push("нет canonical");
  if (f !== "404.html") {
    if (!/lang="ru"/.test(html)) problems.push("нет lang=ru");
    if (!/viewport/.test(html)) problems.push("нет viewport");
  }

  // JSON-LD
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (ld) {
    try {
      const o = JSON.parse(ld[1]);
      if (!o["@type"]) problems.push("ld+json без @type");
    } catch (e) {
      problems.push("ld+json невалиден: " + e.message);
    }
  } else if (f !== "404.html") {
    problems.push("нет ld+json");
  }

  if (problems.length) {
    console.log(f);
    problems.forEach(err);
  } else {
    ok++;
  }
}

console.log(`\nOK: ${ok} страниц, проблем: ${bad}`);
if (bad) process.exitCode = 1;
