/* ═══ AI-ОТДЕЛ · библиотека промптов ═══════════════════════════════ */
BOS.route('ai', function (host) {
  var E = BOS.esc;
  var role = UI.fval('ai-r', 'r', '');
  var q = UI.fval('ai-q', 'q', '').toLowerCase();

  var h = UI.head({
    eyebrow: 'AI-отдел',
    title: 'Библиотека промптов',
    sub: 'Каждый промпт решает одну конкретную задачу и уже содержит рамки бренда — ' +
      'чтобы модель не выдавала «премиум-крафт» и синие градиенты. ' +
      'Перед любым промптом вставляйте блок контекста: он экономит десять уточняющих реплик.'
  });

  /* ── КОНТЕКСТ ───────────────────────────────────────────────── */
  h += '<div class="card rise rise-1" style="border-color:var(--gold-rise)">'
    + '<div class="cap">Вставляется перед любым промптом</div>'
    + '<h4>Блок контекста бренда</h4>'
    + '<p style="margin:8px 0 10px">Скопируйте один раз в начало диалога — дальше можно давать промпты подряд, ' +
    'модель будет держать рамки.</p>'
    + UI.acc('Показать контекст', '<div class="prompt-box" id="ai-ctx">' + E(REF.aiContext) + '</div>')
    + '<div class="copybar"><button class="btn-gold" data-copy="ai-ctx">Скопировать контекст</button></div>'
    + '</div>';

  /* ── ФИЛЬТРЫ ────────────────────────────────────────────────── */
  h += '<h2 class="sec">Промпты по ролям</h2>';
  h += UI.filters('ai-q', [{ type: 'search', key: 'q', placeholder: 'Найти промпт по задаче' }]);
  h += UI.filters('ai-r', [{
    type: 'seg', key: 'r', def: '', options: [{ v: '', l: 'Все' }].concat(
      REF.promptRoles.map(function (r) { return { v: r, l: r }; }))
  }]);

  var list = REF.prompts.filter(function (p) {
    if (role && p.role !== role) return false;
    if (q && (p.n + ' ' + p.task + ' ' + p.text).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });

  h += '<p class="note dim" style="margin-bottom:12px">' + list.length + ' из ' + REF.prompts.length + ' промптов</p>';

  h += '<div class="grid g2">';
  list.forEach(function (p, i) {
    var pid = 'pr-' + BOS.slug(p.role) + '-' + i;
    h += '<div class="card"><div class="cap">' + E(p.role) + '</div>'
      + '<h4>' + E(p.n) + '</h4>'
      + '<p style="margin:6px 0 10px">' + E(p.task) + '</p>'
      + UI.acc('Показать промпт', '<div class="prompt-box" id="' + pid + '">' + E(p.text) + '</div>')
      + '<div class="copybar"><button class="btn sm" data-copy="' + pid + '">Скопировать</button>'
      + '<button class="btn sm" data-both="' + pid + '">С контекстом</button></div>'
      + '</div>';
  });
  h += '</div>';
  if (!list.length) h += UI.empty('Под этот запрос промптов нет. Попробуйте другую роль или слово.');

  /* ── КАК ПОЛЬЗОВАТЬСЯ ───────────────────────────────────────── */
  h += '<h2 class="sec">Как этим пользоваться</h2><div class="grid g3">';
  [
    { n: '1 · Контекст один раз', d: 'В начале диалога вставьте блок контекста. Дальше можно давать промпты подряд — рамки держатся.' },
    { n: '2 · Заполните скобки', d: 'В промптах есть места вида [тема], [цифры]. Не оставляйте их пустыми — модель начнёт выдумывать.' },
    { n: '3 · Не берите первый ответ', d: 'Просите варианты и выбирайте. Первый ответ почти всегда самый средний.' },
    { n: '4 · Правьте руками', d: 'Финальную правку тона делает человек. Иначе голос бренда усредняется за месяц.' },
    { n: '5 · Проверяйте на запреты', d: 'Слова «премиум», «турбо», «зерновой букет» и любые обещания пользы для здоровья — вычёркиваем.' },
    { n: '6 · Что сработало — в банк', d: 'Удачные формулировки переносите в банки контента. Это и есть накопление.' }
  ].forEach(function (s) {
    h += '<div class="card"><h4>' + E(s.n) + '</h4><p>' + E(s.d) + '</p></div>';
  });
  h += '</div>';

  host.innerHTML = h;
  UI.bindCopy(host);

  host.querySelectorAll('[data-both]').forEach(function (b) {
    b.onclick = function () {
      var el = document.getElementById(b.getAttribute('data-both'));
      if (!el) return;
      var text = REF.aiContext + '\n\n───────────────\n\n' + (el.innerText || el.textContent);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function () { UI.toast('Контекст + промпт скопированы'); });
      } else {
        var ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); UI.toast('Скопировано'); } catch (e) { }
        document.body.removeChild(ta);
      }
    };
  });
});
