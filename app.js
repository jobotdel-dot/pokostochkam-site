// Калькуляторы портала «По косточкам»
//
// Принципы:
//   1. Никакой «магии»: каждое число в результате — из формулы, показанной рядом.
//   2. Все нормативы 2026 года вынесены в блок RATES — их легко обновить,
//      когда что-то изменится, и легко проверить по ссылкам рядом.
//   3. Рядом с результатом — норма статьи НК РФ и ссылка на первоисточник.
//   4. Если введённые данные выглядят сомнительно — предупреждение, а не тишина.
//   5. Ничего не отправляется на сервер: расчёт целиком в браузере.

const RATES = {
  year: 2026,
  // страховые взносы ИП «за себя» (ст. 430 НК РФ)
  ipFixed: 57390,            // фиксированный взнос за полный год
  ipExtraLimit: 300000,      // порог, с которого берётся 1%
  ipExtraMax: 321818,        // максимум 1% (п. 11 ст. 430 НК РФ)
  mrot: 27093,               // федеральный МРОТ с 01.01.2026
  // УСН
  usnIncome: 6,              // «доходы»
  usnProfit: 15,             // «доходы минус расходы»
  usnMin: 1,                 // минимальный налог, % от доходов
  ndsLimit: 20000000,        // порог дохода для освобождения от НДС на УСН с 2026 г.
  // НДС
  nds: { "22": 22, "10": 10, "7": 7, "5": 5, "0": 0 },
  // штрафы (ст. 119 НК РФ)
  finePct: 5, fineMin: 1000, fineMaxPct: 30,
  // пени (ст. 75 НК РФ): организации — 1/300, затем 1/150 на 31–90 день, далее 1/300
  keyRate: 14,               // ключевая ставка ЦБ на 21.10.2026
};

const LINKS = {
  nk75: "https://www.consultant.ru/document/cons_doc_LA_19601/",
  nk119: "https://www.consultant.ru/document/cons_doc_LA_19601/",
  nk430: "https://www.consultant.ru/document/cons_doc_LA_19601/",
  nk164: "https://www.consultant.ru/document/cons_doc_LA_19601/",
  nk346: "https://www.consultant.ru/document/cons_doc_LA_19601/",
  nalog: "https://www.nalog.gov.ru/rn77/",
  cbr: "https://www.cbr.ru/hd_base/KeyRate/",
};

const $ = (id) => document.getElementById(id);

function num(id) {
  const el = $(id);
  if (!el) return 0;
  const v = String(el.value).replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}
function int(id) {
  return Math.max(0, Math.round(num(id)));
}
function chk(id) {
  const el = $(id);
  return !!(el && el.checked);
}
function rub(n) {
  return Math.round(n).toLocaleString("ru-RU") + " ₽";
}
function rub2(n) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₽";
}
function pct(n) {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + " %";
}
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// единый блок результата: вывод + формула + норма + предупреждения
function render(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html;
}
function formula(rows) {
  return (
    '<details class="calc-detail"><summary>Показать расчёт по шагам</summary>' +
    '<table class="calc-table"><tbody>' +
    rows
      .map((r) => `<tr><td>${r[0]}</td><td class="f">${r[1]}</td><td class="v">${r[2] ?? ""}</td></tr>`)
      .join("") +
    "</tbody></table></details>"
  );
}
function norm(text, href) {
  return `<p class="calc-norm">Норма: ${text}${href ? ` — <a href="${href}" target="_blank" rel="nofollow">открыть</a>` : ""}</p>`;
}
function warn(list) {
  if (!list || !list.length) return "";
  return '<div class="calc-warn"><b>Проверьте расчёт:</b><ul>' +
    list.map((w) => `<li>${w}</li>`).join("") + "</ul></div>";
}
function note(text) {
  return `<p class="calc-note">${text}</p>`;
}

