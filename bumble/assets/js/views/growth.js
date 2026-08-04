/* ═══ GROWTH ENGINE ════════════════════════════════════════════════ */
(function () {
  var E = BOS.esc;
  var generated = [];

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /** Комбинаторная генерация гипотез по осям. Дубликаты отсекаются. */
  function generate(n) {
    var A = REF.growthAxes, out = [], seen = {};
    var guard = 0;
    while (out.length < n && guard < n * 40) {
      guard++;
      var l = pick(A.lever), s = pick(A.segment), c = pick(A.channel), m = pick(A.mechanic), me = pick(A.metric);
      var key = l + '|' + s + '|' + m;
      if (seen[key]) continue;
      seen[key] = 1;
      out.push({
        text: 'Если мы ' + l + ' для ' + s + ' ' + c + ' ' + m + ', то вырастет ' + me + '.',
        lever: l, segment: s, channel: c, mechanic: m, metric: me,
        impact: 3 + Math.floor(Math.random() * 7),
        ease: 3 + Math.floor(Math.random() * 7),
        speed: 3 + Math.floor(Math.random() * 7),
        cost: 1 + Math.floor(Math.random() * 8)
      });
    }
    return out;
  }

  BOS.route('growth', function (host) {
    var view = UI.fval('gr-v', 'v', 'banks');
    var bank = UI.fval('gr-b', 'b', 'hypo');

    var h = UI.head({
      eyebrow: 'Growth Engine',
      title: 'Машина идей',
      sub: 'Две части. Курируемые банки — идеи, уже прошедшие фильтр бренда, их можно брать сегодня. ' +
        'Генератор — комбинаторика по осям: он не заменяет голову, но показывает сочетания, ' +
        'до которых руки не доходят.'
    });

    /* ── НОРМА НЕДЕЛИ ───────────────────────────────────────────── */
    h += '<h2 class="sec">Норма недели</h2>';
    h += '<p class="note" style="margin-bottom:12px">Норма — ориентир, а не долг. В работу уходит десять идей в неделю, ' +
      'не больше: непроработанные идеи создают иллюзию работы и обесценивают сам инструмент. ' +
      'Мерим не число идей, а число запущенных и число сработавших.</p>';
    h += '<div class="grid g4">';
    REF.growthQuotas.forEach(function (q) {
      var have = (REF.growthBanks[q.id] || []).length;
      h += '<div class="card"><div class="cap">' + E(q.n) + '</div>'
        + '<div class="kpi-val mono" style="font-size:22px">' + q.target + '</div>'
        + '<p class="dim">в банке готовых: ' + have + '</p>'
        + '<div class="bar"><i style="width:' + BOS.clamp(Math.round(have / q.target * 100), 0, 100) + '%"></i></div></div>';
    });
    h += '</div>';

    h += UI.filters('gr-v', [{
      type: 'seg', key: 'v', def: 'banks', options: [
        { v: 'banks', l: 'Банки идей' }, { v: 'gen', l: 'Генератор гипотез' }, { v: 'axes', l: 'Оси' }
      ]
    }]);

    if (view === 'banks') {
      h += UI.filters('gr-b', [{
        type: 'seg', key: 'b', def: 'hypo',
        options: REF.growthQuotas.map(function (q) { return { v: q.id, l: q.n.replace(/^Идей |^Механик |^Способов /, '') }; })
      }]);

      var items = REF.growthBanks[bank] || [];
      var qname = '';
      REF.growthQuotas.forEach(function (q) { if (q.id === bank) qname = q.n; });

      h += '<h2 class="sec">' + E(qname) + ' · ' + items.length + '</h2>';
      h += '<div class="tablewrap"><table><thead><tr>'
        + '<th class="nosort" style="width:44px">№</th><th class="nosort">Идея</th>'
        + '<th class="nosort" style="width:140px">Действие</th></tr></thead><tbody>'
        + items.map(function (it, i) {
          return '<tr><td class="mono dim">' + (i + 1) + '</td><td>' + E(it) + '</td>'
            + '<td><button class="btn sm" data-toidea="' + i + '" data-bank="' + bank + '">В центр идей</button></td></tr>';
        }).join('') + '</tbody></table></div>';

    } else if (view === 'gen') {
      h += '<h2 class="sec">Генератор гипотез</h2>';
      h += '<div class="card" style="margin-bottom:14px">'
        + '<p class="note">Гипотезы собираются из четырёх осей: рычаг × сегмент × канал × механика. '
        + 'Часть выйдет бессмысленной — это нормально и даже полезно: абсурдные сочетания отсеиваются за секунду, '
        + 'а одно из двадцати оказывается тем, о чём никто не подумал. Оценки проставлены случайно как стартовая точка — '
        + 'исправьте их руками, иначе сортировка ничего не значит.</p>'
        + '<div style="display:flex;gap:9px;margin-top:12px;flex-wrap:wrap">'
        + '<button class="btn-gold" data-gen="20">Сгенерировать 20</button>'
        + '<button class="btn" data-gen="50">50</button>'
        + '<button class="btn" data-gen="100">100</button>'
        + (generated.length ? '<button class="btn" id="gen-clear">Очистить</button>' : '')
        + '</div></div>';

      if (generated.length) {
        var scored = generated.map(function (g, i) {
          return Object.assign({ id: 'g' + i, score: Math.round(g.impact * g.ease * g.speed / 10) }, g);
        }).sort(function (a, b) { return b.score - a.score; });

        h += '<p class="note dim" style="margin-bottom:10px">' + generated.length + ' гипотез, отсортированы по оценке. '
          + 'Топ-10 стоит разобрать вручную, остальное — просмотреть по диагонали.</p>';
        h += UI.table('gr-gen', [
          { key: 'text', label: 'Гипотеза' },
          { key: 'impact', label: 'Влияние', num: true, w: '85px' },
          { key: 'ease', label: 'Простота', num: true, w: '85px' },
          { key: 'speed', label: 'Скорость', num: true, w: '85px' },
          { key: 'cost', label: 'Стоимость', num: true, w: '90px' },
          { key: 'score', label: 'Оценка', num: true, w: '80px', render: function (r) { return '<b style="color:' + (r.score >= 70 ? 'var(--gold)' : 'inherit') + '">' + r.score + '</b>'; } },
          { key: 'act', label: '', w: '120px', render: function (r) { return '<button class="btn sm" data-genidea="' + E(r.text) + '">В идеи</button>'; } }
        ], scored);
      } else {
        h += UI.empty('Гипотез пока нет. Нажмите «Сгенерировать» выше.');
      }

    } else {
      h += '<h2 class="sec">Оси генератора</h2>';
      h += '<p class="note" style="margin-bottom:14px">Это словарь, из которого собираются гипотезы. ' +
        'Пополняйте его — чем богаче оси, тем осмысленнее сочетания. ' +
        'Оси редактируются в файле <span class="mono">assets/js/data/growth.js</span>.</p>';
      h += '<div class="grid g2">';
      [
        { k: 'lever', n: 'Рычаг — что именно меняем' },
        { k: 'segment', n: 'Сегмент — для кого' },
        { k: 'channel', n: 'Канал — где' },
        { k: 'mechanic', n: 'Механика — через что' },
        { k: 'metric', n: 'Метрика — что должно вырасти' }
      ].forEach(function (a) {
        h += '<div class="card"><div class="cap">' + REF.growthAxes[a.k].length + ' значений</div>'
          + '<h4>' + E(a.n) + '</h4><div style="margin-top:10px;display:flex;gap:5px;flex-wrap:wrap">'
          + REF.growthAxes[a.k].map(function (v) { return UI.chip(v); }).join('') + '</div></div>';
      });
      h += '</div>';

      var combos = REF.growthAxes.lever.length * REF.growthAxes.segment.length
        * REF.growthAxes.channel.length * REF.growthAxes.mechanic.length;
      h += '<div class="card" style="margin-top:14px"><div class="cap">Пространство комбинаций</div>'
        + '<div class="kpi-val mono">' + combos.toLocaleString('ru-RU') + '</div>'
        + '<p style="margin-top:8px">уникальных сочетаний. Идей никогда не будет не хватать — ' +
        'не хватать будет рук, поэтому и держим правило десяти в неделю.</p></div>';
    }

    host.innerHTML = h;

    /* обработчики */
    host.querySelectorAll('[data-gen]').forEach(function (b) {
      b.onclick = function () {
        generated = generate(Number(b.getAttribute('data-gen')));
        UI.toast(generated.length + ' гипотез готово');
        BOS.render();
      };
    });
    var clr = document.getElementById('gen-clear');
    if (clr) clr.onclick = function () { generated = []; BOS.render(); };

    host.querySelectorAll('[data-toidea]').forEach(function (b) {
      b.onclick = function () {
        var bk = b.getAttribute('data-bank');
        var idx = Number(b.getAttribute('data-toidea'));
        var text = REF.growthBanks[bk][idx];
        var catMap = {
          hypo: 'raw', viral: 'viral', collab: 'collab', pr: 'pr', offline: 'offline',
          sales: 'sales', retail: 'retail', retention: 'promo', check: 'sales', brand: 'promo'
        };
        BOS.upsert('ideas', {
          title: text, cat: catMap[bk] || 'raw', status: 'new',
          impact: 6, confidence: 5, ease: 5, effort: 3, reach: 5000,
          effect: 'Из Growth Engine, банк «' + bk + '». Оценку нужно уточнить.',
          owner: 'cmo'
        });
        UI.toast('Добавлено в Центр идей');
      };
    });

    host.querySelectorAll('[data-genidea]').forEach(function (b) {
      b.onclick = function () {
        BOS.upsert('ideas', {
          title: b.getAttribute('data-genidea'), cat: 'raw', status: 'new',
          impact: 5, confidence: 4, ease: 5, effort: 3, reach: 3000,
          effect: 'Сгенерировано Growth Engine. Оценка требует проверки человеком.',
          owner: 'cmo'
        });
        UI.toast('Добавлено в Центр идей');
      };
    });
  });
})();
