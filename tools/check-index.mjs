// Проверка индексации сайта в поисковых системах.
// Запуск: node tools/check-index.mjs [домен]
//
// Проверяет по публичным индикаторам:
//   - Google: site: запрос и наличие в Google News/главной
//   - Яндекс: наличие в выдаче через HTML-выдачу (может быть недоступна)
//   - Bing: site: запрос
//   - DuckDuckGo: html-выдача
//   - проверка доступности robots.txt и sitemap.xml
//
// Это не «инструмент Вебмастера» — только внешняя проверка.
// Точные данные по индексации смотрите в Вебмастере Яндекса.

const DOMAIN = (process.argv[2] || "jobotdel-dot.github.io").replace(/^https?:\/\//, "").replace(/\/$/, "");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const check = async (name, url, opts = {}) => {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "ru-RU,ru;q=0.9" },
      redirect: "follow",
      ...opts,
    });
    const t = await r.text();
    const has = opts.find ? opts.find(t) : null;
    return { name, status: r.status, len: t.length, has };
  } catch (e) {
    return { name, status: "ERR", len: 0, has: "ошибка: " + e.message };
  }
};

const main = async () => {
  console.log("Домен: " + DOMAIN + "\n");

  // 1. служебные файлы
  for (const f of ["robots.txt", "sitemap.xml", "favicon.svg", "og-image.png"]) {
    const r = await check(f, `https://${DOMAIN}/${f}`);
    console.log(`${String(r.status).padEnd(4)} ${f.padEnd(16)} ${r.len} байт`);
  }

  // 2. доступность страниц
  console.log("\nСтраницы:");
  for (const p of ["", "articles.html", "article-fine.html", "article-rsv-1-kvartal.html"]) {
    const r = await check(p || "index", `https://${DOMAIN}/${p}`);
    console.log(`${String(r.status).padEnd(4)} ${(p || "/").padEnd(30)} ${r.len} байт`);
  }

  // 3. индексация
  console.log("\nИндексация (публичные индикаторы):");

  const g = await check("Google site:", `https://www.google.com/search?q=site%3A${DOMAIN}&num=20`, {
    find: (t) => {
      const m = t.match(/About ([\d,.]+) results/i) || t.match(/найдено\s+([\d\s]+)\s+результат/i);
      return m ? m[1] : "нет счётчика";
    },
  });
  console.log(`  Google  site: → HTTP ${g.status}; ${g.has}`);

  const y = await check("Яндекс site:", `https://yandex.ru/search/?text=site%3A${DOMAIN}`, {
    find: (t) => {
      const m =
        t.match(/найдено\s+([\d\s]+)\s+(?:страниц|результат)/i) ||
        t.match(/Страниц[^:]*:\s*([\d\s]+)/i) ||
        t.match(/capcha/i);
      return m ? m[0].slice(0, 60) : "нет счётчика";
    },
  });
  console.log(`  Яндекс  site: → HTTP ${y.status}; ${y.has}`);

  const b = await check("Bing site:", `https://www.bing.com/search?q=site%3A${DOMAIN}`, {
    find: (t) => {
      const m = t.match(/About ([\d,]+) results/i);
      return m ? m[1] : "нет счётчика";
    },
  });
  console.log(`  Bing    site: → HTTP ${b.status}; ${b.has}`);

  const d = await check("DuckDuckGo site:", `https://html.duckduckgo.com/html/?q=site%3A${DOMAIN}`, {
    find: (t) => {
      const n = [...t.matchAll(/result__a/g)].length;
      return n ? `результатов в выдаче: ${n}` : "нет результатов";
    },
  });
  console.log(`  DuckDuckGo   → HTTP ${d.status}; ${d.has}`);

  console.log(
    "\nВажно: публичные site:-запросы показывают неполную картину (Google и Яндекс\n" +
      "режут выдачу для новых и редких доменов). Точный статус индексации —\n" +
      "в Вебмастере Яндекса: «Индексирование → Страницы в поиске»."
  );
};

main();