// ════════════════════════════════════════════════════════════
//  1. Штраф за несданную декларацию (ст. 119 НК РФ)
// ════════════════════════════════════════════════════════════
function calcFine() {
  const tax = num("f-tax");
  const months = int("f-months");
  const paid = chk("f-paid");
  const warns = [];
  const rows = [];

  if (tax < 0) warns.push("Сумма налога отрицательная — проверьте ввод.");

  let fine, formulaText;

  if (tax <= 0) {
    fine = RATES.fineMin;
    formulaText = "налог = 0 → применяется только нижний предел";
    rows.push(["Налог к уплате", "0 ₽", ""]);
    rows.push(["Минимальный штраф", "не менее 1 000 ₽", rub(fine)]);
  } else if (paid) {
    fine = RATES.fineMin;
    formulaText = "5% × 0 ₽ (налог уплачен) → минимальный штраф";
    rows.push(["Налог к уплате", rub(tax), ""]);
    rows.push(["Налог уплачен вовремя", "доплаченного налога нет", "0 ₽"]);
    rows.push(["Штраф", "не менее 1 000 ₽", rub(fine)]);
  } else {
    const raw = (tax * RATES.finePct) / 100 * months;
    const capped = tax * (RATES.fineMaxPct / 100);
    fine = Math.min(raw, capped);
    rows.push(["Налог к уплате", rub(tax), ""]);
    rows.push(["Просрочка", months + " мес.", ""]);
    rows.push([
      "5% за месяц × " + months,
      rub(tax) + " × 5% × " + months,
      rub(raw),
    ]);
    rows.push(["Предел 30% от налога", rub(tax) + " × 30%", rub(capped)]);
    if (raw > capped) {
      rows.push(["Применено ограничение", "берём 30% от налога", rub(fine)]);
      warns.push("Сработал предел 30% от суммы налога — штраф упирается в него, а не в 5% за месяц.");
    }
    fine = Math.max(fine, RATES.fineMin);
    rows.push(["Итоговый штраф", "не менее 1 000 ₽", rub(fine)]);
    formulaText = rub(tax) + " × 5% × " + months + " мес. = " + rub(raw) +
      (raw > capped ? ", но не более 30% (" + rub(capped) + ")" : "");
  }

  if (months > 12) warns.push("Просрочка больше 12 месяцев — проверьте, не идёт ли речь о повторном нарушении (повторный штраф по ст. 119 НК РФ не ограничен 30% и 1 000 ₽).");
  if (months === 0) warns.push("Просрочка 0 месяцев — штраф по ст. 119 НК РФ не начисляется.");

  render(
    "f-result",
    '<div class="calc-sum">Штраф по ст. 119 НК РФ: <b class="big">' + rub(fine) + "</b></div>" +
      formula(rows) +
      norm("ст. 119 НК РФ — непредставление налоговой декларации", "https://pravo.gov.ru") +
      note(
        "<b>Это только штраф.</b> Отдельно считаются: пеня за неуплату налога (ст. 75 НК РФ) " +
        "и риск приостановления операций по счетам, если декларация не представлена более 20 дней " +
        "после требования (ст. 76 НК РФ). Пеню считает <a href=\"calcs.html#peni\">калькулятор пеней</a>."
      ) +
      warn(warns)
  );
}

