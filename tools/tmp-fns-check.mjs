// Уточняет условия применения ставок 5 % и 7 % на странице ФНС.
const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36",
  "Accept-Language": "ru-RU,ru;q=0.9",
};
const clean = (h) =>
  h.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ");

const r = await fetch("https://www.nalog.gov.ru/rn77/taxation/taxes/nds/", { headers: UA });
const c = clean(await r.text());

for (const kw of ["Ставка НДС в размере 5%", "Ставка НДС в размере 7%", "5% Ставка", "7% Ставка"]) {
  const i = c.indexOf(kw);
  console.log("\n### " + kw + " → " + i);
  if (i > 0) console.log(c.slice(i, i + 900));
}
