// Сборщик тем для blog-usn-2026.
// Источники: официальный интернет-портал правовой информации (publication.pravo.gov.ru)
// и RSS ФНС России. Никакого ИИ здесь — только первичные данные.
//
// Запуск:  node tools/collect-topics.mjs [дней] [--json]
// Пример:  node tools/collect-topics.mjs 45

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "..", "out");
const UA = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  "Accept-Language": "ru-RU,ru;q=0.9",
};

const DAYS = Number(process.argv[2]) || 45;
const AS_JSON = process.argv.includes("--json");

// --- Ведущие организации, чьи акты нас интересуют (id из api/SignatoryAuthorities) ---
const AUTH = {
  "Министерство финансов РФ": "d9083206-f107-40ab-bdb3-92ffd465ecfe",
  "ФНС России": "d959e5e5-b261-43cf-8529-eb19cc364d69",
  "Минэкономразвития РФ": "59ad7c35-7d14-424e-b305-f964615734bd",
  "Правительство РФ": "8005d8c9-4b6d-48d3-861a-2a37e69fccb3",
  "Минтруд РФ": "2c4929b0-9323-4541-9705-76185b9e284b",
  "Минюст РФ": "f69ec43f-3fa5-4611-a286-52acdcc77334",
};

// --- Блоки официального опубликования (по одному на запрос — мультиблок даёт HTTP 500) ---
const BLOCKS = ["foiv284", "foiv283"];

// --- Оценка релевантности: тема подходит, если есть "ядро" (налог/учёт/бизнес)
//     и нет "шумовых" признаков (бюджетные трансферты, внутренние регламенты и т.п.) ---

// Ядро: слова, по которым читателю-бухгалтеру нужен разбор.
const CORE = [
  "налог", "ндс", "усн", "авансов", "взнос", "страхов", "декларац",
  "отчетност", "отчётност", "касс", "ккт", "выручк", "доход", "расход",
  "заработн", "пособи", "льгот", "пенси", "предпринимат", "обязанност",
  "штраф", "проверк", "бухгалтер", "персонифицированн", "учет", "учёт",
  "бухгалтерск", "плательщик", "инвестицион", "амортизац", "основн",
  "счет", "счёт", "расчет", "расчёт", "реестр", "маркиров", "электронн",
];

// Шум: акты, которые не дают статьи читателю-бухгалтеру.
const NOISE = [
  "субсиди", "субвенц", "межбюджетн", "бюджетн", "таможенн", "антикоррупц",
  "конфликт интересов", "личной заинтересованност", "служебн", "делопроизвод",
  "обучени", "стажиров", "награжд", "медал", "почетн", "аттестац",
  "комисси по", "совещан", "круглый стол", "мемориал", "информационн",
  "профилактик", "противодейств", "госслужб", "квалификационн", "должностн",
  "перечень производител", "перечень организац", "перечень товар", "перечень иностран",
  "имущественн отношени", "государственн тайн", "объект культурн",
  "охрана труда", "охраны труда", "экологическ", "санитарно", "гигиен",
  "архивн", "пожарн", "чрезвычайн", "оборот оружия", "миграционн",
  "государственной службы", "государственной служб", "должностн",
  // внутренние кадровые акты ведомств — читателю-бухгалтеру они не нужны
  "работниками, замещающими", "перечн", "порядка уведомления работниками",
  "оплате труда работников федерального", "контроля за расходами федеральных",
  "личной заинтересованност", "реестра мощностей", "технологически обусловленных мест",
  "уведомления работниками", "создаваемых для выполнения задач",
  // ведомственные акты, не дающие материала читателю-бухгалтеру
  "некоммерческ организац", "реестр нко", "агентств по страхованию вкладов",
  "ассоциаци", "общероссийск", "муниципальн", "субъект российской федерации",
  "поддержк индивидуальной предпринимательской инициативы",
  "региональн проект", "национальн проект", "федеральн проект",
  "требования к организациям", "инфраструктур поддержки",
  "нотариально оформляемого документа", "государственн корпораци",
  "мобилизационн", "воинск", "оборон", "государственн тайн",
  "уголовно-исполнительн", "ранжировани", "гарантийн фонд", "акционерн обществ",
  "приказ минюста", "инструкц по прием",
];

// Темы, которые читателю-бухгалтеру не нужны, хотя содержат «ядро».
// Например «отчетность некоммерческих организаций» — это не налоговая отчётность.
const NOISE_CONTEXT = [
  "некоммерческ", "общественн полезн", "реестр нко", "срочно", "благотворит",
];

