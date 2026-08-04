/* ═══ КОНТЕНТ-ЦЕНТР ════════════════════════════════════════════════ */
(function () {
  var E = BOS.esc;

  function contentModal(id) {
    var c = id ? BOS.find('content', id) : null;
    var isNew = !c;
    c = c || { status: 'idea', priority: 'medium', complexity: 2, owner: 'smm1', publishAt: BOS.today(), stats: {} };
    var st = c.stats || {};

    var body =
      '<div class="field"><label>Тема</label><input id="c-title" value="' + E(c.title || '') + '"></div>'
      + '<div class="frow">'
      + '<div class="field"><label>Формат</label><input id="c-format" value="' + E(c.format || '') + '" placeholder="Reels / Пост / Карусель / Тред / Stories"></div>'
      + '<div class="field"><label>Площадка</label><input id="c-channel" value="' + E(c.channel || '') + '"></div>'
      + '</div>'
      + '<div class="frow">'
      + '<div class="field"><label>Рубрика</label><select id="c-rubric"><option value="">—</option>'
      + REF.rubrics.map(function (r) { return '<option value="' + r.id + '"' + (c.rubric === r.id ? ' selected' : '') + '>' + E(r.n) + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="field"><label>Серия</label><input id="c-series" value="' + E(c.series || '') + '"></div>'
      + '</div>'
      + '<div class="field"><label>Крючок — первая строка или первый кадр</label><input id="c-hook" value="' + E(c.hook || '') + '"></div>'
      + '<div class="field"><label>CTA</label><input id="c-cta" value="' + E(c.cta || '') + '"></div>'
      + '<div class="frow">'
      + '<div class="field"><label>Цель</label><input id="c-goal" value="' + E(c.goal || '') + '"></div>'
      + '<div class="field"><label>Ожидаемый результат</label><input id="c-expected" value="' + E(c.expected || '') + '"></div>'
      + '</div>'
      + '<div class="frow">'
      + '<div class="field"><label>Статус</label><select id="c-status">'
      + BOS.CONTENT_STATUS.map(function (s) { return '<option value="' + s.id + '"' + (c.status === s.id ? ' selected' : '') + '>' + s.label + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="field"><label>Приоритет</label><select id="c-priority">'
      + BOS.PRIORITY.map(function (p) { return '<option value="' + p.id + '"' + (c.priority === p.id ? ' selected' : '') + '>' + p.label + '</option>'; }).join('')
      + '</select></div>'
      + '</div>'
      + '<div class="frow">'
      + '<div class="field"><label>Исполнитель</label><select id="c-owner">' + UI.peopleOptions(c.owner) + '</select></div>'
      + '<div class="field"><label>Сложность 1–3</label><select id="c-complexity">'
      + [1, 2, 3].map(function (n) { return '<option value="' + n + '"' + (Number(c.complexity) === n ? ' selected' : '') + '>' + n + '</option>'; }).join('')
      + '</select></div>'
      + '</div>'
      + '<div class="field"><label>Дата публикации</label><input type="date" id="c-date" value="' + E(c.publishAt || '') + '"></div>'
      + '<h3 class="sub3">Аналитика после выхода</h3>'
      + '<div class="frow">'
      + '<div class="field"><label>Охват</label><input type="number" id="c-reach" value="' + E(st.reach || '') + '"></div>'
      + '<div class="field"><label>ER, %</label><input type="number" step="0.1" id="c-er" value="' + E(st.er || '') + '"></div>'
      + '</div>'
      + '<div class="frow">'
      + '<div class="field"><label>Сохранения</label><input type="number" id="c-saves" value="' + E(st.saves || '') + '"></div>'
      + '<div class="field"><label>Репосты</label><input type="number" id="c-shares" value="' + E(st.shares || '') + '"></div>'
      + '</div>'
      + '<div class="field"><label>Вывод — почему сработало или нет</label><textarea id="c-note">' + E(c.note || '') + '</textarea></div>';

    var foot = (isNew ? '' : '<button class="btn danger sm" id="c-del">Удалить</button>')
      + '<button class="btn" data-close>Отмена</button><button class="btn-gold" id="c-save">Сохранить</button>';

    UI.modal(isNew ? 'Новая единица контента' : 'Контент', body, foot, function () {
      document.getElementById('c-save').onclick = function () {
        var v = function (i) { var el = document.getElementById(i); return el ? el.value : ''; };
        var obj = Object.assign({}, c, {
          title: v('c-title') || 'Без названия', format: v('c-format'), channel: v('c-channel'),
          rubric: v('c-rubric'), series: v('c-series'), hook: v('c-hook'), cta: v('c-cta'),
          goal: v('c-goal'), expected: v('c-expected'), status: v('c-status'),
          priority: v('c-priority'), owner: v('c-owner'), complexity: Number(v('c-complexity')),
          publishAt: v('c-date'), note: v('c-note'),
          stats: {
            reach: Number(v('c-reach')) || 0, er: Number(v('c-er')) || 0,
            saves: Number(v('c-saves')) || 0, shares: Number(v('c-shares')) || 0
          }
        });
        BOS.upsert('content', obj);
        UI.closeModal(); UI.toast('Сохранено'); BOS.render();
      };
      var del = document.getElementById('c-del');
      if (del) del.onclick = function () {
        if (confirm('Удалить карточку контента?')) { BOS.remove('content', c.id); UI.closeModal(); BOS.render(); }
      };
    });
  }

  /* ── КАНБАН КОНТЕНТА ────────────────────────────────────────── */
  function contentKanban(items) {
    var cols = BOS.CONTENT_STATUS;
    var h = '<div class="kanban" id="ckanban" style="grid-template-columns:repeat(7,minmax(190px,1fr))">';
    cols.forEach(function (c) {
      var list = items.filter(function (i) { return (i.status || 'idea') === c.id; });
      h += '<div class="kcol" data-status="' + c.id + '">'
        + '<div class="kcol-h">' + E(c.label) + '<span class="n">' + list.length + '</span></div><div class="kcol-b">'
        + list.map(function (i) {
          return '<div class="kcard p-' + (i.priority || 'medium') + '" draggable="true" data-id="' + E(i.id) + '">'
            + '<div class="kt">' + E(i.title) + '</div><div class="km">'
            + (i.channel ? '<span>' + E(i.channel) + '</span>' : '')
            + (i.publishAt ? '<span>' + BOS.fmtDate(i.publishAt) + '</span>' : '')
            + '<span class="dim">' + E(UI.who(i.owner)) + '</span>'
            + '</div></div>';
        }).join('') + '</div></div>';
    });
    h += '</div>';
    setTimeout(function () {
      var root = document.getElementById('ckanban');
      if (!root) return;
      var drag = null;
      root.querySelectorAll('.kcard').forEach(function (el) {
        el.addEventListener('dragstart', function () { drag = el.getAttribute('data-id'); el.classList.add('dragging'); });
        el.addEventListener('dragend', function () { el.classList.remove('dragging'); });
        el.addEventListener('click', function () { contentModal(el.getAttribute('data-id')); });
      });
      root.querySelectorAll('.kcol').forEach(function (col) {
        col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('drop'); });
        col.addEventListener('dragleave', function () { col.classList.remove('drop'); });
        col.addEventListener('drop', function (e) {
          e.preventDefault(); col.classList.remove('drop');
          if (drag) { BOS.patch('content', drag, { status: col.getAttribute('data-status') }); BOS.render(); }
        });
      });
    }, 0);
    return h;
  }

  /* ── КАЛЕНДАРЬ НА 4 НЕДЕЛИ ──────────────────────────────────── */
  function calendar(items) {
    var start = new Date();
    start.setDate(start.getDate() - start.getDay() + 1); // понедельник
    var h = '<div class="tablewrap"><table style="min-width:900px"><thead><tr>'
      + ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(function (d) { return '<th class="nosort">' + d + '</th>'; }).join('')
      + '</tr></thead><tbody>';
    for (var w = 0; w < 4; w++) {
      h += '<tr>';
      for (var d = 0; d < 7; d++) {
        var day = new Date(start);
        day.setDate(start.getDate() + w * 7 + d);
        var p = function (x) { return x < 10 ? '0' + x : '' + x; };
        var key = day.getFullYear() + '-' + p(day.getMonth() + 1) + '-' + p(day.getDate());
        var todays = items.filter(function (i) { return i.publishAt === key; });
        var isToday = key === BOS.today();
        h += '<td style="vertical-align:top;min-width:120px;' + (isToday ? 'background:color-mix(in srgb,var(--gold-rise) 10%,transparent)' : '') + '">'
          + '<div class="mono dim" style="font-size:10.5px;margin-bottom:6px">' + day.getDate() + ' ' + BOS.fmtDate(key).split(' ')[1] + '</div>'
          + todays.map(function (i) {
            return '<div class="kcard p-' + (i.priority || 'medium') + '" data-cid="' + E(i.id) + '" style="margin-bottom:5px;cursor:pointer">'
              + '<div class="kt" style="font-size:11.5px">' + E(i.title) + '</div>'
              + '<div class="km"><span>' + E(i.channel || '') + '</span></div></div>';
          }).join('')
          + '</td>';
      }
      h += '</tr>';
    }
    h += '</tbody></table></div>';
    setTimeout(function () {
      document.querySelectorAll('[data-cid]').forEach(function (el) {
        el.onclick = function () { contentModal(el.getAttribute('data-cid')); };
      });
    }, 0);
    return h;
  }

  BOS.route('content', function (host) {
    var items = BOS.all('content');
    var view = UI.fval('content-view', 'v', 'plan');

    var h = UI.head({
      eyebrow: 'Контент-центр',
      title: 'Управление контентом',
      sub: 'План, календарь, воронка, рубрикатор, серии и банки заготовок. ' +
        'Планируем девятками, а не постами: девять публикаций = один законченный экран профиля.'
    });

    h += UI.filters('content-view', [{
      type: 'seg', key: 'v', def: 'plan', options: [
        { v: 'plan', l: 'Производство' }, { v: 'cal', l: 'Календарь' },
        { v: 'table', l: 'Таблица' }, { v: 'system', l: 'Система' }, { v: 'banks', l: 'Банки' }
      ]
    }]);

    if (view === 'plan') {
      h += '<div class="filters"><button class="btn-gold" id="c-add">+ Контент</button>'
        + '<span class="dim mono" style="font-size:11px;margin-left:10px">Карточки перетаскиваются между статусами</span></div>';
      h += contentKanban(items);

    } else if (view === 'cal') {
      h += '<h2 class="sec">Четыре недели вперёд</h2>' + calendar(items);
      h += '<h2 class="sec">Недельная сетка слотов</h2><div class="grid gauto">';
      REF.weekGrid.forEach(function (d) {
        h += '<div class="card"><div class="cap">' + E(d.day) + '</div>' + UI.beanList(d.slots) + '</div>';
      });
      h += '</div>';

    } else if (view === 'table') {
      h += '<div class="filters"><button class="btn-gold" id="c-add">+ Контент</button></div>';
      h += UI.table('content-tbl', [
        { key: 'title', label: 'Тема', render: function (r) { return '<b>' + E(r.title) + '</b><span class="sub-line">' + E(r.hook || '') + '</span>'; } },
        { key: 'channel', label: 'Площадка', w: '110px' },
        { key: 'format', label: 'Формат', w: '90px' },
        { key: 'status', label: 'Статус', w: '110px', render: function (r) { return UI.chip(BOS.statusLabel(r.status)); } },
        { key: 'priority', label: 'Приор.', w: '90px', render: function (r) { return UI.prChip(r.priority); } },
        { key: 'owner', label: 'Кто', w: '110px', render: function (r) { return E(UI.who(r.owner)); } },
        { key: 'publishAt', label: 'Выход', w: '110px', render: function (r) { return UI.due(r.publishAt); } },
        { key: 'reach', label: 'Охват', num: true, w: '90px', render: function (r) { return BOS.fmtNum(r.stats && r.stats.reach); } },
        { key: 'er', label: 'ER', num: true, w: '70px', render: function (r) { return r.stats && r.stats.er ? r.stats.er + '%' : '—'; } }
      ], items.map(function (i) {
        return Object.assign({}, i, { reach: (i.stats && i.stats.reach) || 0, er: (i.stats && i.stats.er) || 0 });
      }), function (id) { contentModal(id); });

    } else if (view === 'system') {
      h += '<h2 class="sec">Контентная воронка</h2>';
      h += UI.table('content-funnel', [
        { key: 'stage', label: 'Этап', w: '150px', render: function (r) { return '<b>' + E(r.stage) + '</b><span class="sub-line">' + E(r.share) + ' контента</span>'; } },
        { key: 'goal', label: 'Задача' },
        { key: 'formats', label: 'Форматы', render: function (r) { return r.formats.map(function (f) { return UI.chip(f); }).join(' '); } },
        { key: 'message', label: 'Сообщение' },
        { key: 'metric', label: 'Метрика' }
      ], REF.funnel);

      h += '<h2 class="sec">Рубрикатор</h2><div class="grid gauto">';
      REF.rubrics.forEach(function (r) {
        h += '<div class="card"><div class="cap">' + E(r.share) + ' · ' + E(r.ch) + '</div>'
          + '<h4>' + E(r.n) + '</h4><p>' + E(r.d) + '</p></div>';
      });
      h += '</div>';

      h += '<h2 class="sec">Контентные серии</h2>';
      h += UI.table('content-series', [
        { key: 'n', label: 'Серия', w: '210px', render: function (r) { return '<b>' + E(r.n) + '</b>'; } },
        { key: 'd', label: 'Что это' },
        { key: 'len', label: 'Длина', w: '130px' },
        { key: 'ch', label: 'Площадки', w: '170px' }
      ], REF.series);

      h += '<h2 class="sec">Правила публикации</h2><div class="card">' + UI.beanList(REF.publishRules) + '</div>';

    } else {
      /* БАНКИ */
      var bg = UI.fval('bank-g', 'g', '');
      h += UI.filters('bank-g', [{
        type: 'seg', key: 'g', def: '', options: [{ v: '', l: 'Все' }].concat(
          REF.bankGroups.map(function (g) { return { v: g, l: g }; }))
      }]);
      h += '<div class="grid gauto-l">';
      REF.banks.filter(function (b) { return !bg || b.group === bg; }).forEach(function (b) {
        h += '<div class="card"><div class="cap">' + E(b.group) + ' · ' + b.items.length + ' шт</div>'
          + '<h4>' + E(b.name) + '</h4><p style="margin-bottom:10px">' + E(b.desc) + '</p>'
          + UI.acc('Открыть банк', UI.beanList(b.items)) + '</div>';
      });
      h += '</div>';
    }

    host.innerHTML = h;
    var add = document.getElementById('c-add');
    if (add) add.onclick = function () { contentModal(null); };
  });

  window.contentModal = contentModal;
})();
