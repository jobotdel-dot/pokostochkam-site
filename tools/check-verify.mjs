// Проверка, что файл подтверждения прав и мета-тег доступны на живом сайте.
// Запуск: node tools/check-verify.mjs [имя-файла] [код]
const DOMAIN = "jobotdel-dot.github.io";
const file = process.argv[2] || "";
const code = process.argv[3] || "";

const get = async (p) => {
  const r = await fetch(`https://${DOMAIN}/${p}`, { headers: { "User-Agent": "Mozilla/5.0" } });
  return { status: r.status, text: await r.text() };
};

const main = async () => {
  let bad = 0;

  if (file && code) {
    const f = await get(file);
    const ok = f.status === 200 && f.text.includes(code);
    console.log(`${String(f.status).padEnd(4)} ${file}  ${ok ? "код найден ✓" : "код НЕ найден"}`);
    if (!ok) bad++;
    console.log("     содержимое: " + JSON.stringify(f.text.trim().slice(0, 100)));
  } else {
    // ищем файл автоматически
    const idx = await get("robots.txt");
    console.log("robots.txt: HTTP " + idx.status);
  }

  const home = await get("");
  const tag = 'name="yandex-verification"';
  const hasTag = home.text.includes(tag);
  const hasCode = code ? home.text.includes(code) : null;
  console.log(`${String(home.status).padEnd(4)} /  мета-тег yandex-verification: ${hasTag ? "есть ✓" : "нет"}` + (hasCode === null ? "" : hasCode ? " (код совпадает ✓)" : " (код НЕ совпадает)"));
  if (!hasTag) bad++;
  if (hasCode === false) bad++;

  console.log(bad ? `\nПроблем: ${bad}` : "\nВсё на месте — можно нажать «Подтвердить» в Вебмастере.");
  if (bad) process.exitCode = 1;
};

main();