// ════════════════════════════════════════════════════════════
//  2. УСН: 6% против 15% (с учётом НДС и взносов)
// ════════════════════════════════════════════════════════════
function calcUsn() {
  const income = num("u-income");
  const expense = num("u-expense");
  const vatRate = $("u-vat") ? $("u-vat").value : "22";
  const hasVat = vatRate !== "0" && vatRate !== "none";
  const staff = chk("u-staff");

  if (income <= 0) {
    render("u-result", '<div class="calc-warn">Введите доходы за год.</div>');
    return;
  }

  const warns = [];
  const rows = [];
  const exp = Math.min(expense, income);
  if (expense > income) warns.push("Расходы больше доходов — для расчёта взяты равными доходам (убыток по УСН возможен только с разницы, и налог не начисляется).");

  // НДС: выручка по УСН идёт без НДС, налог либо к вычету, либо в расходы
  const vatRateNum = hasVat ? Number(vatRate) : 0;
  // база УСН = поступления без НДС
  const usnBase = vatRateNum > 0 ? (income * 100) / (100 + vatRateNum) : income;
  // входящий НДС к вычету (при ставке 22/10) либо в расходы (5/7 — по общему правилу)
  const inputVat = vatRateNum > 0 ? (exp * vatRateNum) / 100 : 0;
  const vatToDeduct = vatRateNum >= 10;
  const vatToExpense = vatRateNum > 0 && vatRateNum < 10;

  // расходы для режима Д-Р
  let expDeduct = exp;
  if (vatToExpense) expDeduct = exp + inputVat;

  // страховые взносы ИП уменьшают налог (до 100% без сотрудников, до 50% с сотрудниками)
  const fixed = RATES.ipFixed;
  const extra = Math.min(Math.max(0, usnBase - RATES.ipExtraLimit) * 0.01, RATES.ipExtraMax);
  const vznosy = fixed + extra;
  const limit = staff ? 0.5 : 1;

  // режим 6%
  const tax6Raw = (usnBase * RATES.usnIncome) / 100;
  const tax6 = Math.max(0, tax6Raw - Math.min(vznosy, tax6Raw * limit));
  // режим 15%
  const base15 = Math.max(0, usnBase - expDeduct);
  const tax15Raw = (base15 * RATES.usnProfit) / 100;
  const minTax = (usnBase * RATES.usnMin) / 100;
  const tax15 = Math.max(tax15Raw, minTax);
  const tax15AfterVznosy = Math.max(0, tax15 - Math.min(vznosy, tax15 * limit));

  // Полная нагрузка = налог ДО уменьшения на взносы + НДС.
  // Взносы здесь не вычитаем: они уменьшают налог, но сами остаются расходом
  // бизнеса, и в режиме «Д-Р» их нельзя учесть второй раз.
  const vatPay = vatRateNum > 0 ? (usnBase * vatRateNum) / 100 : 0;
  const total6 = tax6Raw + vatPay;
  const total15 = tax15 + vatPay;

  rows.push(["Доходы (поступления)", rub(income), ""]);
  if (vatRateNum > 0) {
    rows.push([
      "База по УСН (без НДС)",
      rub(income) + " × 100 : " + (100 + vatRateNum),
      rub(usnBase),
    ]);
    rows.push([
      "НДС к уплате (ставка " + vatRateNum + "%)",
      rub(usnBase) + " × " + vatRateNum + "%",
      rub((usnBase * vatRateNum) / 100),
    ]);
  } else {
    rows.push(["База по УСН", "доходы без НДС", rub(usnBase)]);
  }
  rows.push(["Расходы", "не выше доходов", rub(exp)]);
  if (vatToDeduct) {
    rows.push([
      "Входящий НДС",
      rub(exp) + " × " + vatRateNum + "% → в вычет",
      rub(inputVat),
    ]);
  } else if (vatToExpense) {
    rows.push([
      "Входящий НДС",
      rub(exp) + " × " + vatRateNum + "% → в расходы",
      rub(inputVat),
    ]);
    rows.push(["Расходы для режима Д-Р", rub(exp) + " + " + rub(inputVat), rub(expDeduct)]);
  }
  rows.push([
    "Страховые взносы ИП",
    RATES.ipFixed + " + 1% с превышения " + (RATES.ipExtraLimit / 1000) + " тыс.",
    rub(vznosy),
  ]);
  rows.push(["Уменьшение налога на взносы", staff ? "не более 50%" : "не более 100%", rub(Math.min(vznosy, tax6Raw * limit)) + " (для 6%)"]);

  rows.push(["", "", ""]);
  rows.push(["<b>УСН «Доходы» 6%</b>", "", ""]);
  rows.push(["Налог до уменьшения", rub(usnBase) + " × 6%", rub(tax6Raw)]);
  rows.push(["6% — после уменьшения на взносы", "", rub(tax6)]);
  rows.push(["<b>УСН «Д-Р» 15%</b>", "", ""]);
  rows.push(["База (доходы − расходы)", rub(usnBase) + " − " + rub(expDeduct), rub(base15)]);
  rows.push(["Налог 15%", rub(base15) + " × 15%", rub(tax15Raw)]);
  rows.push(["Минимальный налог 1% от доходов", rub(usnBase) + " × 1%", rub(minTax)]);
  if (minTax > tax15Raw) {
    rows.push(["Применён минимальный налог", "больше 15%", rub(minTax)]);
  }
  rows.push(["Налог по Д-Р (до уменьшения)", "", rub(tax15)]);
  rows.push(["15% — после уменьшения на взносы", "", rub(tax15AfterVznosy)]);

  const better6 = total6 <= total15;
  const diff = Math.abs(total6 - total15);

  // порог НДС
  let threshold = "";
  if (income > RATES.ndsLimit) {
    threshold =
      '<div class="calc-warn"><b>Порог НДС превышен.</b> Доход ' + rub(income) +
      " больше " + rub(RATES.ndsLimit) + " — вы плательщик НДС на УСН с 2026 года. " +
      "Если доходы за 2025 год были ниже порога, освобождение возможно (проверьте на nalog.gov.ru).</div>";
  } else {
    threshold = note(
      "Доход " + rub(income) + " не превышает порог " + rub(RATES.ndsLimit) +
      " для освобождения от НДС на УСН с 2026 года."
    );
  }

  render(
    "u-result",
    '<div class="calc-sum">Выгоднее: <b class="big">' +
      (better6 ? "УСН «Доходы» 6%" : "УСН «Доходы минус расходы» 15%") +
      "</b></div>" +
      '<p class="calc-lead">Налоговая нагрузка: <b>' + rub(better6 ? total6 : total15) + "</b> — разница с другим режимом " +
      rub(diff) + " в пользу выбранного варианта.</p>" +
      '<div class="calc-compare">' +
        '<div class="cc' + (better6 ? " win" : "") + '"><span>6% «Доходы»</span><b>' + rub(total6) + "</b><small>Налог " + rub(tax6Raw) +
      (vatRateNum > 0 ? " + НДС " + rub(vatPay) : "") + "<br>После уменьшения на взносы: " + rub(tax6) + "</small></div>" +
        '<div class="cc' + (better6 ? "" : " win") + '"><span>15% «Д-Р»</span><b>' + rub(total15) + "</b><small>Налог " + rub(tax15) +
      (vatRateNum > 0 ? " + НДС " + rub(vatPay) : "") + "<br>После уменьшения на взносы: " + rub(tax15AfterVznosy) + "</small></div>" +
      "</div>" +
      formula(rows) +
      threshold +
      norm("ст. 346.11, 346.13, 346.14, 346.16, 346.18 НК РФ; ст. 430 НК РФ — взносы", "https://pravo.gov.ru") +
      note(
        "Крупным числом показана нагрузка до уменьшения налога на взносы — так режимы сравнимы. " +
        "Строка «после уменьшения на взносы» — это сумма, которую вы реально перечислите в бюджет: " +
        "взносы уменьшают налог по УСН " + (staff ? "не более чем на 50%" : "до 100%") + " (подп. 3 п. 2 ст. 346.21 НК РФ). " +
        "Не учтено: пониженные ставки регионов по УСН, льготы для отдельных категорий, " +
        "страховые взносы за сотрудников, вычеты по НДС сверх входящего."
      ) +
      warn(warns)
  );
}

