/* ═══ ДАШБОРД · главная страница ═══════════════════════════════════ */
BOS.route('dashboard', function (host) {
  var E = BOS.esc;
  var tasks = BOS.all('tasks');
  var open = BOS.openTasks();
  var over = BOS.overdue();
  var today = BOS.dueToday();
  var week = BOS.dueWithin(7);
  var month = BOS.dueWithin(30);
  var blocked = BOS.blocked();
  var content = BOS.all('content');
  var ideas = BOS.all('ideas');
  var audit = BOS.all('audit').filter(function (a) { return a.status === 'open'; });
  var infl = BOS.all('influencers');
  var doneAll = tasks.filter(function (t) { return t.status === 'done'; });

  var published = content.filter(function (c) { return c.status === 'published'; });
  var totalReach = published.reduce(function (s, c) { return s + BOS.num(c.stats && c.stats.reach, 0); }, 0);
  var avgER = published.length
    ? (published.reduce(function (s, c) { return s + BOS.num(c.stats && c.stats.er, 0); }, 0) / published.length)
    : 0;

  var h = UI.head({
    eyebrow: 'Black Phoenix · Bumble Coffee',
    title: 'Дашборд',
    sub: 'Заряд без привязи. Состояние маркетинга на ' + BOS.fmtDate(BOS.today()) + '. ' +
      'Всё, что требует внимания сегодня, — в первом блоке.'
  });

  /* ── ТРЕБУЕТ ВНИМАНИЯ ───────────────────────────────────────── */
  var attention = [];
  if (over.length) attention.push({ t: over.length + ' просроченных задач', l: '#/control', bad: true });
  if (blocked.length) attention.push({ t: blocked.length + ' заблокировано — нужно решение', l: '#/control', bad: true });
  if (audit.length) attention.push({ t: audit.length + ' находок аудита без ответа', l: '#/audit', bad: false });
  var noStats = published.filter(function (c) { return !c.stats || !c.stats.reach; });
  if (noStats.length) attention.push({ t: noStats.length + ' публикаций без снятой статистики', l: '#/content', bad: false });
  var newIdeas = ideas.filter(function (i) { return i.status === 'new'; });
  if (newIdeas.length) attention.push({ t: newIdeas.length + ' идей без оценки', l: '#/ideas', bad: false });

  h += '<h2 class="sec">Требует внимания</h2>';
  if (attention.length) {
    h += '<div class="grid gauto rise rise-1">' + attention.map(function (a) {
      return '<a class="card hov" href="' + a.l + '" style="display:block">'
        + '<div class="cap">' + (a.bad ? 'Срочно' : 'На этой неделе') + '</div>'
        + '<h4 style="' + (a.bad ? 'color:var(--danger)' : '') + '">' + E(a.t) + '</h4>'
        + '<p class="dim">Открыть раздел →</p></a>';
    }).join('') + '</div>';
  } else {
    h += '<div class="card"><h4>Всё под контролем</h4><p>Просрочек и блокировок нет. Хороший момент, чтобы взять что-то из Growth Engine.</p></div>';
  }

  /* ── KPI ────────────────────────────────────────────────────── */
  h += '<h2 class="sec">Показатели</h2><div class="grid g4 rise rise-2">';
  h += UI.kpi({ label: 'Открытых задач', value: open.length, foot: 'Закрыто всего: ' + doneAll.length, right: over.length ? '−' + over.length + ' просроч.' : 'без просрочек', bad: over.length > 0 });
  h += UI.kpi({ label: 'Совокупный охват', value: BOS.fmtNum(totalReach), foot: 'По ' + published.length + ' публикациям', hot: true });
  h += UI.kpi({ label: 'Средний ER', value: (Math.round(avgER * 10) / 10) + '%', foot: 'Цель ≥6%', pct: Math.round(avgER / 6 * 100), hot: avgER >= 6 });
  h += UI.kpi({ label: 'Инфлюенсеров в базе', value: infl.length, foot: 'Цель к неделе 2: 200', pct: Math.round(infl.length / 200 * 100) });
  h += '</div>';

  h += '<div class="grid g4 rise rise-2" style="margin-top:14px">';
  h += UI.kpi({ label: 'Контент в производстве', value: content.filter(function (c) { return c.status !== 'published'; }).length, foot: 'Опубликовано: ' + published.length });
  h += UI.kpi({ label: 'Идей в банке', value: ideas.length, foot: newIdeas.length + ' без оценки' });
  h += UI.kpi({ label: 'Публикаций у блогеров', value: infl.filter(function (i) { return i.published; }).length, foot: 'Цель месяца: 20', pct: Math.round(infl.filter(function (i) { return i.published; }).length / 20 * 100) });
  h += UI.kpi({ label: 'Находок аудита открыто', value: audit.length, foot: 'Разбор — раздел «Аудит системы»', bad: audit.length > 3 });
  h += '</div>';

  /* ── ЗАДАЧИ ПО ГОРИЗОНТАМ ───────────────────────────────────── */
  function taskList(arr, empty) {
    if (!arr.length) return '<p class="note dim">' + empty + '</p>';
    return '<ul class="beans">' + arr.slice(0, 8).map(function (t) {
      return '<li><a href="#/team" data-task="' + E(t.id) + '" class="tlink"><b>' + E(t.title) + '</b></a> '
        + UI.prChip(t.priority) + ' <span class="dim mono" style="font-size:11px">'
        + E(UI.who(t.assignee)) + ' · ' + (t.due ? BOS.fmtDate(t.due) : 'без срока') + '</span></li>';
    }).join('') + '</ul>'
      + (arr.length > 8 ? '<p class="dim mono" style="font-size:11px;margin-top:8px">и ещё ' + (arr.length - 8) + '</p>' : '');
  }

  h += '<h2 class="sec">Задачи по горизонтам</h2><div class="grid g3 rise rise-3">';
  h += '<div class="card"><div class="cap">Сегодня · ' + today.length + '</div>' + taskList(today, 'На сегодня задач с дедлайном нет.') + '</div>';
  h += '<div class="card"><div class="cap">Ближайшие 7 дней · ' + week.length + '</div>' + taskList(week, 'Неделя пустая — стоит запланировать.') + '</div>';
  h += '<div class="card"><div class="cap">Месяц · ' + month.length + '</div>' + taskList(month, 'Месяц не распланирован.') + '</div>';
  h += '</div>';

  /* ── ЗАГРУЗКА КОМАНДЫ ───────────────────────────────────────── */
  h += '<h2 class="sec">Загрузка команды на 7 дней</h2><div class="grid g3">';
  REF.team.forEach(function (p) {
    var hrs = BOS.load7(p.key);
    var cap = p.capacityWeek;
    var pct = Math.round(hrs / cap * 100);
    var mine = BOS.byAssignee(p.key).filter(function (t) { return t.status !== 'done'; });
    h += '<div class="card"><div class="cap">' + E(p.role) + '</div>'
      + '<h4>' + E(UI.who(p.key)) + '</h4>'
      + '<div class="kpi-val mono" style="font-size:22px">' + hrs + ' <span class="dim" style="font-size:13px">/ ' + cap + ' ч</span></div>'
      + '<div class="bar' + (pct > 100 ? ' over' : '') + '"><i style="width:' + BOS.clamp(pct, 0, 100) + '%"></i></div>'
      + '<p style="margin-top:8px">' + mine.length + ' открытых задач'
      + (pct > 100 ? ' · <b style="color:var(--danger)">перегруз</b>' : (pct > 80 ? ' · <b style="color:var(--warn)">почти предел</b>' : ''))
      + '</p></div>';
  });
  h += '</div>';

  /* ── ПРИОРИТЕТЫ И БЫСТРЫЕ ССЫЛКИ ────────────────────────────── */
  h += '<h2 class="sec">Приоритеты</h2><div class="grid g4">';
  BOS.PRIORITY.forEach(function (p) {
    var n = open.filter(function (t) { return (t.priority || 'medium') === p.id; }).length;
    h += '<div class="card"><div class="cap">' + p.label + '</div>'
      + '<div class="kpi-val mono" style="font-size:26px">' + n + '</div>'
      + '<p class="dim">открытых задач</p></div>';
  });
  h += '</div>';

  h += '<h2 class="sec">Быстрые переходы</h2><div class="grid gauto">';
  BOS.NAV.forEach(function (g) {
    g.items.forEach(function (i) {
      if (i.id === 'dashboard') return;
      h += '<a class="card hov" href="#/' + i.id + '"><div class="cap">' + E(g.group) + '</div><h4>'
        + i.ico + '  ' + E(i.label) + '</h4></a>';
    });
  });
  h += '</div>';

  /* ── ПОСЛЕДНИЕ ИЗМЕНЕНИЯ ────────────────────────────────────── */
  var recent = tasks.slice().sort(function (a, b) { return (b.created || '').localeCompare(a.created || ''); }).slice(0, 6);
  h += '<h2 class="sec">Последнее в системе</h2>'
    + UI.table('dash-recent', [
      { key: 'title', label: 'Задача', render: function (r) { return '<b>' + E(r.title) + '</b><span class="sub-line">' + E(r.module || '') + '</span>'; } },
      { key: 'assignee', label: 'Кто', render: function (r) { return E(UI.who(r.assignee)); } },
      { key: 'status', label: 'Статус', render: function (r) { return UI.chip(BOS.statusLabel(r.status)); } },
      { key: 'due', label: 'Дедлайн', render: function (r) { return UI.due(r.due); } }
    ], recent, function (id) { UI.taskModal(id); });

  host.innerHTML = h;
  host.querySelectorAll('.tlink').forEach(function (a) {
    a.onclick = function (e) { e.preventDefault(); UI.taskModal(a.getAttribute('data-task')); };
  });
});
