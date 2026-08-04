/* ═══ АНАЛИТИКА ════════════════════════════════════════════════════ */
(function () {
  var E = BOS.esc;

  var CHANNELS = ['Instagram', 'Stories', 'Threads', 'Telegram', 'TikTok', 'YouTube', 'VK', 'Продажи'];

  function metricModal(id) {
    var m = id ? BOS.find('metrics', id) : null;
    var isNew = !m;
    m = m || { date: BOS.today(), channel: 'Instagram' };

    var body = '<div class="frow">'
      + '<div class="field"><label>Дата среза</label><input type="date" id="mt-date" value="' + E(m.date) + '"></div>'
      + '<div class="field"><label>Канал</label><select id="mt-ch">'
      + CHANNELS.map(function (c) { return '<option' + (m.channel === c ? ' selected' : '') + '>' + E(c) + '</option>'; }).join('')
      + '</select></div></div>'
      + '<div class="frow">'
      + '<div class="field"><label>Подписчиков</label><input type="number" id="mt-fol" value="' + E(m.followers || '') + '"></div>'
      + '<div class="field"><label>Охват за период</label><input type="number" id="mt-reach" value="' + E(m.reach || '') + '"></div>'
      + '</div>'
      + '<div class="frow">'
      + '<div class="field"><label>ER, %</label><input type="number" step="0.1" id="mt-er" value="' + E(m.er || '') + '"></div>'
      + '<div class="field"><label>CTR, %</label><input type="number" step="0.1" id="mt-ctr" value="' + E(m.ctr || '') + '"></div>'
      + '</div>'
      + '<div class="frow">'
      + '<div class="field"><label>Сохранения</label><input type="number" id="mt-saves" value="' + E(m.saves || '') + '"></div>'
      + '<div class="field"><label>Переходы / клики</label><input type="number" id="mt-clicks" value="' + E(m.clicks || '') + '"></div>'
      + '</div>'
      + '<div class="frow">'
      + '<div class="field"><label>Конверсия, %</label><input type="number" step="0.1" id="mt-cr" value="' + E(m.cr || '') + '"></div>'
      + '<div class="field"><label>Выручка / продажи, ₽</label><input type="number" id="mt-rev" value="' + E(m.revenue || '') + '"></div>'
      + '</div>'
      + '<div class="field"><label>Затраты на канал за период, ₽</label><input type="number" id="mt-cost" value="' + E(m.cost || '') + '"></div>'
      + '<div class="field"><label>Что произошло и почему — вывод недели</label><textarea id="mt-note">' + E(m.note || '') + '</textarea></div>';

    var foot = (isNew ? '' : '<button class="btn danger sm" id="mt-del">Удалить</button>')
      + '<button class="btn" data-close>Отмена</button><button class="btn-gold" id="mt-save">Сохранить</button>';

    UI.modal(isNew ? 'Новый срез' : 'Срез статистики', body, foot, function () {
      document.getElementById('mt-save').onclick = function () {
        var v = function (x) { var el = document.getElementById(x); return el ? el.value : ''; };
        BOS.upsert('metrics', Object.assign({}, m, {
          date: v('mt-date'), channel: v('mt-ch'),
          followers: Number(v('mt-fol')) || 0, reach: Number(v('mt-reach')) || 0,
          er: Number(v('mt-er')) || 0, ctr: Number(v('mt-ctr')) || 0,
          saves: Number(v('mt-saves')) || 0, clicks: Number(v('mt-clicks')) || 0,
          cr: Number(v('mt-cr')) || 0, revenue: Number(v('mt-rev')) || 0,
          cost: Number(v('mt-cost')) || 0, note: v('mt-note')
        }));
        UI.closeModal(); UI.toast('Срез сохранён'); BOS.render();
      };
      var del = document.getElementById('mt-del');
      if (del) del.onclick = function () {
        if (confirm('Удалить срез?')) { BOS.remove('metrics', m.id); UI.closeModal(); BOS.render(); }
      };
    });
  }

  /* Мини-график: столбики. Только тёплый спектр, свет снизу. */
  function sparkBars(values, labels) {
    if (!values.length) return '<p class="dim mono" style="font-size:11px">Нет данных</p>';
    var max = Math.max.apply(null, values.concat([1]));
    return '<div style="display:flex;align-items:flex-end;gap:4px;height:72px;margin-top:10px">'
      + values.map(function (v, i) {
        var pct = Math.round(v / max * 100);
        return '<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%" title="'
          + E((labels[i] || '') + ': ' + BOS.fmtNum(v)) + '">'
          + '<div style="height:' + Math.max(pct, 3) + '%;border-radius:3px 3px 0 0;'
          + 'background:linear-gradient(180deg,var(--gold-light),var(--gold-rise))"></div></div>';
      }).join('') + '</div>'
      + '<div style="display:flex;gap:4px;margin-top:4px">'
      + labels.map(function (l) { return '<div style="flex:1;text-align:center;font-size:9px;color:var(--txt-3)" class="mono">' + E(l) + '</div>'; }).join('')
      + '</div>';
  }

  BOS.route('analytics', function (host) {
    var metrics = BOS.all('metrics');
    var content = BOS.all('content');
    var infl = BOS.all('influencers');
    var published = content.filter(function (c) { return c.status === 'published' && c.stats && c.stats.reach; });

    var h = UI.head({
      eyebrow: 'Аналитика',
      title: 'Цифры и выводы',
      sub: 'Решения принимаются на цифрах, а не на ощущениях. Срез снимается каждую пятницу — ' +
        'без пропусков, иначе через месяц не с чем будет сравнивать.'
    });

    if (!metrics.length) {
      h += '<div class="card" style="border-color:var(--warn);margin-bottom:18px">'
        + '<div class="cap" style="color:var(--warn)">Первое, что нужно сделать</div>'
        + '<h4>Базовых значений нет</h4>'
        + '<p style="margin-top:8px">Цели вида «+20% охвата в месяц» бессмысленны, пока не зафиксирована точка отсчёта. '
        + 'Снимите текущие цифры по каждому каналу сегодня — это займёт двадцать минут и сделает все дальнейшие цели измеримыми.</p>'
        + '<button class="btn-gold" id="mt-add-first" style="margin-top:12px">Зафиксировать базу</button></div>';
    }

    /* ── СВОДКА ─────────────────────────────────────────────────── */
    var totalReach = published.reduce(function (s, c) { return s + BOS.num(c.stats.reach, 0); }, 0);
    var avgER = published.length ? published.reduce(function (s, c) { return s + BOS.num(c.stats.er, 0); }, 0) / published.length : 0;
    var totalSaves = published.reduce(function (s, c) { return s + BOS.num(c.stats.saves, 0); }, 0);
    var inflReach = infl.filter(function (i) { return i.published; }).reduce(function (s, i) { return s + BOS.num(i.reach, 0); }, 0);
    var inflSpend = infl.reduce(function (s, i) { return s + BOS.num(i.price, 0); }, 0);

    h += '<h2 class="sec">Сводка по контенту</h2><div class="grid g4 rise rise-1">';
    h += UI.kpi({ label: 'Публикаций с цифрами', value: published.length, foot: 'Всего опубликовано: ' + content.filter(function (c) { return c.status === 'published'; }).length });
    h += UI.kpi({ label: 'Совокупный охват', value: BOS.fmtNum(totalReach), foot: 'По собственным каналам', hot: true });
    h += UI.kpi({ label: 'Средний ER', value: (Math.round(avgER * 10) / 10) + '%', foot: 'Цель ≥6%', pct: Math.round(avgER / 6 * 100), hot: avgER >= 6 });
    h += UI.kpi({ label: 'Сохранений', value: BOS.fmtNum(totalSaves), foot: 'Сохранение — сильнее лайка' });
    h += '</div>';

    h += '<div class="grid g4" style="margin-top:14px">';
    h += UI.kpi({ label: 'Охват через блогеров', value: BOS.fmtNum(inflReach), foot: 'Опубликовали: ' + infl.filter(function (i) { return i.published; }).length });
    h += UI.kpi({ label: 'Потрачено на блогеров', value: BOS.fmtNum(inflSpend) + ' ₽', foot: 'Без учёта бартера' });
    h += UI.kpi({ label: 'CPM инфлюенсеров', value: inflReach ? Math.round(inflSpend / (inflReach / 1000)) + ' ₽' : '—', foot: 'Чем ниже, тем лучше' });
    h += UI.kpi({
      label: 'Публикаций без статистики',
      value: content.filter(function (c) { return c.status === 'published' && (!c.stats || !c.stats.reach); }).length,
      foot: 'Без цифры это не работа, а активность', bad: true
    });
    h += '</div>';

    /* ── ГРАФИКИ ПО КАНАЛАМ ─────────────────────────────────────── */
    if (metrics.length) {
      h += '<h2 class="sec">Динамика по каналам</h2><div class="grid g3">';
      CHANNELS.forEach(function (ch) {
        var rows = metrics.filter(function (m) { return m.channel === ch; })
          .sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); });
        if (!rows.length) return;
        var last = rows[rows.length - 1];
        var prev = rows.length > 1 ? rows[rows.length - 2] : null;
        var delta = prev && prev.reach ? Math.round((last.reach - prev.reach) / prev.reach * 100) : null;
        h += '<div class="card"><div class="cap">' + E(ch) + '</div>'
          + '<div class="kpi-val mono" style="font-size:22px">' + BOS.fmtNum(last.reach) + '</div>'
          + '<p class="dim">охват · ER ' + (last.er || 0) + '%'
          + (delta !== null ? ' · <b style="color:' + (delta >= 0 ? 'var(--gold)' : 'var(--danger)') + '">'
            + (delta >= 0 ? '+' : '') + delta + '%</b>' : '') + '</p>'
          + sparkBars(rows.map(function (r) { return r.reach; }), rows.map(function (r) { return BOS.fmtDate(r.date); }))
          + '</div>';
      });
      h += '</div>';
    }

    /* ── ЛУЧШИЙ И ХУДШИЙ КОНТЕНТ ───────────────────────────────── */
    var sorted = published.slice().sort(function (a, b) { return b.stats.reach - a.stats.reach; });
    if (sorted.length) {
      h += '<h2 class="sec">Лучший и худший контент</h2><div class="grid g2">';
      var best = sorted[0], worst = sorted[sorted.length - 1];
      h += '<div class="card" style="border-color:var(--gold-rise)"><div class="cap">Лучший по охвату</div>'
        + '<h4>' + E(best.title) + '</h4>'
        + '<p style="margin-top:6px" class="mono">' + BOS.fmtNum(best.stats.reach) + ' охват · ER ' + best.stats.er + '% · '
        + BOS.fmtNum(best.stats.saves) + ' сохранений</p>'
        + '<p style="margin-top:8px"><b>Крючок:</b> ' + E(best.hook || '—') + '</p>'
        + '<p style="margin-top:6px" class="dim">' + E(best.note || 'Вывод не записан. Запишите — иначе успех не повторится.') + '</p></div>';
      h += '<div class="card"><div class="cap">Слабее всех</div>'
        + '<h4>' + E(worst.title) + '</h4>'
        + '<p style="margin-top:6px" class="mono">' + BOS.fmtNum(worst.stats.reach) + ' охват · ER ' + worst.stats.er + '%</p>'
        + '<p style="margin-top:8px"><b>Крючок:</b> ' + E(worst.hook || '—') + '</p>'
        + '<p style="margin-top:6px" class="dim">' + E(worst.note || 'Вывод не записан. Гипотеза о причине важнее, чем сам факт провала.') + '</p></div>';
      h += '</div>';

      h += '<h2 class="sec">Все публикации по результату</h2>';
      h += UI.table('an-content', [
        { key: 'title', label: 'Публикация', render: function (r) { return '<b>' + E(r.title) + '</b><span class="sub-line">' + E(r.hook || '') + '</span>'; } },
        { key: 'channel', label: 'Канал', w: '110px' },
        { key: 'reachV', label: 'Охват', num: true, w: '90px', render: function (r) { return BOS.fmtNum(r.stats.reach); } },
        { key: 'erV', label: 'ER', num: true, w: '70px', render: function (r) { return r.stats.er + '%'; } },
        { key: 'savesV', label: 'Сохр.', num: true, w: '80px', render: function (r) { return BOS.fmtNum(r.stats.saves); } },
        { key: 'sharesV', label: 'Репосты', num: true, w: '85px', render: function (r) { return BOS.fmtNum(r.stats.shares); } },
        { key: 'publishAt', label: 'Дата', w: '95px', render: function (r) { return BOS.fmtDate(r.publishAt); } }
      ], published.map(function (c) {
        return Object.assign({}, c, {
          reachV: c.stats.reach, erV: c.stats.er, savesV: c.stats.saves || 0, sharesV: c.stats.shares || 0
        });
      }), function (id) { window.contentModal(id); });
    }

    /* ── ТАБЛИЦА СРЕЗОВ ─────────────────────────────────────────── */
    h += '<h2 class="sec">Срезы статистики</h2>';
    h += '<div class="filters"><button class="btn-gold" id="mt-add">+ Срез</button>'
      + '<span class="dim mono" style="font-size:11px;margin-left:10px">Снимается каждую пятницу до 15:00</span></div>';
    h += UI.table('an-metrics', [
      { key: 'date', label: 'Дата', w: '100px', render: function (r) { return BOS.fmtDate(r.date); } },
      { key: 'channel', label: 'Канал', w: '110px' },
      { key: 'followers', label: 'Подпис.', num: true, w: '90px', render: function (r) { return BOS.fmtNum(r.followers); } },
      { key: 'reach', label: 'Охват', num: true, w: '90px', render: function (r) { return BOS.fmtNum(r.reach); } },
      { key: 'er', label: 'ER', num: true, w: '65px', render: function (r) { return r.er ? r.er + '%' : '—'; } },
      { key: 'ctr', label: 'CTR', num: true, w: '65px', render: function (r) { return r.ctr ? r.ctr + '%' : '—'; } },
      { key: 'clicks', label: 'Клики', num: true, w: '80px', render: function (r) { return BOS.fmtNum(r.clicks); } },
      { key: 'revenue', label: 'Выручка', num: true, w: '95px', render: function (r) { return r.revenue ? BOS.fmtNum(r.revenue) + ' ₽' : '—'; } },
      {
        key: 'roi', label: 'ROI', num: true, w: '70px', render: function (r) {
          if (!r.cost || !r.revenue) return '—';
          return (Math.round(r.revenue / r.cost * 10) / 10) + '×';
        }
      },
      { key: 'note', label: 'Вывод' }
    ], metrics.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); }),
      function (id) { metricModal(id); });

    /* ── ЧТО СЧИТАЕМ ────────────────────────────────────────────── */
    h += '<h2 class="sec">Что и зачем считаем</h2><div class="grid g3">';
    [
      { n: 'Охват', d: 'Сколько людей увидели. Базовая цифра, но сама по себе ничего не значит.' },
      { n: 'ER', d: 'Вовлечённость. Показывает, попали ли в интерес, а не просто в ленту.' },
      { n: 'Сохранения', d: 'Самый честный сигнал ценности: человек вернётся к этому.' },
      { n: 'Репосты', d: 'Готовность рассказать. Прямой предиктор органического роста.' },
      { n: 'CTR', d: 'Работает ли призыв. Низкий CTR при высоком охвате — проблема в CTA, не в контенте.' },
      { n: 'Конверсия', d: 'Довели ли до полки. Главная цифра для этапа «Действие».' },
      { n: 'ROI', d: 'Выручка / затраты. Считаем по каналам, где есть промокоды и метки.' },
      { n: 'Прирост аудитории', d: 'Растём или топчемся. Смотрим динамику, а не абсолют.' },
      { n: 'CPM', d: 'Стоимость тысячи контактов. Единственный способ сравнить блогеров между собой.' }
    ].forEach(function (m) {
      h += '<div class="card"><h4>' + E(m.n) + '</h4><p>' + E(m.d) + '</p></div>';
    });
    h += '</div>';

    /* ── РЕКОМЕНДАЦИИ ───────────────────────────────────────────── */
    var recs = [];
    if (!metrics.length) recs.push('Зафиксировать базовые значения по всем каналам — без этого цели в процентах не работают.');
    if (published.length && avgER < 6) recs.push('Средний ER ниже цели 6%. Проверьте первые секунды: банк крючков есть, но он не используется.');
    var noNote = published.filter(function (c) { return !c.note; });
    if (noNote.length) recs.push(noNote.length + ' публикаций без вывода о причинах. Успех без записанной причины не повторяется.');
    if (!infl.filter(function (i) { return i.promo; }).length) recs.push('Ни у одного блогера нет персонального промокода — вклад инфлюенсеров нельзя измерить.');
    if (published.length < 5) recs.push('Данных мало для выводов. Нужно минимум 15–20 публикаций, чтобы отличить закономерность от случайности.');
    if (recs.length) {
      h += '<h2 class="sec">Что делать с этими цифрами</h2><div class="card">' + UI.beanList(recs) + '</div>';
    }

    host.innerHTML = h;
    var a1 = document.getElementById('mt-add'); if (a1) a1.onclick = function () { metricModal(null); };
    var a2 = document.getElementById('mt-add-first'); if (a2) a2.onclick = function () { metricModal(null); };
  });
})();