// ════════════════════════════════════════════════════════════
//  3. Пени по налогам (ст. 75 НК РФ)
// ════════════════════════════════════════════════════════════
function calcPeni() {
  const sum = num("p-sum");
  const days = int("p-days");
  const rate = num("p-rate") || RATES.keyRate;
  const isOrg = chk("p-org");
  const warns = [];

  if (sum <= 0) {
    render("p-result", '<div class="calc-warn">Введите сумму недоимки.</div>');
    return;
  }
  if (days <= 0) {
    render("p-result", '<div class="calc-warn">Укажите число дней просрочки.</div>');
    return;
  }
  if (rate > 100) warns.push("Ключевая ставка больше 100% — проверьте ввод.");

  // организации: 1-30 → 1/300, 31-90 → 1/150, далее 1/300
  // ИП и физлица: 1/300 весь период
  const segments = [];
  if (isOrg) {
    const d1 = Math.min(days, 30);
    const d2 = Math.max(0, Math.min(days, 90) - 30);
    const d3 = Math.max(0, days - 90);
    if (d1 > 0) segments.push({ from: 1, to: d1, div: 300, days: d1 });
    if (d2 > 0) segments.push({ from: 31, to: 30 + d2, div: 150, days: d2 });
    if (d3 > 0) segments.push({ from: 91, to: days, div: 300, days: d3 });
  } else {
    segments.push({ from: 1, to: days, div: 300, days });
  }

  let total = 0;
  const rows = [["Недоимка", rub(sum), ""]];
  for (const s of segments) {
    const peni = (sum * rate * s.days) / (s.div * 100);
    total += peni;
    rows.push([
      "Дни " + s.from + "–" + s.to + " (1/" + s.div + ")",
      rub(sum) + " × " + rate + "% × " + s.days + " / " + s.div,
      rub(peni),
    ]);
  }
  rows.push(["Итого пеней", "", rub(total)]);

  render(
    "p-result",
    '<div class="calc-sum">Пеня: <b class="big">' + rub(total) + "</b></div>" +
      '<p class="calc-lead">За ' + days + " дн. просрочки при ключевой ставке " + rate +
      " % · " + (isOrg ? "организация (трёхступенчатый порядок)" : "ИП / физлицо (1/300 весь период)") + "</p>" +
      formula(rows) +
      norm("ст. 75 НК РФ — пени за несвоевременную уплату налога", "https://pravo.gov.ru") +
      note(
        "Ключевая ставка меняется в течение года — при длинной просрочке разбейте расчёт " +
        "по периодам действия ставки (актуальная: <a href=\"https://www.cbr.ru/hd_base/KeyRate/\" target=\"_blank\" rel=\"nofollow\">cbr.ru</a>). " +
        "Пени начисляются на отрицательное сальдо ЕНС в целом, а не по каждому налогу отдельно (п. 3 ст. 75 НК РФ)."
      ) +
      warn(warns)
  );
}