// Сигнал "свежо и важно" — повышает приоритет темы.
const BOOST = [
  "упрощенн", "усн", "ндс", "декларац", "авансов", "взнос", "штраф",
  "персонифицированн", "касс", "ккт", "льгот", "новый", "изменени",
];

const norm = (s) => (s || "").toLowerCase().replace(/ё/g, "е");

function relevant(title) {
  const t = norm(title);
  if (NOISE.some((w) => t.includes(norm(w)))) return false;
  // «отчётность» есть и у НКО — это не налоговая отчётность
  if (NOISE_CONTEXT.some((w) => t.includes(norm(w)))) {
    const taxish = ["налог", "ндс", "усн", "касс", "ккт", "взнос", "декларац"];
    if (!taxish.some((w) => t.includes(norm(w)))) return false;
  }
  return CORE.some((w) => t.includes(norm(w)));
}

function priority(title) {
  const t = norm(title);
  let p = 0;
  for (const w of BOOST) if (t.includes(norm(w))) p += 2;
  for (const w of CORE) if (t.includes(norm(w))) p += 1;
  return p;
}

async function getJSON(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function getText(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

const decode = (s = "") =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// ---------- 1. publication.pravo.gov.ru: акты ФНС и Минфина за период ----------
async function collectOfficial() {
  const since = new Date(Date.now() - DAYS * 864e5).toISOString().slice(0, 10);
  const rows = [];

  for (const [name, id] of Object.entries(AUTH)) {
    const url =
      "http://publication.pravo.gov.ru/api/Documents" +
      `?SignatoryAuthorityId=${id}&PublishDateFrom=${since}` +
      "&SortedBy=4&SortDestination=desc";
    let j;
    try {
      j = await getJSON(url);
    } catch (e) {
      console.error("  ! " + name + ": " + e.message);
      continue;
    }
    const items = j.items || [];
    let kept = 0;
    for (const it of items) {
      const title = it.name || "";
      if (!relevant(title)) continue;
      kept++;
      rows.push({
        kind: "НПА (официальное опубликование)",
        org: name,
        title,
        full: (it.complexName || "").replace(/\n/g, " ").trim(),
        number: it.number || "",
        docDate: (it.documentDate || "").slice(0, 10),
        published: (it.publishDateShort || "").slice(0, 10),
        reg: it.jdRegNumber ? `Минюст № ${it.jdRegNumber} от ${(it.jdRegDate || "").slice(0, 10)}` : "",
        eoNumber: it.eoNumber,
        url: `http://publication.pravo.gov.ru/document/${it.eoNumber}`,
        portalSearch: `http://publication.pravo.gov.ru/search?query=${encodeURIComponent(title.slice(0, 60))}`,
        score: priority(title),
      });
    }
    console.error(`  · ${name}: всего ${j.itemsTotalCount ?? items.length}, релевантных ${kept}`);
  }
  return rows;
}

// ---------- 2. RSS официального опубликования (быстрый сигнал "что вышло сегодня") ----------
async function collectRss() {
  const rows = [];
  for (const block of BLOCKS) {
    let xml;
    try {
      xml = await getText(`http://publication.pravo.gov.ru/api/rss?block=${block}&pageSize=10`);
    } catch (e) {
      console.error("  ! rss " + block + ": " + e.message);
      continue;
    }
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const b = m[1];
      const title = decode((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
      const link = (b.match(/<link>([\s\S]*?)<\/link>/) || [])[1]?.trim();
      const pub = (b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]?.trim();
      const desc = decode((b.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || "");
      if (!relevant(title)) continue;
      rows.push({
        kind: "RSS официального опубликования",
        org: "publication.pravo.gov.ru",
        title,
        full: desc,
        number: "",
        docDate: "",
        published: pub || "",
        reg: "",
        eoNumber: "",
        url: link,
        portalSearch: "",
      });
    }
  }
  return rows;
}

// ---------- 3. RSS ФНС России ----------
async function collectFnsRss() {
  const rows = [];
  let xml;
  try {
    xml = await getText("https://www.nalog.gov.ru/rn77/rss/");
  } catch (e) {
    console.error("  ! ФНС RSS: " + e.message);
    return rows;
  }
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1];
    const title = decode((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
    const link = (b.match(/<link>([\s\S]*?)<\/link>/) || [])[1]?.trim();
    const pub = (b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]?.trim();
    const cat = decode((b.match(/<category>([\s\S]*?)<\/category>/) || [])[1] || "");
    if (!relevant(title)) continue;
    rows.push({
      kind: "RSS ФНС России",
      org: "ФНС России",
      title,
      full: "категория: " + cat,
      number: "",
      docDate: "",
      published: pub || "",
      reg: "",
      eoNumber: "",
      url: link,
      portalSearch: "",
    });
  }
  return rows;
}

// ---------- дедупликация по названию (из RSS и API приходит одно и то же) ----------
function dedupe(rows) {
  const seen = new Map();
  for (const r of rows) {
    const key = norm(r.title).replace(/[^a-zа-я0-9]+/gi, "").slice(0, 80);
    if (!key) continue;
    const prev = seen.get(key);
    // приоритет отдаём записи из API: там есть номер акта и дата регистрации
    if (!prev) seen.set(key, r);
    else if ((r.score || 0) > (prev.score || 0) || (!prev.number && r.number)) seen.set(key, r);
  }
  return [...seen.values()].sort(
    (a, b) => (b.score || 0) - (a.score || 0) || String(b.published).localeCompare(String(a.published))
  );
}

function toMarkdown(rows) {
  const lines = [];
  lines.push(`# Очередь тем · сгенерировано ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`Окно: последние ${DAYS} дней. Отобрано ${rows.length} тем из официальных источников.`);
  lines.push("");
  lines.push("Каждая строка — заготовка статьи. Дальше по конвейеру:");
  lines.push("черновик ИИ → сверка с первоисточником → правка → публикация.");
  lines.push("");
  rows.forEach((r, i) => {
    lines.push(`## ${i + 1}. ${r.title}`);
    lines.push("");
    lines.push(`- Приоритет: ${"★".repeat(Math.min(5, Math.ceil((r.score || 0) / 3)))} (${r.score || 0})`);
    lines.push(`- Источник: ${r.kind} · ${r.org}`);
    if (r.number) lines.push(`- Номер: ${r.number}`);
    if (r.docDate) lines.push(`- Дата акта: ${r.docDate}`);
    if (r.published) lines.push(`- Опубликовано: ${r.published}`);
    if (r.reg) lines.push(`- Регистрация: ${r.reg}`);
    lines.push(`- Ссылка на первоисточник: ${r.url}`);
    if (r.eoNumber) lines.push(`- PDF (скан, без текстового слоя): http://publication.pravo.gov.ru/file/pdf?eoNumber=${r.eoNumber}`);
    if (r.portalSearch) lines.push(`- Поиск по наименованию: ${r.portalSearch}`);
    lines.push(`- Документ: ${r.full}`);
    lines.push("");
    lines.push("**Чек-лист перед публикацией:**");
    lines.push("1. Открыть первоисточник, найти в тексте акта номера статей, ставки, лимиты и сроки.");
    lines.push("   Метаданные: `api/Document?eoNumber=<eo>`; постраничные сканы: `GetImage?documentId=<id>&pageNumber=N`.");
    lines.push("   Текстового слоя в PDF официального опубликования нет — PDF годится только для визуальной сверки.");
    lines.push("2. Сверить каждую цифру с текстом акта (не с пересказом).");
    lines.push("3. Собрать блок «Нормы и источники»: НПА + ссылка + пункт.");
    lines.push("4. Написать 3 примера расчёта на актуальных цифрах.");
    lines.push("5. Поставить дату проверки и пометку «материал подготовлен с помощью ИИ и проверен редактором».");
    lines.push("");
  });
  return lines.join("\n");
}

const main = async () => {
  console.error("Собираю темы за последние " + DAYS + " дней…");
  const [official, rssRows, fnsRows] = await Promise.all([
    collectOfficial(),
    collectRss(),
    collectFnsRss(),
  ]);
  const rows = dedupe([...official, ...rssRows, ...fnsRows]);
  console.error("Итого уникальных тем: " + rows.length);

  mkdirSync(OUT_DIR, { recursive: true });
  // Markdown — основной вывод (очередь тем для редактора)
  const pm = resolve(OUT_DIR, "topics.md");
  writeFileSync(pm, toMarkdown(rows), "utf8");
  console.error("Markdown → " + pm);
  // JSON — машинный вариант (по --json); пишем всегда, чтобы он не устаревал
  const pj = resolve(OUT_DIR, "topics.json");
  writeFileSync(pj, JSON.stringify({ generated: new Date().toISOString(), days: DAYS, topics: rows }, null, 2), "utf8");
  console.error("JSON → " + pj);
};

main().catch((e) => {
  console.error("Ошибка: " + e.message);
  process.exit(1);
});
