// Проверка живого сайта: страницы, canonical, микроразметка, SEO-файлы.
// Запуск: node tools/check-live.mjs [базовый-URL]
const BASE = (process.argv[2] || "https://jobotdel-dot.github.io").replace(/\/$/, "");

const PAGES = [
  "", "article-fine.html", "article-avans-usn-2026.html", "article-reforma-3-0.html",
  "article-rashody-usn-2026.html", "article-rsv-1-kvartal.html",
  "article-uvedomleniya-aprel.html", "article-shtrafy-kkt.html",
  "article-deklaraciya-nds.html",
];
const FILES = ["404.html", "robots.txt", "sitemap.xml", "style.css", "app.js"];

const get = async (p) => {
  const r = await fetch(BASE + "/" + p, { headers: { "User-Agent": "Mozilla/5.0" } });
  return { status: r.status, text: await r.text() };
};

const main = async () => {
  console.log("База: " + BASE + "\n");
  let bad = 0;

  for (const p of [...PAGES, ...FILES]) {
    const { status, text } = await get(p);
    const title = (text.match(/<title>(.*?)<\/title>/) || [])[1] || "";
    const canon = (text.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] || "—";
    const ld = text.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    let ldInfo = "—";
    if (ld) {
      try {
        const o = JSON.parse(ld[1]);
        ldInfo = `${o["@type"]} · ${o.datePublished || ""} · слов ${o.wordCount || "?"} · разделов ${(o.hasPart || []).length}`;
      } catch (e) {
        ldInfo = "ОШИБКА JSON: " + e.message;
        bad++;
      }
    }
    if (status !== 200) bad++;
    console.log(
      String(status).padEnd(4) + (p || "/").padEnd(32) +
        title.slice(0, 38).padEnd(40) + "| canonical: " + canon.replace(BASE, "") + " | ld: " + ldInfo
    );
  }

  const sm = await get("sitemap.xml");
  const locs = [...sm.text.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  console.log("\nsitemap.xml: " + locs.length + " URL");
  const badLoc = locs.filter((u) => !u.startsWith(BASE));
  if (badLoc.length) { console.log("  URL с чужим доменом: " + badLoc.join(", ")); bad++; }

  const rb = await get("robots.txt");
  console.log("robots.txt: " + rb.text.trim().replace(/\n/g, " | "));
  if (!rb.text.includes("Sitemap:")) { console.log("  нет строки Sitemap"); bad++; }

  console.log("\n" + (bad ? "Проблем: " + bad : "Всё в порядке"));
  if (bad) process.exitCode = 1;
};

main();
