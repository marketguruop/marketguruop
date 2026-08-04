/* ═══ АВТОМАТИЗАЦИЯ ════════════════════════════════════════════════ */
BOS.route('automation', function (host) {
  var E = BOS.esc;

  var totalHours = 0;
  REF.automations.forEach(function (a) {
    var m = /([\d,.]+)\s*(?:–|-)?\s*([\d,.]+)?\s*(ч|мин)/.exec(a.saves);
    if (!m) return;
    var v = parseFloat(String(m[2] || m[1]).replace(',', '.'));
    var perWeek = /день/.test(a.saves) ? v * 5 : v;
    if (m[3] === 'мин') perWeek = perWeek / 60;
    totalHours += perWeek;
  });

  var h = UI.head({
    eyebrow: 'Автоматизация',
    title: 'Что убрать из ручной работы',
    sub: 'Автоматизируем то, что делается регулярно, по правилам и не требует вкуса. ' +
      'Всё, что требует вкуса — приёмка макета, выбор блогера, тон ответа — остаётся людям. ' +
      'Автоматизация ради галочки создаёт больше работы, чем убирает.'
  });

  h += '<div class="grid g4 rise rise-1">';
  h += UI.kpi({ label: 'Процессов к автоматизации', value: REF.automations.length, foot: 'Отсортированы по приоритету' });
  h += UI.kpi({ label: 'Экономия в неделю', value: '≈' + Math.round(totalHours) + ' ч', foot: 'При полном внедрении', hot: true });
  h += UI.kpi({ label: 'Критичных', value: REF.automations.filter(function (a) { return a.prio === 'critical'; }).length, foot: 'Делаем в первые две недели' });
  h += UI.kpi({ label: 'Не автоматизируем', value: REF.noAutomation.length, foot: 'Осознанно оставляем людям' });
  h += '</div>';

  h += '<h2 class="sec">Порядок внедрения</h2><div class="grid gauto">';
  REF.autoRoadmap.forEach(function (r) {
    h += '<div class="card"><div class="cap">' + E(r.w) + '</div><h4 style="font-size:13px">' + E(r.what) + '</h4>'
      + '<p style="margin-top:8px">' + E(r.why) + '</p></div>';
  });
  h += '</div>';

  h += '<h2 class="sec">Процессы</h2>';
  ['critical', 'high', 'medium'].forEach(function (p) {
    var list = REF.automations.filter(function (a) { return a.prio === p; });
    if (!list.length) return;
    h += '<h3 class="sub3">' + BOS.priority(p).label + ' · ' + list.length + '</h3><div class="grid g2">';
    list.forEach(function (a) {
      h += '<div class="card"><div class="cap">Экономит ' + E(a.saves) + ' · сложность: ' + E(a.effort) + '</div>'
        + '<h4>' + E(a.n) + '</h4>'
        + '<p style="margin-top:8px"><b>Как сейчас:</b> ' + E(a.now) + '</p>'
        + '<p style="margin-top:6px"><b>Как надо:</b> ' + E(a.how) + '</p>'
        + '<button class="btn sm" style="margin-top:10px" data-auto="' + E(a.n) + '">Поставить задачу</button></div>';
    });
    h += '</div>';
  });

  h += '<h2 class="sec">Стек</h2>';
  h += UI.table('auto-stack', [
    { key: 'n', label: 'Инструмент', w: '190px', render: function (r) { return '<b>' + E(r.n) + '</b>'; } },
    { key: 'use', label: 'Для чего' },
    { key: 'cost', label: 'Стоимость', w: '160px' }
  ], REF.autoStack);

  h += '<h2 class="sec">Что не автоматизируем и почему</h2><div class="grid g3">';
  REF.noAutomation.forEach(function (n) {
    h += '<div class="card"><h4>' + E(n.n) + '</h4><p>' + E(n.why) + '</p></div>';
  });
  h += '</div>';

  h += '<h2 class="sec">Резервная копия</h2>';
  h += '<div class="card"><p class="note">Состояние системы живёт в браузере. Если почистить данные сайта или сменить компьютер — ' +
    'всё пропадёт. Экспорт занимает десять секунд и спасает месяцы работы. Делайте это каждую пятницу вместе со сводкой.</p>'
    + '<div style="display:flex;gap:9px;margin-top:12px;flex-wrap:wrap">'
    + '<button class="btn-gold" id="auto-export">Скачать копию сейчас</button>'
    + '<button class="btn" id="auto-import">Загрузить из файла</button></div></div>';

  host.innerHTML = h;

  host.querySelectorAll('[data-auto]').forEach(function (b) {
    b.onclick = function () {
      var name = b.getAttribute('data-auto');
      var a = null;
      REF.automations.forEach(function (x) { if (x.n === name) a = x; });
      BOS.upsert('tasks', {
        title: 'Автоматизация: ' + name,
        module: 'Автоматизация', assignee: 'smm1',
        goal: 'Убрать ручную работу: ' + (a ? a.saves : ''),
        desc: a ? ('Как сейчас: ' + a.now + '\n\nКак надо: ' + a.how) : '',
        priority: a && a.prio === 'critical' ? 'critical' : 'high',
        status: 'todo', hours: 4, due: ''
      });
      UI.toast('Задача создана');
      BOS.render();
    };
  });
  document.getElementById('auto-export').onclick = function () { BOS.exportJSON(); UI.toast('Файл скачан'); };
  document.getElementById('auto-import').onclick = function () { document.getElementById('file-input').click(); };
});
