/* ═══ БАЗА ЗНАНИЙ ══════════════════════════════════════════════════ */
BOS.route('knowledge', function (host) {
  var E = BOS.esc;
  var view = UI.fval('kb-v', 'v', 'rules');
  var q = UI.fval('kb-q', 'q', '').toLowerCase();

  var h = UI.head({
    eyebrow: 'База знаний',
    title: 'Как здесь всё устроено',
    sub: 'Правило раздела: если что-то объясняли дважды — это должно лежать здесь. ' +
      'Тогда третий раз объяснять не придётся, а новый человек выйдет на работу за пять дней.'
  });

  h += UI.filters('kb-v', [{
    type: 'seg', key: 'v', def: 'rules', options: [
      { v: 'rules', l: 'Регламенты' }, { v: 'sop', l: 'SOP' }, { v: 'check', l: 'Чек-листы' },
      { v: 'obj', l: 'Возражения' }, { v: 'faq', l: 'FAQ' }, { v: 'scripts', l: 'Скрипты продаж' },
      { v: 'onb', l: 'Онбординг' }, { v: 'err', l: 'Ошибки' }
    ]
  }]);

  if (view === 'rules') {
    h += '<div class="grid g2">';
    REF.rules.forEach(function (r) {
      h += '<div class="card"><h4>' + E(r.n) + '</h4><div style="margin-top:10px">' + UI.beanList(r.items) + '</div></div>';
    });
    h += '</div>';

  } else if (view === 'sop') {
    REF.sops.forEach(function (s) {
      h += UI.acc(s.n, '<div class="steps">' + s.steps.map(function (st, i) {
        return '<div class="step"><div class="step-n">' + (i + 1) + '</div><div class="step-b"><p style="font-size:13.5px;color:var(--txt)">'
          + E(st) + '</p></div></div>';
      }).join('') + '</div>', false, s.steps.length + ' шагов');
    });

  } else if (view === 'check') {
    h += '<div class="grid g2">';
    REF.checklists.forEach(function (c) {
      h += '<div class="card"><h4>' + E(c.n) + '</h4><div style="margin-top:10px">'
        + c.items.map(function (i) {
          return '<label style="display:flex;gap:9px;align-items:flex-start;padding:5px 0;font-size:13px;color:var(--txt-2)">'
            + '<input type="checkbox" style="margin-top:3px;width:auto"> ' + E(i) + '</label>';
        }).join('') + '</div></div>';
    });
    h += '</div>';
    h += '<p class="note dim" style="margin-top:12px">Галочки намеренно не сохраняются: чек-лист проходится заново каждый раз, ' +
      'иначе он превращается в декорацию.</p>';

  } else if (view === 'obj') {
    h += UI.filters('kb-q', [{ type: 'search', key: 'q', placeholder: 'Найти возражение' }]);
    var objs = REF.objections.filter(function (o) {
      return !q || (o.q + ' ' + o.a).toLowerCase().indexOf(q) >= 0;
    });
    h += '<p class="note" style="margin-bottom:14px">' + objs.length + ' из ' + REF.objections.length +
      ' возражений. Ответы дословные — их можно использовать как есть.</p>';
    h += '<div class="grid g2">';
    objs.forEach(function (o) {
      h += '<div class="card"><h4>«' + E(o.q) + '»</h4><p style="margin-top:8px">' + E(o.a) + '</p></div>';
    });
    h += '</div>';

  } else if (view === 'faq') {
    h += UI.filters('kb-q', [{ type: 'search', key: 'q', placeholder: 'Найти в FAQ' }]);
    REF.faq.forEach(function (g) {
      var items = g.items.filter(function (i) { return !q || (i.q + ' ' + i.a).toLowerCase().indexOf(q) >= 0; });
      if (!items.length) return;
      h += '<h2 class="sec">' + E(g.g) + ' · ' + items.length + '</h2>';
      h += '<div class="tablewrap"><table><thead><tr><th class="nosort" style="width:320px">Вопрос</th><th class="nosort">Ответ</th></tr></thead><tbody>'
        + items.map(function (i) { return '<tr><td><b>' + E(i.q) + '</b></td><td>' + E(i.a) + '</td></tr>'; }).join('')
        + '</tbody></table></div>';
    });

  } else if (view === 'scripts') {
    REF.salesScripts.forEach(function (s, i) {
      h += UI.acc(s.n, '<div class="prompt-box" id="sc-' + i + '">' + E(s.text) + '</div>'
        + '<div class="copybar"><button class="btn sm" data-copy="sc-' + i + '">Скопировать</button></div>', i === 0);
    });
    h += '<h2 class="sec">Уникальные преимущества — что говорить клиенту</h2>';
    h += UI.table('kb-adv', [
      { key: 'a', label: 'Преимущество', w: '250px', render: function (r) { return '<b>' + E(r.a) + '</b>'; } },
      { key: 'b', label: 'Почему это важно' },
      { key: 'c', label: 'Что сказать' }
    ], [
      { a: 'Газированный кофе без сахара', b: 'Такого формата на полке нет — новая ниша, нет прямых аналогов', c: '«Единственный газированный кофе без сахара — берут из любопытства и возвращаются за вкусом»' },
      { a: 'Натуральный кофеин из кофе (125 мг)', b: 'Ответ на запрос «натуральнее, чем энергетик»', c: '«Кофеин из кофе, а не синтетика. 125 мг — как хорошая чашка кофе»' },
      { a: 'Ноль сахара / версия Zero', b: 'Растущий тренд, нет сахарного отката', c: '«Заряд без сахара и калорий — не бьёт по фигуре»' },
      { a: '6 ярких вкусов', b: 'Ротация на полке, есть что коллекционировать, выше частота покупки', c: '«Шесть вкусов — каждый день можно выбрать новый, покупают набором»' },
      { a: 'Газация и холод', b: 'Освежает там, где кофе тяжёлый и горячий', c: '«Холодный и шипучий — освежает и бодрит одновременно»' },
      { a: 'Выгодно', b: 'Дешевле кофейни и ежедневного латте', c: '«Дешевле стакана из кофейни, а бодрит не хуже»' },
      { a: 'Красивая банка', b: 'Продаёт себя на полке, импульсная покупка', c: '«Банку хочется взять в руку и сфоткать — работает на импульс»' },
      { a: 'Проще кофе', b: 'Ни очереди, ни бариста, ни поиска кофейни', c: '«Открыл — и готово, где угодно»' }
    ]);

  } else if (view === 'onb') {
    h += '<p class="note" style="margin-bottom:14px">Пять дней — и человек работает самостоятельно. ' +
      'Порядок важен: сначала бренд, потом инструменты, и только потом задачи.</p>';
    h += '<div class="grid gauto">';
    REF.onboarding.forEach(function (d) {
      h += '<div class="card"><div class="cap">' + E(d.day) + '</div>'
        + d.items.map(function (i) {
          return '<label style="display:flex;gap:9px;align-items:flex-start;padding:5px 0;font-size:13px;color:var(--txt-2)">'
            + '<input type="checkbox" style="margin-top:3px;width:auto"> ' + E(i) + '</label>';
        }).join('') + '</div>';
    });
    h += '</div>';

  } else {
    h += '<p class="note" style="margin-bottom:14px">Это не список для наказаний. Это девять мест, где чаще всего ' +
      'ломается система — и объяснение, почему именно они дорого стоят.</p>';
    h += UI.table('kb-err', [
      { key: 'm', label: 'Что считается ошибкой', w: '330px', render: function (r) { return '<b>' + E(r.m) + '</b>'; } },
      { key: 'why', label: 'Почему это дорого' }
    ], REF.mistakes);
  }

  host.innerHTML = h;
  UI.bindCopy(host);
});
