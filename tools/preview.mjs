// Локальный предпросмотр сайта на http://127.0.0.1:8099
//
// Запуск: node tools/preview.mjs [порт]
//
// Зачем: главная подключает /style.css по абсолютному пути (так правильно для
// GitHub Pages), а при открытии файла напрямую такое подключение не работает.
// Этот сервер отдаёт папку сайта так же, как GitHub Pages, — можно смотреть
// дизайн до публикации.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2]) || 8099;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (path === "/") path = "/index.html";
    if (path.endsWith("/")) path += "index.html";

    const file = join(SITE, normalize(path).replace(/^(\.\.[/\\])+/, ""));
    if (!file.startsWith(SITE)) {
      res.writeHead(403).end("403");
      return;
    }

    const info = await stat(file).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(await readFile(join(SITE, "404.html"), "utf8").catch(() => "404"));
      return;
    }

    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": TYPES[extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch (e) {
    res.writeHead(500).end("500: " + e.message);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("Предпросмотр: http://127.0.0.1:" + PORT + "/");
  console.log("Папка: " + SITE);
});