// ════════════════════════════════════════════════════════════
//  4. Страховые взносы ИП «за себя» (ст. 430 НК РФ)
// ════════════════════════════════════════════════════════════
function calcIpVznosy() {
  const income = num("v-income");
  const months = int("v-months") || 12;
  const warns = [];
  const rows = [];

  if (months < 1 || months > 12) warns.push("Период должен быть от 1 до 12 месяцев.");
  const m = Math.min(12, Math.max(1, months));

  const fixed = (RATES.ipFixed / 12) * m;
  const extraBase = Math.max(0, income - RATES.ipExtraLimit);
  const extra = Math.min(extraBase * 0.01, (RATES.ipExtraMax / 12) * m);
  const total = fixed + extra;

  rows.push(["Фиксированный взнос (полный год)", rub(RATES.ipFixed), ""]);
  rows.push([
    "За период " + m + " мес.",
    rub(RATES.ipFixed) + " / 12 × " + m,
    rub(fixed),
  ]);
  rows.push(["Порог для 1%", rub(RATES.ipExtraLimit), ""]);
  rows.push(["Доход свыше порога", rub(extraBase), ""]);
  rows.push([
    "Дополнительный взнос 1%",
    rub(extraBase) + " × 1%, не более " + rub(RATES.ipExtraMax / 12) + " за период",
    rub(extra),
  ]);
  rows.push(["Итого взносов", "", rub(total)]);

  if (income > RATES.ndsLimit) {
    warns.push("Доход свыше " + rub(RATES.ndsLimit) + " — вы плательщик НДС на УСН; при определении дохода для взносов имеют значение особенности п. 9 ст. 430 НК РФ.");
  }
  if (income > 0 && income <= RATES.ipExtraLimit) {
    warns.push("Доход не превышает " + rub(RATES.ipExtraLimit) + " — дополнительный взнос 1% не начисляется.");
  }
  if (m < 12) {
    warns.push("Расчёт сделан за неполный год. Если вы не были зарегистрированы как ИП весь год, дни регистрации и снятия с учёта включаются в период (п. 1 ст. 430 НК РФ).");
  }

  render(
    "v-result",
    '<div class="calc-sum">Взносы ИП «за себя»: <b class="big">' + rub(total) + "</b></div>" +
      '<p class="calc-lead">Фиксированная часть ' + rub(fixed) + " + дополнительный 1% " + rub(extra) + "</p>" +
      formula(rows) +
      norm("ст. 430 НК РФ — фиксированные взносы и 1% с дохода свыше 300 000 ₽", "https://pravo.gov.ru") +
      note(
        "Срок уплаты: фиксированные взносы — до 28 декабря, дополнительный 1% — до 1 июля следующего года. " +
        "Взносы уменьшают налог по УСН: ИП без сотрудников — до 100%, с сотрудниками — не более 50%."
      ) +
      warn(warns)
  );
}

