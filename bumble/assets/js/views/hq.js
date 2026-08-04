/* ═══ MARKETING HQ · реестр направлений ════════════════════════════ */
BOS.route('hq', function (host, arg) {
  var E = BOS.esc;

  /* Открыт конкретный канал */
  if (arg) {
    var ch = null;
    REF.channels.forEach(function (c) { if (c.id === arg) ch = c; });
    if (!ch) { BOS.go('hq'); return; }
    return renderChannel(host, ch);
  }

  var h = UI.head({
    eyebrow: 'Marketing HQ',
    title: 'Центр управления маркетингом',
    sub: 'Двадцать направлений, у каждого один владелец, ритм, формат-стандарт и чек-лист. ' +
      'Задачи любого направления фильтруются по полю «Направление» — ничего не теряется между каналами.'
  });

  var tasks = BOS.all('tasks');

  REF.channelGroups.forEach(function (g) {
    h += '<h2 class="sec">' + E(g) + '</h2><div class="grid gauto-l">';
    REF.channels.filter(function (c) { return c.group === g; }).forEach(function (c) {
      var mine = tasks.filter(function (t) { return t.module === c.name && t.status !== 'done'; });
      var over = mine.filter(function (t) { return t.due && BOS.daysLeft(t.due) < 0; });
      h += '<a class="card hov" href="#/hq/' + c.id + '">'
        + '<div class="cap">' + E(UI.who(c.owner)) + ' · ' + E(c.cadence) + '</div>'
        + '<h4>' + E(c.name) + '</h4>'
        + '<p>' + E(c.role) + '</p>'
        + '<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">'
        + UI.chip(mine.length + ' в работе')
        + (over.length ? UI.chip(over.length + ' просроч.', 'crit') : '')
        + '</div></a>';
    });
    h += '</div>';
  });

  host.innerHTML = h;
});

function renderChannel(host, c) {
  var E = BOS.esc;
  var tasks = BOS.all('tasks').filter(function (t) { return t.module === c.name; });
  var open = tasks.filter(function (t) { return t.status !== 'done'; });

  var h = '<p class="mono dim" style="font-size:11px;margin-bottom:10px"><a href="#/hq">← Marketing HQ</a></p>';
  h += UI.head({
    eyebrow: c.group + ' · владелец: ' + UI.who(c.owner),
    title: c.name,
    sub: E(c.role) + '<br><span class="mono dim" style="font-size:12px">Ритм: ' + E(c.cadence) + '</span>'
  });

  h += '<div class="grid g3 rise rise-1">';
  h += UI.kpi({ label: 'Открытых задач', value: open.length, foot: 'Всего: ' + tasks.length });
  h += UI.kpi({ label: 'Просрочено', value: open.filter(function (t) { return t.due && BOS.daysLeft(t.due) < 0; }).length, foot: 'Разбираем в «Контроле»', bad: true });
  h += UI.kpi({ label: 'Владелец', value: UI.who(c.owner), foot: 'Один ответственный' });
  h += '</div>';

  h += '<h2 class="sec">KPI направления</h2><div class="grid gauto">';
  c.kpi.forEach(function (k) { h += '<div class="card"><h4>' + E(k) + '</h4></div>'; });
  h += '</div>';

  h += '<h2 class="sec">Формат-стандарт</h2><div class="card">' + UI.beanList(c.standard) + '</div>';

  h += '<h2 class="sec">Чек-лист перед выпуском</h2><div class="card">'
    + c.checklist.map(function (q, i) {
      return '<label style="display:flex;gap:9px;align-items:flex-start;padding:6px 0;font-size:13.5px">'
        + '<input type="checkbox" style="margin-top:4px" data-ck="' + c.id + '-' + i + '"> ' + E(q) + '</label>';
    }).join('')
    + '<p class="dim mono" style="font-size:11px;margin-top:10px">Галочки не сохраняются намеренно — чек-лист проходится заново каждый раз.</p></div>';

  h += '<h2 class="sec">Задачи направления</h2>';
  h += '<div class="filters"><button class="btn-gold" id="hq-add">+ Задача в «' + E(c.name) + '»</button></div>';
  h += UI.kanban(tasks, {});

  host.innerHTML = h;
  var b = document.getElementById('hq-add');
  if (b) b.onclick = function () {
    UI.taskModal(null);
    setTimeout(function () {
      var m = document.getElementById('f-module');
      if (m) m.value = c.name;
      var a = document.getElementById('f-assignee');
      if (a) a.value = c.owner;
    }, 30);
  };
}
