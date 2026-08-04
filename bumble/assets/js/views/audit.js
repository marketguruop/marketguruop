/* ═══ АУДИТ СИСТЕМЫ · роль Claude ══════════════════════════════════ */
BOS.route('audit', function (host) {
  var E = BOS.esc;
  var all = BOS.all('audit');
  var f = UI.fval('au-f', 'st', 'open');
  var rows = all.filter(function (a) { return !f || a.status === f; });

  var sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  rows.sort(function (a, b) { return (sevOrder[a.severity] || 9) - (sevOrder[b.severity] || 9); });

  var h = UI.head({
    eyebrow: 'Аудит системы',
    title: 'Что я нашёл, сверив документы',
    sub: 'Это не критика работы. Это места, где пять документов расходятся между собой ' +
      'или где система в текущем составе команды не выдержит нагрузки. ' +
      'У каждой находки есть план внедрения, а не просто «обратите внимание».'
  });

  h += '<div class="grid g4 rise rise-1">';
  h += UI.kpi({ label: 'Открыто', value: all.filter(function (a) { return a.status === 'open'; }).length, foot: 'Требует решения', bad: true });
  h += UI.kpi({ label: 'Критичных', value: all.filter(function (a) { return a.severity === 'critical' && a.status === 'open'; }).length, foot: 'Разбираем первыми' });
  h += UI.kpi({ label: 'В работе', value: all.filter(function (a) { return a.status === 'doing'; }).length, foot: '' });
  h += UI.kpi({ label: 'Закрыто', value: all.filter(function (a) { return a.status === 'done' || a.status === 'dismissed'; }).length, foot: 'Решено или отклонено' });
  h += '</div>';

  h += UI.filters('au-f', [{
    type: 'seg', key: 'st', def: 'open', options: [
      { v: 'open', l: 'Открытые' }, { v: 'doing', l: 'В работе' },
      { v: 'done', l: 'Решённые' }, { v: 'dismissed', l: 'Отклонённые' }, { v: '', l: 'Все' }
    ]
  }]);

  if (!rows.length) {
    h += UI.empty('В этой категории пусто.');
  }

  rows.forEach(function (a) {
    var sevCls = a.severity === 'critical' ? 'crit' : (a.severity === 'high' ? 'high' : 'med');
    h += '<div class="card" style="margin-bottom:14px' + (a.severity === 'critical' && a.status === 'open' ? ';border-color:var(--danger)' : '') + '">'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">'
      + UI.chip(a.kind) + UI.chip(a.severity === 'critical' ? 'критично' : (a.severity === 'high' ? 'высокая' : 'средняя'), sevCls)
      + UI.chip(UI.who(a.owner)) + (a.due ? UI.chip('до ' + BOS.fmtDate(a.due)) : '')
      + '</div>'
      + '<h4 style="font-size:15px">' + E(a.title) + '</h4>'
      + '<div class="cap" style="margin-top:12px">Что нашёл</div><p>' + E(a.found) + '</p>'
      + '<div class="cap" style="margin-top:12px">Почему это важно</div><p>' + E(a.why) + '</p>'
      + '<div class="cap" style="margin-top:12px">План внедрения</div>'
      + '<div class="steps" style="margin-top:8px">' + a.plan.map(function (p, i) {
        return '<div class="step" style="padding-bottom:10px"><div class="step-n" style="width:26px;height:26px;font-size:11px">' + (i + 1) + '</div>'
          + '<div class="step-b"><p style="font-size:13px;color:var(--txt)">' + E(p) + '</p></div></div>';
      }).join('') + '</div>'
      + '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">'
      + (a.status === 'open' ? '<button class="btn sm" data-au-task="' + E(a.id) + '">Создать задачи по плану</button>' : '')
      + '<select class="btn sm" data-au-st="' + E(a.id) + '" style="padding:5px 10px">'
      + [['open', 'Открыто'], ['doing', 'В работе'], ['done', 'Решено'], ['dismissed', 'Отклонено']].map(function (s) {
        return '<option value="' + s[0] + '"' + (a.status === s[0] ? ' selected' : '') + '>' + s[1] + '</option>';
      }).join('') + '</select>'
      + '</div></div>';
  });

  /* ── КАК Я РАБОТАЮ ──────────────────────────────────────────── */
  h += '<h2 class="sec">Что я проверяю постоянно</h2><div class="grid g3">';
  [
    { n: 'Расхождения между документами', d: 'Пять источников — пять возможностей противоречить друг другу. Побеждает более поздний и более конкретный.' },
    { n: 'Нагрузка против ёмкости', d: 'План, написанный под пять ролей, при трёх людях не выполнится. Это видно заранее, а не в конце месяца.' },
    { n: 'Метрики без базы', d: 'Цель в процентах от неизвестного числа — не цель. Ищу такие места и подсвечиваю.' },
    { n: 'Процессы без владельца', d: 'Если у задачи нет одного имени, её не сделает никто.' },
    { n: 'Дублирование', d: 'Одна и та же работа в двух местах — самый дорогой вид потерь, потому что его не видно.' },
    { n: 'Что можно убрать', d: 'Не только что добавить. Сокращение семи каналов до трёх часто даёт больше, чем новая активность.' },
    { n: 'Разрыв цепочки', d: 'Отбор → outreach → бокс → контент → UGC → амбассадорство. Обрыв в любом звене останавливает маховик.' },
    { n: 'Идеи, которые залежались', d: 'Идея без оценки две недели — это решение не принимать решение.' },
    { n: 'Что не приносит результата', d: 'Активность без цифры — это не работа. Ищу такое и предлагаю прекратить.' }
  ].forEach(function (c) {
    h += '<div class="card"><h4>' + E(c.n) + '</h4><p>' + E(c.d) + '</p></div>';
  });
  h += '</div>';

  h += '<h2 class="sec">Как добавить свою находку</h2>';
  h += '<div class="card"><p class="note">Если вы сами заметили слабое место — заведите его здесь. ' +
    'Разница между «раздражает» и «исправлено» обычно только в том, записал кто-нибудь это или нет.</p>'
    + '<button class="btn-gold" id="au-add" style="margin-top:12px">+ Находка</button></div>';

  host.innerHTML = h;

  host.querySelectorAll('[data-au-st]').forEach(function (s) {
    s.onchange = function () {
      BOS.patch('audit', s.getAttribute('data-au-st'), { status: s.value });
      UI.toast('Статус обновлён');
      BOS.render();
    };
  });

  host.querySelectorAll('[data-au-task]').forEach(function (b) {
    b.onclick = function () {
      var a = BOS.find('audit', b.getAttribute('data-au-task'));
      if (!a) return;
      a.plan.forEach(function (p, i) {
        BOS.upsert('tasks', {
          title: p, module: 'Аудит системы',
          goal: a.title,
          desc: 'Из находки аудита: ' + a.found,
          assignee: a.owner, priority: a.severity === 'critical' ? 'critical' : 'high',
          status: i === 0 ? 'todo' : 'backlog', due: a.due || '', hours: 2
        });
      });
      BOS.patch('audit', a.id, { status: 'doing' });
      UI.toast(a.plan.length + ' задач создано');
      BOS.render();
    };
  });

  document.getElementById('au-add').onclick = function () {
    var body = '<div class="field"><label>Что не так</label><input id="au-t"></div>'
      + '<div class="field"><label>Что именно нашли</label><textarea id="au-f"></textarea></div>'
      + '<div class="field"><label>Почему это важно</label><textarea id="au-w"></textarea></div>'
      + '<div class="field"><label>План — по одному шагу на строку</label><textarea id="au-p" style="min-height:110px"></textarea></div>'
      + '<div class="frow">'
      + '<div class="field"><label>Серьёзность</label><select id="au-s">'
      + '<option value="critical">Критично</option><option value="high" selected>Высокая</option><option value="medium">Средняя</option></select></div>'
      + '<div class="field"><label>Ответственный</label><select id="au-o">' + UI.peopleOptions('cmo') + '</select></div>'
      + '</div>'
      + '<div class="field"><label>Срок</label><input type="date" id="au-d"></div>';
    UI.modal('Новая находка', body,
      '<button class="btn" data-close>Отмена</button><button class="btn-gold" id="au-save">Сохранить</button>',
      function () {
        document.getElementById('au-save').onclick = function () {
          var v = function (x) { return document.getElementById(x).value; };
          BOS.upsert('audit', {
            title: v('au-t') || 'Без названия', kind: 'Находка команды',
            found: v('au-f'), why: v('au-w'),
            plan: v('au-p').split('\n').filter(function (s) { return s.trim(); }),
            severity: v('au-s'), owner: v('au-o'), due: v('au-d'), status: 'open'
          });
          UI.closeModal(); BOS.render();
        };
      });
  };
});
