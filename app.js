// Калькуляторы портала «По косточкам»
// Принцип: все переменные ставки вводит пользователь, а не «зашиты» в код.
// Рядом с каждым полем — ссылка, где проверить актуальное значение.

function num(id){
  const v = document.getElementById(id).value.replace(/\s/g,'').replace(',', '.');
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}
function rub(n){ return n.toLocaleString('ru-RU', {maximumFractionDigits: 0}) + ' ₽'; }

// ---------- 1. Штраф за несданную декларацию (ст. 119 НК РФ) ----------
function calcFine(){
  const tax  = num('f-tax');      // сумма налога к уплате по декларации
  const m    = Math.max(0, parseInt(document.getElementById('f-months').value || 0, 10));
  const paid = document.getElementById('f-paid').checked;

  let fine, why;
  if (tax <= 0){
    // нулевая декларация или налог = 0
    fine = 1000;
    why = 'Налог к уплате нулевой, но штраф всё равно не менее 1 000 ₽ (ниже предел ст. 119 НК РФ).';
  } else if (paid){
    fine = 1000;
    why = 'Налог уплачен вовремя — считается, что доплаченного налога нет, поэтому штраф минимальный: 1 000 ₽ (позиция Минфина).';
  } else {
    let f = tax * 0.05 * m;          // 5% за каждый полный или неполный месяц
    f = Math.min(f, tax * 0.3);      // но не более 30% налога (ст. 119 НК РФ, с 2023 г.)
    f = Math.max(f, 1000);           // но не менее 1 000 ₽
    fine = f;
    why = '5% × ' + rub(tax) + ' × ' + m + ' мес. Предел 30% = ' + rub(tax*0.3) + ' (ст. 119 НК РФ).';
  }
  document.getElementById('f-result').innerHTML =
    'Штраф: <b class="big">' + rub(fine) + '</b><span class="why">' + why +
    ' Отдельно: пеня за неуплату налога (ст. 75 НК РФ) и возможная блокировка счёта, если декларация не сдана более 20 дней (ст. 76 НК РФ).</span>';
}

// ---------- 2. УСН: 6% «доходы» против 15% «доходы минус расходы» ----------
function calcUsn(){
  const d = num('u-income');   // доходы за год
  const r = Math.min(num('u-expense'), d); // расходы за год (не выше доходов для расчёта)

  if (d <= 0){
    document.getElementById('u-result').innerHTML = '<span class="why">Введите доходы за год.</span>';
    return;
  }
  const tax6  = d * 0.06;                       // УСН «доходы»
  let   tax15 = (d - r) * 0.15;                 // УСН «доходы минус расходы»
  const minTax = d * 0.01;                      // минимальный налог: 1% от доходов
  if (tax15 < minTax) tax15 = minTax;           // платится минимальный

  const breakeven = d * 0.6;  // перелом: расходы выше ~60% доходов → выгоден 15%
  const verdict = tax6 <= tax15
    ? 'Выгоднее <b>«Доходы», 6%</b> — платите ' + rub(tax6) + ' вместо ' + rub(tax15) + '.'
    : 'Выгоднее <b>«Доходы минус расходы», 15%</b> — платите ' + rub(tax15) + ' вместо ' + rub(tax6) + '.';
  document.getElementById('u-result').innerHTML =
    verdict + '<span class="why">При расходах выше ' + rub(breakeven) +
    ' (≈60% доходов) начинает выигрывать режим 15%. Минимальный налог на «Д-Р»: 1% от доходов = ' + rub(minTax) +
    '. Не учтены: страховые взносы (они уменьшают налог), сниженные ставки регионов — считайте это предварительной оценкой.</span>';
}
