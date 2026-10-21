// Создание репозитория на GitHub и включение GitHub Pages.
// Токен берётся из Git Credential Manager (его же использует git push).
// Запуск: node tools/publish.mjs <имя-репозитория> [--private]
//
// Скрипт:
//   1. читает учётные данные для github.com из credential helper;
//   2. создаёт репозиторий через API (если ещё нет);
//   3. включает GitHub Pages на ветке main (ветка должна быть уже запушена);
//   4. печатает адрес сайта.
//
// Токен в вывод не попадает.

import { execFileSync } from "node:child_process";

const REPO = process.argv[2] || "pokostochkam-site";
const PRIVATE = process.argv.includes("--private");
const API = "https://api.github.com";

const env = { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" };

function credential() {
  const input = "protocol=https\nhost=github.com\n\n";
  const out = execFileSync("git", ["credential", "fill"], { input, env, encoding: "utf8" });
  const u = /username=(.*)/.exec(out)?.[1]?.trim();
  const p = /password=(.*)/.exec(out)?.[1]?.trim();
  if (!u || !p) throw new Error("не удалось получить учётные данные для github.com");
  return { user: u, token: p };
}

const { user, token } = credential();
const H = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "dsh-publish",
  "Content-Type": "application/json",
};

const api = async (path, method = "GET", body) => {
  const r = await fetch(API + path, {
    method,
    headers: H,
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let j = null;
  try { j = JSON.parse(t); } catch { /* не JSON */ }
  return { status: r.status, body: j, text: t };
};

const main = async () => {
  console.log(`Аккаунт: ${user}`);
  console.log(`Репозиторий: ${user}/${REPO}`);

  // 1. создать репозиторий
  let r = await api(`/repos/${user}/${REPO}`, "GET");
  if (r.status === 404) {
    r = await api("/user/repos", "POST", {
      name: REPO,
      description: "Портал «По косточкам» — разборы бухгалтерских ситуаций по законодательству РФ",
      private: PRIVATE,
      auto_init: false,
      has_issues: false,
      has_wiki: false,
    });
    if (r.status === 201) console.log("Репозиторий создан");
    else if (r.status === 422) console.log("Репозиторий уже существует (422)");
    else {
      console.error("Не удалось создать:", r.status, r.text.slice(0, 300));
      process.exit(1);
    }
  } else if (r.status === 200) {
    console.log("Репозиторий уже существует");
  } else {
    console.error("Ошибка проверки:", r.status, r.text.slice(0, 200));
    process.exit(1);
  }

  // 2. проверить, что ветка main запушена
  const br = await api(`/repos/${user}/${REPO}/branches/main`);
  console.log("Ветка main:", br.status === 200 ? "есть" : "нет (запушьте ветку)");

  // 3. включить Pages
  if (br.status === 200) {
    const p = await api(`/repos/${user}/${REPO}/pages`, "POST", {
      source: { branch: "main", path: "/" },
    });
    if (p.status === 201) console.log("GitHub Pages включён");
    else if (p.status === 409) console.log("Pages уже настроен (409) — обновляю");
    else console.log("Pages:", p.status, p.text.slice(0, 200));

    if (p.status === 409 || p.status === 422) {
      const u = await api(`/repos/${user}/${REPO}/pages`, "PUT", {
        source: { branch: "main", path: "/" },
      });
      console.log("Обновление Pages:", u.status, u.text.slice(0, 150));
    }

    // 4. отчёт
    const info = await api(`/repos/${user}/${REPO}/pages`);
    if (info.status === 200 && info.body) {
      console.log("URL сайта:", info.body.html_url || info.body.cname);
      console.log("Статус:", info.body.status, "| HTTPS:", info.body.https_enforced);
    }
  }
};

main().catch((e) => {
  console.error("Ошибка: " + e.message);
  process.exit(1);
});
