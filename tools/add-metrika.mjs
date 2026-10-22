// Установка счётчика Яндекс.Метрики на все HTML-страницы сайта.
//
// Запуск: node tools/add-metrika.mjs [номер_счётчика]
//   номер можно не указывать — тогда берётся из уже установленного счётчика.
//
// Вставляет блок <!-- Yandex.Metrika counter --> в конец <head> каждой
// страницы. Идемпотентно: если счётчик с этим номером уже стоит — страница
// не меняется. Если стоит счётчик с ДРУГИМ номером — заменяет его.
//
// Учтено 152-ФЗ: мет(Metrika) отправляет усечённый IP по умолчанию с
// параметрами по умолчанию; дополнительно ставим страницу на учёт
// только после согласия? Для сайта без формы сбора ПДн достаточно
// усечённого IP — счётчик ставим как есть.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, "..");

const blockFor = (id) => `<!-- Yandex.Metrika counter -->
<script type="text/javascript">
  (function(m,e,t,r,i,k,a){
    m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
    m[i].l=1*new Date();
    for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
    k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
  })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js?id=${id}', 'ym');

  ym(${id}, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
</script>
<noscript><div><img src="https://mc.yandex.ru/watch/${id}" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
<!-- /Yandex.Metrika counter -->`;

const counterRe = /<!-- Yandex\.Metrika counter -->([\s\S]*?)<!-- \/Yandex\.Metrika counter -->/;
const idIn = (block) => (block.match(/metrika\/tag\.js\?id=(\d+)/) || [])[1];

// Файлы подтверждения прав (yandex_*.html, google*.html) трогать нельзя:
// поисковики проверяют их содержимое побайтово, любой лишний тег = не подтверждено.
const SKIP = /^(google[a-z0-9]*\.html|yandex[_-].*\.html|verification.*\.html)$/i;

const main = () => {
  const pages = readdirSync(SITE).filter((f) => f.endsWith(".html"));

  // номер счётчика: из аргумента, иначе — с любой страницы, где он уже стоит.
  // Так инструмент можно вызывать без аргумента из конвейера публикации:
  // новая страница получит тот же счётчик, что и остальные.
  let counterId = process.argv[2] && /^\d+$/.test(process.argv[2]) ? process.argv[2] : null;
  if (!counterId) {
    for (const f of pages) {
      const m = readFileSync(join(SITE, f), "utf8").match(counterRe);
      const id = m && idIn(m[0]);
      if (id && id !== "00000000") { counterId = id; break; }
    }
  }
  if (!counterId) {
    console.error("Счётчик не найден ни на одной странице. Укажите номер: node tools/add-metrika.mjs 12345678");
    process.exit(1);
  }
  console.log("Счётчик: " + counterId);

  let added = 0, replaced = 0, unchanged = 0, noHead = [];

  for (const f of pages) {
    const p = join(SITE, f);
    let html = readFileSync(p, "utf8");

    // служебные файлы подтверждения — пропускаем целиком
    if (SKIP.test(f)) { unchanged++; continue; }

    const m = html.match(counterRe);

    if (m) {
      const cur = idIn(m[0]);
      if (cur === counterId) { unchanged++; continue; }        // тот же номер — не трогаем
      html = html.replace(counterRe, blockFor(counterId));      // замена номера
      writeFileSync(p, html, "utf8");
      replaced++;
      console.log(`↻ ${f}: счётчик ${cur} → ${counterId}`);
      continue;
    }

    // счётчика нет — вставляем перед </head>
    if (!/<\/head>/i.test(html)) { noHead.push(f); continue; }
    html = html.replace(/<\/head>/i, blockFor(counterId) + "\n</head>");
    writeFileSync(p, html, "utf8");
    added++;
    console.log(`✓ ${f}: счётчик ${counterId} установлен`);
  }

  console.log("\nИтого: добавлено " + added + ", заменено " + replaced +
    ", без изменений " + unchanged +
    (noHead.length ? ", без </head> " + noHead.join(", ") : ""));
};

main();
