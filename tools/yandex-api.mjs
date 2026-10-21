// Работа с API Вебмастера Яндекса: карта сайта, переобход, статус индексации.
//
// Запуск:
//   node tools/yandex-api.mjs sitemap-add          # добавить sitemap.xml
//   node tools/yandex-api.mjs reindex <url> [...]  # отправить на переобход
//   node tools/yandex-api.mjs status               # сколько URL в индексе
//   node tools/yandex-api.mjs all                  # всё сразу
//
// Токен берётся из переменной окружения YANDEX_WEBMASTER_TOKEN.
// Где взять: Вебмастер Яндекса → «Настройки» (шестерёнка) → «API Вебмастера» → «Создать OAuth-токен».
//
// PowerShell:
//   $env:YANDEX_WEBMASTER_TOKEN = "ваш-токен"
//   node tools/yandex-api.mjs all
//
// Формат токена: yandex_<oauth-token> или номер пользователя:токен
// (как показано в самом Вебмастере).

const DOMAIN = "jobotdel-dot.github.io";
const UA = "DSH-pokostochkam/1.0";
const TOKEN = (process.env.YANDEX_WEBMASTER_TOKEN || "").trim();

if (!TOKEN) {
  console.error(
    "Не задан токен. Создайте его в Вебмастере Яндекса:\n" +
      "  Настройки (шестерёнка) → API Вебмастера → Создать OAuth-токен\n\n" +
      "Затем:\n" +
      '  $env:YANDEX_WEBMASTER_TOKEN = "ваш-токен"\n' +
      "  node tools/yandex-api.mjs all"
  );
  process.exit(1);
}

const API = "https://api.webmaster.yandex.net";
// oauth-токен можно передать как Bearer
const H = { Authorization: `OAuth ${TOKEN}`, "User-Agent": UA, "Content-Type": "application/json" };

const api = async (method, path, body) => {
  const r = await fetch(API + path, {
    method,
    headers: H,
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let j = null;
  try { j = JSON.parse(t); } catch { /* не JSON */ }
  return { status: r.status, body: j, text: t };
};

const main = async () => {
  const cmd = process.argv[2] || "status";
  console.log("Домен: " + DOMAIN);
  console.log("Токен: " + TOKEN.slice(0, 8) + "…\n");

  // проверка прав
  const check = await api("GET", `/v4/user/?host=${DOMAIN}`);
  if (check.status !== 200) {
    console.error("Ошибка авторизации: HTTP " + check.status);
    console.error(check.text.slice(0, 400));
    console.error(
      "\nПроверьте токен и права на сайт. Если сайт только что добавлен,\n" +
        "подождите несколько минут — доступ выдаётся не мгновенно."
    );
    process.exit(1);
  }
  console.log("Права подтверждены: " + (check.body?.username || "ok") + "\n");

  const doSitemap = async () => {
    console.log("— Карта сайта —");
    const list = await api("GET", `/v4/sites/${DOMAIN}/search-engine/sitemaps`);
    if (list.status === 200) {
      const items = list.body?.sitemaps || [];
      if (!items.length) console.log("  карт пока нет");
      for (const s of items) {
        console.log(`  ${s.uri} · ${s.statistics?.urls_total ?? "?"} URL`);
      }
    }
    const add = await api("PUT", `/v4/sites/${DOMAIN}/search-engine/sitemaps/${encodeURIComponent("sitemap.xml")}`, {
      sitemap_url: `https://${DOMAIN}/sitemap.xml`,
    });
    console.log(
      "  добавление sitemap.xml → HTTP " + add.status +
        (add.status === 204 || add.status === 200 ? " ✓" : ": " + add.text.slice(0, 200))
    );
  };

  const doReindex = async (urls) => {
    console.log("\n— Переобход —");
    for (const u of urls) {
      const r = await api("POST", `/v4/sites/${DOMAIN}/indexing/search-engine/url/indexing?url=${encodeURIComponent(u)}`);
      console.log(`  ${u.replace("https://" + DOMAIN, "") || "/"} → HTTP ${r.status}${r.status === 204 ? " ✓" : ""}`);
    }
  };

  const doStatus = async () => {
    console.log("— Статус индексации —");
    const s = await api("GET", `/v4/sites/${DOMAIN}/search-engine/stats`);
    if (s.status === 200) {
      const st = s.body?.statistics || {};
      console.log("  в индексе (всего):", st.indexed_urls ?? "?");
      console.log("  доступно для поиска:", st.available_urls ?? "?");
    } else {
      console.log("  HTTP " + s.status + ": " + s.text.slice(0, 200));
    }
  };

  if (cmd === "sitemap-add") await doSitemap();
  else if (cmd === "reindex") {
    const urls = process.argv.slice(3);
    await doReindex(urls.length ? urls : [`https://${DOMAIN}/`, `https://${DOMAIN}/articles.html`]);
  } else if (cmd === "status") await doStatus();
  else if (cmd === "all") {
    await doSitemap();
    await doReindex([`https://${DOMAIN}/`, `https://${DOMAIN}/articles.html`]);
    await doStatus();
  } else {
    console.error("Неизвестная команда: " + cmd);
    console.error("Доступно: sitemap-add | reindex <url> | status | all");
    process.exit(1);
  }
};

main().catch((e) => {
  console.error("Ошибка: " + e.message);
  process.exit(1);
});
