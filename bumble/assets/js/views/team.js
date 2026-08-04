/* ═══ КОМАНДА · личные доски, ритуалы, KPI, нагрузка ═══════════════ */
BOS.route('team', function (host) {
  var E = BOS.esc;
  var who = UI.fval('team-who', 'w', 'all');
  var view = UI.fval('team-view', 'v', 'board');

  var h = UI.head({
    eyebrow: 'Команда',
    title: 'Кто что делает',
    sub: 'CMO и две SMM-специалистки. Разделение не по постам, а по типу работы: ' +
      'одна отвечает за то, что смотрят, вторая — за то, что читают и с чем разговаривают.'
  });

  /* ── КАРТОЧКИ ЛЮДЕЙ ─────────────────────────────────────────── */
  h += '<div class="grid g3 rise rise-1">';
  REF.team.forEach(function (p) {
    var hrs = BOS.load7(p.key), pct = Math.round(hrs / p.capacityWeek * 100);
    var mine = BOS.byAssignee(p.key);
    var open = mine.filter(function (t) { return t.status !== 'done'; });
    var over = open.filter(function (t) { return t.due && BOS.daysLeft(t.due) < 0; });
    h += '<div class="card"><div class="cap">' + E(p.role) + '</div>'
      + '<h4 style="font-size:16px">' + E(UI.who(p.key)) + '</h4>'
      + '<p style="margin-top:6px">' + E(p.scope) + '</p>'
      + '<div style="margin-top:12px" class="cap">Загрузка 7 дней</div>'
      + '<div class="kpi-val mono" style="font-size:20px">' + hrs + ' / ' + p.capacityWeek + ' ч</div>'
      + '<div class="bar' + (pct > 100 ? ' over' : '') + '"><i style="width:' + BOS.clamp(pct, 0, 100) + '%"></i></div>'
      + '<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">'
      + UI.chip(open.length + ' открыто')
      + (over.length ? UI.chip(over.length + ' просроч.', 'crit') : '')
      + (pct > 100 ? UI.chip('перегруз', 'crit') : (pct > 80 ? UI.chip('почти предел', 'high') : UI.chip('норма')))
      + '</div>'
      + '<div style="margin-top:12px" class="cap">Отвечает за</div>'
      + '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:5px">'
      + p.owns.map(function (o) { return UI.chip(o); }).join('') + '</div>'
      + '</div>';
  });
  h += '</div>';

  /* ── ФИЛЬТРЫ ────────────────────────────────────────────────── */
  h += '<h2 class="sec">Доска задач</h2>';
  h += UI.filters('team-who', [{
    type: 'seg', key: 'w', def: 'all', options: [{ v: 'all', l: 'Все' }].concat(
      REF.team.map(function (p) { return { v: p.key, l: UI.who(p.key) }; }))
  }]);
  h += UI.filters('team-view', [{
    type: 'seg', key: 'v', def: 'board', options: [
      { v: 'board', l: 'Канбан' }, { v: 'list', l: 'Список' }, { v: 'rituals', l: 'Ритуалы и KPI' }
    ]
  }]);

  var tasks = BOS.all('tasks').filter(function (t) { return who === 'all' || t.assignee === who; });

  if (view === 'board') {
    h += '<div class="filters"><button class="btn-gold" id="t-add">+ Задача</button>'
      + '<span class="dim mono" style="font-size:11px;margin-left:10px">Карточки перетаскиваются между колонками</span></div>';
    h += UI.kanban(tasks, {});

  } else if (view === 'list') {
    h += '<div class="filters"><button class="btn-gold" id="t-add">+ Задача</button></div>';
    h += UI.table('team-tbl', [
      { key: 'title', label: 'Задача', render: function (r) { return '<b>' + E(r.title) + '</b><span class="sub-line">' + E(r.goal || '') + '</span>'; } },
      { key: 'module', label: 'Направление', w: '140px' },
      { key: 'assignee', label: 'Кто', w: '130px', render: function (r) { return E(UI.who(r.assignee)); } },
      { key: 'priority', label: 'Приор.', w: '95px', render: function (r) { return UI.prChip(r.priority); } },
      { key: 'status', label: 'Статус', w: '110px', render: function (r) { return UI.chip(BOS.statusLabel(r.status)); } },
      { key: 'due', label: 'Дедлайн', w: '120px', render: function (r) { return UI.due(r.due); } },
      { key: 'hours', label: 'Ч', num: true, w: '55px' }
    ], tasks, function (id) { UI.taskModal(id); });

  } else {
    /* РИТУАЛЫ И KPI */
    REF.team.filter(function (p) { return who === 'all' || p.key === who; }).forEach(function (p) {
      h += '<h2 class="sec">' + E(UI.who(p.key)) + ' · ' + E(p.role) + '</h2>';
      h += '<div class="grid g2">';
      h += '<div class="card"><div class="cap">KPI</div>'
        + p.kpi.map(function (k) {
          return '<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid var(--line);font-size:13.5px">'
            + '<span>' + E(k.n) + '</span><span class="mono" style="color:var(--gold)">' + E(k.target) + '</span></div>';
        }).join('') + '</div>';
      h += '<div class="card"><div class="cap">Ёмкость</div>'
        + '<div class="kpi-val mono" style="font-size:22px">' + p.capacityWeek + ' ч / нед</div>'
        + '<p style="margin-top:8px">Правило: при загрузке выше 80% новые задачи ставим только вместо старых, ' +
        'а не сверху. Перегруз — это не героизм, а сорванные сроки через неделю.</p></div>';
      h += '</div>';
      h += '<div class="grid g3" style="margin-top:14px">'
        + '<div class="card"><div class="cap">Каждый день</div>' + UI.beanList(p.rituals.day) + '</div>'
        + '<div class="card"><div class="cap">Каждую неделю</div>' + UI.beanList(p.rituals.week) + '</div>'
        + '<div class="card"><div class="cap">Каждый месяц</div>' + UI.beanList(p.rituals.month) + '</div>'
        + '</div>';
    });

    h += '<h2 class="sec">Шаблон постановки задачи</h2>';
    h += '<p class="note" style="margin-bottom:12px">Задача без цели и ожидаемого результата в работу не берётся — ' +
      'она всё равно вернётся переделываться, только позже и дороже.</p>';
    h += UI.table('team-tpl', [
      { key: 'f', label: 'Поле', w: '220px', render: function (r) { return '<b>' + E(r.f) + '</b>'; } },
      { key: 'd', label: 'Что писать' }
    ], REF.taskTemplate);

    h += '<h2 class="sec">Имена в системе</h2>';
    h += '<div class="card"><p class="note" style="margin-bottom:12px">Замените подписи на реальные имена — они подставятся везде.</p>'
      + REF.team.map(function (p) {
        return '<div class="field"><label>' + E(p.role) + '</label>'
          + '<input data-name="' + p.key + '" value="' + E(UI.who(p.key)) + '"></div>';
      }).join('')
      + '<button class="btn-gold" id="save-names">Сохранить имена</button></div>';
  }

  host.innerHTML = h;

  var add = document.getElementById('t-add');
  if (add) add.onclick = function () {
    UI.taskModal(null);
    if (who !== 'all') setTimeout(function () {
      var a = document.getElementById('f-assignee'); if (a) a.value = who;
    }, 30);
  };
  var sn = document.getElementById('save-names');
  if (sn) sn.onclick = function () {
    var n = BOS.settings.names || {};
    document.querySelectorAll('[data-name]').forEach(function (el) {
      n[el.getAttribute('data-name')] = el.value || el.getAttribute('data-name');
    });
    BOS.settings.names = n;
    BOS.emit(); UI.toast('Имена обновлены'); BOS.render();
  };
});