// ════════════════════════════════════════════════════════════
//  5. НДС: выделить / начислить
// ════════════════════════════════════════════════════════════
function calcNds() {
  const amount = num("n-amount");
  const rate = Number($("n-rate").value);
  const mode = $("n-mode").value;

  if (amount <= 0) {
    render("n-result", '<div class="calc-warn">Введите сумму.</div>');
    return;
  }

  const rows = [];
  let vat, withVat, withoutVat;

  if (mode === "extract") {
    withoutVat = (amount * 100) / (100 + rate);
    vat = amount - withoutVat;
    withVat = amount;
    rows.push(["Сумма с НДС", "введено", rub(withVat)]);
    rows.push([
      "Сумма без НДС",
      rub(withVat) + " × 100 : " + (100 + rate),
      rub2(withoutVat),
    ]);
    rows.push(["НДС «снизу»", rub(withVat) + " − " + rub2(withoutVat), rub2(vat)]);
  } else {
    withoutVat = amount;
    vat = (amount * rate) / 100;
    withVat = amount + vat;
    rows.push(["Сумма без НДС", "введено", rub(withoutVat)]);
    rows.push(["НДС «сверху»", rub(withoutVat) + " × " + rate + "%", rub2(vat)]);
    rows.push(["Сумма с НДС", rub(withoutVat) + " + " + rub2(vat), rub(withVat)]);
  }

  const warns = [];
  if (rate === 0) warns.push("Ставка 0% применяется только к экспорту и отдельным видам деятельности — проверьте основание по ст. 164 НК РФ.");
  if (rate === 5 || rate === 7) warns.push("Ставки 5% и 7% доступны только налогоплательщикам УСН, не освобождённым от НДС из-за превышения порога доходов.");
  if (rate === 22) warns.push("Ставка 22% — основная с 2026 года. Проверьте, не подходит ли ваша операция под льготную ставку или освобождение.");

  render(
    "n-result",
    '<div class="calc-sum">НДС: <b class="big">' + rub2(vat) + "</b></div>" +
      '<div class="calc-compare">' +
        '<div class="cc"><span>Без НДС</span><b>' + rub2(withoutVat) + "</b></div>" +
        '<div class="cc win"><span>С НДС</span><b>' + rub(withVat) + "</b></div>" +
      "</div>" +
      formula(rows) +
      norm("ст. 164, 168, 170 НК РФ — порядок исчисления и вычетов", "https://pravo.gov.ru") +
      note(
        "На УСН с 2026 года действуют ставки 5% и 7% (для упрощенцев, не освобождённых от НДС) " +
        "и 22% — общая ставка. При 5% и 7% входящий НДС включается в расходы, при 10% и 22% — принимается к вычету."
      ) +
      warn(warns)
  );
}

