/* ═══ PR И МЕДИА ═══════════════════════════════════════════════════ */
(function () {
  var E = BOS.esc;
  function stName(id) { var n = id; REF.mediaStatuses.forEach(function (s) { if (s.id === id) n = s.n; }); return n; }
  function typeName(id) { var n = id; REF.mediaTypes.forEach(function (t) { if (t.id === id) n = t.n; }); return n; }

  function mediaModal(id) {
    var m = id ? BOS.find('media', id) : null;
    var isNew = !m;
    m = m || { type: 'lifestyle', status: 'idea', reach: 0 };

    var body =
      '<div class="field"><label>Издание / канал</label><input id="m-name" value="' + E(m.name || '') + '"></div>'
      + '<div class="frow">'
      + '<div class="field"><label>Тип</label><select id="m-type">'
      + REF.mediaTypes.map(function (t) { return '<option value="' + t.id + '"' + (m.type === t.id ? ' selected' : '') + '>' + E(t.n) + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="field"><label>Статус</label><select id="m-status">'
      + REF.mediaStatuses.map(function (s) { return '<option value="' + s.id + '"' + (m.status === s.id ? ' selected' : '') + '>' + E(s.n) + '</option>'; }).join('')
      + '</select></div>'
      + '</div>'
      + '<div class="field"><label>Контакт</label><input id="m-contact" value="' + E(m.contact || '') + '"></div>'
      + '<div class="field"><label>Повод / угол подачи</label><input id="m-angle" value="' + E(m.angle || '') + '"></div>'
      + '<div class="frow">'
      + '<div class="field"><label>Дата питча</label><input type="date" id="m-pitched" value="' + E(m.pitchedAt || '') + '"></div>'
      + '<div class="field"><label>Дата выхода</label><input type="date" id="m-published" value="' + E(m.publishedAt || '') + '"></div>'
      + '</div>'
      + '<div class="field"><label>Охват публикации</label><input type="number" id="m-reach" value="' + E(m.reach || 0) + '"></div>'
      + '<div class="field"><label>Заметки</label><textarea id="m-note">' + E(m.note || '') + '</textarea></div>';

    var foot = (isNew ? '' : '<button class="btn danger sm" id="m-del">Удалить</button>')
      + '<button class="btn" data-close>Отмена</button><button class="btn-gold" id="m-save">Сохранить</button>';

    UI.modal(isNew ? 'Новое медиа' : (m.name || 'Медиа'), body, foot, function () {
      document.getElementById('m-save').onclick = function () {
        var v = function (x) { var el = document.getElementById(x); return el ? el.value : ''; };
        BOS.upsert('media', Object.assign({}, m, {
          name: v('m-name') || 'Без названия', type: v('m-type'), status: v('m-status'),
          contact: v('m-contact'), angle: v('m-angle'), pitchedAt: v('m-pitched'),
          publishedAt: v('m-published'), reach: Number(v('m-reach')) || 0, note: v('m-note')
        }));
        UI.closeModal(); UI.toast('Сохранено'); BOS.render();
      };
      var del = document.getElementById('m-del');
      if (del) del.onclick = function () {
        if (confirm('Удалить запись?')) { BOS.remove('media', m.id); UI.closeModal(); BOS.render(); }
      };
    });
  }

  BOS.route('pr', function (host) {
    var all = BOS.all('media');
    var view = UI.fval('pr-v', 'v', 'base');
    var pub = all.filter(function (m) { return m.status === 'published'; });
    var reach = pub.reduce(function (s, m) { return s + BOS.num(m.reach, 0); }, 0);

    var h = UI.head({
      eyebrow: 'PR и медиа',
      title: 'Работа со СМИ',
      sub: 'Один питч = один повод. «Расскажите о нас» поводом не является. ' +
        'В каждом письме обязательна цифра — перепечатывают цифры, а не прилагательные.'
    });

    h += UI.filters('pr-v', [{
      type: 'seg', key: 'v', def: 'base', options: [
        { v: 'base', l: 'База медиа' }, { v: 'angles', l: 'Поводы' },
        { v: 'process', l: 'Процесс' }, { v: 'release', l: 'Пресс-релиз' }
      ]
    }]);

    if (view === 'base') {
      h += '<div class="grid g4 rise rise-1">';
      h += UI.kpi({ label: 'Медиа в базе', value: all.length, foot: 'Растёт с каждым питчем' });
      h += UI.kpi({ label: 'Публикаций', value: pub.length, foot: 'Цель: 4 / мес', pct: Math.round(pub.length / 4 * 100), hot: true });
      h += UI.kpi({ label: 'Совокупный охват', value: BOS.fmtNum(reach), foot: 'По вышедшим материалам' });
      h += UI.kpi({ label: 'Питчей в работе', value: all.filter(function (m) { return m.status === 'pitched' || m.status === 'talks'; }).length, foot: 'Напоминание через 5 раб. дней' });
      h += '</div>';

      h += '<h2 class="sec">База медиа</h2>';
      h += '<div class="filters"><button class="btn-gold" id="m-add">+ Медиа</button></div>';
      h += UI.table('pr-tbl', [
        { key: 'name', label: 'Издание', render: function (r) { return '<b>' + E(r.name) + '</b><span class="sub-line">' + E(r.contact || '') + '</span>'; } },
        { key: 'type', label: 'Тип', w: '140px', render: function (r) { return UI.chip(typeName(r.type)); } },
        { key: 'angle', label: 'Повод' },
        { key: 'status', label: 'Статус', w: '140px', render: function (r) { return UI.chip(stName(r.status)); } },
        { key: 'pitchedAt', label: 'Питч', w: '100px', render: function (r) { return r.pitchedAt ? BOS.fmtDate(r.pitchedAt) : '—'; } },
        { key: 'reach', label: 'Охват', num: true, w: '90px', render: function (r) { return r.reach ? BOS.fmtNum(r.reach) : '—'; } }
      ], all, function (id) { mediaModal(id); });

      h += '<h2 class="sec">Типы медиа и углы подачи</h2>';
      h += UI.table('pr-types', [
        { key: 'n', label: 'Тип', w: '150px', render: function (r) { return '<b>' + E(r.n) + '</b>'; } },
        { key: 'ex', label: 'Примеры' },
        { key: 'angle', label: 'Наш угол' }
      ], REF.mediaTypes);

    } else if (view === 'angles') {
      h += '<h2 class="sec">Банк поводов</h2>';
      h += '<p class="note" style="margin-bottom:14px">Повод — это то, что можно рассказать журналисту в одну строку. ' +
        'У каждого есть доказательство: без него это не повод, а желание.</p>';
      h += UI.table('pr-angles', [
        { key: 'n', label: 'Повод', w: '300px', render: function (r) { return '<b>' + E(r.n) + '</b>'; } },
        { key: 'proof', label: 'Доказательство' },
        { key: 'for', label: 'Кому', w: '150px', render: function (r) { return r['for'].split(', ').map(function (t) { return UI.chip(typeName(t)); }).join(' '); } }
      ], REF.prAngles);

      h += '<h2 class="sec">Ещё поводы из Growth Engine</h2>';
      h += '<div class="card">' + UI.beanList(REF.growthBanks.pr) + '</div>';

    } else if (view === 'process') {
      h += '<h2 class="sec">Пайплайн</h2>';
      h += '<div class="steps">' + REF.prPipeline.map(function (s, i) {
        return '<div class="step"><div class="step-n">' + (i + 1) + '</div><div class="step-b">'
          + '<h4>' + E(s.n) + '</h4><p>' + E(s.d) + '</p></div></div>';
      }).join('') + '</div>';

      h += '<h2 class="sec">Правила</h2><div class="card">' + UI.beanList(REF.prRules) + '</div>';

      h += '<h2 class="sec">Рыночные цифры для питчей</h2>';
      h += UI.table('pr-mkt', [
        { key: 'n', label: 'Тренд', w: '220px' }, { key: 'v', label: 'Данные' }, { key: 'src', label: 'Источник', w: '220px' }
      ], REF.brand.market);

    } else {
      h += '<h2 class="sec">Шаблон пресс-релиза</h2>';
      h += '<div class="prompt-box" id="pr-tpl">' + E(REF.pressReleaseTemplate) + '</div>';
      h += '<div class="copybar"><button class="btn sm" data-copy="pr-tpl">Скопировать шаблон</button></div>';

      h += '<h2 class="sec">Факты, которые идут в каждый релиз</h2><div class="grid g4">';
      h += UI.kpi({ label: 'Кофеин', value: '125 мг', foot: 'натуральный, из робусты' });
      h += UI.kpi({ label: 'Сахар', value: '0 г', foot: 'доказуемо на этикетке' });
      h += UI.kpi({ label: 'Вкусов', value: '6', foot: 'линейка как коллекция' });
      h += UI.kpi({ label: 'Цена', value: '120 ₽', foot: 'против 300–400 ₽ за латте' });
      h += '</div>';

      h += '<h2 class="sec">Готовые формулировки</h2>';
      h += UI.acc('Elevator Pitch', '<div class="prompt-box" id="pr-el">' + E(REF.brand.pitches.elevator) + '</div>'
        + '<div class="copybar"><button class="btn sm" data-copy="pr-el">Скопировать</button></div>', true);
      h += UI.acc('Справка о бренде',
        '<div class="prompt-box" id="pr-about">Bumble Coffee — газированный кофе без сахара под зонтом Black Phoenix. '
        + '330 мл, 125 мг натурального кофеина из экстракта робусты, ноль сахара, шесть вкусов, 120 ₽. '
        + 'Big Idea бренда — «Заряд без привязи». Продукт занимает третью нишу между сладким холодным кофе '
        + 'и энергетиками: вкусный и чистый заряд без привязки к кофейне.</div>'
        + '<div class="copybar"><button class="btn sm" data-copy="pr-about">Скопировать</button></div>');
    }

    host.innerHTML = h;
    var add = document.getElementById('m-add');
    if (add) add.onclick = function () { mediaModal(null); };
    UI.bindCopy(host);
  });
})();
