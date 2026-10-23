// Сборка og-image.png из HTML-шаблона.
//
// Запуск: node tools/make-og.mjs [путь_к_chrome]
//
// Почему так, а не рисованием пикселей: превью ссылки должно совпадать
// со стилем сайта — те же шрифты, токены, скругления. HTML-шаблон правится
// в одном месте (tools/og-template.html), а картинка пересобирается за секунду.
//
// Что делает:
//   1. поднимает временный локальный сервер на 127.0.0.1:8123;
//   2. просит Chrome отрисовать шаблон в окне 1200×630;
//   3. сохраняет og-image.png в папку сайта;
//   4. проверяет, что получилось ровно 1200×630.

import { createServer } from "node:http";
import { readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, "..");
const PORT = 8123;

const CHROME_CANDIDATES = [
  process.argv[2],
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
  console.error("Не найден Chrome/Edge. Укажите путь: node tools/make-og.mjs \"C:\\...\\chrome.exe\"");
  process.exit(1);
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (path === "/") path = "/tools/og-template.html";
    const file = join(SITE, path);
    if (!file.startsWith(SITE)) return res.writeHead(403).end("403");
    const info = await stat(file).catch(() => null);
    if (!info || !info.isFile()) return res.writeHead(404).end("404");
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(await readFile(file));
  } catch (e) {
    res.writeHead(500).end("500: " + e.message);
  }
});

await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
console.log("шаблон: tools/og-template.html");

const out = resolve(SITE, "og-image.png");
await run(chrome, [
  "--headless=new",
  "--disable-gpu",
  "--no-sandbox",
  "--hide-scrollbars",
  "--force-device-scale-factor=1",
  "--virtual-time-budget=4000",
  "--window-size=1200,630",
  `--screenshot=${out}`,
  `http://127.0.0.1:${PORT}/tools/og-template.html`,
]);
server.close();

// проверка размера: первые 24 байта PNG содержат ширину и высоту
const png = await readFile(out);
const w = png.readUInt32BE(16);
const h = png.readUInt32BE(20);
console.log(`og-image.png: ${w}×${h}, ${png.length} байт`);
if (w !== 1200 || h !== 630) {
  console.error("Ожидалось 1200×630 — проверьте шаблон и размер окна Chrome");
  process.exit(1);
}
await writeFile(out, png); // фиксируем файл на диске
