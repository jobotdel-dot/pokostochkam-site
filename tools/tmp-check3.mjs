// Проверка трёх опубликованных статей и карты сайта.
const pages = [
  "/article-efs-1-9-mesyacev.html",
  "/article-rsv-9-mesyacev.html",
  "/article-nds-3-kvartal.html",
];

for (const p of pages) {
  const r = await fetch("https://jobotdel-dot.github.io" + p);
  const c = await r.text();
  const text = c.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");
  console.log(
    p,
    "| http", r.status,
    "| слов", text.split(/\s+/).filter((w) => /\p{L}{2,}/u.test(w)).length,
    "| примеров", (c.match(/class="scen"/g) || []).length,
    "| метрика", c.includes("113723029") ? "да" : "НЕТ",
    "| ld+json", c.includes("application/ld+json") ? "да" : "НЕТ"
  );
}

const s = await (await fetch("https://jobotdel-dot.github.io/sitemap.xml")).text();
console.log("sitemap URL:", (s.match(/<url>/g) || []).length);
