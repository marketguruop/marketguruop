/* ══════════════════════════════════════════════════════════════════════
   ЦЕНТР ИДЕЙ · Brain Dump
   Смысл: ни одна идея не теряется. Любая мысль падает сюда за 10 секунд,
   получает оценку и либо уходит в работу, либо честно закрывается.
   Оценка: ICE = impact × confidence × ease / 10 · RICE = reach × impact × conf / effort
   ══════════════════════════════════════════════════════════════════════ */
window.REF = window.REF || {};
window.SEED = window.SEED || {};

REF.ideaCats = [
  { id: 'raw', n: 'Сырые идеи' },
  { id: 'later', n: 'На будущее' },
  { id: 'product', n: 'Продукт' },
  { id: 'pack', n: 'Упаковка' },
  { id: 'promo', n: 'Продвижение' },
  { id: 'ads', n: 'Реклама' },
  { id: 'collab', n: 'Коллаборации' },
  { id: 'infl', n: 'Инфлюенсеры' },
  { id: 'event', n: 'Мероприятия' },
  { id: 'viral', n: 'Вирусный контент' },
  { id: 'sales', n: 'Рост продаж' },
  { id: 'retail', n: 'Магазины и ритейл' },
  { id: 'social', n: 'Социальные сети' },
  { id: 'pr', n: 'PR' },
  { id: 'offline', n: 'Офлайн-активации' }
];

REF.ideaStatuses = [
  { id: 'new', n: 'Новая' },
  { id: 'scored', n: 'Оценена' },
  { id: 'queued', n: 'В очереди' },
  { id: 'doing', n: 'В работе' },
  { id: 'done', n: 'Сделана' },
  { id: 'rejected', n: 'Отклонена' }
];

/* Правило приоритизации: ICE ≥ 70 идёт в работу на этой неделе,
   40–69 в очередь на месяц, < 40 остаётся в банке до лучшего момента. */
REF.ideaRule = [
  { range: 'ICE ≥ 70', act: 'В работу на этой неделе' },
  { range: 'ICE 40–69', act: 'В очередь на месяц' },
  { range: 'ICE < 40', act: 'Остаётся в банке, не удаляем' },
  { range: 'Дешёвая и быстрая (ease ≥ 8)', act: 'Делаем даже при среднем impact — это тест' }
];

