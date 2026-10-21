// Проверка живой страницы калькуляторов: наличие всех блоков и нового app.js.
// Запуск: node tools/check-calcs-live.mjs
const BASE = "https://jobotdel-dot.github.io";

const main = async () => {
  const r = await fetch(BASE + "/calcs.html", { headers: { "User-Agent": "Mozilla/5.0" } });
  const html = await r.text();
  const js = await (await fetch(BASE + "/app.js", { headers: { "User-Agent": "Mozilla/5.0" } })).text();
  const css = await (await fetch(BASE + "/style.css", { headers: { "User-Agent": "Mozilla/5.0" } })).text();

  let bad = 0;
  const need = [
    ["страница calcs.html отдаётся", r.status === 200],
    ["6 калькуляторов", (html.match(/class="calc"/g) || []).length === 6],
    ["есть id для якорей", (html.match(/id="(usn|peni|vznosy|nds|avans|fine)"/g) || []).length === 6],
    ["app.js обновлён (calcPeni)", js.includes("calcPeni")],
    ["app.js обновлён (calcAvans)", js.includes("calcAvans")],
    ["app.js: нормативы 2026", js.includes("57390") && js.includes("27093")],
    ["app.js: порог НДС 20 млн", js.includes("20000000")],
    ["app.js: НДС 22%", js.includes('"22": 22')],
    ["css: стили результата", css.includes("calc-detail") && css.includes("calc-compare")],
    ["есть ссылка на index", html.includes('href="/"')],
    ["есть canonical", html.includes('rel="canonical"')],
  ];
  for (const [name, ok] of need) {
    console.log((ok ? "  ✓ " : "  ✗ ") + name);
    if (!ok) bad++;
  }
  console.log(bad ? "\nПроблем: " + bad : "\nВсё на месте");
  if (bad) process.exitCode = 1;
};

main();
