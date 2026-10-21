// Проверка арифметики калькуляторов на эталонных примерах.
// Запуск: node tools/test-calcs.mjs
//
// Примеры взяты из:
//   — калькулятор пеней biznesinalogi.ru (НДС 500 000, 51 день, ставка 14%);
//   — разбор «Аванс по УСН за I квартал 2026» (3 000 000 и 610 000 с НДС 22%);
//   — ст. 119 НК РФ (налог 60 000, 2 месяца, 5% / 1 000 ₽ / 30%);
//   — взносы ИП 2026 (57 390 + 1% свыше 300 000).

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, "..");

// вытаскиваем логику из app.js в изолированный контекст
const appSrc = readFileSync(resolve(SITE, "app.js"), "utf8");

// создаём песочницу с DOM-заглушкой
const values = {};
const checks = {};
const results = {};
// элементы НЕ кэшируем: значение и checked читаются из values/checks каждый раз
const makeEl = (id) => ({
  get value() { return values[id] ?? ""; },
  set value(v) { values[id] = String(v); },
  get checked() { return checks[id] ?? false; },
  set checked(v) { checks[id] = !!v; },
  addEventListener() {},
  set innerHTML(v) { results[id] = v; },
  get innerHTML() { return results[id] || ""; },
});
const els = {};
global.document = {
  getElementById: (id) => (els[id] = els[id] || makeEl(id)),
  addEventListener: () => {},
};
global.window = {};

// исполняем app.js в песочнице и получаем доступ к функциям
const sandbox = { document: global.document, window: global.window, console };
sandbox.globalThis = sandbox;
const run = new Function("document", "window", "console", appSrc + "\n;return {calcFine,calcUsn,calcPeni,calcIpVznosy,calcNds,calcAvans};");
const api = run(global.document, global.window, console);
const { calcFine, calcUsn, calcPeni, calcIpVznosy, calcNds, calcAvans } = api;

const setVals = (obj) => { for (const [k, v] of Object.entries(obj)) values[k] = String(v); };
const setChecks = (obj) => { for (const [k, v] of Object.entries(obj)) checks[k] = !!v; };
const getRes = (id) => results[id] || "";
const numOf = (s) => {
  // вытаскиваем первое число в тексте, убирая пробелы-разделители тысяч
  const m = s.match(/-?[\d  \s]+(?:,\d+)?/);
  if (!m) return NaN;
  return parseFloat(m[0].replace(/[\s  ]/g, "").replace(",", "."));
};

