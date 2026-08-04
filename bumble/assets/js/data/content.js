/* ══════════════════════════════════════════════════════════════════════
   КОНТЕНТ-ЦЕНТР · структура
   Рубрикатор, воронка, серии, календарь, правила публикации.
   Сами единицы контента лежат в SEED.content и редактируются командой.
   ══════════════════════════════════════════════════════════════════════ */
window.REF = window.REF || {};
window.SEED = window.SEED || {};

/* ── ВОРОНКА ────────────────────────────────────────────────────── */
REF.funnel = [
  {
    stage: 'Знакомство', share: '40%',
    goal: 'Человек впервые видит бренд и понимает продукт за 3 секунды',
    formats: ['Reels-хук', 'TikTok-тест', 'Наружка', 'Плакат'],
    message: 'Газированный кофе без сахара. Такого на полке ещё нет.',
    metric: 'Охват, новые зрители, досмотры'
  },
  {
    stage: 'Интерес', share: '25%',
    goal: 'Объяснить, почему это не энергетик и не обычный кофе',
    formats: ['Карусель «Три зерна»', 'Тред', 'Telegram-разбор', 'Макро-видео'],
    message: 'Кофеин из кофе, 125 мг, ноль сахара — значит нет отката.',
    metric: 'Сохранения, время просмотра, ответы'
  },
  {
    stage: 'Желание', share: '20%',
    goal: 'Захотеть открыть банку прямо сейчас',
    formats: ['Момент первого глотка', 'Макро пузырьков', 'UGC', 'Инфлюенсеры'],
    message: 'Первый глоток должен удивлять.',
    metric: 'Репосты, комментарии «где купить», клики'
  },
  {
    stage: 'Действие', share: '10%',
    goal: 'Довести до полки',
    formats: ['«Где купить»', 'Карта точек', 'Промокод', 'Stories со ссылкой'],
    message: 'Заряд ближе, чем кофейня.',
    metric: 'Переходы, продажи, использование промокода'
  },
  {
    stage: 'Возврат и адвокация', share: '5%',
    goal: 'Вторая покупка и собственный контент',
    formats: ['Челлендж «собери все 6»', 'Репост UGC', 'Амбассадорство', 'Email'],
    message: 'Каждый вкус — новый повод.',
    metric: 'Повторные покупки, UGC в неделю, упоминания'
  }
];

/* ── РУБРИКАТОР ─────────────────────────────────────────────────── */
REF.rubrics = [
  { id: 'hero', n: 'Герой-вкус', d: 'Один вкус — один кадр. Продукт на линии, много воздуха сверху.', share: '3 из 9', ch: 'Instagram, VK' },
  { id: 'macro', n: 'Макро и физика', d: 'Пузырьки, конденсат, звук вскрытия. Газ, а не молоко.', share: '2 из 9', ch: 'Instagram, TikTok' },
  { id: 'fact', n: 'Факт', d: '125 мг · 0 г · 120 ₽. Цифра моноширинным = факт, а не реклама.', share: '1 из 9', ch: 'Все' },
  { id: 'human', n: 'Человек в движении', d: 'Зал, город, пары, дорога. Никто не смотрит в камеру.', share: '2 из 9', ch: 'Instagram, TikTok' },
  { id: 'ugc', n: 'UGC', d: 'Контент аудитории, репост в 24 часа.', share: '1 из 9', ch: 'Instagram, Stories' },
  { id: 'myth', n: 'Миф и правда', d: 'До/после линии: разбор мифов о кофеине, сахаре, газации.', share: 'по поводу', ch: 'Threads, Telegram' },
  { id: 'behind', n: 'Закулисье', d: 'Съёмки, отказы, честные разборы. Только Telegram.', share: '1 / нед', ch: 'Telegram' },
  { id: 'where', n: 'Где купить', d: 'Карта точек, новые сети, гео-сторис.', share: '1 / нед', ch: 'Stories, Telegram, VK' },
  { id: 'collect', n: 'Коллекция', d: 'Шесть вкусов как спектр. Только «семейные» коммуникации.', share: '1 / 2 нед', ch: 'Instagram, VK' },
  { id: 'voice', n: 'Мнение', d: 'Спорная мысль, самоирония, точка зрения. Не продаём — думаем вслух.', share: '5–7 / нед', ch: 'Threads' }
];

