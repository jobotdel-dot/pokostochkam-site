// Пытаемся получить текст приказа СФР 1462 через API портала.
const UA = { "User-Agent": "Mozilla/5.0", Accept: "*/*" };
const eo = "0001202512190019";

const variants = [
  "http://publication.pravo.gov.ru/api/DocumentText?eoNumber=" + eo,
  "http://publication.pravo.gov.ru/api/Document?eoNumber=" + eo + "&includeText=true",
];

for (const u of variants) {
  try {
    const r = await fetch(u, { headers: UA });
    const t = await r.text();
    console.log("=== " + r.status + " " + u + " → " + t.length + " байт");
    console.log(t.slice(0, 300));
  } catch (e) {
    console.log("ERR " + u + " " + e.message);
  }
}
