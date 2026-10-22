// Скачивает первую страницу постановления Правительства № 1705 (предельная база 2026).
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const UA = { "User-Agent": "Mozilla/5.0", Accept: "*/*" };
const eo = "0001202511010039";
const OUT = resolve("..", "default-workspace", "blog-usn-2026", "out", "acts", "1705");
mkdirSync(OUT, { recursive: true });

const j = await (await fetch("http://publication.pravo.gov.ru/api/Document?eoNumber=" + eo, { headers: UA })).json();
console.log("документ:", j.complexName?.replace(/\n/g, " ").slice(0, 140));
console.log("id:", j.id, "| страниц:", j.pagesCount);

for (const p of [1, 2]) {
  const u = `http://publication.pravo.gov.ru/GetImage?documentId=${j.id}&pageNumber=${p}`;
  const r = await fetch(u, { headers: UA });
  const b = Buffer.from(await r.arrayBuffer());
  if (b[0] === 0x89 && b[1] === 0x50) {
    const name = resolve(OUT, `page-${String(p).padStart(2, "0")}.png`);
    writeFileSync(name, b);
    console.log("ok", p, b.length, "→", name);
  } else {
    console.log("не PNG", p, r.status, b.slice(0, 60).toString());
  }
}
