// Ежедневный запуск: сбор тем из официальных источников + проверка, что готово к публикации.
//
// Запуск: node tools/daily.mjs
//
// Что делает (каждый день, автоматически):
//   1. Забирает свежие акты с официального интернет-портала правовой информации
//      и из RSS ФНС → обновляет очередь тем out/topics.md + out/topics.json.
//   2. Подбирает НОВУЮ тему — ту, которой ещё нет в блоге, — по трём фильтрам:
//      есть срок, есть цифра, есть типовая ошибка.
//   3. Кладёт готовый черновик-заготовку в out/daily/ — с первоисточником,
//      нормами и планом по шагам. Следующий шаг — человек пишет текст.
//
// Чего скрипт НЕ делает и не может:
//   — не публикует статью сам. Публикация только после проверки человеком:
//     node tools/publish-article.mjs src/NN-тема.md
//   — не выдумывает ни одной цифры. Всё, что попадает в черновик-заготовку,
//     взято из карточки акта на pravo.gov.ru.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, "..");
const BLOG = resolve(SITE, "..", "default-workspace", "blog-usn-2026");
const OUT = resolve(BLOG, "out");
const DAILY = resolve(OUT, "daily");

const GIT = { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" };
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: "utf8", env: GIT, stdio: "pipe", ...opts });

const step = (n, t) => console.log(`\n[${n}] ${t}`);
const ok = (m) => console.log("    ✓ " + m);
const info = (m) => console.log("    " + m);

// Какие темы уже написаны — по ключевым словам заголовка
const published = () => {
  const srcDir = resolve(BLOG, "src");
  if (!existsSync(srcDir)) return [];
  return readdirSync(srcDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const raw = readFileSync(resolve(srcDir, f), "utf8");
      const t = (raw.match(/^#\s+(.*)$/m) || [])[1] || "";
      return { file: f, title: t, words: new Set(
        t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 4)
      ) };
    });
};

// Три фильтра: срок, цифра, ошибка
const SCORE = {
  deadline: ["срок", "дедлайн", "квартал", "форма", "уведомлен", "отчетност", "декларац", "расчет по", "рсв", "ндфл", "ефс", "ндс за"],
  numbers: ["код", "ставк", "размер", "сумм", "лимит", "процент", "ндс", "взнос", "штраф", "налог"],
  mistake: ["ошибк", "требован", "штраф", "пени", "блокиров", "отказ", "доначисл", "проверк", "льгот", "пониженн"],
};

// Темы, которые почти не бьют в боль читателя-бухгалтера ИП/упрощенца
const LOW_VALUE = [
  "налоговой проверки", "акта об обеспеченительных мерах", "порядка рассмотрения",
  "оценки регулирующего воздействия", "многофакторной аутентификац", "электронной подписи",
  "государственной тайны", "об операторе", "об архив",
];

const matches = (title, words) => {
  const t = title.toLowerCase();
  let n = 0;
  for (const w of words) if (t.includes(w)) n++;
  return n;
};

