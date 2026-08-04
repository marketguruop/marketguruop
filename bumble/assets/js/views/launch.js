/* ═══ ЗАПУСК НОВЫХ ПРОДУКТОВ ═══════════════════════════════════════ */
BOS.route('launch', function (host, arg) {
  var E = BOS.esc;
  var launches = BOS.all('launches');

  /* Открыт конкретный запуск */
  if (arg) {
    var l = BOS.find('launches', arg);
    if (!l) { BOS.go('launch'); return; }
    var done = l.done || [];

    var h = '<p class="mono dim" style="font-size:11px;margin-bottom:10px"><a href="#/launch">← Все запуски</a></p>';
    h += UI.head({
      eyebrow: l.kind + ' · ответственный: ' + UI.who(l.owner),
      title: l.name,
      sub: E(l.note || '') + '<br><span class="mono dim" style="font-size:12px">Целевая дата: ' + BOS.fmtDate(l.target) + '</span>'
    });

    var pct = Math.round(done.length / REF.launchSteps.length * 100);
    h += '<div class="grid g3 rise rise-1">';
    h += UI.kpi({ label: 'Пройдено этапов', value: done.length + ' / 13', pct: pct, foot: 'Этап не закрывается, пока не выполнены все пункты', hot: pct >= 50 });
    h += UI.kpi({ label: 'До целевой даты', value: (BOS.daysLeft(l.target) || 0) + ' дн', foot: BOS.fmtDate(l.target), bad: BOS.daysLeft(l.target) < 0 });
    h += UI.kpi({ label: 'Тип кампании', value: l.kind, foot: '7 фаз запуска' });
    h += '</div>';

    h += '<h2 class="sec">Чек-лист запуска</h2>';
    REF.launchSteps.forEach(function (s) {
      var isDone = done.indexOf(s.n) >= 0;
      h += '<details class="acc"' + (!isDone && done.indexOf(s.n - 1) >= 0 ? ' open' : '') + '>'
        + '<summary>'
        + '<span class="step-n" style="width:26px;height:26px;font-size:11px;' + (isDone ? 'background:var(--gold);color:var(--ink);border-color:transparent' : '') + '">' + s.n + '</span>'
        + E(s.name)
        + ' <span class="chip sm">' + E(UI.who(s.owner)) + '</span>'
        + ' <span class="chip sm">' + E(s.dur) + '</span>'
        + (isDone ? ' <span class="chip sm gold">пройден</span>' : '')
        + '</summary><div class="acc-b">'
        + UI.beanList(s.items)
        + '<p style="margin-top:12px"><b>Условие перехода:</b> ' + E(s.gate) + '</p>'
        + '<button class="btn sm" data-step="' + s.n + '" style="margin-top:10px">'
        + (isDone ? 'Снять отметку' : 'Отметить пройденным') + '</button>'
        + '</div></details>';
    });

    h += '<h2 class="sec">Семь фаз кампании</h2>';
    h += UI.table('lnc-phases', [
      { key: 'n', label: 'Фаза', w: '120px', render: function (r) { return '<b>' + E(r.n) + '</b>'; } },
      { key: 'act', label: 'Действие' },
      { key: 'ch', label: 'Каналы' },
      { key: 'kpi', label: 'KPI', w: '180px' }
    ], REF.campaignPhases);

    host.innerHTML = h;
    host.querySelectorAll('[data-step]').forEach(function (b) {
      b.onclick = function () {
        var n = Number(b.getAttribute('data-step'));
        var d = (l.done || []).slice();
        var i = d.indexOf(n);
        if (i >= 0) d.splice(i, 1); else d.push(n);
        BOS.patch('launches', l.id, { done: d });
        BOS.render();
      };
    });
    return;
  }

  /* Список запусков */
  var h = UI.head({
    eyebrow: 'Запуск продуктов',
    title: 'Пошаговый запуск',
    sub: 'Тринадцать этапов от исследования до анализа. Работает и для нового вкуса, ' +
      'и для второго продукта под зонтом Black Phoenix. Этап не закрывается, ' +
      'пока не выполнено условие перехода — иначе следующий запуск снова начнётся с нуля.'
  });

  h += '<div class="filters"><button class="btn-gold" id="l-add">+ Запуск</button></div>';

  h += '<div class="grid gauto-l">';
  launches.forEach(function (l) {
    var pct = Math.round((l.done || []).length / REF.launchSteps.length * 100);
    h += '<a class="card hov" href="#/launch/' + E(l.id) + '">'
      + '<div class="cap">' + E(l.kind) + ' · ' + E(UI.who(l.owner)) + '</div>'
      + '<h4>' + E(l.name) + '</h4><p>' + E(l.note || '') + '</p>'
      + '<div class="bar"><i style="width:' + pct + '%"></i></div>'
      + '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">'
      + UI.chip((l.done || []).length + ' / 13 этапов')
      + UI.chip(BOS.fmtDate(l.target))
      + '</div></a>';
  });
  h += '</div>';
  if (!launches.length) h += UI.empty('Запусков пока нет.', 'Создать запуск', function () { addLaunch(); });

  h += '<h2 class="sec">Тринадцать этапов</h2><div class="grid g3">';
  REF.launchSteps.forEach(function (s) {
    h += '<div class="card"><div class="cap">Этап ' + s.n + ' · ' + E(s.dur) + ' · ' + E(UI.who(s.owner)) + '</div>'
      + '<h4>' + E(s.name) + '</h4>'
      + '<p style="margin-top:8px" class="dim">' + E(s.gate) + '</p></div>';
  });
  h += '</div>';

  h += '<h2 class="sec">Типы кампаний</h2><div class="grid g3">';
  REF.campaignTypes.forEach(function (c) {
    h += '<div class="card"><h4>' + E(c.n) + '</h4><p>' + E(c.d) + '</p></div>';
  });
  h += '</div>';

  host.innerHTML = h;
  var add = document.getElementById('l-add');
  if (add) add.onclick = addLaunch;

  function addLaunch() {
    var body = '<div class="field"><label>Название запуска</label><input id="l-name"></div>'
      + '<div class="frow">'
      + '<div class="field"><label>Тип кампании</label><select id="l-kind">'
      + REF.campaignTypes.map(function (c) { return '<option>' + E(c.n) + '</option>'; }).join('') + '</select></div>'
      + '<div class="field"><label>Целевая дата</label><input type="date" id="l-target" value="' + BOS.today() + '"></div>'
      + '</div>'
      + '<div class="field"><label>Ответственный</label><select id="l-owner">' + UI.peopleOptions('cmo') + '</select></div>'
      + '<div class="field"><label>Заметка</label><textarea id="l-note"></textarea></div>';
    UI.modal('Новый запуск', body,
      '<button class="btn" data-close>Отмена</button><button class="btn-gold" id="l-save">Создать</button>',
      function () {
        document.getElementById('l-save').onclick = function () {
          var v = function (x) { return document.getElementById(x).value; };
          BOS.upsert('launches', {
            name: v('l-name') || 'Новый запуск', kind: v('l-kind'), target: v('l-target'),
            owner: v('l-owner'), note: v('l-note'), done: []
          });
          UI.closeModal(); BOS.render();
        };
      });
  }
});