(function () {
  function d(n) {
    var t = new Date(); t.setDate(t.getDate() + n);
    var p = function (x) { return x < 10 ? '0' + x : '' + x; };
    return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate());
  }

  var I = [
    { title: 'Золотая линия на асфальте, ведущая к точке продаж', cat: 'offline', impact: 9, confidence: 6, ease: 4, reach: 20000, effort: 5, cost: '60–150 тыс ₽ за инсталляцию', effect: 'Городская инсталляция без единого слова. Люди идут по ней, потому что хочется. Максимальный PR-потенциал.', status: 'queued' },
    { title: 'Финишная черта забега = наша линия', cat: 'collab', impact: 9, confidence: 8, ease: 6, reach: 15000, effort: 3, cost: 'спонсорский взнос + продукт', effect: 'Прямое попадание в спорт-ядро. Каждый кадр «пересёк линию» — кадр бренда.', status: 'queued' },
    { title: 'Звук вскрытия как официальный саунд для дуэтов', cat: 'viral', impact: 8, confidence: 7, ease: 9, reach: 50000, effort: 1, cost: '0 ₽', effect: 'Аудио-код работает, даже когда экран выключен. Самый дешёвый вирусный актив.', status: 'queued' },
    { title: 'Автомат с экраном, живущим по солнцу города', cat: 'product', impact: 8, confidence: 4, ease: 2, reach: 8000, effort: 8, cost: '400+ тыс ₽', effect: 'Утром светлее, ночью Night Rise. Сильный PR-объект, но дорогой и долгий.', status: 'new' },
    { title: 'Седьмой вкус выбирает аудитория голосованием', cat: 'product', impact: 9, confidence: 7, ease: 5, reach: 30000, effort: 6, cost: 'себестоимость партии', effect: 'Причастность → лояльность. Готовый инфоповод на 3 месяца вперёд: голосование, разработка, релиз.', status: 'new' },
    { title: 'Значки шести вкусов как валюта обмена', cat: 'promo', impact: 7, confidence: 8, ease: 8, reach: 10000, effort: 2, cost: '25–40 тыс ₽ за тираж', effect: 'Коллекция заставляет ходить на ивенты и покупать чаще.', status: 'queued' },
    { title: 'Партнёрство с сетью фитнес-клубов: холодильник у стойки', cat: 'retail', impact: 9, confidence: 6, ease: 4, reach: 25000, effort: 7, cost: 'холодильник + отсрочка', effect: 'Прямое попадание в ядро в момент потребности. Высокая оборачиваемость.', status: 'new' },
    { title: '«Мы отказали 40 блогерам» — честный пост про критерии', cat: 'social', impact: 6, confidence: 8, ease: 9, reach: 12000, effort: 1, cost: '0 ₽', effect: 'Строит репутацию бренда с позицией. Хорошо расходится в Threads.', status: 'new' },
    { title: 'Коллаборация с локальным брендом одежды: капсула без логотипов', cat: 'collab', impact: 8, confidence: 5, ease: 4, reach: 18000, effort: 6, cost: 'разделение затрат', effect: 'Тест гипотезы «бренд перестаёт показывать банку». Двойной охват.', status: 'new' },
    { title: 'Карта точек, которую собирает аудитория', cat: 'social', impact: 7, confidence: 7, ease: 7, reach: 9000, effort: 3, cost: '0–15 тыс ₽', effect: 'Решает главный вопрос «где купить» руками аудитории.', status: 'new' },
    { title: 'Гифт-сет к декабрю: 6 вкусов + термос + значки', cat: 'pack', impact: 8, confidence: 8, ease: 6, reach: 6000, effort: 4, cost: '180–300 тыс ₽ тираж', effect: 'Открывание коробки = рассвет. Высокий средний чек, единственное место, где разрешён металлик.', status: 'queued' },
    { title: 'Промокоды с индивидуальным следом у каждого блогера', cat: 'infl', impact: 8, confidence: 9, ease: 8, reach: 5000, effort: 2, cost: '0 ₽ + скидка', effect: 'Наконец видно, кто реально приводит покупателей, а кто только охват.', status: 'queued' },
    { title: 'Исследование: сколько россияне тратят на кофе навынос за год', cat: 'pr', impact: 8, confidence: 6, ease: 5, reach: 40000, effort: 5, cost: '50–120 тыс ₽ на опрос', effect: 'Готовый повод для деловых СМИ. Цифра, которую перепечатают.', status: 'new' },
    { title: 'Pop-up на музыкальном фестивале: конструкция «Линия» 12 м', cat: 'event', impact: 9, confidence: 6, ease: 3, reach: 30000, effort: 8, cost: '300–600 тыс ₽', effect: 'Ночью видно за 300 м. Люди сами встают в кадр.', status: 'new' },
    { title: 'Второй фейсинг у кассы вместо расширения ассортимента', cat: 'sales', impact: 7, confidence: 8, ease: 8, reach: 3000, effort: 2, cost: 'переговоры', effect: 'Импульсная зона даёт больше, чем шестой вкус на дальней полке.', status: 'new' },
    { title: 'Реклама только на контенте из топ-10% по органике', cat: 'ads', impact: 8, confidence: 9, ease: 9, reach: 0, effort: 1, cost: 'экономия бюджета', effect: 'Перестаём разгонять слабое. Снижение CPM без потери охвата.', status: 'queued' },
    { title: 'Мерч без логотипа как публичный дизайн-челлендж', cat: 'viral', impact: 7, confidence: 5, ease: 6, reach: 15000, effort: 4, cost: 'тираж мерча', effect: 'Тест визуальной ДНК становится контентом: «узнали или нет».', status: 'new' },
    { title: 'Слепой тест на 100 человек с публикацией результатов', cat: 'pr', impact: 8, confidence: 7, ease: 5, reach: 25000, effort: 5, cost: '40–80 тыс ₽', effect: 'Главная фраза бренда получает доказательство. Цифра для медиа и для точек.', status: 'new' },
    { title: 'Точки у вузов к началу учебного года', cat: 'retail', impact: 8, confidence: 8, ease: 6, reach: 20000, effort: 4, cost: 'логистика + POS', effect: 'Студенческое ядро в момент максимальной потребности. Сезонное окно — август-сентябрь.', status: 'queued' },
    { title: 'Рубрика «Что мы никогда не сделаем» в Threads', cat: 'social', impact: 6, confidence: 7, ease: 9, reach: 8000, effort: 1, cost: '0 ₽', effect: 'Бренд с позицией запоминается. Шесть пунктов уже написаны в брендбуке.', status: 'new' },
    { title: 'Холодильник брендированный: верх золотой, ручка на линии', cat: 'retail', impact: 8, confidence: 7, ease: 3, reach: 12000, effort: 7, cost: '35–60 тыс ₽ за штуку', effect: 'Открывая дверь, рука проходит по горизонту. Собственная территория в чужом магазине.', status: 'new' },
    { title: 'Email-цепочка для тех, кто пришёл с промокода', cat: 'promo', impact: 6, confidence: 7, ease: 7, reach: 2000, effort: 3, cost: '0–8 тыс ₽/мес', effect: 'Повторная покупка дешевле привлечения. Пока база маленькая — самое время начать собирать.', status: 'new' }
  ];

  SEED.ideas = I.map(function (o, i) {
    var obj = Object.assign({ id: 'ide-' + (i + 1), created: d(-7), owner: 'cmo' }, o);
    return obj;
  });
})();