/* ── КОНТЕНТНЫЕ СЕРИИ ───────────────────────────────────────────── */
REF.series = [
  { n: '«Первый глоток»', d: 'Шесть выпусков — по одному на вкус. Момент открытия, реакция, ничего лишнего.', len: '6 выпусков', ch: 'Reels, TikTok' },
  { n: '«Кофе или кола?»', d: 'Слепой тест с реальными людьми. Главная фраза бренда становится механикой.', len: 'бесконечная', ch: 'TikTok, Reels' },
  { n: '«Шесть состояний»', d: 'Каждый вкус = состояние дня. Orange — старт, Wild Berries — финал.', len: '6 выпусков', ch: 'Stories, лента' },
  { n: '«До и после линии»', d: 'Мифы о кофеине, сахаре и газации. Верх кадра — миф, низ — правда.', len: '10+ выпусков', ch: 'Threads, Telegram, карусели' },
  { n: '«Где я открыл Bumble»', d: 'UGC-серия. Карта мест, где люди пьют. Репост лучшего.', len: 'бесконечная', ch: 'Stories, UGC' },
  { n: '«Кофейня подождёт»', d: 'Сравнение: очередь за латте против одной секунды. Юмор без злобы.', len: '8 выпусков', ch: 'Reels, Threads' },
  { n: '«Как это снято»', d: 'Закулисье: солнце 5–20°, один LUT, три склейки. Показываем дисциплину как ценность.', len: 'раз в месяц', ch: 'Telegram, Stories' },
  { n: '«Собери все 6»', d: 'Челлендж-коллекция. Значки, спектр, лидерборд.', len: 'сезонная', ch: 'Все' }
];

/* ── ПРАВИЛА ПУБЛИКАЦИИ ─────────────────────────────────────────── */
REF.publishRules = [
  '9 постов = один законченный экран профиля. Планируем девятками, не постами.',
  'Максимум 1 тёмный пост на 9. Тьма — специя, не блюдо.',
  'Ни одного поста без линии, света или трёх зёрен. Минимум один из трёх кодов обязателен.',
  'Не более 4 слов на изображении. Остальное — в подписи.',
  'Один вкус — один кадр. Спектр целиком только в «семейных» коммуникациях.',
  'Обложка Reels — всегда кадр с горизонтом.',
  'Все интерактивы в Stories живут ниже линии.',
  'G-06 Night Rise — не чаще 1 поста из 9.'
];

/* ── НЕДЕЛЬНАЯ СЕТКА ────────────────────────────────────────────── */
REF.weekGrid = [
  { day: 'Пн', slots: ['Reels — герой-вкус (10:00)', 'Stories — план недели (утро)', 'Тред — мнение (14:00)', 'Telegram — анонс недели (19:00)'] },
  { day: 'Вт', slots: ['Съёмочный день (батч)', 'Stories — закулисье съёмки', 'TikTok — тренд-тест (18:00)'] },
  { day: 'Ср', slots: ['Пост-карусель «Три зерна» (11:00)', 'Reels — макро (17:00)', 'Telegram — длинный разбор (19:00)', 'Тред — вопрос аудитории'] },
  { day: 'Чт', slots: ['Reels — человек в движении (10:00)', 'Stories — UGC-репосты', 'TikTok — «Кофе или кола?» (18:00)'] },
  { day: 'Пт', slots: ['Пост — факт / цифра (12:00)', 'Reels — «Кофейня подождёт» (17:00)', 'Stories — где купить на выходных', 'Telegram — итоги недели (19:00)'] },
  { day: 'Сб', slots: ['Reels — UGC или коллаб (13:00)', 'Stories — жизнь бренда', 'Тред — лёгкий, ироничный'] },
  { day: 'Вс', slots: ['Пост — коллекция / спектр (14:00)', 'Stories — опрос на неделю', 'Подготовка следующей девятки'] }
];

