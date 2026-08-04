/* ══════════════════════════════════════════════════════════════════════
   ЗАПУСК ПРИЛОЖЕНИЯ
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var E = BOS.esc;

  BOS.load();

  /* ── тема ───────────────────────────────────────────────────── */
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', BOS.settings.theme || 'dark');
  }
  applyTheme();

  document.getElementById('btn-theme').onclick = function () {
    BOS.settings.theme = (BOS.settings.theme === 'light') ? 'dark' : 'light';
    BOS.emit(); applyTheme();
  };

  /* ── навигация ──────────────────────────────────────────────── */
  BOS.buildNav();
  BOS.onChange(function () { BOS.buildNav(); });

  window.addEventListener('hashchange', BOS.render);
  if (!location.hash) location.hash = '#/dashboard';
  BOS.render();

  document.getElementById('btn-burger').onclick = function () {
    document.getElementById('sidebar').classList.toggle('open');
  };

  /* ── быстрая задача ─────────────────────────────────────────── */
  document.getElementById('btn-quickadd').onclick = function () { UI.taskModal(null); };

  /* ── экспорт / импорт ───────────────────────────────────────── */
  document.getElementById('btn-export').onclick = function () {
    BOS.exportJSON(); UI.toast('Копия скачана');
  };
  document.getElementById('btn-import').onclick = function () {
    document.getElementById('file-input').click();
  };
  document.getElementById('file-input').onchange = function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        BOS.importJSON(r.result);
        UI.toast('Состояние загружено');
        BOS.render();
      } catch (err) {
        UI.toast('Файл не подошёл — нужен экспорт этой же системы');
      }
    };
    r.readAsText(f);
    e.target.value = '';
  };

  /* ── глобальный поиск ───────────────────────────────────────── */
  var searchEl = document.getElementById('global-search');
  var searchTimer = null;

  searchEl.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 220);
  });
  searchEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { clearTimeout(searchTimer); runSearch(); }
    if (e.key === 'Escape') { searchEl.value = ''; UI.closeModal(); }
  });

  function runSearch() {
    var q = searchEl.value.trim().toLowerCase();
    if (q.length < 2) return;

    var res = [];
    BOS.all('tasks').forEach(function (t) {
      if ((t.title + ' ' + (t.goal || '') + ' ' + (t.desc || '') + ' ' + (t.module || '')).toLowerCase().indexOf(q) >= 0)
        res.push({ g: 'Задачи', t: t.title, s: UI.who(t.assignee) + ' · ' + BOS.statusLabel(t.status), act: function () { UI.taskModal(t.id); } });
    });
    BOS.all('content').forEach(function (c) {
      if ((c.title + ' ' + (c.hook || '') + ' ' + (c.channel || '')).toLowerCase().indexOf(q) >= 0)
        res.push({ g: 'Контент', t: c.title, s: (c.channel || '') + ' · ' + BOS.statusLabel(c.status), act: function () { window.contentModal(c.id); } });
    });
    BOS.all('ideas').forEach(function (i) {
      if ((i.title + ' ' + (i.effect || '')).toLowerCase().indexOf(q) >= 0)
        res.push({ g: 'Идеи', t: i.title, s: 'ICE ' + BOS.ice(i), act: function () { BOS.go('ideas'); } });
    });
    BOS.all('influencers').forEach(function (i) {
      if ((i.name + ' ' + (i.notes || '')).toLowerCase().indexOf(q) >= 0)
        res.push({ g: 'Инфлюенсеры', t: i.name, s: 'скор ' + (i.score || '—'), act: function () { BOS.go('influencers'); } });
    });
    /* справочные данные */
    REF.banks.forEach(function (b) {
      b.items.forEach(function (it) {
        if (String(it).toLowerCase().indexOf(q) >= 0)
          res.push({ g: 'Банк: ' + b.name, t: it, s: '', act: function () { BOS.go('content'); } });
      });
    });
    REF.objections.forEach(function (o) {
      if ((o.q + ' ' + o.a).toLowerCase().indexOf(q) >= 0)
        res.push({ g: 'Возражения', t: o.q, s: o.a, act: function () { BOS.go('knowledge'); } });
    });
    REF.prompts.forEach(function (p) {
      if ((p.n + ' ' + p.task).toLowerCase().indexOf(q) >= 0)
        res.push({ g: 'Промпты', t: p.n, s: p.role + ' · ' + p.task, act: function () { BOS.go('ai'); } });
    });

    if (!res.length) {
      UI.modal('Поиск: ' + searchEl.value,
        '<div class="empty"><div class="e-t">Ничего не нашлось</div><p>Попробуйте другое слово или его часть.</p></div>', '');
      return;
    }

    var groups = {};
    res.slice(0, 60).forEach(function (r) { (groups[r.g] = groups[r.g] || []).push(r); });

    var html = '<p class="note dim" style="margin-bottom:14px">Найдено ' + res.length
      + (res.length > 60 ? ', показаны первые 60' : '') + '</p>';
    var idx = 0;
    Object.keys(groups).forEach(function (g) {
      html += '<h3 class="sub3">' + E(g) + ' · ' + groups[g].length + '</h3>';
      groups[g].forEach(function (r) {
        html += '<div class="card hov" style="margin-bottom:8px;cursor:pointer" data-res="' + idx + '">'
          + '<h4 style="font-size:13.5px">' + E(r.t) + '</h4>'
          + (r.s ? '<p class="dim" style="font-size:12px;margin-top:4px">' + E(r.s) + '</p>' : '') + '</div>';
        r._i = idx++;
      });
    });

    UI.modal('Поиск: ' + searchEl.value, html, '', function (body) {
      body.querySelectorAll('[data-res]').forEach(function (el) {
        el.onclick = function () {
          var i = Number(el.getAttribute('data-res'));
          var found = null;
          res.forEach(function (r) { if (r._i === i) found = r; });
          UI.closeModal();
          if (found) found.act();
        };
      });
    });
  }

  /* ── горячие клавиши ────────────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') UI.closeModal();
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); searchEl.focus(); }
    /* N — новая задача, если фокус не в поле ввода */
    if (e.key === 'n' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
      var mr = document.getElementById('modal-root');
      if (mr.hidden) { e.preventDefault(); UI.taskModal(null); }
    }
  });

  /* ── закрытие сайдбара по клику вне ─────────────────────────── */
  document.addEventListener('click', function (e) {
    var sb = document.getElementById('sidebar');
    if (!sb.classList.contains('open')) return;
    if (sb.contains(e.target) || e.target.id === 'btn-burger') return;
    sb.classList.remove('open');
  });

  console.log('%cBumble Marketing OS', 'font-weight:bold;color:#F6B54B',
    '· состояние в localStorage, экспорт кнопкой слева внизу');
})();
