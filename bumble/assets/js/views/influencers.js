/* ═══ ИНФЛЮЕНСЕРЫ · CRM, скоринг, пайплайн, амбассадоры ════════════ */
(function () {
  var E = BOS.esc;

  function stName(id) { var n = id; REF.inflStatuses.forEach(function (s) { if (s.id === id) n = s.n; }); return n; }
  function tierName(id) { var n = id; REF.tiers.forEach(function (t) { if (t.id === id) n = t.n; }); return n; }

  function inflModal(id) {
    var i = id ? BOS.find('influencers', id) : null;
    var isNew = !i;
    i = i || { tier: 'micro', status: 'found', score: 0, sent: false, published: false };

    var body =
      '<div class="frow">'
      + '<div class="field"><label>Имя / ник</label><input id="n-name" value="' + E(i.name || '') + '"></div>'
      + '<div class="field"><label>Ссылка</label><input id="n-link" value="' + E(i.link || '') + '"></div>'
      + '</div>'
      + '<div class="frow">'
      + '<div class="field"><label>Тир</label><select id="n-tier">'
      + REF.tiers.map(function (t) { return '<option value="' + t.id + '"' + (i.tier === t.id ? ' selected' : '') + '>' + E(t.n + ' · ' + t.reach) + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="field"><label>Категория</label><select id="n-cat">'
      + REF.inflCategories.map(function (c) { return '<option value="' + E(c.n) + '"' + (i.cat === c.n ? ' selected' : '') + '>' + E(c.n) + (c.prio ? ' ★' : '') + '</option>'; }).join('')
      + '</select></div>'
      + '</div>'
      + '<div class="frow">'
      + '<div class="field"><label>Подписчиков</label><input type="number" id="n-fol" value="' + E(i.followers || '') + '"></div>'
      + '<div class="field"><label>Средний охват</label><input type="number" id="n-reach" value="' + E(i.reach || '') + '"></div>'
      + '</div>'
      + '<div class="frow">'
      + '<div class="field"><label>ER, %</label><input type="number" step="0.1" id="n-er" value="' + E(i.er || '') + '"></div>'
      + '<div class="field"><label>Скор 0–100</label><input type="number" min="0" max="100" id="n-score" value="' + E(i.score || 0) + '"></div>'
      + '</div>'
      + '<div class="field"><label>Аудитория</label><input id="n-aud" value="' + E(i.audience || '') + '" placeholder="18–30, М 60%, Москва+СПб"></div>'
      + '<div class="frow">'
      + '<div class="field"><label>Стоимость, ₽</label><input type="number" id="n-price" value="' + E(i.price || 0) + '"></div>'
      + '<div class="field"><label>Контакт</label><input id="n-contact" value="' + E(i.contact || '') + '"></div>'
      + '</div>'
      + '<div class="frow">'
      + '<div class="field"><label>Статус</label><select id="n-status">'
      + REF.inflStatuses.map(function (s) { return '<option value="' + s.id + '"' + (i.status === s.id ? ' selected' : '') + '>' + E(s.n) + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="field"><label>Промокод</label><input id="n-promo" value="' + E(i.promo || '') + '" placeholder="BUMBLE + ник"></div>'
      + '</div>'
      + '<div class="field"><label><input type="checkbox" id="n-sent" style="width:auto;margin-right:8px"' + (i.sent ? ' checked' : '') + '> Продукт отправлен</label></div>'
      + '<div class="field"><label><input type="checkbox" id="n-pub" style="width:auto;margin-right:8px"' + (i.published ? ' checked' : '') + '> Опубликовано</label></div>'
      + '<div class="field"><label>Результат публикации</label><input id="n-result" value="' + E(i.result || '') + '" placeholder="Охват, сохранения, переходы"></div>'
      + '<div class="frow">'
      + '<div class="field"><label>ROI</label><input type="number" step="0.1" id="n-roi" value="' + E(i.roi || '') + '"></div>'
      + '<div class="field"><label>Применений промокода</label><input type="number" id="n-promoused" value="' + E(i.promoUsed || '') + '"></div>'
      + '</div>'
      + '<div class="field"><label>Заметки</label><textarea id="n-notes">' + E(i.notes || '') + '</textarea></div>';

    var foot = (isNew ? '' : '<button class="btn danger sm" id="n-del">Удалить</button>')
      + '<button class="btn" data-close>Отмена</button><button class="btn-gold" id="n-save">Сохранить</button>';

    UI.modal(isNew ? 'Новый инфлюенсер' : (i.name || 'Инфлюенсер'), body, foot, function () {
      document.getElementById('n-save').onclick = function () {
        var v = function (x) { var el = document.getElementById(x); return el ? el.value : ''; };
        BOS.upsert('influencers', Object.assign({}, i, {
          name: v('n-name') || 'Без имени', link: v('n-link'), tier: v('n-tier'), cat: v('n-cat'),
          followers: Number(v('n-fol')) || 0, reach: Number(v('n-reach')) || 0, er: Number(v('n-er')) || 0,
          score: Number(v('n-score')) || 0, audience: v('n-aud'), price: Number(v('n-price')) || 0,
          contact: v('n-contact'), status: v('n-status'), promo: v('n-promo'),
          sent: document.getElementById('n-sent').checked,
          published: document.getElementById('n-pub').checked,
          result: v('n-result'), roi: Number(v('n-roi')) || 0,
          promoUsed: Number(v('n-promoused')) || 0, notes: v('n-notes')
        }));
        UI.closeModal(); UI.toast('Сохранено'); BOS.render();
      };
      var del = document.getElementById('n-del');
      if (del) del.onclick = function () {
        if (confirm('Удалить карточку?')) { BOS.remove('influencers', i.id); UI.closeModal(); BOS.render(); }
      };
    });
  }

  BOS.route('influencers', function (host) {
    var all = BOS.all('influencers');
    var view = UI.fval('inf-v', 'v', 'crm');

    var h = UI.head({
      eyebrow: 'Инфлюенсеры',
      title: 'CRM и работа с блогерами',
      sub: 'Цель — не охват любой ценой, а совпадение по образу жизни. ' +
        'Цепочка отбор → outreach → бокс → контент по брифу → UGC → амбассадорство работает только целиком: ' +
        'разорвёшь звено — маховик встанет.'
    });

    h += UI.filters('inf-v', [{
      type: 'seg', key: 'v', def: 'crm', options: [
        { v: 'crm', l: 'База' }, { v: 'pipe', l: 'Пайплайн' }, { v: 'score', l: 'Скоринг' },
        { v: 'out', l: 'Outreach' }, { v: 'amb', l: 'Амбассадоры' }, { v: 'box', l: 'PR-бокс и бриф' }
      ]
    }]);

    if (view === 'crm') {
      var published = all.filter(function (i) { return i.published; });
      var avgScore = all.length ? Math.round(all.reduce(function (s, i) { return s + BOS.num(i.score, 0); }, 0) / all.length) : 0;
      var spent = all.reduce(function (s, i) { return s + BOS.num(i.price, 0); }, 0);
      var reach = published.reduce(function (s, i) { return s + BOS.num(i.reach, 0); }, 0);

      h += '<div class="grid g4 rise rise-1">';
      h += UI.kpi({ label: 'В базе', value: all.length, foot: 'Цель к неделе 2: 200', pct: Math.round(all.length / 200 * 100) });
      h += UI.kpi({ label: 'Публикаций', value: published.length, foot: 'Цель месяца: 20', pct: Math.round(published.length / 20 * 100), hot: true });
      h += UI.kpi({ label: 'Средний скор базы', value: avgScore, foot: 'Берём от 60' });
      h += UI.kpi({ label: 'CPM интеграций', value: reach ? Math.round(spent / (reach / 1000)) + ' ₽' : '—', foot: 'Потрачено: ' + BOS.fmtNum(spent) + ' ₽' });
      h += '</div>';

      var q = UI.fval('inf-f', 'q', '').toLowerCase();
      var fs = UI.fval('inf-f', 'st', '');
      var ft = UI.fval('inf-f', 'tier', '');
      var rows = all.filter(function (i) {
        if (fs && i.status !== fs) return false;
        if (ft && i.tier !== ft) return false;
        if (q && (i.name + ' ' + (i.notes || '')).toLowerCase().indexOf(q) < 0) return false;
        return true;
      });

      h += '<h2 class="sec">База</h2>';
      h += UI.filters('inf-f', [
        { type: 'search', key: 'q', placeholder: 'Поиск' },
        { key: 'st', options: [{ v: '', l: 'Все статусы' }].concat(REF.inflStatuses.map(function (s) { return { v: s.id, l: s.n }; })) },
        { key: 'tier', options: [{ v: '', l: 'Все тиры' }].concat(REF.tiers.map(function (t) { return { v: t.id, l: t.n }; })) }
      ]);
      h += '<div class="filters"><button class="btn-gold" id="n-add">+ Инфлюенсер</button></div>';

      h += UI.table('inf-tbl', [
        { key: 'name', label: 'Кто', render: function (r) { return '<b>' + E(r.name) + '</b><span class="sub-line">' + E(r.cat || '') + '</span>'; } },
        { key: 'tier', label: 'Тир', w: '90px', render: function (r) { return UI.chip(tierName(r.tier)); } },
        { key: 'followers', label: 'Подпис.', num: true, w: '90px', render: function (r) { return BOS.fmtNum(r.followers); } },
        { key: 'reach', label: 'Охват', num: true, w: '85px', render: function (r) { return BOS.fmtNum(r.reach); } },
        { key: 'er', label: 'ER', num: true, w: '65px', render: function (r) { return r.er ? r.er + '%' : '—'; } },
        {
          key: 'score', label: 'Скор', num: true, w: '70px', render: function (r) {
            var c = r.score >= 80 ? 'var(--gold)' : (r.score < 40 ? 'var(--danger)' : 'inherit');
            return '<b style="color:' + c + '">' + (r.score || '—') + '</b>';
          }
        },
        { key: 'price', label: 'Цена', num: true, w: '90px', render: function (r) { return r.price ? BOS.fmtNum(r.price) + ' ₽' : 'бартер'; } },
        { key: 'status', label: 'Статус', w: '130px', render: function (r) { return UI.chip(stName(r.status)); } },
        { key: 'roi', label: 'ROI', num: true, w: '65px', render: function (r) { return r.roi ? r.roi : '—'; } }
      ], rows, function (id) { inflModal(id); });

      h += '<h2 class="sec">Бюджетный микс по тирам</h2>';
      h += UI.table('inf-tiers', [
        { key: 'n', label: 'Тир', w: '110px', render: function (r) { return '<b>' + E(r.n) + '</b>'; } },
        { key: 'reach', label: 'Охват', w: '120px' },
        { key: 'role', label: 'Роль в миксе' },
        { key: 'format', label: 'Формат', w: '160px' },
        { key: 'budget', label: 'Доля бюджета', w: '120px', render: function (r) { return '<b class="mono">' + E(r.budget) + '</b>'; } }
      ], REF.tiers);

      h += '<div class="grid g2" style="margin-top:14px">'
        + '<div class="card"><div class="cap">Кого ищем</div>' + UI.beanList(REF.inflWho.yes) + '</div>'
        + '<div class="card"><div class="cap" style="color:var(--danger)">Кого не берём никогда</div>' + UI.beanList(REF.inflWho.no) + '</div>'
        + '</div>';

      h += '<h2 class="sec">Приоритетные категории</h2><div class="grid gauto">';
      REF.inflCategories.forEach(function (c) {
        h += '<div class="card" style="' + (c.prio ? 'border-color:var(--gold-rise)' : '') + '"><h4 style="font-size:12.5px">'
          + E(c.n) + (c.prio ? ' ★' : '') + '</h4></div>';
      });
      h += '</div>';
      h += '<p class="note dim" style="margin-top:10px">★ — прямое попадание в три ядра (спорт / студенты / работа-город). ' +
        'Food и Coffee — точечно, только в холодной clean-подаче.</p>';

    } else if (view === 'pipe') {
      h += '<h2 class="sec">Пайплайн от поиска до публикации</h2>';
      h += '<div class="steps">' + REF.inflPipeline.map(function (s, idx) {
        return '<div class="step"><div class="step-n">' + (idx + 1) + '</div><div class="step-b">'
          + '<h4>' + E(s.n) + '</h4><p>' + E(s.d) + '</p>'
          + '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">'
          + UI.chip(s.owner) + UI.chip(s.dl) + UI.chip('Контроль: ' + s.qc, 'gold')
          + '</div></div></div>';
      }).join('') + '</div>';

      h += '<h2 class="sec">Где сейчас база</h2><div class="grid gauto">';
      REF.inflStatuses.forEach(function (s) {
        var n = all.filter(function (i) { return i.status === s.id; }).length;
        h += '<div class="card"><div class="cap">' + E(s.n) + '</div><div class="kpi-val mono" style="font-size:24px">' + n + '</div></div>';
      });
      h += '</div>';

    } else if (view === 'score') {
      h += '<h2 class="sec">Чек-лист отбора · 100+ критериев</h2>';
      h += '<div class="card"><p><b>' + E(REF.inflScoring.rule) + '</b></p>'
        + '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">'
        + REF.inflScoring.verdict.map(function (v) {
          return '<div class="chip ' + (v.r === '80–100' ? 'gold' : (v.r === '<40' ? 'crit' : '')) + '">' + E(v.r + ' · ' + v.v) + '</div>';
        }).join('') + '</div></div>';

      h += '<div class="grid g2" style="margin-top:14px">';
      REF.inflScoring.blocks.forEach(function (b) {
        h += '<div class="card"><div class="cap">Вес ×' + b.w + '</div><h4>' + E(b.n) + '</h4>'
          + '<div style="margin-top:8px">' + b.q.map(function (q) {
            return '<label style="display:flex;gap:8px;align-items:flex-start;padding:3px 0;font-size:12.5px;color:var(--txt-2)">'
              + '<input type="checkbox" style="margin-top:3px;width:auto"> ' + E(q) + '</label>';
          }).join('') + '</div></div>';
      });
      h += '</div>';
      h += '<p class="note dim" style="margin-top:12px">Галочки не сохраняются — чек-лист проходится заново для каждого блогера. ' +
        'Итоговый балл вносится в карточку в разделе «База».</p>';

    } else if (view === 'out') {
      h += '<h2 class="sec">Шаблоны первого касания и сопровождения</h2>';
      h += '<div class="card" style="margin-bottom:14px"><div class="cap">Правила тона</div>' + UI.beanList(REF.brand.tov.outreachRules) + '</div>';
      REF.outreach.forEach(function (o, idx) {
        h += UI.acc(o.when + ' · ' + o.ch,
          '<div class="prompt-box" id="out-' + idx + '">' + E(o.text) + '</div>'
          + '<div class="copybar"><button class="btn sm" data-copy="out-' + idx + '">Скопировать</button></div>');
      });

    } else if (view === 'amb') {
      h += '<h2 class="sec">Уровни амбассадорства</h2><div class="grid g4">';
      REF.ambassadors.forEach(function (a) {
        h += '<div class="card"><div class="cap">' + E(a.sub) + '</div><h4 style="font-size:16px">' + E(a.lvl) + '</h4>'
          + '<p style="margin-top:8px"><b>Вход:</b> ' + E(a.enter) + '</p>'
          + '<p style="margin-top:6px"><b>Бонус:</b> ' + E(a.bonus) + '</p></div>';
      });
      h += '</div>';
      h += '<h2 class="sec">Мотивация</h2><div class="card">' + UI.beanList(REF.ambassadorMotivation) + '</div>';

      var amb = all.filter(function (i) { return i.status === 'ambassador'; });
      h += '<h2 class="sec">Действующие амбассадоры · ' + amb.length + '</h2>';
      h += amb.length
        ? UI.table('amb-tbl', [
          { key: 'name', label: 'Кто' },
          { key: 'tier', label: 'Тир', render: function (r) { return UI.chip(tierName(r.tier)); } },
          { key: 'score', label: 'Скор', num: true },
          { key: 'result', label: 'Результат' }
        ], amb, function (id) { inflModal(id); })
        : UI.empty('Пока никого. Первого амбассадора берём из тех, у кого скор ≥80 и есть успешная публикация.');

    } else {
      /* PR-BOX и Content Brief */
      h += '<h2 class="sec">PR Box</h2><div class="grid g3">';
      REF.prBox.spec.forEach(function (s) { h += '<div class="card"><h4>' + E(s.n) + '</h4><p>' + E(s.d) + '</p></div>'; });
      h += '</div>';
      h += '<p class="note" style="margin-top:12px"><b>Правило:</b> ' + E(REF.prBox.rule) + '</p>';

      h += '<h2 class="sec">Welcome Kit</h2><div class="grid g3">'
        + '<div class="card"><div class="cap">Состав</div>' + UI.beanList(REF.welcomeKit.content) + '</div>'
        + '<div class="card"><div class="cap">Опыт распаковки</div>' + UI.beanList(REF.welcomeKit.unboxing) + '</div>'
        + '<div class="card"><div class="cap">Эмоция</div><p>' + E(REF.welcomeKit.emotion) + '</p></div>'
        + '</div>';

      h += '<h2 class="sec">Content Brief для блогеров</h2>';
      h += '<div class="grid g2">'
        + '<div class="card"><div class="cap">Обязательно показать</div>' + UI.beanList(REF.contentBrief.must)
        + '<div class="cap" style="margin-top:14px">Как держать банку</div><p>' + E(REF.contentBrief.how) + '</p></div>'
        + '<div class="card"><div class="cap">Фон, свет, монтаж</div>' + UI.beanList(REF.contentBrief.tech)
        + '<div class="cap" style="margin-top:14px;color:var(--danger)">Нельзя</div>' + UI.beanList(REF.contentBrief.never) + '</div>'
        + '</div>';
      h += '<div class="card" style="margin-top:14px">'
        + '<div class="cap">Слова-опоры</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">'
        + REF.contentBrief.words.map(function (w) { return UI.chip(w, 'gold'); }).join('') + '</div>'
        + '<div class="cap" style="margin-top:14px">Слова-запреты</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">'
        + REF.contentBrief.banned.map(function (w) { return UI.chip(w, 'crit'); }).join('') + '</div>'
        + '<p style="margin-top:14px"><b>Эмоция кадра:</b> ' + E(REF.contentBrief.emotion) + '</p></div>';
    }

    host.innerHTML = h;
    var add = document.getElementById('n-add');
    if (add) add.onclick = function () { inflModal(null); };
    UI.bindCopy(host);
  });
})();