const main = async () => {
  const today = new Date().toISOString().slice(0, 10);
  console.log("═".repeat(64));
  console.log("ЕЖЕДНЕВНЫЙ СБОР ТЕМ · " + today);
  console.log("═".repeat(64));

  // ── 1. Сбор тем ──────────────────────────────────────────
  step(1, "Сбор тем из официальных источников");
  try {
    const out = run("node", [resolve(HERE, "collect-topics.mjs"), "45"]);
    const tail = out.trim().split("\n").slice(-3).join(" · ");
    ok(tail);
  } catch (e) {
    console.log("    ! сбор не удался: " + (e.stderr || e.message).split("\n")[0]);
  }

  // ── 2. Подбор новой темы ────────────────────────────────
  step(2, "Подбор темы, которой ещё нет в блоге");
  const topicsPath = resolve(OUT, "topics.json");
  if (!existsSync(topicsPath)) {
    console.log("    ! нет очереди тем — пропускаю");
    return;
  }
  const { topics = [] } = JSON.parse(readFileSync(topicsPath, "utf8"));
  const done = published();
  info("опубликовано разборов: " + done.length);

  const candidates = topics
    .map((t) => {
      const tw = new Set(
        t.title.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 4)
      );
      // сколько уже написанных тем пересекаются с этой
      const overlap = done.reduce((acc, d) => {
        let c = 0;
        for (const w of tw) if (d.words.has(w)) c++;
        return Math.max(acc, c);
      }, 0);
      // совпадение по ключевым словам = тема уже раскрыта
      const low = LOW_VALUE.some((w) => t.title.toLowerCase().includes(w));
      const s = (low ? -8 : 0) +
        matches(t.title, SCORE.deadline) * 3 +
        matches(t.title, SCORE.numbers) +
        matches(t.title, SCORE.mistake) * 2 -
        overlap * 3;
      return { t, score: s, overlap, low };
    })
    .filter((c) => c.overlap < 3 && !c.low)
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) {
    info("новых тем не найдено");
    return;
  }
  const best = candidates[0];
  ok(`выбрана тема (оценка ${best.score}): ${best.t.title.slice(0, 80)}`);

  // ── 3. Заготовка ────────────────────────────────────────
  step(3, "Заготовка статьи");
  mkdirSync(DAILY, { recursive: true });
  const n = readdirSync(DAILY).filter((f) => f.endsWith(".md")).length + 1;
  const name = `${String(n).padStart(2, "0")}-${best.t.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40)}.md`;
  const file = resolve(DAILY, name);

  const draft = `# ${best.t.title}

> **Заготовка.** Это не готовая статья. Ниже — первоисточник, что нужно
> проверить и о чём писать. Финальный текст пишет человек, цифры сверяет
> с первоисточником.

## Первоисточник

- **Документ:** ${best.t.full || best.t.title}
- **Ведомство:** ${best.t.org}
${best.t.number ? `- **Номер:** ${best.t.number}\n` : ""}${best.t.docDate ? `- **Дата акта:** ${best.t.docDate}\n` : ""}${best.t.published ? `- **Опубликовано:** ${best.t.published}\n` : ""}${best.t.reg ? `- **Регистрация в Минюсте:** ${best.t.reg}\n` : ""}- **Ссылка:** ${best.t.url}
${best.t.eoNumber ? `- **Страницы акта для сверки:** \`node tools/fetch-act.mjs ${best.t.eoNumber}\` → \`out/acts/${best.t.eoNumber}/\`\n` : ""}
## Что раскрыть (по правилам редакции)

1. **Ситуация** — 2–3 предложения: кто, что сделал, из-за чего вопрос.
2. **Закон** — что именно говорит норма, со ссылкой на статью.
3. **Что делать по шагам** — 5–7 шагов, глагол в начале.
4. **Три примера расчёта** — с числами. Без них материал не публикуется.
5. **Ошибки** — что приводит к требованию ФНС.
6. **Нормы и источники** — ссылки на pravo.gov.ru, nalog.gov.ru.

## Проверка перед публикацией

- [ ] Скачать страницы акта: \`node tools/fetch-act.mjs ${best.t.eoNumber || "<eoNumber>"}\`
- [ ] Сверить номера статей, ставки, лимиты и сроки по тексту акта
- [ ] Написать 3 примера с числами
- [ ] Прогнать линтер: \`node tools/lint-article.mjs <файл>\`
- [ ] Опубликовать: \`node tools/publish-article.mjs <файл>\`
`;
  writeFileSync(file, draft, "utf8");
  ok("заготовка: out/daily/" + name);

  // ── 4. Сводка ───────────────────────────────────────────
  console.log("\n" + "─".repeat(64));
  console.log("Готово. Следующий шаг — заполнить заготовку и опубликовать.");
  console.log("Заготовка: " + file);
  console.log("Тем в очереди: " + topics.length + " · новых кандидатов: " + candidates.length);
  console.log("─".repeat(64));
};

main().catch((e) => {
  console.error("Ошибка: " + (e.stderr || e.message).split("\n")[0]);
  process.exit(1);
});
