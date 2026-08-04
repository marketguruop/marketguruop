/* ══════════════════════════════════════════════════════════════════════
   ЯДРО: хранилище, роутер, утилиты.
   Всё состояние живёт в localStorage. Экспорт/импорт — обычный JSON-файл,
   чтобы команда могла передавать состояние друг другу без сервера.
   ══════════════════════════════════════════════════════════════════════ */
window.BOS = (function () {
  'use strict';

  var KEY = 'bumbleOS.v1';
  var SCHEMA = 1;

  /* ── коллекции, которые редактируются командой ───────────────────── */
  var COLLECTIONS = [
    'tasks', 'content', 'ideas', 'influencers', 'media',
    'launches', 'metrics', 'growth', 'audit'
  ];

  var state = null;
  var listeners = [];

  /* ── утилиты ─────────────────────────────────────────────────────── */
  function uid(p) {
    return (p || 'x') + '-' + Math.random().toString(36).slice(2, 9);
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function daysBetween(a, b) {
    if (!a || !b) return null;
    var ms = new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00');
    return Math.round(ms / 86400000);
  }
  /** Сколько дней осталось до даты. Отрицательное = просрочено. */
  function daysLeft(due) { return due ? daysBetween(today(), due) : null; }

  function fmtDate(d) {
    if (!d) return '—';
    var M = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    var p = d.split('-');
    return parseInt(p[2], 10) + ' ' + M[parseInt(p[1], 10) - 1];
  }
  function fmtNum(n) {
    if (n === null || n === undefined || n === '') return '—';
    n = Number(n);
    if (isNaN(n)) return '—';
    if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
    if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K';
    return String(Math.round(n * 100) / 100);
  }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '');
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ── скоринг ─────────────────────────────────────────────────────── */
  /** ICE = (impact × confidence × ease) / 10 → шкала ≈0–100 */
  function ice(o) {
    var i = num(o.impact, 5), c = num(o.confidence, 5), e = num(o.ease, 5);
    return Math.round(i * c * e / 10);
  }
  /** RICE = reach × impact × confidence / effort */
  function rice(o) {
    var r = num(o.reach, 1000), i = num(o.impact, 5), c = num(o.confidence, 5) / 10, e = num(o.effort, 3);
    if (!e) e = 1;
    return Math.round(r * i * c / e);
  }
  function num(v, d) { var n = Number(v); return isNaN(n) ? d : n; }

  /* ── справочники статусов и приоритетов ──────────────────────────── */
  var PRIORITY = [
    { id: 'critical', label: 'Critical', cls: 'crit', weight: 4 },
    { id: 'high', label: 'High', cls: 'high', weight: 3 },
    { id: 'medium', label: 'Medium', cls: 'med', weight: 2 },
    { id: 'low', label: 'Low', cls: 'low', weight: 1 }
  ];
  var STATUS = [
    { id: 'backlog', label: 'Бэклог' },
    { id: 'todo', label: 'К работе' },
    { id: 'doing', label: 'В работе' },
    { id: 'review', label: 'На проверке' },
    { id: 'done', label: 'Готово' }
  ];
  var CONTENT_STATUS = [
    { id: 'idea', label: 'Идея' },
    { id: 'script', label: 'Сценарий' },
    { id: 'shoot', label: 'Съёмка' },
    { id: 'edit', label: 'Монтаж' },
    { id: 'approve', label: 'Апрув' },
    { id: 'scheduled', label: 'Запланирован' },
    { id: 'published', label: 'Опубликован' }
  ];

  function priority(id) {
    for (var i = 0; i < PRIORITY.length; i++) if (PRIORITY[i].id === id) return PRIORITY[i];
    return PRIORITY[2];
  }
  function statusLabel(id) {
    for (var i = 0; i < STATUS.length; i++) if (STATUS[i].id === id) return STATUS[i].label;
    for (var j = 0; j < CONTENT_STATUS.length; j++) if (CONTENT_STATUS[j].id === id) return CONTENT_STATUS[j].label;
    return id;
  }

  /* ── хранилище ───────────────────────────────────────────────────── */
  function blank() {
    var s = { meta: { schema: SCHEMA, created: today(), updated: today() }, settings: {} };
    COLLECTIONS.forEach(function (c) { s[c] = []; });
    return s;
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* приватный режим */ }
    if (raw) {
      try {
        state = JSON.parse(raw);
        COLLECTIONS.forEach(function (c) { if (!Array.isArray(state[c])) state[c] = []; });
        if (!state.settings) state.settings = {};
        if (!state.meta) state.meta = { schema: SCHEMA };
      } catch (e) { state = null; }
    }
    if (!state) { state = blank(); seed(); save(); }
    return state;
  }

  /** Первичное наполнение: данные из SEED.* (файлы assets/js/data/*). */
  function seed() {
    var S = window.SEED || {};
    COLLECTIONS.forEach(function (c) {
      if (Array.isArray(S[c])) state[c] = JSON.parse(JSON.stringify(S[c]));
    });
    state.settings = Object.assign({
      theme: 'dark',
      me: 'cmo',
      names: { cmo: 'CMO', smm1: 'SMM · Видео', smm2: 'SMM · Комьюнити' }
    }, S.settings || {});
  }

  var saveTimer = null;
  function save() {
    state.meta.updated = today();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(state)); }
      catch (e) { console.warn('Не удалось сохранить состояние:', e); }
    }, 120);
  }

  function emit() {
    save();
    listeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
  }
  function onChange(fn) { listeners.push(fn); }

  /* ── CRUD ────────────────────────────────────────────────────────── */
  function all(col) { return state[col] || []; }

  function find(col, id) {
    var a = all(col);
    for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i];
    return null;
  }

  function upsert(col, obj) {
    if (!state[col]) state[col] = [];
    if (!obj.id) {
      obj.id = uid(col.slice(0, 3));
      obj.created = obj.created || today();
      state[col].unshift(obj);
    } else {
      var ex = find(col, obj.id);
      if (ex) Object.assign(ex, obj); else state[col].unshift(obj);
    }
    emit();
    return obj;
  }

  function patch(col, id, changes) {
    var o = find(col, id);
    if (!o) return null;
    Object.assign(o, changes);
    emit();
    return o;
  }

  function remove(col, id) {
    state[col] = all(col).filter(function (o) { return o.id !== id; });
    emit();
  }

  function addComment(col, id, text, who) {
    var o = find(col, id);
    if (!o) return;
    if (!o.comments) o.comments = [];
    o.comments.push({ at: today(), who: who || state.settings.me || 'cmo', text: text });
    emit();
  }

  /* ── выборки, которые нужны в нескольких экранах ─────────────────── */
  function openTasks() {
    return all('tasks').filter(function (t) { return t.status !== 'done'; });
  }
  function overdue() {
    return openTasks().filter(function (t) { return t.due && daysLeft(t.due) < 0; });
  }
  function dueToday() {
    return openTasks().filter(function (t) { return t.due === today(); });
  }
  function dueWithin(n) {
    return openTasks().filter(function (t) {
      var d = daysLeft(t.due);
      return d !== null && d >= 0 && d <= n;
    });
  }
  function blocked() {
    return openTasks().filter(function (t) { return t.blocked; });
  }
  function byAssignee(who) {
    return all('tasks').filter(function (t) { return t.assignee === who; });
  }
  /** Загрузка исполнителя в часах по открытым задачам ближайших 7 дней. */
  function load7(who) {
    var h = 0;
    openTasks().forEach(function (t) {
      if (t.assignee !== who) return;
      var d = daysLeft(t.due);
      if (d === null || d <= 7) h += num(t.hours, 2);
    });
    return h;
  }

  function sortBy(arr, key, dir) {
    var d = dir === 'desc' ? -1 : 1;
    return arr.slice().sort(function (a, b) {
      var x = a[key], y = b[key];
      if (x === undefined || x === null || x === '') return 1;
      if (y === undefined || y === null || y === '') return -1;
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * d;
      return String(x).localeCompare(String(y), 'ru') * d;
    });
  }

  /* ── роутер (hash) ───────────────────────────────────────────────── */
  var routes = {};
  var currentRoute = '';

  function route(name, fn) { routes[name] = fn; }

  function parseHash() {
    var h = (location.hash || '#/dashboard').replace(/^#\/?/, '');
    var parts = h.split('/');
    return { name: parts[0] || 'dashboard', arg: parts.slice(1).join('/') };
  }

  function go(path) {
    location.hash = '#/' + String(path).replace(/^#?\/?/, '');
  }

  function render() {
    var r = parseHash();
    currentRoute = r.name;
    var fn = routes[r.name] || routes.dashboard;
    var host = document.getElementById('view');
    host.innerHTML = '';
    try {
      fn(host, r.arg);
    } catch (e) {
      console.error(e);
      host.innerHTML = '<div class="empty"><div class="e-t">Экран не собрался</div><p class="mono">'
        + esc(e.message) + '</p></div>';
    }
    host.scrollTop = 0;
    window.scrollTo(0, 0);
    document.querySelectorAll('#nav a').forEach(function (a) {
      a.classList.toggle('on', a.getAttribute('href') === '#/' + r.name);
    });
    var nv = NAV_FLAT[r.name];
    document.getElementById('crumb').textContent = nv ? nv.label : 'Bumble Marketing OS';
    var sb = document.getElementById('sidebar');
    if (sb) sb.classList.remove('open');
  }

  /* ── карта разделов ──────────────────────────────────────────────── */
  var NAV = [
    {
      group: 'Ежедневно', items: [
        { id: 'dashboard', label: 'Дашборд', ico: '◑' },
        { id: 'control', label: 'Контроль', ico: '⌁', count: function () { return overdue().length + blocked().length; } },
        { id: 'planning', label: 'Планирование', ico: '⌸' },
        { id: 'team', label: 'Команда', ico: '⚇' }
      ]
    },
    {
      group: 'Маркетинг', items: [
        { id: 'hq', label: 'Marketing HQ', ico: '⌗' },
        { id: 'content', label: 'Контент-центр', ico: '▤', count: function () { return all('content').filter(function (c) { return c.status !== 'published'; }).length; } },
        { id: 'influencers', label: 'Инфлюенсеры', ico: '☍', count: function () { return all('influencers').length; } },
        { id: 'pr', label: 'PR и медиа', ico: '✎' },
        { id: 'launch', label: 'Запуск продуктов', ico: '⬈' },
        { id: 'growth', label: 'Growth Engine', ico: '⇗' }
      ]
    },
    {
      group: 'База', items: [
        { id: 'brand', label: 'Brand Center', ico: '◈' },
        { id: 'ideas', label: 'Центр идей', ico: '✳', count: function () { return all('ideas').filter(function (i) { return i.status === 'new'; }).length; } },
        { id: 'knowledge', label: 'База знаний', ico: '❏' },
        { id: 'ai', label: 'AI-отдел', ico: '✦' },
        { id: 'automation', label: 'Автоматизация', ico: '⚙' }
      ]
    },
    {
      group: 'Результат', items: [
        { id: 'analytics', label: 'Аналитика', ico: '◫' },
        { id: 'audit', label: 'Аудит системы', ico: '⚑', count: function () { return all('audit').filter(function (a) { return a.status === 'open'; }).length; } }
      ]
    }
  ];
  var NAV_FLAT = {};
  NAV.forEach(function (g) { g.items.forEach(function (i) { NAV_FLAT[i.id] = i; }); });

  function buildNav() {
    var nav = document.getElementById('nav');
    nav.innerHTML = NAV.map(function (g) {
      return '<div class="nav-group"><div class="nav-glabel">' + esc(g.group) + '</div>'
        + g.items.map(function (i) {
          var c = '';
          if (i.count) { var n = i.count(); if (n) c = '<span class="cnt">' + n + '</span>'; }
          return '<a href="#/' + i.id + '"><span class="ico">' + i.ico + '</span>' + esc(i.label) + c + '</a>';
        }).join('') + '</div>';
    }).join('');
  }

  /* ── экспорт / импорт ────────────────────────────────────────────── */
  function exportJSON() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bumble-os-' + today() + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function importJSON(text) {
    var data = JSON.parse(text);
    if (!data || typeof data !== 'object') throw new Error('Файл не похож на состояние системы');
    state = data;
    COLLECTIONS.forEach(function (c) { if (!Array.isArray(state[c])) state[c] = []; });
    if (!state.settings) state.settings = {};
    emit();
  }

  function reseed() {
    state = blank();
    seed();
    emit();
  }

  return {
    // состояние
    load: load, save: save, emit: emit, onChange: onChange, reseed: reseed,
    get state() { return state; },
    get settings() { return state.settings; },
    // crud
    all: all, find: find, upsert: upsert, patch: patch, remove: remove, addComment: addComment,
    // выборки
    openTasks: openTasks, overdue: overdue, dueToday: dueToday, dueWithin: dueWithin,
    blocked: blocked, byAssignee: byAssignee, load7: load7, sortBy: sortBy,
    // справочники
    PRIORITY: PRIORITY, STATUS: STATUS, CONTENT_STATUS: CONTENT_STATUS,
    priority: priority, statusLabel: statusLabel, NAV: NAV, NAV_FLAT: NAV_FLAT,
    // утилиты
    uid: uid, today: today, daysLeft: daysLeft, daysBetween: daysBetween,
    fmtDate: fmtDate, fmtNum: fmtNum, esc: esc, slug: slug, clamp: clamp, num: num,
    ice: ice, rice: rice,
    // роутер
    route: route, go: go, render: render, buildNav: buildNav, parseHash: parseHash,
    get currentRoute() { return currentRoute; },
    // файлы
    exportJSON: exportJSON, importJSON: importJSON
  };
})();
