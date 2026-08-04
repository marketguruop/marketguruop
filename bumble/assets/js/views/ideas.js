/* ═══ ЦЕНТР ИДЕЙ · Brain Dump ══════════════════════════════════════ */
(function () {
  var E = BOS.esc;

  function catName(id) {
    var n = id;
    REF.ideaCats.forEach(function (c) { if (c.id === id) n = c.n; });
    return n;
  }

  function ideaModal(id) {
    var i = id ? BOS.find('ideas', id) : null;
    var isNew = !i;
    i = i || { cat: 'raw', status: 'new', impact: 5, confidence: 5, ease: 5, reach: 5000, effort: 3, owner: BOS.settings.me || 'cmo' };

    var body =
      '<div class="field"><label>Идея одной строкой</label><input id="i-title" value="' + E(i.title || '') + '"></div>'
      + '<div class="frow">'
      + '<div class="field"><label>Раздел</label><select id="i-cat">'
      + REF.ideaCats.map(function (c) { return '<option value="' + c.id + '"' + (i.cat === c.id ? ' selected' : '') + '>' + E(c.n) + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="field"><label>Статус</label><select id="i-status">'
      + REF.ideaStatuses.map(function (s) { return '<option value="' + s.id + '"' + (i.status === s.id ? ' selected' : '') + '>' + E(s.n) + '</option>'; }).join('')
      + '</select></div>'
      + '</div>'
      + '<div class="field"><label>Ожидаемый эффект — что изменится</label><textarea id="i-effect">' + E(i.effect || '') + '</textarea></div>'
      + '<h3 class="sub3">Оценка</h3>'
      + '<div class="frow">'
      + '<div class="field"><label>Влияние 1–10</label><input type="number" min="1" max="10" id="i-impact" value="' + E(i.impact) + '"></div>'
      + '<div class="field"><label>Уверенность 1–10</label><input type="number" min="1" max="10" id="i-conf" value="' + E(i.confidence) + '"></div>'
      + '</div>'
      + '<div class="frow">'
      + '<div class="field"><label>Простота 1–10</label><input type="number" min="1" max="10" id="i-ease" value="' + E(i.ease) + '"></div>'
      + '<div class="field"><label>Трудозатраты (недели)</label><input type="number" min="0.5" step="0.5" id="i-effort" value="' + E(i.effort) + '"></div>'
      + '</div>'
      + '<div class="frow">'
      + '<div class="field"><label>Охват / сколько людей затронет</label><input type="number" id="i-reach" value="' + E(i.reach) + '"></div>'
      + '<div class="field"><label>Примерная стоимость</label><input id="i-cost" value="' + E(i.cost || '') + '"></div>'
      + '</div>'
      + '<div class="field"><label>Ответственный</label><select id="i-owner">' + UI.peopleOptions(i.owner) + '</select></div>';

    var foot = (isNew ? '' : '<button class="btn danger sm" id="i-del">Удалить</button>')
      + '<button class="btn" data-close>Отмена</button>'
      + (isNew ? '' : '<button class="btn" id="i-totask">В задачи</button>')
      + '<button class="btn-gold" id="i-save">Сохранить</button>';

    UI.modal(isNew ? 'Новая идея' : 'Идея', body, foot, function () {
      document.getElementById('i-save').onclick = function () {
        var v = function (x) { var el = document.getElementById(x); return el ? el.value : ''; };
        BOS.upsert('ideas', Object.assign({}, i, {
          title: v('i-title') || 'Без названия', cat: v('i-cat'), status: v('i-status'),
          effect: v('i-effect'), impact: Number(v('i-impact')), confidence: Number(v('i-conf')),
          ease: Number(v('i-ease')), effort: Number(v('i-effort')), reach: Number(v('i-reach')),
          cost: v('i-cost'), owner: v('i-owner')
        }));
        UI.closeModal(); UI.toast('Сохранено'); BOS.render();
      };
      var del = document.getElementById('i-del');
      if (del) del.onclick = function () {
        if (confirm('Удалить идею? Обычно лучше поставить статус «Отклонена» — история пригодится.')) {
          BOS.remove('ideas', i.id); UI.closeModal(); BOS.render();
        }
      };
      var tt = document.getElementById('i-totask');
      if (tt) tt.onclick = function () {
        BOS.upsert('tasks', {
          title: i.title, module: catName(i.cat), goal: i.effect,
          desc: 'Из Центра идей. Ожидаемая стоимость: ' + (i.cost || 'не оценена'),
          priority: BOS.ice(i) >= 70 ? 'high' : 'medium', status: 'todo',
          assignee: i.owner, due: '', hours: 4
        });
        BOS.patch('ideas', i.id, { status: 'doing' });
        UI.closeModal(); UI.toast('Идея ушла в задачи'); BOS.render();
      };
    });
  }

  BOS.route('ideas', function (host) {
    var all = BOS.all('ideas');
    var cat = UI.fval('idea-f', 'cat', '');
    var st = UI.fval('idea-f', 'st', '');
    var q = UI.fval('idea-f', 'q', '').toLowerCase();

    var rows = all.filter(function (i) {
      if (cat && i.cat !== cat) return false;
      if (st && i.status !== st) return false;
      if (q && (i.title + ' ' + (i.effect || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).map(function (i) {
      return Object.assign({}, i, { iceV: BOS.ice(i), riceV: BOS.rice(i) });
    });
    rows.sort(function (a, b) { return b.iceV - a.iceV; });

    var h = UI.head({
      eyebrow: 'Центр идей',
      title: 'Brain Dump',
      sub: 'Ни одна идея не теряется. Мысль падает сюда за десять секунд, получает оценку ' +
        'и либо уходит в работу, либо честно закрывается. Оценка автоматическая: ' +
        'ICE = влияние × уверенность × простота ÷ 10.'
    });

    h += '<div class="grid g4 rise rise-1">';
    h += UI.kpi({ label: 'Всего идей', value: all.length, foot: 'Банк не чистим — идеи ждут своего момента' });
    h += UI.kpi({ label: 'Без оценки', value: all.filter(function (i) { return i.status === 'new'; }).length, foot: 'Оценить и решить' });
    h += UI.kpi({ label: 'В очереди', value: all.filter(function (i) { return i.status === 'queued'; }).length, foot: 'Ждут слота в плане' });
    h += UI.kpi({ label: 'ICE ≥ 70', value: rows.filter(function (i) { return i.iceV >= 70; }).length, foot: 'Кандидаты на эту неделю', hot: true });
    h += '</div>';

    h += '<h2 class="sec">Правило приоритизации</h2><div class="grid g4">';
    REF.ideaRule.forEach(function (r) {
      h += '<div class="card"><div class="cap">' + E(r.range) + '</div><p>' + E(r.act) + '</p></div>';
    });
    h += '</div>';

    h += '<h2 class="sec">Банк идей</h2>';
    h += UI.filters('idea-f', [
      { type: 'search', key: 'q', placeholder: 'Поиск по идеям' },
      {
        key: 'cat', options: [{ v: '', l: 'Все разделы' }].concat(
          REF.ideaCats.map(function (c) { return { v: c.id, l: c.n }; }))
      },
      {
        key: 'st', options: [{ v: '', l: 'Все статусы' }].concat(
          REF.ideaStatuses.map(function (s) { return { v: s.id, l: s.n }; }))
      }
    ]);
    h += '<div class="filters"><button class="btn-gold" id="i-add">+ Идея</button></div>';

    h += UI.table('ideas-tbl', [
      { key: 'title', label: 'Идея', render: function (r) { return '<b>' + E(r.title) + '</b><span class="sub-line">' + E(r.effect || '') + '</span>'; } },
      { key: 'cat', label: 'Раздел', w: '140px', render: function (r) { return UI.chip(catName(r.cat)); } },
      { key: 'iceV', label: 'ICE', num: true, w: '70px', render: function (r) { return '<b style="color:' + (r.iceV >= 70 ? 'var(--gold)' : 'inherit') + '">' + r.iceV + '</b>'; } },
      { key: 'riceV', label: 'RICE', num: true, w: '80px' },
      { key: 'impact', label: 'Влияние', num: true, w: '80px' },
      { key: 'ease', label: 'Простота', num: true, w: '85px' },
      { key: 'cost', label: 'Стоимость', w: '150px' },
      { key: 'status', label: 'Статус', w: '110px', render: function (r) { var n = r.status; REF.ideaStatuses.forEach(function (s) { if (s.id === r.status) n = s.n; }); return UI.chip(n); } }
    ], rows, function (id) { ideaModal(id); });

    host.innerHTML = h;
    document.getElementById('i-add').onclick = function () { ideaModal(null); };
  });
})();