let pass = 0, fail = 0;
const check = (name, actual, expected, tol = 1) => {
  const ok = Math.abs(actual - expected) <= tol;
  if (ok) { pass++; console.log(`  ✓ ${name}: ${actual}`); }
  else { fail++; console.log(`  ✗ ${name}: получено ${actual}, ожидалось ${expected}`); }
};
// берём «крупное» число из блока .calc-sum
const head = (html) => {
  const m = html.match(/calc-sum">[\s\S]*?<b class="big">([\d\s,]+) ₽/);
  return m ? numOf(m[1]) : NaN;
};
// берём значение из строки таблицы расчёта по подписи
// nth — номер совпадения (по умолчанию первое), нужно, когда подпись повторяется
const cell = (html, label, nth = 0) => {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp("<tr><td>" + esc(label) + "[\\s\\S]*?<td class=\"v\">([\\d\\s,]*)\\s*₽", "gi");
  const all = [...html.matchAll(re)];
  const m = all[nth];
  return m ? numOf(m[1]) : NaN;
};

console.log("Проверка калькуляторов\n");

// ───────────────────────────────────────────────────────────
// 1. Пени: НДС 500 000 ₽, 51 день, ставка 14%, организация
//    Эталон biznesinalogi: 1-30 дн → 7 000; 31-51 дн → 9 800; итого 16 800
// ───────────────────────────────────────────────────────────
console.log("Пени (ст. 75 НК РФ), организация, 500 000 ₽, 51 день, 14%:");
setVals({ "p-sum": 500000, "p-days": 51, "p-rate": 14 });
setChecks({ "p-org": true });
calcPeni();
let r = getRes("p-result");
check("итого пеней", head(r), 16800);
check("1-30 дней (1/300)", cell(r, "Дни 1–30 (1/300)"), 7000);
check("31-51 день (1/150)", cell(r, "Дни 31–51 (1/150)"), 9800);
console.log();

// ───────────────────────────────────────────────────────────
// 2. Пени: ИП — 1/300 весь период
//    500 000 × 14% × 51 / 300 = 11 900
// ───────────────────────────────────────────────────────────
console.log("Пени, ИП (1/300 весь период), 500 000 ₽, 51 день, 14%:");
setChecks({ "p-org": false });
calcPeni();
r = getRes("p-result");
check("итого пеней", head(r), 11900);
console.log();

// ───────────────────────────────────────────────────────────
// 3. Штраф по ст. 119 НК РФ: налог 60 000, 2 месяца, налог не уплачен
//    60 000 × 5% × 2 = 6 000 (предел 30% = 18 000, не сработал)
// ───────────────────────────────────────────────────────────
console.log("Штраф (ст. 119 НК РФ), налог 60 000 ₽, 2 месяца:");
setVals({ "f-tax": 60000, "f-months": 2 });
setChecks({ "f-paid": false });
calcFine();
r = getRes("f-result");
check("штраф", head(r), 6000);
console.log();

// ───────────────────────────────────────────────────────────
// 4. Штраф: налог уплачен вовремя → минимальные 1 000 ₽
// ───────────────────────────────────────────────────────────
console.log("Штраф, налог уплачен вовремя:");
setChecks({ "f-paid": true });
calcFine();
r = getRes("f-result");
check("штраф (минимум)", head(r), 1000);
console.log();

// ───────────────────────────────────────────────────────────
// 5. Штраф: налог 60 000, 20 месяцев → 5% × 20 = 100% > 30% → предел 18 000
// ───────────────────────────────────────────────────────────
console.log("Штраф, налог 60 000 ₽, 20 месяцев (срабатывает предел 30%):");
setVals({ "f-months": 20 });
setChecks({ "f-paid": false });
calcFine();
r = getRes("f-result");
check("штраф (предел 30%)", head(r), 18000);
console.log();

// ───────────────────────────────────────────────────────────
// 6. Взносы ИП: доход 1 200 000, 12 месяцев
//    фикс. 57 390 + 1% × (1 200 000 − 300 000) = 9 000 → итого 66 390
// ───────────────────────────────────────────────────────────
console.log("Взносы ИП «за себя», доход 1 200 000 ₽, 12 месяцев:");
setVals({ "v-income": 1200000, "v-months": 12 });
calcIpVznosy();
r = getRes("v-result");
check("итого взносов", head(r), 66390);
console.log();

// ───────────────────────────────────────────────────────────
// 7. Взносы ИП: доход 250 000 (ниже порога) → только фиксированные
// ───────────────────────────────────────────────────────────
console.log("Взносы ИП, доход 250 000 ₽ (ниже порога):");
setVals({ "v-income": 250000 });
calcIpVznosy();
r = getRes("v-result");
check("итого взносов", head(r), 57390);
console.log();

// ───────────────────────────────────────────────────────────
// 8. Взносы ИП: неполный год (6 месяцев)
//    57 390 / 12 × 6 = 28 695; доход 600 000 → 1% × 300 000 = 3 000
//    потолок за 6 мес: 321 818 / 12 × 6 = 160 909 → не сработал
//    итого 31 695
// ───────────────────────────────────────────────────────────
console.log("Взносы ИП, 6 месяцев, доход 600 000 ₽:");
setVals({ "v-income": 600000, "v-months": 6 });
calcIpVznosy();
r = getRes("v-result");
check("итого взносов", head(r), 31695);
console.log();

// ───────────────────────────────────────────────────────────
// 9. НДС: выделить из 122 000 при 22% → 100 000 + 22 000
// ───────────────────────────────────────────────────────────
console.log("НДС: выделить из 122 000 ₽ при 22%:");
setVals({ "n-amount": 122000, "n-rate": "22", "n-mode": "extract" });
calcNds();
r = getRes("n-result");
check("НДС", head(r), 22000);
check("без НДС", numOf((r.match(/Без НДС<\/span><b>([\d\s,]+) ₽/) || [])[1] || "0"), 100000);
console.log();

// ───────────────────────────────────────────────────────────
// 10. НДС: начислить на 100 000 при 22% → 122 000
// ───────────────────────────────────────────────────────────
console.log("НДС: начислить на 100 000 ₽ при 22%:");
setVals({ "n-amount": 100000, "n-mode": "add" });
calcNds();
r = getRes("n-result");
const nds2 = r.match(/calc-sum">НДС: <b class="big">([\d\s,]+) ₽/);
check("НДС", numOf(nds2 ? nds2[1] : "0"), 22000);
check("с НДС", numOf((r.match(/С НДС<\/span><b>([\d\s,]+) ₽/) || [])[1] || "0"), 122000);
console.log();

// ───────────────────────────────────────────────────────────
// 11. Аванс по УСН: 3 000 000 с НДС 22%
//     база 3 000 000 × 100:122 = 2 459 016,39; аванс 6% = 147 540,98
// ───────────────────────────────────────────────────────────
console.log("Аванс по УСН, 3 000 000 ₽ с НДС 22%:");
setVals({ "a-income": 3000000, "a-vat": "22" });
calcAvans();
r = getRes("a-result");
const av = r.match(/calc-sum">Авансовый платёж по УСН: <b class="big">([\d\s,]+) ₽/);
check("аванс", numOf(av ? av[1] : "0"), 147540.98, 0.5);
console.log();

// ───────────────────────────────────────────────────────────
// 12. Аванс по УСН: 610 000 с НДС 22% → база 500 000, аванс 30 000
// ───────────────────────────────────────────────────────────
console.log("Аванс по УСН, 610 000 ₽ с НДС 22%:");
setVals({ "a-income": 610000 });
calcAvans();
r = getRes("a-result");
const av2 = r.match(/calc-sum">Авансовый платёж по УСН: <b class="big">([\d\s,]+) ₽/);
check("аванс", numOf(av2 ? av2[1] : "0"), 30000, 0.5);
console.log();

// ───────────────────────────────────────────────────────────
// 13. УСН: доход 2 000 000, расходы 800 000, без НДС
//     нагрузка 6%: 2 000 000 × 6% = 120 000; после уменьшения на взносы 74 390 → 45 610
//     нагрузка 15%: база 1 200 000 × 15% = 180 000 (минимальный 1% = 20 000)
//                   после уменьшения на взносы → 105 610
//     выгоднее 6%: 120 000 против 180 000
// ───────────────────────────────────────────────────────────
console.log("УСН 6% против 15%: доход 2 000 000, расходы 800 000, без НДС:");
setVals({ "u-income": 2000000, "u-expense": 800000, "u-vat": "none" });
setChecks({ "u-staff": false });
calcUsn();
r = getRes("u-result");
check("нагрузка на 6%", numOf((r.match(/6% «Доходы»<\/span><b>([\d\s]+) ₽/) || [])[1] || "0"), 120000);
check("нагрузка на 15%", numOf((r.match(/15% «Д-Р»<\/span><b>([\d\s]+) ₽/) || [])[1] || "0"), 180000);
check("6% после уменьшения на взносы", cell(r, "6% — после уменьшения на взносы"), 45610);
console.log();

// ───────────────────────────────────────────────────────────
// 14. УСН: расходы 1 700 000 (85%) → выгоднее 15%
//     6%: нагрузка 120 000; после взносов 45 610
//     15%: база 300 000 × 15% = 45 000; минимальный 1% = 20 000 → 45 000
//          после уменьшения на взносы 74 390 (не более 100%) → 0
//     выгоднее 15%: 45 000 против 120 000
// ───────────────────────────────────────────────────────────
console.log("УСН: доход 2 000 000, расходы 1 700 000 (выгоднее 15%):");
setVals({ "u-expense": 1700000 });
calcUsn();
r = getRes("u-result");
const t6b = numOf((r.match(/6% «Доходы»<\/span><b>([\d\s]+) ₽/) || [])[1] || "0");
const t15b = numOf((r.match(/15% «Д-Р»<\/span><b>([\d\s]+) ₽/) || [])[1] || "0");
check("нагрузка на 6%", t6b, 120000);
check("нагрузка на 15%", t15b, 45000);
check("15% после уменьшения на взносы", cell(r, "15% — после уменьшения на взносы"), 0);
console.log();

console.log(`Итого: успешно ${pass}, ошибок ${fail}`);
if (fail) process.exitCode = 1;
