/* ═══ ПЛАНИРОВАНИЕ ═════════════════════════════════════════════════ */
BOS.route('planning', function (host) {
  var E = BOS.esc;
  var view = UI.fval('pl-v', 'v', 'day');
  var open = BOS.openTasks();

  var h = UI.head({
    eyebrow: 'Планирование',
    title: 'От дня до года',
    sub: 'Планы собираются из задач автоматически. Правило одно: если задача не попала в план, ' +
      'её не существует — значит, либо ставим срок, либо честно убираем в бэклог.'
  });

  h += UI.filters('pl-v', [{
    type: 'seg', key: 'v', def: 'day', options: [
      { v: 'day', l: 'День' }, { v: 'week', l: 'Неделя' }, { v: 'month', l: 'Месяц' },
      { v: 'quarter', l: 'Квартал' }, { v: 'year', l: 'Год' },
      { v: 'eisen', l: 'Эйзенхауэр' }, { v: 'method', l: 'Методологии' }
    ]
  }]);

  function taskCards(arr, emptyText) {
    if (!arr.length) return '<div class="card"><p class="dim">' + E(emptyText) + '</p></div>';
    return '<div class="tablewrap"><table><thead><tr>'
      + '<th class="nosort">Задача</th><th class="nosort" style="width:130px">Кто</th>'
      + '<th class="nosort" style="width:95px">Приор.</th><th class="nosort" style="width:120px">Срок</th>'
      + '<th class="nosort num" style="width:55px">Ч</th></tr></thead><tbody>'
      + arr.map(function (t) {
        return '<tr class="rowlink" data-t="' + E(t.id) + '"><td><b>' + E(t.title) + '</b>'
          + '<span class="sub-line">' + E(t.module || '') + (t.goal ? ' · ' + E(t.goal) : '') + '</span></td>'
          + '<td>' + E(UI.who(t.assignee)) + '</td>'
          + '<td>' + UI.prChip(t.priority) + '</td>'
          + '<td>' + UI.due(t.due) + '</td>'
          + '<td class="num mono">' + (t.hours || 0) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  if (view === 'day') {
    var today = BOS.dueToday();
    var over = BOS.overdue();
    var noDate = open.filter(function (t) { return !t.due && t.status !== 'backlog'; });

    h += '<h2 class="sec">План на сегодня · ' + BOS.fmtDate(BOS.today()) + '</h2>';
    if (over.length) {
      h += '<div class="card" style="border-color:var(--danger);margin-bottom:14px">'
        + '<div class="cap" style="color:var(--danger)">Сначала это · ' + over.length + '</div>'
        + '<p>Просроченное разбирается до начала нового. Либо делаем, либо переносим срок осознанно, ' +
        'либо закрываем — но не оставляем висеть.</p></div>';
      h += taskCards(over, '');
    }
    h += '<h3 class="sub3">С дедлайном сегодня</h3>' + taskCards(today, 'На сегодня задач с дедлайном нет. Возьмите следующее по приоритету из недели.');

    REF.team.forEach(function (p) {
      var mine = today.concat(over).filter(function (t) { return t.assignee === p.key; });
      var hrs = mine.reduce(function (s, t) { return s + BOS.num(t.hours, 0); }, 0);
      h += '<h3 class="sub3">' + E(UI.who(p.key)) + ' · ' + hrs + ' ч на сегодня'
        + (hrs > 8 ? ' <span class="chip sm crit">не поместится в день</span>' : '') + '</h3>';
      h += '<div class="card"><div class="cap">Ежедневные ритуалы</div>' + UI.beanList(p.rituals.day) + '</div>';
    });

    if (noDate.length) {
      h += '<h2 class="sec">Без срока · ' + noDate.length + '</h2>';
      h += '<p class="note" style="margin-bottom:12px">Задача без даты не выполняется — она просто существует. ' +
        'Поставьте срок или верните в бэклог.</p>' + taskCards(noDate, '');
    }

  } else if (view === 'week') {
    var week = BOS.dueWithin(7);
    h += '<h2 class="sec">Ближайшие 7 дней · ' + week.length + ' задач</h2>';
    h += '<div class="grid g3" style="margin-bottom:16px">';
    REF.team.forEach(function (p) {
      var hrs = BOS.load7(p.key), pct = Math.round(hrs / p.capacityWeek * 100);
      h += '<div class="card"><div class="cap">' + E(UI.who(p.key)) + '</div>'
        + '<div class="kpi-val mono" style="font-size:20px">' + hrs + ' / ' + p.capacityWeek + ' ч</div>'
        + '<div class="bar' + (pct > 100 ? ' over' : '') + '"><i style="width:' + BOS.clamp(pct, 0, 100) + '%"></i></div></div>';
    });
    h += '</div>';
    h += taskCards(BOS.sortBy(week, 'due', 'asc'), 'Неделя пустая — это тоже сигнал.');

    h += '<h2 class="sec">Недельные ритуалы</h2><div class="grid g3">';
    REF.team.forEach(function (p) {
      h += '<div class="card"><div class="cap">' + E(UI.who(p.key)) + '</div>' + UI.beanList(p.rituals.week) + '</div>';
    });
    h += '</div>';

    h += '<h2 class="sec">Сетка контента на неделю</h2><div class="grid gauto">';
    REF.weekGrid.forEach(function (d) {
      h += '<div class="card"><div class="cap">' + E(d.day) + '</div>' + UI.beanList(d.slots) + '</div>';
    });
    h += '</div>';

  } else if (view === 'month') {
    var month = BOS.dueWithin(30);
    h += '<h2 class="sec">Месяц · ' + month.length + ' задач</h2>' + taskCards(BOS.sortBy(month, 'due', 'asc'), 'Месяц не распланирован.');
    h += '<h2 class="sec">Месячные ритуалы</h2><div class="grid g3">';
    REF.team.forEach(function (p) {
      h += '<div class="card"><div class="cap">' + E(UI.who(p.key)) + '</div>' + UI.beanList(p.rituals.month) + '</div>';
    });
    h += '</div>';

  } else if (view === 'quarter') {
    h += '<h2 class="sec">Квартальные OKR</h2>';
    h += '<p class="note" style="margin-bottom:14px">Objective — состояние, а не задача. Key Result — цифра с датой. ' +
      'Если KR нельзя проверить одним числом, это не KR.</p>';
    h += '<div class="grid g3">';
    [
      {
        o: 'Bumble узнают на полке без логотипа',
        krs: ['Тест «без логотипа»: 3 из 5 узнают бренд', 'Совокупный охват собственных каналов ≥ 500K / мес', '100+ UGC за квартал', 'Мерч-линия в тираже и на людях']
      },
      {
        o: 'Инфлюенсер-маховик работает без ручного толкания',
        krs: ['База 200+ с посчитанным скором', '20 публикаций в месяц', '20 активных амбассадоров', 'CPM интеграции ниже среднего по рынку', 'У 100% блогеров персональный промокод']
      },
      {
        o: 'Продукт легко купить там, где он нужен',
        krs: ['+30 активных точек', 'Полный фейсинг из 6 вкусов в 70% точек', 'POS в 100% точек', 'Вход в первую сеть']
      }
    ].forEach(function (okr) {
      h += '<div class="card"><div class="cap">Objective</div><h4>' + E(okr.o) + '</h4>'
        + '<div class="cap" style="margin-top:12px">Key Results</div>' + UI.beanList(okr.krs) + '</div>';
    });
    h += '</div>';

    h += '<h2 class="sec">Что НЕ делаем в этом квартале</h2>';
    h += '<div class="card"><p class="note" style="margin-bottom:10px">Список отказов важнее списка целей: он и есть то, ' +
      'что делает цели достижимыми при команде из трёх человек.</p>'
      + UI.beanList([
        'Не запускаем длинные видео на YouTube — только Shorts как переупаковка',
        'Не расширяем линейку — сначала выжимаем шесть существующих вкусов',
        'Не выходим в новые города, пока не отработана механика в текущем',
        'Не берём Macro и Celebrity блогеров — сначала научимся на Micro',
        'Не строим большой сайт — хватает профиля и карты точек'
      ]) + '</div>';

    h += '<h2 class="sec">Roadmap внедрения системы</h2>';
    h += UI.table('pl-road', [
      { key: 'p', label: 'Период', w: '130px', render: function (r) { return '<b>' + E(r.p) + '</b>'; } },
      { key: 'what', label: 'Что внедряем' },
      { key: 'owner', label: 'Кто', w: '140px', render: function (r) { return E(UI.who(r.owner)); } },
      { key: 'kpi', label: 'KPI', w: '190px' },
      { key: 'prio', label: 'Приоритет', w: '110px', render: function (r) { return UI.prChip(r.prio); } }
    ], [
      { p: 'Неделя 1–2', what: 'База инфлюенсеров, чек-лист, скоринг, шаблоны outreach', owner: 'cmo', kpi: 'База 200+, 50 контактов', prio: 'critical' },
      { p: 'Неделя 3–4', what: 'PR Box + Welcome Kit в производство, первые рассылки', owner: 'cmo', kpi: '50 боксов, 20 публикаций', prio: 'critical' },
      { p: 'Месяц 2', what: 'Merch + POS в тираж, Content Brief в работе, UGC-механики', owner: 'cmo', kpi: '100+ UGC, POS в точках', prio: 'high' },
      { p: 'Месяц 3', what: 'Ambassador Program, первое событие / pop-up', owner: 'cmo', kpi: '20 амбассадоров, 1 событие', prio: 'high' },
      { p: 'Месяц 4+', what: 'Campaign Playbooks: запуск вкуса, коллаба, сезонная кампания', owner: 'cmo', kpi: 'Рост подписчиков и продаж', prio: 'medium' }
    ]);

  } else if (view === 'year') {
    h += '<h2 class="sec">Год первый — установка</h2>';
    h += '<div class="card"><h4>Задача года — не креатив, а повторение</h4>'
      + '<p style="margin-top:8px">Шесть вкусов, один LUT, одна линия. Ничего нового не придумываем 12 месяцев: ' +
      'код становится кодом только через частоту. Это самая сложная дисциплина и главное конкурентное преимущество.</p></div>';

    h += '<div class="grid g4" style="margin-top:14px">';
    [
      { q: 'Q1', f: 'Инструменты', d: 'База инфлюенсеров, PR Box, POS, банк кадров, регулярный контент. Цель — чтобы система заработала без ежедневного участия CMO.' },
      { q: 'Q2', f: 'Маховик', d: 'Амбассадоры, UGC-поток, первые события, вход в сети. Цель — чтобы контент начал появляться без нас.' },
      { q: 'Q3', f: 'Масштаб', d: 'Расширение точек, платное усиление проверенного, коллаборации. Цель — предсказуемая экономика привлечения.' },
      { q: 'Q4', f: 'Закрепление', d: 'Гифт-сет, седьмой вкус, годовые итоги, планирование второго года. Цель — накопленный бренд, а не набор активностей.' }
    ].forEach(function (q) {
      h += '<div class="card"><div class="cap">' + E(q.q) + '</div><h4>' + E(q.f) + '</h4><p style="margin-top:8px">' + E(q.d) + '</p></div>';
    });
    h += '</div>';

    h += '<h2 class="sec">Горизонт бренда</h2><div class="grid g4">';
    REF.brand.visual.growth.forEach(function (g) {
      h += '<div class="card"><h4>' + E(g.p) + '</h4><p>' + E(g.d) + '</p></div>';
    });
    h += '</div>';

  } else if (view === 'eisen') {
    var urgent = function (t) { var d = BOS.daysLeft(t.due); return d !== null && d <= 3; };
    var important = function (t) { return t.priority === 'critical' || t.priority === 'high'; };
    var q1 = open.filter(function (t) { return urgent(t) && important(t); });
    var q2 = open.filter(function (t) { return !urgent(t) && important(t); });
    var q3 = open.filter(function (t) { return urgent(t) && !important(t); });
    var q4 = open.filter(function (t) { return !urgent(t) && !important(t); });

    h += '<h2 class="sec">Матрица Эйзенхауэра</h2>';
    h += '<p class="note" style="margin-bottom:14px">Срочно = дедлайн в ближайшие 3 дня. Важно = приоритет Critical или High. ' +
      'Смысл матрицы не в сортировке, а в том, чтобы увидеть перекос: если почти всё в первом квадранте, ' +
      'значит планирования нет и команда живёт в пожарах.</p>';

    function quad(title, sub, list, cls) {
      return '<div class="eq ' + cls + '"><div class="eq-h">' + E(title) + '<span class="n">' + list.length + '</span></div>'
        + '<div class="eq-b"><p class="dim" style="font-size:11.5px;margin-bottom:6px">' + E(sub) + '</p>'
        + (list.length ? list.slice(0, 10).map(function (t) {
          return '<div class="li"><span class="rowlink" data-t="' + E(t.id) + '">' + E(t.title) + '</span></div>';
        }).join('') : '<p class="dim">Пусто</p>')
        + (list.length > 10 ? '<p class="dim mono" style="font-size:11px">и ещё ' + (list.length - 10) + '</p>' : '')
        + '</div></div>';
    }

    h += '<div class="eisen">'
      + quad('Срочно и важно · делаем сами', 'Пожары. Чем их меньше, тем лучше работает планирование.', q1, 'do')
      + quad('Важно, не срочно · планируем', 'Здесь живёт настоящий результат. Этот квадрант должен быть самым полным.', q2, 'plan')
      + quad('Срочно, не важно · делегируем', 'Кандидаты на делегирование и автоматизацию.', q3, '')
      + quad('Ни то ни другое · убираем', 'Честно: если оно здесь третью неделю — закройте.', q4, '')
      + '</div>';

    var ratio = open.length ? Math.round(q1.length / open.length * 100) : 0;
    h += '<div class="card" style="margin-top:14px"><div class="cap">Диагноз</div>';
    if (ratio > 40) h += '<h4 style="color:var(--danger)">' + ratio + '% задач в режиме пожара</h4><p style="margin-top:8px">Это много. Планирование не работает: задачи ставятся тогда, когда уже горит. Начните ставить сроки на неделю вперёд, а не на завтра.</p>';
    else if (q2.length < q1.length) h += '<h4>Важного-несрочного меньше, чем пожаров</h4><p style="margin-top:8px">Команда работает в реактивном режиме. Стратегические задачи не двигаются, потому что их всегда вытесняет срочное.</p>';
    else h += '<h4>Баланс здоровый</h4><p style="margin-top:8px">Важного-несрочного больше, чем пожаров — значит планирование работает.</p>';
    h += '</div>';

  } else {
    /* МЕТОДОЛОГИИ */
    h += '<h2 class="sec">Методологии и где они применяются</h2><div class="grid g2">';
    [
      { n: 'OKR', d: 'Квартальные цели. Objective — состояние, а не задача. Key Result — цифра с датой.', where: 'Раздел «Планирование → Квартал»' },
      { n: 'SMART', d: 'Любая задача: конкретная, измеримая, достижимая, значимая, со сроком. У нас это поля «Цель», «Ожидаемый результат», «Дедлайн».', where: 'Форма задачи' },
      { n: 'RICE', d: 'Reach × Impact × Confidence ÷ Effort. Для крупных решений, где важен охват.', where: 'Центр идей, колонка RICE' },
      { n: 'ICE', d: 'Impact × Confidence × Ease ÷ 10. Быстрая оценка, когда охват неизвестен.', where: 'Центр идей и Growth Engine' },
      { n: 'Матрица Эйзенхауэра', d: 'Разделение срочного и важного. Диагностический инструмент, а не способ сортировки.', where: 'Планирование → Эйзенхауэр' },
      { n: 'Kanban', d: 'Задачи двигаются по колонкам, а не по переписке. Видно, где затор.', where: 'Команда, Marketing HQ, Контент-центр' },
      { n: 'Agile-ритм', d: 'Недельные циклы: планёрка в понедельник, сводка в пятницу, разбор и корректировка.', where: 'Ритуалы команды' },
      { n: 'Scrum', d: 'Полный Scrum для команды из трёх человек — избыточен. Берём только ретроспективу раз в месяц.', where: 'Месячные ритуалы' }
    ].forEach(function (m) {
      h += '<div class="card"><h4>' + E(m.n) + '</h4><p style="margin-top:6px">' + E(m.d) + '</p>'
        + '<p style="margin-top:8px" class="dim mono" style="font-size:11px">→ ' + E(m.where) + '</p></div>';
    });
    h += '</div>';

    h += '<h2 class="sec">Приоритеты: как решаем</h2>';
    h += UI.table('pl-prio', [
      { key: 'p', label: 'Уровень', w: '110px', render: function (r) { return UI.prChip(r.id); } },
      { key: 'when', label: 'Когда ставим' },
      { key: 'rule', label: 'Правило' }
    ], [
      { id: 'critical', p: 'Critical', when: 'Блокирует других или срывает запуск / поставку', rule: 'Берётся в работу сегодня, вытесняет всё остальное' },
      { id: 'high', p: 'High', when: 'Прямо влияет на цель квартала', rule: 'Планируется на неделю, не откладывается дважды' },
      { id: 'medium', p: 'Medium', when: 'Нужно, но мир не рухнет', rule: 'Идёт в месячный план' },
      { id: 'low', p: 'Low', when: 'Хорошо бы когда-нибудь', rule: 'Живёт в бэклоге. Если висит три месяца — закрываем без сожаления' }
    ]);
  }

  host.innerHTML = h;
  host.querySelectorAll('[data-t]').forEach(function (el) {
    el.onclick = function () { UI.taskModal(el.getAttribute('data-t')); };
  });
});
