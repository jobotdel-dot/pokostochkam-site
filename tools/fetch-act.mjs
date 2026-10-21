// Выкачивание страниц акта с официального интернет-портала правовой информации
// (publication.pravo.gov.ru) — только открытые данные.
//
// Запуск:  node tools/fetch-act.mjs <eoNumber> [папка]
// Пример:  node tools/fetch-act.mjs 0001202609180008
//
// Что делает:
//   1. api/Document?eoNumber=…            → метаданные (номер, даты, регистрация Минюста, число страниц)
//   2. document/mainview?code=…&index=N    → HTML-обёртка со ссылкой на <img>
//   3. GetImage?documentId=…&pageNumber=N  → постраничный PNG-скан акта
//   4. file/pdf?eoNumber=…                 → PDF официального опубликования (скан, без текстового слоя)
//
// Итог: out/acts/<eoNumber>/ со страницами page-01.png … и meta.json + act.pdf.
// Дальше редактор читает/распознаёт страницы и сверяет цифры — на этом шаге
// никакого ИИ, только глаза человека.

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "..", "out");
const BASE = "http://publication.pravo.gov.ru";
const UA = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  "Accept-Language": "ru-RU,ru;q=0.9",
};

const eo = String(process.argv[2] || "").trim();
if (!eo) {
  console.error("Укажите eoNumber: node tools/fetch-act.mjs 0001202609180008");
  process.exit(1);
}
const dest = resolve(process.argv[3] || resolve(OUT_DIR, "acts", eo));

async function json(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
}
async function text(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.text();
}
async function bin(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

const main = async () => {
  console.error(`Акт ${eo} → ${dest}`);
  mkdirSync(dest, { recursive: true });

  const meta = await json(`${BASE}/api/Document?eoNumber=${eo}`);
  console.error(
    `  ${meta.name || meta.title} (${meta.number || "б/н"} от ${String(meta.documentDate || "").slice(0, 10)})` +
      `, страниц: ${meta.pagesCount}`
  );

  const view = await text(`${BASE}/document/mainview?code=${eo}&index=1&pageSize=1`);
  const docId =
    (view.match(/GetImage\?documentId=([0-9a-f-]+)/i) || [])[1] || meta.id || "";
  const pages = Number(meta.pagesCount || 0);
  if (!docId) throw new Error("Не удалось определить documentId акта");

  let saved = 0;
  for (let p = 1; p <= pages; p++) {
    const file = resolve(dest, `page-${String(p).padStart(2, "0")}.png`);
    if (existsSync(file)) {
      saved++;
      continue;
    }
    const buf = await bin(`${BASE}/GetImage?documentId=${docId}&pageNumber=${p}`);
    writeFileSync(file, buf);
    saved++;
    process.stdout.write(`\r  страниц скачано: ${saved}/${pages}`);
  }
  console.error("");

  let pdfBytes = 0;
  try {
    const pdf = await bin(`${BASE}/file/pdf?eoNumber=${eo}`);
    writeFileSync(resolve(dest, "act.pdf"), pdf);
    pdfBytes = pdf.length;
  } catch (e) {
    console.error("  PDF недоступен: " + e.message);
  }

  const summary = {
    eoNumber: eo,
    documentId: docId,
    title: meta.title || meta.name || "",
    number: meta.number || "",
    documentDate: String(meta.documentDate || "").slice(0, 10),
    published: String(meta.publishDateShort || "").slice(0, 10),
    jdRegNumber: meta.jdRegNumber || "",
    jdRegDate: String(meta.jdRegDate || "").slice(0, 10),
    pagesCount: pages,
    pdfBytes,
    pageFiles: Array.from({ length: pages }, (_, i) => `page-${String(i + 1).padStart(2, "0")}.png`),
    url: `${BASE}/document/${eo}`,
    pdfUrl: `${BASE}/file/pdf?eoNumber=${eo}`,
    note: "PDF — скан без текстового слоя; сверять цифры по страницам PNG.",
  };
  writeFileSync(resolve(dest, "meta.json"), JSON.stringify(summary, null, 2), "utf8");
  console.error(`  Готово: ${pages} страниц + PDF (${pdfBytes} Б) → ${dest}`);
  console.error(`  Первоисточник: ${summary.url}`);
};

main().catch((e) => {
  console.error("Ошибка: " + e.message);
  process.exit(1);
});
