// Линтер статьи: проверяет, что разбор готов к публикации.
//
// Запуск: node tools/lint-article.mjs src/08-novaya-tema.md
//        node tools/lint-article.mjs src/*.md        (все сразу)
//
// Проверяет то, что требуется от материала:
//   1. есть фактура: расчёт с числами, а не «в зависимости от ситуации»;
//   2. язык простой: короткие предложения, нет канцелярита и юридического жаргона
//      без пояснения;
//   3. данные проверяемы: есть ссылки на нормы, даты, первоисточники;
//   4. нет выдумки: «около 1000 ₽» рядом с числом — блокирует;
//   5. структура соответствует шаблону.
//
// Возвращает код 1, если есть блокирующие замечания.
//
// Логика правил — в lint-core.mjs, чтобы publish-article.mjs мог вызвать её
// напрямую, без запуска подпроцесса.

import { lintArticle, printLint } from "./lint-core.mjs";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("Укажите файлы: node tools/lint-article.mjs src/08-tema.md");
  process.exit(1);
}

let totalErr = 0, totalWarn = 0;
for (const f of files) {
  const r = lintArticle(f);
  printLint(r);
  totalErr += r.errors.length;
  totalWarn += r.warns.length;
}

console.log("\n" + "─".repeat(60));
console.log(`Всего: блокирующих ${totalErr}, замечаний ${totalWarn}`);
if (totalErr) process.exitCode = 1;