/* ── ЕДИНИЦЫ КОНТЕНТА (редактируются) ───────────────────────────── */
(function () {
  function d(n) {
    var t = new Date(); t.setDate(t.getDate() + n);
    var p = function (x) { return x < 10 ? '0' + x : '' + x; };
    return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate());
  }

  var C = [
    { title: 'Первый глоток · Orange', format: 'Reels', channel: 'Instagram', rubric: 'hero', series: '«Первый глоток»', hook: 'Звук вскрытия на чёрном кадре', cta: 'Какой вкус первым?', status: 'published', priority: 'high', complexity: 2, goal: 'Охват и знакомство с линейкой', expected: '25K охват', owner: 'smm1', publishAt: d(-5), stats: { reach: 31400, er: 7.2, saves: 980, shares: 310, comments: 142 } },
    { title: 'Кофе или кола? · слепой тест в зале', format: 'Reels', channel: 'TikTok', rubric: 'myth', series: '«Кофе или кола?»', hook: '«Угадай, что это» — крупный план глотка', cta: 'Угадал бы?', status: 'published', priority: 'critical', complexity: 3, goal: 'Проверить главную фразу как вирусную механику', expected: '50K просмотров', owner: 'smm1', publishAt: d(-3), stats: { reach: 87200, er: 9.4, saves: 2100, shares: 1450, comments: 610 } },
    { title: 'Макро: пузырьки идут вверх', format: 'Reels', channel: 'Instagram', rubric: 'macro', hook: 'Первый кадр — только пузырь в фокусе', cta: 'Сохрани, если тоже залипаешь', status: 'published', priority: 'medium', complexity: 2, goal: 'Эстетика и сохранения', expected: '3% сохранений', owner: 'smm1', publishAt: d(-2), stats: { reach: 18900, er: 6.1, saves: 720, shares: 95, comments: 48 } },
    { title: '125 мг · 0 г · 120 ₽', format: 'Пост', channel: 'Instagram', rubric: 'fact', hook: 'Три цифры моноширинным на золоте', cta: 'Сравни со своим энергетиком', status: 'published', priority: 'medium', complexity: 1, goal: 'Закрыть возражение «а сколько кофеина»', expected: 'Комментарии-вопросы', owner: 'smm2', publishAt: d(-1), stats: { reach: 12400, er: 4.8, saves: 310, shares: 60, comments: 88 } },

    { title: 'Кофейня подождёт · очередь vs секунда', format: 'Reels', channel: 'Instagram', rubric: 'human', series: '«Кофейня подождёт»', hook: 'Сплит-экран: очередь и открытая банка', cta: 'Сколько ты стоишь за кофе?', status: 'edit', priority: 'high', complexity: 3, goal: 'Донести анти-кофейню без наезда', expected: '30K охват', owner: 'smm1', publishAt: d(1) },
    { title: 'Тред: почему газированный кофе — это не странно', format: 'Тред', channel: 'Threads', rubric: 'voice', hook: 'Сначала все удивляются. Потом покупают второй раз.', cta: 'А ты бы попробовал?', status: 'approve', priority: 'medium', complexity: 1, goal: 'Снять барьер странности', expected: '50 ответов', owner: 'smm2', publishAt: d(1) },
    { title: 'Telegram: почему робуста, а не арабика', format: 'Пост', channel: 'Telegram', rubric: 'behind', hook: 'Мы выбрали «неправильный» кофе. Осознанно.', cta: 'Вопросы — в комментарии', status: 'script', priority: 'medium', complexity: 2, goal: 'Глубина для ядра', expected: 'ERR ≥60%', owner: 'smm2', publishAt: d(2) },
    { title: 'Шесть состояний · карусель', format: 'Карусель', channel: 'Instagram', rubric: 'collect', series: '«Шесть состояний»', hook: 'Слайд 1 — линия внизу (ночь)', cta: 'Твоё состояние сегодня?', status: 'script', priority: 'high', complexity: 3, goal: 'Объяснить линейку как коллекцию', expected: '4% сохранений', owner: 'smm1', publishAt: d(3) },
    { title: 'Stories: где купить — карта точек', format: 'Stories', channel: 'Stories', rubric: 'where', hook: 'Ближайшая точка — 400 метров', cta: 'Свайп на карту', status: 'scheduled', priority: 'high', complexity: 1, goal: 'Довести до полки', expected: '300 переходов', owner: 'smm2', publishAt: d(1) },
    { title: 'До и после линии: миф о сахарном откате', format: 'Карусель', channel: 'Instagram', rubric: 'myth', series: '«До и после линии»', hook: 'Верх — миф. Низ — правда.', cta: 'Сохрани, чтобы не забыть', status: 'idea', priority: 'medium', complexity: 2, goal: 'Закрыть главное возражение', expected: '5% сохранений', owner: 'smm2', publishAt: d(5) },
    { title: 'Как это снято: один LUT на бренд', format: 'Пост', channel: 'Telegram', rubric: 'behind', series: '«Как это снято»', hook: 'Мы снимаем только два часа в сутки. Вот почему.', cta: '', status: 'idea', priority: 'low', complexity: 2, goal: 'Показать дисциплину как ценность', expected: 'Реакции ядра', owner: 'smm2', publishAt: d(8) },
    { title: 'Собери все 6 · анонс челленджа', format: 'Reels', channel: 'Instagram', rubric: 'collect', series: '«Собери все 6»', hook: 'Шесть банок выстраиваются в спектр', cta: 'Собери и отметь нас', status: 'idea', priority: 'critical', complexity: 3, goal: 'Запустить UGC-маховик', expected: '100+ UGC за месяц', owner: 'smm1', publishAt: d(6) },
    { title: 'Где я открыл Bumble · подборка UGC', format: 'Stories', channel: 'Stories', rubric: 'ugc', series: '«Где я открыл Bumble»', hook: 'Ваши кадры за неделю', cta: 'Отметь нас — попадёшь сюда', status: 'idea', priority: 'medium', complexity: 1, goal: 'Мотивировать снимать', expected: '7 репостов', owner: 'smm2', publishAt: d(4) },
    { title: 'YouTube Shorts: лучшее за месяц', format: 'Shorts', channel: 'YouTube', rubric: 'macro', hook: 'Переупаковка топ-3 Reels', cta: 'Подписка', status: 'idea', priority: 'low', complexity: 1, goal: 'Освоить площадку', expected: '10K просмотров', owner: 'smm1', publishAt: d(7) },
    { title: 'Пост-факт: 6 вкусов = 6 поводов вернуться', format: 'Пост', channel: 'VK', rubric: 'collect', hook: 'Шесть банок в ряд', cta: 'Какой пробовал?', status: 'idea', priority: 'low', complexity: 1, goal: 'Частота покупки', expected: 'Комментарии', owner: 'smm2', publishAt: d(9) }
  ];

  SEED.content = C.map(function (c, i) {
    return Object.assign({ id: 'cnt-' + (i + 1), created: d(-14), stats: c.stats || {} }, c);
  });
})();