// ════════════════════════════════════════════════════════════
//  6. Авансовый платёж по УСН
// ════════════════════════════════════════════════════════════
function calcAvans() {
  const income = num("a-income");
  const rate = $("a-vat").value;
  const warns = [];
  const rows = [];

  if (income <= 0) {
    render("a-result", '<div class="calc-warn">Введите доходы за квартал.</div>');
    return;
  }

  const vatRate = rate === "none" ? 0 : Number(rate);
  const base = vatRate > 0 ? (income * 100) / (100 + vatRate) : income;
  const tax = (base * RATES.usnIncome) / 100;

  rows.push(["Поступления за квартал", rub(income), ""]);
  if (vatRate > 0) {
    rows.push([
      "Доходы без НДС",
      rub(income) + " × 100 : " + (100 + vatRate),
      rub2(base),
    ]);
    rows.push(["НДС к уплате", rub2(base) + " × " + vatRate + "%", rub2((base * vatRate) / 100)]);
  }
  rows.push(["Аванс по УСН 6%", rub2(base) + " × 6%", rub2(tax)]);

  if (vatRate === 0) {
    warns.push("Режим «без НДС»: с 2026 года НДС обязателен при доходах выше " + rub(RATES.ndsLimit) + ". Если вы применяете УСН с НДС, укажите ставку.");
  }
  if (vatRate === 5 || vatRate === 7) {
    warns.push("При ставке 5% и 7% входящий НДС включается в расходы, а не принимается к вычету — это меняет расчёт налога на режиме «доходы минус расходы».");
  }
  if (base > RATES.ndsLimit) {
    warns.push("Доход за квартал превышает " + rub(RATES.ndsLimit) + " — уточните статус по НДС на nalog.gov.ru.");
  }

  render(
    "a-result",
    '<div class="calc-sum">Авансовый платёж по УСН: <b class="big">' + rub2(tax) + "</b></div>" +
      '<p class="calc-lead">Начислено НДС: ' + rub2(vatRate > 0 ? (base * vatRate) / 100 : 0) + " · в базу по УСН идёт " + rub2(base) + "</p>" +
      formula(rows) +
      norm("ст. 346.21, 346.22 НК РФ — порядок исчисления и уплаты авансовых платежей", "https://pravo.gov.ru") +
      note(
        "Срок уплаты аванса — 25-го числа месяца, следующего за истекшим кварталом. " +
        "Если 25-е выпадает на выходной, срок переносится на следующий рабочий день (п. 7 ст. 6.1 НК РФ). " +
        "Полную разборку аванса с учётом переходящих авансов 2025 года читайте в статье «Аванс по УСН за I квартал 2026»."
      ) +
      warn(warns)
  );
}

// автопересчёт при вводе
function bindLive(ids, fn) {
  ids.forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("input", fn);
    el.addEventListener("change", fn);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const map = {
    "f-tax": calcFine, "f-months": calcFine, "f-paid": calcFine,
    "u-income": calcUsn, "u-expense": calcUsn, "u-vat": calcUsn, "u-staff": calcUsn,
    "p-sum": calcPeni, "p-days": calcPeni, "p-rate": calcPeni, "p-org": calcPeni,
    "v-income": calcIpVznosy, "v-months": calcIpVznosy,
    "n-amount": calcNds, "n-rate": calcNds, "n-mode": calcNds,
    "a-income": calcAvans, "a-vat": calcAvans,
  };
  Object.entries(map).forEach(([id, fn]) => bindLive([id], fn));

  // первичный расчёт для всех видимых блоков
  ["calcFine", "calcUsn", "calcPeni", "calcIpVznosy", "calcNds", "calcAvans"].forEach((fn) => {
    if (typeof window[fn] === "function") {
      try { window[fn](); } catch (e) { /* блок не на этой странице */ }
    }
  });
});
