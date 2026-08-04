/* ═══ КОНТРОЛЬ ИСПОЛНЕНИЯ ══════════════════════════════════════════ */
BOS.route('control', function (host) {
  var E = BOS.esc;
  var open = BOS.openTasks();
  var over = BOS.overdue();
  var blocked = BOS.blocked();
  var content = BOS.all('content');
  var infl = BOS.all('influencers');
  var ideas = BOS.all('ideas');

  var h = UI.head({
    eyebrow: 'Контроль исполнения',
    title: 'Что горит и что бесполезно',
    sub: 'Один экран, с которого начинается день. Просроченное разбирается до того, ' +
      'как начинается новое — иначе оно накапливается и через месяц становится неразбираемым.'
  });

  h += '<div class="grid g4 rise rise-1">';
  h += UI.kpi({ label: 'Просрочено', value: over.length, foot: over.length ? 'Разобрать сегодня' : 'Чисто', bad: over.length > 0 });
  h += UI.kpi({ label: 'Заблокировано', value: blocked.length, foot: 'Ждут чужого решения', bad: blocked.length > 0 });
  h += UI.kpi({ label: 'Без дедлайна', value: open.filter(function (t) { return !t.due && t.status !== 'backlog'; }).length, foot: 'Задача без даты не выполняется' });
  h += UI.kpi({ label: 'В работе одновременно', value: open.filter(function (t) { return t.status === 'doing'; }).length, foot: 'Больше 3 на человека — уже не работа' });
  h += '</div>';

  function taskTable(id, arr, extraCol) {
    var cols = [
      { key: 'title', label: 'Задача', render: function (r) { return '<b>' + E(r.title) + '</b><span class="sub-line">' + E(r.module || '') + '</span>'; } },
      { key: 'assignee', label: 'Кто', w: '130px', render: function (r) { return E(UI.who(r.assignee)); } },
      { key: 'priority', label: 'Приор.', w: '95px', render: function (r) { return UI.prChip(r.priority); } },
      { key: 'due', label: 'Дедлайн', w: '130px', render: function (r) { return UI.due(r.due); } }
    ];
    if (extraCol) cols.push(extraCol);
    return UI.table(id, cols, arr, function (tid) { UI.taskModal(tid); });
  }

  /* ── ПРОСРОЧЕНО ─────────────────────────────────────────────── */
  h += '<h2 class="sec">Просрочено · ' + over.length + '</h2>';
  if (over.length) {
    h += '<p class="note" style="margin-bottom:12px">У каждой просроченной задачи есть только три честных исхода: ' +
      'сделать сегодня, перенести срок осознанно или закрыть. Оставить висеть — не исход.</p>';
    h += taskTable('ctl-over', BOS.sortBy(over, 'due', 'asc'), {
      key: 'lag', label: 'Дней', num: true, w: '75px',
      render: function (r) { return '<b class="overdue">' + Math.abs(BOS.daysLeft(r.due)) + '</b>'; }
    });
  } else {
    h += '<div class="card"><h4>Просрочек нет</h4><p>Хороший знак. Это значит, что сроки ставятся реалистично.</p></div>';
  }

  /* ── ЗАБЛОКИРОВАНО ──────────────────────────────────────────── */
  h += '<h2 class="sec">Заблокировано · ' + blocked.length + '</h2>';
  if (blocked.length) {
    h += '<p class="note" style="margin-bottom:12px">Блокировка — это всегда чьё-то нерешённое решение. ' +
      'Разблокировка обычно занимает две минуты и откладывается на две недели.</p>';
    h += taskTable('ctl-block', blocked, {
      key: 'blockWhy', label: 'Чем заблокировано', render: function (r) { return E(r.blockWhy || 'причина не указана'); }
    });
  } else {
    h += '<div class="card"><p class="dim">Заблокированных задач нет.</p></div>';
  }

  /* ── ТРЕБУЕТ РЕШЕНИЯ ────────────────────────────────────────── */
  var decisions = [];
  BOS.all('audit').filter(function (a) { return a.status === 'open' && a.severity === 'critical'; }).forEach(function (a) {
    decisions.push({ t: a.title, w: 'Аудит системы', l: '#/audit' });
  });
  var noOwner = open.filter(function (t) { return !t.assignee; });
  if (noOwner.length) decisions.push({ t: noOwner.length + ' задач без ответственного', w: 'Команда', l: '#/team' });
  var stale = ideas.filter(function (i) { return i.status === 'new' && BOS.daysBetween(i.created, BOS.today()) > 14; });
  if (stale.length) decisions.push({ t: stale.length + ' идей лежат без оценки больше двух недель', w: 'Центр идей', l: '#/ideas' });

  h += '<h2 class="sec">Требует вашего решения · ' + decisions.length + '</h2>';
  if (decisions.length) {
    h += '<div class="grid gauto">' + decisions.map(function (d) {
      return '<a class="card hov" href="' + d.l + '"><div class="cap">' + E(d.w) + '</div><h4>' + E(d.t) + '</h4></a>';
    }).join('') + '</div>';
  } else {
    h += '<div class="card"><p class="dim">Ничего не ждёт вашего решения.</p></div>';
  }

  /* ── ЧТО ДЕЛЕГИРОВАТЬ ───────────────────────────────────────── */
  var cmoTasks = open.filter(function (t) { return t.assignee === 'cmo'; });
  var delegable = cmoTasks.filter(function (t) {
    return t.priority === 'low' || t.priority === 'medium' || /отчёт|обход|статистик|рассылк|логистик|заказ/i.test(t.title);
  });
  h += '<h2 class="sec">Кандидаты на делегирование · ' + delegable.length + '</h2>';
  h += '<p class="note" style="margin-bottom:12px">Задачи CMO, которые не требуют стратегического решения. ' +
    'Каждая такая задача на вас — это стратегическая задача, которая не делается.</p>';
  h += delegable.length ? taskTable('ctl-deleg', delegable) : '<div class="card"><p class="dim">Всё, что можно было передать, уже передано.</p></div>';

  /* ── ЧТО АВТОМАТИЗИРОВАТЬ ───────────────────────────────────── */
  h += '<h2 class="sec">Кандидаты на автоматизацию</h2><div class="grid g3">';
  REF.automations.filter(function (a) { return a.prio === 'critical'; }).forEach(function (a) {
    h += '<a class="card hov" href="#/automation"><div class="cap">Экономит ' + E(a.saves) + '</div>'
      + '<h4>' + E(a.n) + '</h4><p>' + E(a.how) + '</p></a>';
  });
  h += '</div>';

  /* ── ЧТО ПРИНОСИТ И НЕ ПРИНОСИТ РЕЗУЛЬТАТ ───────────────────── */
  var published = content.filter(function (c) { return c.status === 'published' && c.stats && c.stats.reach; });
  if (published.length >= 3) {
    var sorted = published.slice().sort(function (a, b) { return b.stats.reach - a.stats.reach; });
    var top = sorted.slice(0, 3);
    var bottom = sorted.slice(-3).reverse();
    h += '<h2 class="sec">Что приносит максимум и что не приносит ничего</h2><div class="grid g2">';
    h += '<div class="card" style="border-color:var(--gold-rise)"><div class="cap">Работает — повторяем</div>'
      + top.map(function (c) {
        return '<div style="padding:7px 0;border-bottom:1px solid var(--line)"><b>' + E(c.title) + '</b>'
          + '<span class="sub-line mono">' + BOS.fmtNum(c.stats.reach) + ' охват · ' + E(c.channel) + '</span></div>';
      }).join('') + '</div>';
    h += '<div class="card"><div class="cap">Не сработало — разбираем причину</div>'
      + bottom.map(function (c) {
        return '<div style="padding:7px 0;border-bottom:1px solid var(--line)"><b>' + E(c.title) + '</b>'
          + '<span class="sub-line mono">' + BOS.fmtNum(c.stats.reach) + ' охват · ' + E(c.channel) + '</span></div>';
      }).join('') + '</div>';
    h += '</div>';
  }

  /* ── ЗАСТОЙ ─────────────────────────────────────────────────── */
  var stuck = open.filter(function (t) {
    return t.status === 'doing' && BOS.daysBetween(t.created, BOS.today()) > 14;
  });
  var inflStuck = infl.filter(function (i) { return i.status === 'outreach' || i.status === 'talks'; });

  h += '<h2 class="sec">Застряло</h2><div class="grid g2">';
  h += '<div class="card"><div class="cap">Задачи в работе больше двух недель · ' + stuck.length + '</div>'
    + (stuck.length ? UI.beanList(stuck.map(function (t) { return t.title + ' — ' + UI.who(t.assignee); }))
      : '<p class="dim">Таких нет.</p>')
    + '<p class="note dim" style="margin-top:10px">Задача, которая в работе третью неделю, обычно либо слишком большая, ' +
    'либо на самом деле заблокирована.</p></div>';
  h += '<div class="card"><div class="cap">Блогеры без движения · ' + inflStuck.length + '</div>'
    + (inflStuck.length ? UI.beanList(inflStuck.map(function (i) { return i.name + ' — ' + (i.status === 'outreach' ? 'написали, ответа нет' : 'в переговорах'); }))
      : '<p class="dim">Все двигаются.</p>')
    + '<p class="note dim" style="margin-top:10px">Максимум два напоминания. После — отпускаем и идём дальше.</p></div>';
  h += '</div>';

  /* ── ЕЖЕДНЕВНЫЙ МИНИМУМ ─────────────────────────────────────── */
  h += '<h2 class="sec">Ежедневный минимум</h2>';
  h += '<div class="card">' + REF.checklists[5].items.map(function (i) {
    return '<label style="display:flex;gap:9px;align-items:flex-start;padding:6px 0;font-size:13.5px">'
      + '<input type="checkbox" style="margin-top:3px;width:auto"> ' + E(i) + '</label>';
  }).join('') + '</div>';

  host.innerHTML = h;
});
