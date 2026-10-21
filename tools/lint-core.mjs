// Логика проверки статьи — отдельный модуль, чтобы её можно было вызвать
// и из командной строки, и из publish-article.mjs без запуска подпроцессов.
//
// Импорт: import { lintArticle } from "./lint-core.mjs";

import { readFileSync, existsSync } from "node:fs";
import { basename } from "node:path";

// ───────────────────────────────────────────────────────────
// Правила редакции
// ───────────────────────────────────────────────────────────

// 1. Структура: обязательные разделы
const REQUIRED_SECTIONS = [
  { re: /^#{1,4}\s*.*(ситуац|произошло|сломал)/im, name: "раздел «Ситуация» (что произошло)", level: "warn" },
  { re: /^#{1,4}\s*.*(закон|требован|что изменил|как будет|правил)/im, name: "раздел «Что говорит закон»", level: "warn" },
  { re: /^#{1,4}\s*.*(шаг|делать|порядок|как сдать|счита)/im, name: "раздел «Что делать по шагам»", level: "warn" },
  { re: /^#{1,4}\s*.*(пример|вариант|расчёт|расчет)/im, name: "раздел с примерами расчёта", level: "warn" },
  { re: /^#{1,4}\s*.*(источник|норм)/im, name: "раздел «Нормы и источники»", level: "block" },
  { re: /^#{1,4}\s*.*(ошибк|ловушк|красн|подводн|сужден|границ)/im, name: "разбор ошибок (что приводит к требованию)", level: "warn" },
];

// 2. Маркеры выдумки — опасны только рядом с числом
const VAGUE = [
  "примерно", "около", "порядка", "примерно так", "нечто вроде", "грубо говоря",
  "где-то", "не помню точно", "кажется, что", "вроде бы", "предположительно",
  "более-менее", "сколько-то", "не менее", "не более", "около того",
];

// 3. Юридический жаргон, который нужно пояснять при первом употреблении
const JARGON = [
  { term: "ЕНС", hint: "единый налоговый счёт" },
  { term: "КУДиР", hint: "книга учёта доходов и расходов" },
  { term: "ОКТМО", hint: "код муниципального образования по ОКАТМО" },
  { term: "КБК", hint: "код бюджетной классификации" },
  { term: "УСН", hint: "упрощённая система налогообложения" },
  { term: "РСВ", hint: "расчёт по страховым взносам" },
  { term: "ЕФС-1", hint: "единая форма сведений" },
];

// 4. Канцелярит
const BUREAU = [
  "осуществляется", "осуществляет", "производится", "является", "данный",
  "данной", "данного", "указанный", "указанной", "соответствующий",
  "осуществлении", "настоящий", "вышеуказанный", "имеющийся", "являются",
];

// 5. Пороги
const MIN_NUMBERS = 8;      // минимум чисел в тексте
const MAX_SENTENCE = 220;   // длина предложения, символов
const MIN_WORDS = 700;      // минимум слов
const MAX_WORDS = 3500;     // максимум слов

// ───────────────────────────────────────────────────────────
const plain = (md) =>
  md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*\|.*\|\s*$/gm, " ")
    .replace(/^\s*[-*]\s+/gm, " ")
    .replace(/^\s*\d+\.\s+/gm, " ")
    .replace(/^#{1,6}\s+.*$/gm, " ")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const sentences = (t) =>
  t
    .split(/(?<=[.!?…])\s+(?=[А-ЯЁA-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);

const countNumbers = (t) => (t.match(/\d[\d\s]*[,.]\d+|\d[\d\s]{1,}/g) || []).length;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Проверяет файл статьи.
 * @param {string} file — путь к .md
 * @returns {{file:string, errors:string[], warns:string[], stats:object}}
 */
export function lintArticle(file) {
  if (!existsSync(file)) {
    return { file: basename(file), errors: ["файл не найден"], warns: [], stats: {} };
  }
  const raw = readFileSync(file, "utf8");
  const text = plain(raw);
  const errors = [];
  const warns = [];

  // --- фронт-маттер ---
  if (!/@kicker:/m.test(raw)) warns.push("нет @kicker в фронт-маттере");
  if (!/@desc:/m.test(raw)) warns.push("нет @desc в фронт-маттере");
  if (!/@lead:/m.test(raw)) warns.push("нет @lead в фронт-маттере");

  // --- структура ---
  for (const s of REQUIRED_SECTIONS) {
    if (!s.re.test(raw)) {
      (s.level === "block" ? errors : warns).push("отсутствует " + s.name);
    }
  }

  // --- расчёты с числами ---
  const exampleSections = (raw.match(/^#{1,4}\s*.*(пример|вариант)/gim) || []).length;
  const exBlocks = (raw.match(/:::example/g) || []).length;
  const calcRows = (raw.match(/^\|.*[₽%]|^\|.*\d.*\|/gm) || []).length;
  const formulas = (raw.match(/\d[\d\s ]*\s*[×*]\s*[\d\s,%.]+\s*=\s*[\d\s,.]+/g) || []).length;
  const calcLines = (raw.match(/^[—\-•].*\d.*[=×].*\d/gm) || []).length;

  const hasCalc = exBlocks > 0 || formulas >= 2 || calcRows >= 3 || calcLines >= 3;
  if (!hasCalc) {
    errors.push(
      "нет расчёта с числами: нужен блок :::example, формула (число × ставка = число) " +
        "или таблица с расчётом"
    );
  } else {
    if (exBlocks < 2) warns.push("лучше 2–3 блока :::example — читателю нужен выбор, а не один пример");
    if (formulas === 0 && exBlocks === 0) warns.push("покажите формулу расчёта прямо в тексте: «число × ставка = число»");
  }
  if (exampleSections === 0) warns.push("нет заголовка с примером — примеры лучше вынести в отдельный раздел");

  // --- цифры ---
  const nums = countNumbers(text);
  if (nums < MIN_NUMBERS) {
    errors.push(`мало цифр: ${nums}, нужно минимум ${MIN_NUMBERS} — материал без расчётов не работает`);
  }

  // --- проверяемость ---
  const hasArticles = /ст\.\s*\d+|п\.\s*\d+|НК РФ|Федерального закона|приказ|пункт/i.test(text);
  if (!hasArticles) errors.push("нет ссылок на нормы (статьи НК РФ, приказы, законы)");
  if (!/https?:\/\//.test(raw)) {
    errors.push("нет ни одной ссылки на первоисточник (добавьте блок «Нормы и источники» со ссылками)");
  }
  const pravoLinks = (raw.match(/pravo\.gov\.ru|nalog\.gov\.ru|minfin\.gov\.ru|consultant\.ru/gi) || []).length;
  if (pravoLinks === 0) warns.push("нет ссылок на официальные источники (pravo.gov.ru / nalog.gov.ru)");

  // --- даты ---
  if (!/\b20\d\d\b/.test(text)) warns.push("нет ни одной даты — проверьте актуальность");

  // --- дисклеймер ---
  if (!/не заменяет|не является юридической|информационный характер/i.test(raw)) {
    errors.push("нет дисклеймера");
  }

  // --- пометка об ИИ (добавляется при вёрстке) ---
  if (!/подготовлен с помощью ИИ/i.test(raw)) {
    warns.push("пометка «материал подготовлен с помощью ИИ и проверен редактором» добавляется при вёрстке — проверьте, что она есть в готовой странице");
  }

  // --- выдумка: неопределённость рядом с числом ---
  for (const v of VAGUE) {
    const re = new RegExp(
      "(?:\\b" + esc(v) + "\\b[^.!?]{0,25}?\\d)|(?:\\d[^.!?]{0,25}?\\b" + esc(v) + "\\b)",
      "gi"
    );
    const m = text.match(re);
    if (m) {
      const at = text.search(re);
      const sample = text.slice(Math.max(0, at - 30), at + 50).trim();
      errors.push(
        `неопределённость рядом с числом: «${v}» ×${m.length} — цифра должна быть точной ` +
          `(например: «${sample}»)`
      );
    }
  }

  // --- жаргон без пояснения ---
  for (const j of JARGON) {
    const first = text.toLowerCase().indexOf(j.term.toLowerCase());
    if (first < 0) continue;
    const near = text.slice(first, first + 120).toLowerCase();
    if (!near.includes(j.hint.toLowerCase())) {
      warns.push(`«${j.term}» употреблено без пояснения (${j.hint}) — для новичка это преграда`);
    }
  }

  // --- канцелярит ---
  const foundBureau = BUREAU.filter((b) => new RegExp("\\b" + b, "i").test(text));
  if (foundBureau.length) {
    warns.push(
      "канцелярит (" + foundBureau.slice(0, 5).join(", ") + ") — замените на простые слова: " +
        "«осуществляется» → «делают», «является» → «есть»"
    );
  }

  // --- длинные предложения ---
  const longSent = sentences(text).filter((s) => s.length > MAX_SENTENCE);
  if (longSent.length > 2) {
    warns.push(`${longSent.length} предложений длиннее ${MAX_SENTENCE} символов — разбейте их на короткие`);
  }

  // --- длина ---
  const words = text.split(/\s+/).length;
  if (words < MIN_WORDS) warns.push(`мало текста: ${words} слов — разбор должен разбирать, а не обходить`);
  if (words > MAX_WORDS) warns.push(`много текста: ${words} слов — проверьте, нет ли воды`);

  return {
    file: basename(file),
    errors,
    warns,
    stats: { words, nums, sentences: sentences(text).length, exampleBlocks: exampleSections },
  };
}

/** Печатает отчёт по проверке. */
export function printLint(r) {
  console.log("\n" + "═".repeat(60));
  console.log(r.file);
  console.log("═".repeat(60));
  console.log(
    `слов: ${r.stats.words} · цифр: ${r.stats.nums} · предложений: ${r.stats.sentences} · ` +
      `разделов с примерами: ${r.stats.exampleBlocks}`
  );
  if (r.errors.length) {
    console.log("\nБЛОКИРУЕТ (не публиковать):");
    r.errors.forEach((e) => console.log("  ✗ " + e));
  }
  if (r.warns.length) {
    console.log("\nЖелательно поправить:");
    r.warns.forEach((w) => console.log("  ! " + w));
  }
  if (!r.errors.length && !r.warns.length) console.log("\n✓ Готово к публикации");
}
