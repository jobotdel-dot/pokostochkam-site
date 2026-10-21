// Поиск актов в официальном опубликовании по номеру и ключевым словам.
// Запуск: node tools/find-acts.mjs "ЕД-1-11/67" "ПБУ 18/02" ...
//
// Выводит найденные акты с номером, датами, регистрацией в Минюсте и ссылкой
// на карточку — то, что нужно для блока «Нормы и источники».

const UA = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  "Accept-Language": "ru-RU,ru;q=0.9",
};

const norm = (s) => (s || "").toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/g, "");

const AUTH = {
  "Минфин": "d9083206-f107-40ab-bdb3-92ffd465ecfe",
  "ФНС": "d959e5e5-b261-43cf-8529-eb19cc364d69",
  "Минэкономразвития": "59ad7c35-7d14-424e-b305-f964615734bd",
  "Правительство": "8005d8c9-4b6d-48d3-861a-2a37e69fccb3",
  "Минтруд": "2c4929b0-9323-4541-9705-76185b9e284b",
  "Минюст": "f69ec43f-3fa5-4611-a286-52acdcc77334",
};

const getJSON = async (url) => {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};

const main = async () => {
  const queries = process.argv.slice(2);
  if (!queries.length) {
    console.error('Укажите номера: node tools/find-acts.mjs "ЕД-1-11/67"');
    process.exit(1);
  }

  // собираем акты за последние полтора года
  const since = new Date();
  since.setMonth(since.getMonth() - 18);
  const sinceStr = since.toISOString().slice(0, 10);

  const all = [];
  for (const [name, id] of Object.entries(AUTH)) {
    try {
      const j = await getJSON(
        `http://publication.pravo.gov.ru/api/Documents?SignatoryAuthorityId=${id}` +
          `&PublishDateFrom=${sinceStr}&SortedBy=4&SortDestination=desc`
      );
      for (const it of j.items || []) {
        all.push({
          org: name,
          title: it.name || "",
          full: (it.complexName || "").replace(/\n/g, " ").trim(),
          number: it.number || "",
          docDate: (it.documentDate || "").slice(0, 10),
          published: (it.publishDateShort || "").slice(0, 10),
          reg: it.jdRegNumber ? `Минюст № ${it.jdRegNumber} от ${(it.jdRegDate || "").slice(0, 10)}` : "",
          eoNumber: it.eoNumber,
          url: `http://publication.pravo.gov.ru/document/${it.eoNumber}`,
        });
      }
    } catch (e) {
      console.error("  ! " + name + ": " + e.message);
    }
  }
  console.log("Загружено актов: " + all.length + "\n");

  for (const q of queries) {
    const nq = norm(q);
    // ищем по номеру акта, если он похож на номер
    const found = all.filter((a) => {
      const nNum = norm(a.number);
      if (nNum && (nNum === nq || nNum.includes(nq) || nq.includes(nNum))) return true;
      const nTitle = norm(a.title) + " " + norm(a.full);
      return nTitle.includes(nq);
    });
    console.log("═".repeat(70));
    console.log("Запрос: " + q + "  →  найдено " + found.length);
    console.log("═".repeat(70));
    if (!found.length) {
      console.log("  не найдено. Проверьте формулировку или ищите вручную:\n" +
        "  http://publication.pravo.gov.ru/search?query=" + encodeURIComponent(q));
      console.log();
      continue;
    }
    for (const a of found.slice(0, 6)) {
      console.log(`\n${a.org} · ${a.number || "б/н"} от ${a.docDate}`);
      console.log("  " + a.full.slice(0, 150));
      console.log("  Опубликовано: " + a.published + (a.reg ? " · " + a.reg : ""));
      console.log("  Ссылка: " + a.url);
    }
    console.log();
  }
};

main().catch((e) => {
  console.error("Ошибка: " + e.message);
  process.exit(1);
});
