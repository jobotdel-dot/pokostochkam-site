// Проверка внутренних ссылок и целостности портала.
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PORTAL = resolve(HERE, "..");
const files = ["index.html", "article-fine.html", "article-avans-usn-2026.html",
  "article-reforma-3-0.html", "article-rashody-usn-2026.html", "article-rsv-1-kvartal.html",
  "article-uvedomleniya-aprel.html", "article-shtrafy-kkt.html", "article-deklaraciya-nds.html"];

let ok = 0, bad = 0;
for (const f of files) {
  const p = resolve(PORTAL, f);
  if (!existsSync(p)) { console.log("MISSING FILE " + f); bad++; continue; }
  const html = readFileSync(p, "utf8");
  const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  for (const l of links) {
    if (/^(https?:|mailto:|#)/.test(l)) continue;
    const target = resolve(dirname(p), l.split("#")[0]);
    if (existsSync(target)) ok++;
    else { console.log(`BROKEN ${f} -> ${l}`); bad++; }
  }
  // базовые проверки
  if (!/<html lang="ru">/.test(html)) { console.log("NO lang " + f); bad++; }
  if (f !== "index.html" && !/class="disclaimer"/.test(html)) { console.log("NO disclaimer " + f); bad++; }
  if (!/meta name="description"/.test(html)) { console.log("NO description " + f); bad++; }
  if (f !== "index.html" && !/Материал подготовлен с помощью ИИ/.test(html)) {
    console.log("NO ai-badge " + f); bad++;
  }
  if (f !== "index.html" && !/class="updated"/.test(html)) {
    console.log("NO updated " + f); bad++;
  }
}
console.log(`internal links ok=${ok} bad=${bad}`);
