// Проверка: иконка на вкладке и новая версия статьи.
const base = "https://jobotdel-dot.github.io";

const fav = await fetch(base + "/favicon.svg");
const favText = await fav.text();
console.log("favicon.svg:", fav.status, "|", fav.headers.get("content-type"), "|", favText.length, "байт");
console.log("  <svg>:", favText.includes("<svg"));

const r = await fetch(base + "/article-nds-3-kvartal.html");
const c = await r.text();
console.log("\nстатья:", r.status);
console.log("  rel=icon:", c.includes('rel="icon"') ? "есть" : "НЕТ");
console.log("  apple-touch-icon:", c.includes("apple-touch-icon") ? "есть" : "НЕТ");
console.log("  og:image:", c.includes("og:image") ? "есть" : "НЕТ");
console.log("  «Главное в пяти пунктах»:", c.includes("Главное в пяти пунктах") ? "есть" : "НЕТ");
console.log("  «Чем рискуете: ошибки»:", c.includes("Чем рискуете: ошибки") ? "есть" : "НЕТ");
console.log("  «Счёт на оплату»:", c.includes("Счёт на оплату вычет не подтверждает") ? "есть" : "НЕТ");
console.log("  «15 млн»:", c.includes("15 млн") ? "есть" : "НЕТ");
console.log("  дата актуальности:", c.includes("Актуально на 22 октября 2026") ? "есть" : "НЕТ");
