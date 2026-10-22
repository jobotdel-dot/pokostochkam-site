// Достаёт eoNumber и даты для приказа ЕД-7-11/1@ (поправка к форме 6-НДФЛ).
const UA = { "User-Agent": "Mozilla/5.0", Accept: "application/json" };
const j = await (
  await fetch("http://publication.pravo.gov.ru/api/Documents?Name=" + encodeURIComponent("ЕД-7-11/1@"), {
    headers: UA,
  })
).json();
for (const it of j.items || []) {
  console.log(it.number, "|", (it.documentDate || "").slice(0, 10), "|", it.eoNumber);
  console.log("  ", (it.name || "").slice(0, 140));
  console.log("   https://publication.pravo.gov.ru/document/" + it.eoNumber);
}
