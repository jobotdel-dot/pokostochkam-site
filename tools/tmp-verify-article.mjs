// Проверка опубликованной статьи на живом сайте.
const u = "https://jobotdel-dot.github.io/article-6-ndfl-9-mesyacev.html";
for (let i = 0; i < 4; i++) {
  const r = await fetch(u);
  const c = await r.text();
  if (r.status === 200) {
    console.log("Статус:", r.status);
    console.log("title:", (c.match(/<title>([^<]+)/) || [])[1]);
    const text = c.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");
    console.log("слов:", text.split(/\s+/).filter((w) => /\p{L}{2,}/u.test(w)).length);
    console.log("блоков-примеров:", (c.match(/class="example"/g) || []).length);
    console.log("Метрика:", c.includes("113723029") ? "да" : "НЕТ");
    console.log("JSON-LD:", c.includes("application/ld+json") ? "да" : "НЕТ");
    console.log("пометка об ИИ:", /подготовлен с помощью ИИ/i.test(c) ? "да" : "НЕТ");
    break;
  }
  console.log("попытка", i + 1, "→", r.status);
  await new Promise((s) => setTimeout(s, 25000));
}
