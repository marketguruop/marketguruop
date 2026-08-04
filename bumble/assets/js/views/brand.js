/* ═══ BRAND CENTER ═════════════════════════════════════════════════ */
BOS.route('brand', function (host) {
  var E = BOS.esc, B = REF.brand, V = B.visual;

  var h = UI.head({
    eyebrow: B.umbrella + ' · ' + B.product,
    title: 'Brand Center',
    sub: 'Единственный источник истины по бренду. Если макет, текст или решение расходятся ' +
      'с этой страницей — правы не они. Данные сведены из платформы позиционирования, ' +
      'Visual Code Book v1.0, Marketing Playbook и Sales Guide.'
  });

  /* ── БОЛЬШАЯ ИДЕЯ ───────────────────────────────────────────── */
  h += '<div class="law618 rise rise-1" style="margin-bottom:18px">'
    + '<div class="l-top"><span class="l-mark">61,8% · СВЕТ</span></div>'
    + '<div class="l-bot"><span>' + E(B.bigIdea) + '</span></div></div>';

  h += '<div class="grid g2 rise rise-1">';
  h += '<div class="card"><div class="cap">Ключевая фраза</div><h4 style="font-size:17px;line-height:1.35">«' + E(B.keyPhrase) + '»</h4><p style="margin-top:8px">Порядок слов здесь — порядок слоёв в кадре. Сначала вкус, потом заряд. Сначала свет, потом продукт.</p></div>';
  h += '<div class="card"><div class="cap">Суть бренда</div><p style="font-size:14px">' + E(B.essence) + '</p><p style="margin-top:10px" class="dim">' + E(B.mission) + '</p></div>';
  h += '</div>';

  /* ── ПОЗИЦИОНИРОВАНИЕ ───────────────────────────────────────── */
  h += '<h2 class="sec">Позиционирование</h2>';
  h += '<div class="card"><p style="font-size:14.5px">' + E(B.positioning) + '</p></div>';
  h += '<div class="grid g2" style="margin-top:14px">'
    + '<div class="card"><div class="cap">Проблема, которую решаем</div><p>' + E(B.problem) + '</p></div>'
    + '<div class="card"><div class="cap">Архетип</div>'
    + '<p><b>' + E(B.archetype.main) + '</b></p>'
    + '<p style="margin-top:6px">' + E(B.archetype.second) + '</p>'
    + '<p style="margin-top:6px" class="dim">' + E(B.archetype.visual) + '</p>'
    + '<p style="margin-top:6px" class="dim">' + E(B.archetype.consequence) + '</p></div>'
    + '</div>';

  /* ── ЦЕННОСТИ И ЭМОЦИЯ ──────────────────────────────────────── */
  h += '<h2 class="sec">Ценности</h2><div class="grid g3">';
  B.values.forEach(function (v) {
    h += '<div class="card"><h4>' + E(v.n) + '</h4><p>' + E(v.d) + '</p></div>';
  });
  h += '</div>';

  h += '<h2 class="sec">Эмоция бренда</h2><div class="card">'
    + '<h4 style="font-size:16px">' + E(B.emotion.core) + '</h4>'
    + '<p style="margin-top:8px">' + E(B.emotion.detail) + '</p>'
    + '<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">'
    + B.emotion.states.map(function (s) { return UI.chip(s, 'gold'); }).join('') + '</div></div>';

  /* ── ЛИНЕЙКА ВКУСОВ ─────────────────────────────────────────── */
  h += '<h2 class="sec">Линейка вкусов</h2>';
  h += '<div class="flavor-strip rise">' + B.flavors.map(function (f) {
    return '<div class="flavor-cell"><div class="fc-top"></div>'
      + '<div class="fc-bot" style="background:' + f.hex + '">'
      + '<div class="fc-n">' + E(f.name) + '</div>'
      + '<div class="fc-h">' + f.hex + '</div></div></div>';
  }).join('') + '</div>';
  h += '<p class="note dim" style="margin-top:10px">' + E(B.flavorRule) + '</p>';

  h += '<div class="grid g3" style="margin-top:14px">';
  B.flavors.forEach(function (f) {
    h += '<div class="card"><div class="cap"><span class="dot-f" style="background:' + f.hex + '"></span> '
      + f.hex + ' · PMS ' + E(f.pms) + '</div>'
      + '<h4>' + E(f.name) + ' <span class="dim" style="font-weight:400">· ' + E(f.ru) + '</span>'
      + (f.top ? ' ' + UI.chip('топ', 'gold') : '') + '</h4>'
      + '<p>' + E(f.desc) + '</p>'
      + '<p style="margin-top:8px"><b>Эмоция:</b> ' + E(f.emotion) + '</p>'
      + '<p style="margin-top:4px"><b>Крепость:</b> ' + UI.beans(f.strength) + '</p>'
      + '<p style="margin-top:6px;color:var(--danger)"><b>Где нельзя:</b> ' + E(f.avoid) + '</p></div>';
  });
  h += '</div>';
  h += '<p class="note" style="margin-top:12px"><b>На полке:</b> ' + E(B.shelfTip) + '</p>';

  /* ── ПРОДУКТ ────────────────────────────────────────────────── */
  h += '<h2 class="sec">Продукт</h2><div class="grid g4">';
  h += UI.kpi({ label: 'Кофеин', value: '125 мг', foot: 'натуральный, из робусты' });
  h += UI.kpi({ label: 'Сахар', value: '0 г', foot: 'Zero' });
  h += UI.kpi({ label: 'Объём', value: '330 мл', foot: 'алюминиевая банка' });
  h += UI.kpi({ label: 'Цена', value: '120 ₽', foot: 'дешевле латте навынос' });
  h += '</div>';

  h += '<div class="grid g2" style="margin-top:14px">';
  h += '<div class="card"><div class="cap">Состав человеческим языком</div>'
    + B.product_facts.composition.map(function (c) {
      return '<div style="margin-top:9px"><b>' + E(c.n) + '</b><br><span class="dim">' + E(c.d) + '</span>'
        + '<br>→ покупателю: ' + E(c.gives) + '</div>';
    }).join('')
    + '<p style="margin-top:12px" class="mono">' + E(B.product_facts.philosophy) + '</p></div>';
  h += '<div class="card"><div class="cap">Почему робуста</div><p>' + E(B.product_facts.why_robusta) + '</p>'
    + '<div class="cap" style="margin-top:14px">Категория</div><p>' + E(B.product_facts.category) + '</p></div>';
  h += '</div>';

  /* ── АУДИТОРИЯ ──────────────────────────────────────────────── */
  h += '<h2 class="sec">Аудитория</h2>';
  h += '<div class="card"><p style="font-size:14px">' + E(B.audience.core) + '</p></div>';
  h += '<div class="grid g3" style="margin-top:14px">';
  B.audience.segments.forEach(function (s) {
    h += '<div class="card"><div class="cap">' + E(s.share) + '</div><h4>' + E(s.n) + '</h4><p>' + E(s.d) + '</p></div>';
  });
  h += '</div>';
  h += '<div class="grid g2" style="margin-top:14px">'
    + '<div class="card"><div class="cap">Дополнительно наши</div>' + UI.beanList(B.audience.extra) + '</div>'
    + '<div class="card"><div class="cap" style="color:var(--danger)">Кто НЕ наша аудитория</div>' + UI.beanList(B.audience.notOurs) + '</div>'
    + '</div>';

  /* ── TONE OF VOICE ──────────────────────────────────────────── */
  h += '<h2 class="sec">Tone of Voice</h2>';
  h += '<div class="card"><h4>' + E(B.tov.rule) + '</h4>'
    + '<div style="margin-top:12px;display:flex;gap:20px;flex-wrap:wrap">'
    + '<div><div class="cap">Слова-опоры</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">'
    + B.tov.support.map(function (w) { return UI.chip(w, 'gold'); }).join('') + '</div></div>'
    + '<div><div class="cap">Слова-запреты</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">'
    + B.tov.forbidden.map(function (w) { return UI.chip(w, 'crit'); }).join('') + '</div></div>'
    + '</div></div>';

  h += '<div class="tablewrap" style="margin-top:14px"><table><thead><tr>'
    + '<th class="nosort">Не говорим</th><th class="nosort">Говорим</th></tr></thead><tbody>'
    + B.tov.pairs.map(function (p) {
      return '<tr><td style="color:var(--txt-3)">' + E(p.bad) + '</td><td><b>' + E(p.good) + '</b></td></tr>';
    }).join('') + '</tbody></table></div>';

  /* ── ЧЕГО НЕ ДЕЛАЕМ ─────────────────────────────────────────── */
  h += '<h2 class="sec">Что бренд никогда не будет делать</h2>';
  h += '<div class="card">' + UI.beanList(B.neverDo) + '</div>';

  /* ── ВИЗУАЛЬНЫЙ КОД ─────────────────────────────────────────── */
  h += '<h2 class="sec">Визуальный код</h2>';
  h += '<div class="card"><h4 style="font-size:16px">' + E(V.concept) + '</h4>'
    + '<p style="margin-top:10px;font-size:14px">' + E(V.law) + '</p>'
    + '<div style="margin-top:12px">' + UI.beanList(V.lawDetails) + '</div></div>';

  h += '<h3 class="sub3">Палитра</h3><div class="grid g6">';
  V.palette.forEach(function (p) {
    var light = p.hex === '#F7F3EC' || p.hex === '#FDE0A6' || p.hex === '#FACE79' || p.hex === '#F6B54B';
    h += '<div class="card" style="padding:0;overflow:hidden">'
      + '<div style="height:64px;background:' + p.hex + '"></div>'
      + '<div style="padding:10px"><h4 style="font-size:12px">' + E(p.n) + '</h4>'
      + '<p class="mono" style="font-size:10.5px;margin-top:4px">' + p.hex + '<br>' + E(p.rgb) + '<br>' + E(p.pms) + '</p></div></div>';
  });
  h += '</div>';
  h += '<div class="card" style="margin-top:12px">' + UI.beanList(V.colorRules) + '</div>';

  h += '<h3 class="sub3">Градиенты</h3>'
    + UI.table('brand-grad', [
      { key: 'id', label: 'ID', w: '80px' },
      { key: 'n', label: 'Название' },
      { key: 'spec', label: 'Спецификация' },
      { key: 'use', label: 'Где используется' }
    ], V.gradients);
  h += '<div class="card" style="margin-top:12px">' + UI.beanList(V.gradientRules) + '</div>';
  h += '<div class="card" style="margin-top:10px"><div class="cap" style="color:var(--danger)">Запрещённые сочетания</div>'
    + '<p>Золото → холодный · два не-соседа · диагональ 45° · конический / «мешLab»</p></div>';

  h += '<h3 class="sub3">Типографика</h3>'
    + UI.table('brand-type', [
      { key: 'lvl', label: 'Ур.', num: true, w: '50px' },
      { key: 'n', label: 'Уровень' },
      { key: 'font', label: 'Шрифт', render: function (r) { return '<b>' + E(r.font) + '</b><span class="sub-line">' + E(r.spec) + '</span>'; } },
      { key: 'use', label: 'Правило' }
    ], V.typography);
  h += '<div style="margin-top:12px">' + UI.table('brand-tsize', [
    { key: 'media', label: 'Носитель' }, { key: 'h', label: 'Заголовок' },
    { key: 't', label: 'Текст' }, { key: 'rule', label: 'Правило' }
  ], V.typeSizes) + '</div>';

  h += '<h3 class="sub3">Формы и графика</h3><div class="card">' + UI.beanList(V.forms) + '</div>';
  h += '<div class="grid gauto" style="margin-top:12px">';
  V.elements.forEach(function (el) { h += '<div class="card"><h4>' + E(el.n) + '</h4><p>' + E(el.d) + '</p></div>'; });
  h += '</div>';
  h += '<p class="note dim" style="margin-top:10px">' + E(V.noGraphics) + '</p>';

  h += '<h3 class="sub3">Motion</h3><div class="card">'
    + '<h4>' + E(V.motion.law) + '</h4><p style="margin-top:6px">' + E(V.motion.rhythm) + '</p>'
    + '<div style="margin-top:12px">' + UI.beanList(V.motion.specs) + '</div>'
    + '<p style="margin-top:12px;color:var(--danger)"><b>Запрещено:</b> ' + E(V.motion.forbidden) + '</p></div>';

  h += '<h3 class="sub3">Фотостиль · ' + E(V.photo.title) + '</h3><div class="grid g3">';
  V.photo.rules.forEach(function (r) { h += '<div class="card"><h4>' + E(r.n) + '</h4><p>' + E(r.d) + '</p></div>'; });
  h += '</div>';

  h += '<h3 class="sub3">3D</h3>' + UI.table('brand-3d', [
    { key: 'n', label: 'Материал', w: '160px' }, { key: 'd', label: 'Правило' }
  ], V.threeD);
  h += '<p class="note" style="margin-top:10px;color:var(--danger)">' + E(V.threeDflags) + '</p>';

  /* ── ПЯТЬ ЗАКОНОВ ───────────────────────────────────────────── */
  h += '<h2 class="sec">Пять законов приёмки</h2>';
  h += '<p class="note" style="margin-bottom:12px">Нарушение любого = макет не принят. Без исключений «в этот раз можно».</p>';
  h += '<div class="grid gauto">';
  V.laws.forEach(function (l) {
    h += '<div class="card"><h4>' + E(l.n) + '</h4><p>' + E(l.d) + '</p></div>';
  });
  h += '</div>';

  h += '<div class="grid g2" style="margin-top:14px">'
    + '<div class="card"><div class="cap">Тест «без логотипа»</div><p>' + E(V.testNoLogo) + '</p></div>'
    + '<div class="card"><div class="cap">Тест на полке</div><p>' + E(V.testShelf) + '</p></div>'
    + '</div>';

  h += '<h3 class="sub3" style="color:var(--danger)">Запрещено без обсуждения</h3>'
    + '<div class="card">' + UI.beanList(V.forbidden) + '</div>';

  h += '<div class="card" style="margin-top:12px"><div class="cap">Файлы, которые получает команда</div><p class="mono" style="font-size:12px">' + E(V.files) + '</p></div>';

  /* ── ТРИ БОЛЬШИЕ ИДЕИ ───────────────────────────────────────── */
  h += '<h2 class="sec">Три вещи, которые нельзя скопировать</h2><div class="grid g3">';
  V.bigIdeas.forEach(function (b) {
    h += '<div class="card"><h4>' + E(b.n) + '</h4>'
      + '<div class="cap" style="margin-top:10px">Почему работает</div><p>' + E(b.why) + '</p>'
      + '<div class="cap" style="margin-top:10px">Почему не скопируют</div><p>' + E(b.noCopy) + '</p></div>';
  });
  h += '</div>';

  /* ── МУДБОРД ────────────────────────────────────────────────── */
  h += '<h2 class="sec">Мудборд</h2><div class="card">' + UI.beanList(B.moodboard)
    + '<p style="margin-top:12px;color:var(--danger)">' + E(B.moodboardNever) + '</p></div>';

  /* ── ХАРАКТЕР ───────────────────────────────────────────────── */
  h += '<h2 class="sec">Характер бренда</h2>'
    + UI.table('brand-char', [
      { key: 'q', label: 'Если бы бренд был', w: '160px' },
      { key: 'a', label: '' }
    ], B.characterChecks);

  /* ── КОНКУРЕНТЫ ─────────────────────────────────────────────── */
  h += '<h2 class="sec">Конкуренты и наша ниша</h2>'
    + UI.table('brand-comp', [
      { key: 'n', label: 'Кто', w: '220px' },
      { key: 'weak', label: 'Их слабое место' },
      { key: 'us', label: 'Наше отличие' }
    ], B.competitors);

  h += '<h3 class="sub3">Карта визуальных территорий</h3><div class="grid g6">';
  B.categoryMap.forEach(function (m) {
    var us = m.n === 'BUMBLE';
    h += '<div class="card" style="' + (us ? 'border-color:var(--gold-rise)' : '') + '">'
      + '<h4 style="font-size:12px;' + (us ? 'color:var(--gold)' : '') + '">' + E(m.n) + '</h4>'
      + '<p style="font-size:11.5px">' + E(m.code) + '</p></div>';
  });
  h += '</div>';

  h += '<h3 class="sub3">Рынок</h3>' + UI.table('brand-mkt', [
    { key: 'n', label: 'Тренд', w: '220px' }, { key: 'v', label: 'Данные' }, { key: 'src', label: 'Источник', w: '220px' }
  ], B.market);

  /* ── ТЕЗИСЫ И СЛОГАНЫ ───────────────────────────────────────── */
  h += '<h2 class="sec">Десять тезисов, которые надо помнить</h2><div class="card">'
    + '<ol style="padding-left:20px;display:flex;flex-direction:column;gap:7px">'
    + B.tenTheses.map(function (t) { return '<li style="font-size:13.5px">' + E(t) + '</li>'; }).join('')
    + '</ol></div>';

  h += '<h2 class="sec">Карта смыслов и слоганы</h2><div class="grid gauto">';
  B.slogans.forEach(function (g) {
    h += '<div class="card"><div class="cap">' + E(g.g) + '</div>' + UI.beanList(g.items) + '</div>';
  });
  h += '</div>';

  /* ── ПИТЧИ ──────────────────────────────────────────────────── */
  h += '<h2 class="sec">Питчи</h2>';
  h += UI.acc('Elevator Pitch · до 40 слов', '<div class="prompt-box" id="p-elev">' + E(B.pitches.elevator) + '</div>'
    + '<div class="copybar"><button class="btn sm" data-copy="p-elev">Скопировать</button></div>', true);
  h += UI.acc('30 секунд', '<div class="prompt-box" id="p-30">' + E(B.pitches.sec30) + '</div>'
    + '<div class="copybar"><button class="btn sm" data-copy="p-30">Скопировать</button></div>');
  h += UI.acc('1 минута · менеджеру точки', '<div class="prompt-box" id="p-1">' + E(B.pitches.min1) + '</div>'
    + '<div class="copybar"><button class="btn sm" data-copy="p-1">Скопировать</button></div>');
  h += UI.acc('3 минуты · закупщику', '<div class="prompt-box" id="p-3">' + E(B.pitches.min3) + '</div>'
    + '<div class="copybar"><button class="btn sm" data-copy="p-3">Скопировать</button></div>');

  /* ── КОНТЕНТ-НАПРАВЛЕНИЯ ────────────────────────────────────── */
  h += '<h2 class="sec">Контент-направления</h2><div class="card">' + UI.beanList(B.contentDirections)
    + '<p style="margin-top:12px"><b>Принцип:</b> ' + E(B.contentPrinciple) + '</p></div>';

  /* ── РОСТ СИСТЕМЫ ───────────────────────────────────────────── */
  h += '<h2 class="sec">Как система растёт</h2><div class="grid g4">';
  V.growth.forEach(function (g) { h += '<div class="card"><h4>' + E(g.p) + '</h4><p>' + E(g.d) + '</p></div>'; });
  h += '</div>';

  h += '<div class="grid g2" style="margin-top:14px">'
    + '<div class="card"><div class="cap">Что можно менять</div>' + UI.beanList(V.canChange) + '</div>'
    + '<div class="card"><div class="cap" style="color:var(--danger)">Что менять нельзя никогда</div>' + UI.beanList(V.neverChange) + '</div>'
    + '</div>';

  h += '<h3 class="sub3">Честные риски системы</h3><div class="card">' + UI.beanList(V.risks) + '</div>';

  host.innerHTML = h;
  UI.bindCopy(host);
});
