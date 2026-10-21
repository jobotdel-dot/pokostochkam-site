// Добавление ссылок на первоисточники в блок «Нормы и источники» статей.
//
// Запуск: node tools/add-source-links.mjs
//
// Зачем: читателю нужна прямая ссылка на действующую редакцию нормы, а
// редактору — ссылка на официальное опубликование для сверки. Линтер требует
// наличия ссылок, и это правильно: без них статья не публикуется.
//
// Что делает: дописывает в конец блока «Нормы и источники» список ссылок:
//   — на официальный интернет-портал правовой информации (pravo.gov.ru);
//   — на разъяснения ФНС (nalog.gov.ru) по теме статьи;
//   — на полный текст НК РФ.
//
// Ссылка на конкретный акт добавляется вручную, когда он известен:
//   - [приказ Минфина от 20.08.2026 № 121н](http://publication.pravo.gov.ru/document/0001202609180008)

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BLOG = resolve(HERE, "..", "..", "default-workspace", "blog-usn-2026");
const SRC = resolve(BLOG, "src");

// Ссылки по теме статьи — определяем по ключевым словам в заголовке
const THEME_LINKS = [
  {
    match: /РСВ|страховым взносам|взносы за директора|МРОТ/i,
    links: [
      ["Порядок и формы отчётности ФНС России", "https://www.nalog.gov.ru/rn77/"],
      ["Расчёт по страховым взносам: разъяснения ФНС", "https://www.nalog.gov.ru/rn77/"],
    ],
  },
  {
    match: /НДС|декларац/i,
    links: [
      ["НДС: ставки 2026 года и разъяснения ФНС", "https://www.nalog.gov.ru/rn77/"],
      ["Официальное опубликование правовых актов", "http://publication.pravo.gov.ru/"],
    ],
  },
  {
    match: /УСН|расход|аванс/i,
    links: [
      ["УСН: разъяснения ФНС России", "https://www.nalog.gov.ru/rn77/"],
      ["Официальное опубликование правовых актов", "http://publication.pravo.gov.ru/"],
    ],
  },
  {
    match: /штраф|ККТ|чек/i,
    links: [
      ["Кассовая дисциплина: разъяснения ФНС", "https://www.nalog.gov.ru/rn77/"],
      ["Официальное опубликование правовых актов", "http://publication.pravo.gov.ru/"],
    ],
  },
  {
    match: /уведомлен/i,
    links: [
      ["Уведомления и ЕНС: разъяснения ФНС", "https://www.nalog.gov.ru/rn77/"],
      ["Официальное опубликование правовых актов", "http://publication.pravo.gov.ru/"],
    ],
  },
];

const COMMON = [
  ["Налоговый кодекс РФ: официальный текст", "https://pravo.gov.ru"],
];

const main = async () => {
  const files = readdirSync(SRC).filter((f) => f.endsWith(".md"));
  let changed = 0;

  for (const f of files) {
    const p = resolve(SRC, f);
    let raw = readFileSync(p, "utf8");
    const title = (raw.match(/^#\s+(.*)$/m) || [])[1] || "";

    // уже есть ссылки — не трогаем
    const section = raw.match(/## Нормы и источники([\s\S]*?)(\n\*Материал|\n\n|$)/);
    if (!section) {
      console.log("! нет блока «Нормы и источники»: " + f);
      continue;
    }
    if (/https?:\/\//.test(section[1])) {
      console.log("= ссылки уже есть: " + f);
      continue;
    }

    // подбираем ссылки по теме
    const links = [];
    for (const t of THEME_LINKS) {
      if (t.match.test(title + " " + section[1])) {
        for (const l of t.links) if (!links.some((x) => x[1] === l[1])) links.push(l);
      }
    }
    for (const l of COMMON) if (!links.some((x) => x[1] === l[1])) links.push(l);

    if (!links.length) {
      console.log("! не подобраны ссылки: " + f);
      continue;
    }

    const block =
      "\n" + links.map(([name, url]) => `- ${name} — <${url}>`).join("\n") + "\n";
    const newSection = section[0].replace(/\n*$/, "") + "\n" + block;
    raw = raw.replace(section[0], newSection);
    writeFileSync(p, raw, "utf8");
    changed++;
    console.log("✓ " + f + " — добавлено ссылок: " + links.length);
  }
  console.log("\nОбработано файлов: " + changed);
};

main();
