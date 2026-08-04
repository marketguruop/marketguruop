/* ══════════════════════════════════════════════════════════════════════
   UI-КОМПОНЕНТЫ. Всё возвращает HTML-строку либо монтируется в узел.
   Правила бренда, зашитые сюда:
   · загрузка = три зерна, не спиннер
   · пустой экран = «Свет ещё не поднялся» + одна кнопка
   · ошибка = что случилось и что нажать, без извинений и юмора
   ══════════════════════════════════════════════════════════════════════ */
window.UI = (function () {
  'use strict';
  var E = BOS.esc;

  /* ── заголовок экрана ────────────────────────────────────────────── */
  function head(o) {
    return '<div class="page-head rise">'
      + (o.eyebrow ? '<span class="eyebrow">' + E(o.eyebrow) + '</span>' : '')
      + '<h1>' + E(o.title) + '</h1>'
      + (o.sub ? '<p class="sub">' + o.sub + '</p>' : '')
      + '</div>';
  }

  /* ── KPI-плитка ──────────────────────────────────────────────────── */
  function kpi(o) {
    var cls = 'kpi' + (o.hot ? ' hot' : '') + (o.bad ? ' bad' : '');
    var bar = '';
    if (o.pct !== undefined && o.pct !== null) {
      var p = BOS.clamp(o.pct, 0, 100);
      bar = '<div class="bar' + (o.pct > 100 ? ' over' : '') + '"><i style="width:' + p + '%"></i></div>';
    }
    return '<div class="' + cls + '">'
      + '<div class="kpi-top"><div class="kpi-label">' + E(o.label) + '</div>'
      + '<div class="kpi-val">' + E(o.value) + '</div>' + bar + '</div>'
      + '<div class="kpi-bot"><span>' + (o.foot || '') + '</span>'
      + (o.right ? '<span class="mono dim">' + E(o.right) + '</span>' : '') + '</div></div>';
  }

  /* ── чипы ────────────────────────────────────────────────────────── */
  function prChip(id) {
    var p = BOS.priority(id);
    return '<span class="chip sm ' + p.cls + '">' + p.label + '</span>';
  }
  function chip(text, cls) {
    return '<span class="chip sm ' + (cls || '') + '">' + E(text) + '</span>';
  }
  function beans(n) {
    var s = '<span class="beans3">';
    for (var i = 1; i <= 3; i++) s += '<i class="' + (i <= n ? 'on' : '') + '"></i>';
    return s + '</span>';
  }
  /** Дата с подсветкой просрочки. */
  function due(d) {
    if (!d) return '<span class="dim">—</span>';
    var left = BOS.daysLeft(d);
    var cls = left < 0 ? 'overdue' : (left <= 2 ? 'soon' : '');
    var tail = left < 0 ? ' (−' + Math.abs(left) + 'д)' : (left === 0 ? ' (сегодня)' : '');
    return '<span class="mono ' + cls + '">' + BOS.fmtDate(d) + tail + '</span>';
  }

  /* ── таблица с сортировкой ───────────────────────────────────────── */
  /**
   * cols: [{key, label, num, w, render(row)}]
   * onRow: id → действие по клику
   */
  var sortState = {};
  function table(id, cols, rows, onRowClick) {
    var st = sortState[id] || {};
    if (st.key) rows = BOS.sortBy(rows, st.key, st.dir);
    var html = '<div class="tablewrap"><table data-tid="' + id + '"><thead><tr>'
      + cols.map(function (c) {
        var arrow = st.key === c.key ? (st.dir === 'desc' ? ' ↓' : ' ↑') : '';
        return '<th class="' + (c.num ? 'num ' : '') + (c.key ? '' : 'nosort') + '"'
          + (c.key ? ' data-sort="' + c.key + '"' : '')
          + (c.w ? ' style="width:' + c.w + '"' : '') + '>' + E(c.label) + arrow + '</th>';
      }).join('')
      + '</tr></thead><tbody>';
    if (!rows.length) {
      html += '<tr><td colspan="' + cols.length + '"><div class="empty">'
        + '<div class="e-t">Свет ещё не поднялся</div><p>Здесь пока пусто.</p></div></td></tr>';
    }
    rows.forEach(function (r) {
      html += '<tr' + (onRowClick ? ' class="rowlink" data-row="' + E(r.id) + '"' : '') + '>'
        + cols.map(function (c) {
          var v = c.render ? c.render(r) : E(r[c.key]);
          return '<td class="' + (c.num ? 'num' : '') + (c.cls ? ' ' + c.cls : '') + '">' + v + '</td>';
        }).join('') + '</tr>';
    });
    html += '</tbody></table></div>';

    // отложенная привязка обработчиков
    setTimeout(function () {
      var t = document.querySelector('table[data-tid="' + id + '"]');
      if (!t) return;
      t.querySelectorAll('th[data-sort]').forEach(function (th) {
        th.onclick = function () {
          var k = th.getAttribute('data-sort');
          var s = sortState[id] || {};
          sortState[id] = { key: k, dir: (s.key === k && s.dir === 'asc') ? 'desc' : 'asc' };
          BOS.render();
        };
      });
      if (onRowClick) {
        t.querySelectorAll('tr[data-row]').forEach(function (tr) {
          tr.onclick = function () { onRowClick(tr.getAttribute('data-row')); };
        });
      }
    }, 0);
    return html;
  }

  /* ── перемещение карточки без перетаскивания ─────────────────────
     На iPad и iPhone HTML5 drag-and-drop не работает вообще, поэтому
     у каждой карточки есть стрелки. На десктопе они тоже удобнее мыши,
     когда нужно сдвинуть одну задачу на шаг. */
  function statusIndex(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return i;
    return 0;
  }
  function moveBtns(id, idx, total) {
    return '<span class="kmove">'
      + '<button class="kmv" data-mv="-1" data-mvid="' + E(id) + '"' + (idx <= 0 ? ' disabled' : '') + ' aria-label="Назад">‹</button>'
      + '<button class="kmv" data-mv="1" data-mvid="' + E(id) + '"' + (idx >= total - 1 ? ' disabled' : '') + ' aria-label="Вперёд">›</button>'
      + '</span>';
  }

  /* ── канбан задач с перетаскиванием ──────────────────────────────── */
  function kanban(tasks, opts) {
    opts = opts || {};
    var cols = BOS.STATUS;
    var html = '<div class="kanban" id="kanban">';
    cols.forEach(function (c) {
      var list = tasks.filter(function (t) { return (t.status || 'backlog') === c.id; });
      html += '<div class="kcol" data-status="' + c.id + '">'
        + '<div class="kcol-h">' + E(c.label) + '<span class="n">' + list.length + '</span></div>'
        + '<div class="kcol-b">'
        + list.map(function (t) {
          var left = BOS.daysLeft(t.due);
          var dueCls = left !== null && left < 0 ? 'overdue' : (left !== null && left <= 2 ? 'soon' : '');
          var ci = statusIndex(BOS.STATUS, c.id);
          return '<div class="kcard p-' + (t.priority || 'medium') + '" draggable="true" data-id="' + E(t.id) + '">'
            + '<div class="kt">' + E(t.title) + '</div>'
            + '<div class="km">'
            + (t.due ? '<span class="' + dueCls + '">' + BOS.fmtDate(t.due) + '</span>' : '')
            + (t.assignee ? '<span>' + E(who(t.assignee)) + '</span>' : '')
            + (t.module ? '<span class="dim">' + E(t.module) + '</span>' : '')
            + (t.blocked ? '<span class="overdue">блок</span>' : '')
            + moveBtns(t.id, ci, BOS.STATUS.length)
            + '</div></div>';
        }).join('')
        + '</div></div>';
    });
    html += '</div>';

    setTimeout(function () { bindKanban(opts.onOpen); }, 0);
    return html;
  }

  function bindKanban(onOpen) {
    var root = document.getElementById('kanban');
    if (!root) return;
    var dragId = null;
    root.querySelectorAll('.kcard').forEach(function (el) {
      el.addEventListener('dragstart', function (e) {
        dragId = el.getAttribute('data-id');
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', dragId); } catch (err) { }
      });
      el.addEventListener('dragend', function () { el.classList.remove('dragging'); });
      el.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('.kmove')) return;
        if (onOpen) onOpen(el.getAttribute('data-id'));
        else taskModal(el.getAttribute('data-id'));
      });
    });
    bindMove(root, 'tasks', BOS.STATUS);
    root.querySelectorAll('.kcol').forEach(function (col) {
      col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('drop'); });
      col.addEventListener('dragleave', function () { col.classList.remove('drop'); });
      col.addEventListener('drop', function (e) {
        e.preventDefault();
        col.classList.remove('drop');
        var id = dragId || e.dataTransfer.getData('text/plain');
        if (!id) return;
        BOS.patch('tasks', id, { status: col.getAttribute('data-status') });
        BOS.render();
      });
    });
  }

  /** Стрелки на карточках: сдвигают статус на шаг влево или вправо. */
  function bindMove(root, collection, statuses) {
    if (!root) return;
    root.querySelectorAll('.kmv').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        if (b.disabled) return;
        var id = b.getAttribute('data-mvid');
        var item = BOS.find(collection, id);
        if (!item) return;
        var i = statusIndex(statuses, item.status || statuses[0].id) + Number(b.getAttribute('data-mv'));
        i = BOS.clamp(i, 0, statuses.length - 1);
        BOS.patch(collection, id, { status: statuses[i].id });
        toast(statuses[i].label || statuses[i].n);
        BOS.render();
      });
    });
  }

  /* ── имя исполнителя ─────────────────────────────────────────────── */
  function who(key) {
    var n = BOS.settings.names || {};
    return n[key] || key || '—';
  }
  function peopleOptions(sel) {
    var n = BOS.settings.names || {};
    return Object.keys(n).map(function (k) {
      return '<option value="' + k + '"' + (sel === k ? ' selected' : '') + '>' + E(n[k]) + '</option>';
    }).join('');
  }

  /* ── фильтры ─────────────────────────────────────────────────────── */
  var filterState = {};
  function filters(id, defs, onChange) {
    var st = filterState[id] || (filterState[id] = {});
    var html = '<div class="filters" data-fid="' + id + '">';
    defs.forEach(function (d) {
      if (d.type === 'seg') {
        html += '<div class="seg">' + d.options.map(function (o) {
          var on = (st[d.key] || d.def) === o.v;
          return '<button data-fk="' + d.key + '" data-fv="' + E(o.v) + '"' + (on ? ' class="on"' : '') + '>' + E(o.l) + '</button>';
        }).join('') + '</div>';
      } else if (d.type === 'search') {
        html += '<input type="search" data-fk="' + d.key + '" placeholder="' + E(d.placeholder || 'Поиск') + '" value="' + E(st[d.key] || '') + '">';
      } else {
        html += '<select data-fk="' + d.key + '">'
          + d.options.map(function (o) {
            return '<option value="' + E(o.v) + '"' + ((st[d.key] || '') === o.v ? ' selected' : '') + '>' + E(o.l) + '</option>';
          }).join('') + '</select>';
      }
    });
    html += '<div class="spacer"></div>' + (defs.extra || '') + '</div>';

    setTimeout(function () {
      var root = document.querySelector('.filters[data-fid="' + id + '"]');
      if (!root) return;
      root.querySelectorAll('select[data-fk],input[data-fk]').forEach(function (el) {
        el.oninput = el.onchange = function () {
          st[el.getAttribute('data-fk')] = el.value;
          if (onChange) onChange(st); else BOS.render();
        };
      });
      root.querySelectorAll('button[data-fk]').forEach(function (b) {
        b.onclick = function () {
          st[b.getAttribute('data-fk')] = b.getAttribute('data-fv');
          if (onChange) onChange(st); else BOS.render();
        };
      });
    }, 0);
    return html;
  }
  function fval(id, key, def) {
    var st = filterState[id] || {};
    return st[key] !== undefined && st[key] !== '' ? st[key] : (def || '');
  }

  /* ── модалка ─────────────────────────────────────────────────────── */
  function modal(title, bodyHTML, footHTML, onMount) {
    var root = document.getElementById('modal-root');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-foot').innerHTML = footHTML || '';
    root.hidden = false;
    document.body.style.overflow = 'hidden';
    root.querySelectorAll('[data-close]').forEach(function (el) { el.onclick = closeModal; });
    if (onMount) onMount(document.getElementById('modal-body'), document.getElementById('modal-foot'));
  }
  function closeModal() {
    document.getElementById('modal-root').hidden = true;
    document.body.style.overflow = '';
  }

  /* ── редактор задачи ─────────────────────────────────────────────── */
  function taskModal(id) {
    var t = id ? BOS.find('tasks', id) : null;
    var isNew = !t;
    t = t || { priority: 'medium', status: 'todo', assignee: BOS.settings.me || 'cmo', due: BOS.today(), hours: 2 };

    var body =
      '<div class="field"><label>Задача</label><input id="f-title" value="' + E(t.title || '') + '" placeholder="Что именно нужно сделать"></div>'
      + '<div class="frow">'
      + '<div class="field"><label>Направление</label><input id="f-module" value="' + E(t.module || '') + '" placeholder="Instagram / PR / Ритейл…"></div>'
      + '<div class="field"><label>Исполнитель</label><select id="f-assignee">' + peopleOptions(t.assignee) + '</select></div>'
      + '</div>'
      + '<div class="field"><label>Цель — зачем это делаем</label><input id="f-goal" value="' + E(t.goal || '') + '" placeholder="Какой результат считаем успехом"></div>'
      + '<div class="field"><label>Описание и шаги</label><textarea id="f-desc" placeholder="Что сделать по шагам">' + E(t.desc || '') + '</textarea></div>'
      + '<div class="frow">'
      + '<div class="field"><label>Референсы и материалы</label><input id="f-refs" value="' + E(t.refs || '') + '" placeholder="Ссылки через запятую"></div>'
      + '<div class="field"><label>Ожидаемый результат</label><input id="f-expected" value="' + E(t.expected || '') + '" placeholder="3 Reels, 1 отчёт…"></div>'
      + '</div>'
      + '<div class="frow">'
      + '<div class="field"><label>Приоритет</label><select id="f-priority">'
      + BOS.PRIORITY.map(function (p) { return '<option value="' + p.id + '"' + (t.priority === p.id ? ' selected' : '') + '>' + p.label + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="field"><label>Статус</label><select id="f-status">'
      + BOS.STATUS.map(function (s) { return '<option value="' + s.id + '"' + (t.status === s.id ? ' selected' : '') + '>' + s.label + '</option>'; }).join('')
      + '</select></div>'
      + '</div>'
      + '<div class="frow">'
      + '<div class="field"><label>Дедлайн</label><input type="date" id="f-due" value="' + E(t.due || '') + '"></div>'
      + '<div class="field"><label>Оценка, часов</label><input type="number" id="f-hours" min="0" step="0.5" value="' + E(t.hours || 2) + '"></div>'
      + '</div>'
      + '<div class="field"><label>Результат и следующий шаг</label><textarea id="f-result" placeholder="Заполняется при закрытии">' + E(t.result || '') + '</textarea></div>'
      + '<div class="field"><label><input type="checkbox" id="f-blocked" style="width:auto;margin-right:8px"' + (t.blocked ? ' checked' : '') + '> Заблокировано — нужно решение</label>'
      + '<input id="f-blockwhy" value="' + E(t.blockWhy || '') + '" placeholder="Чем заблокировано и от кого ждём" style="margin-top:6px"></div>'
      + (t.comments && t.comments.length
        ? '<h3 class="sub3">Комментарии</h3>' + t.comments.map(function (c) {
          return '<div class="cmt"><div class="meta">' + BOS.fmtDate(c.at) + ' · ' + E(who(c.who)) + '</div>' + E(c.text) + '</div>';
        }).join('') : '')
      + '<div class="field" style="margin-top:12px"><label>Новый комментарий</label><input id="f-comment" placeholder="Оставить комментарий"></div>';

    var foot = (isNew ? '' : '<button class="btn danger sm" id="m-del">Удалить</button>')
      + '<button class="btn" data-close>Отмена</button>'
      + '<button class="btn-gold" id="m-save">Сохранить</button>';

    modal(isNew ? 'Новая задача' : 'Задача', body, foot, function () {
      document.getElementById('m-save').onclick = function () {
        var v = function (i) { var el = document.getElementById(i); return el ? el.value : ''; };
        var obj = Object.assign({}, t, {
          title: v('f-title') || 'Без названия',
          module: v('f-module'), assignee: v('f-assignee'), goal: v('f-goal'),
          desc: v('f-desc'), refs: v('f-refs'), expected: v('f-expected'),
          priority: v('f-priority'), status: v('f-status'), due: v('f-due'),
          hours: Number(v('f-hours')) || 0, result: v('f-result'),
          blocked: document.getElementById('f-blocked').checked,
          blockWhy: v('f-blockwhy')
        });
        var saved = BOS.upsert('tasks', obj);
        var c = v('f-comment');
        if (c) BOS.addComment('tasks', saved.id, c);
        closeModal();
        toast('Сохранено');
        BOS.render();
      };
      var del = document.getElementById('m-del');
      if (del) del.onclick = function () {
        if (confirm('Удалить задачу без возможности вернуть?')) {
          BOS.remove('tasks', t.id); closeModal(); BOS.render();
        }
      };
    });
  }

  /* ── тост ────────────────────────────────────────────────────────── */
  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 1900);
  }

  /* ── копирование в буфер ─────────────────────────────────────────── */
  function bindCopy(root) {
    (root || document).querySelectorAll('[data-copy]').forEach(function (b) {
      b.onclick = function () {
        var sel = b.getAttribute('data-copy');
        var src = document.getElementById(sel);
        var text = src ? (src.innerText || src.textContent) : sel;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(function () { toast('Скопировано'); },
            function () { fallbackCopy(text); });
        } else fallbackCopy(text);
      };
    });
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Скопировано'); }
    catch (e) { toast('Не удалось скопировать — выделите текст вручную'); }
    document.body.removeChild(ta);
  }

  /* ── аккордеон-блок ──────────────────────────────────────────────── */
  function acc(title, bodyHTML, open, badge) {
    return '<details class="acc"' + (open ? ' open' : '') + '><summary>' + E(title)
      + (badge ? ' <span class="chip sm">' + E(badge) + '</span>' : '')
      + '</summary><div class="acc-b">' + bodyHTML + '</div></details>';
  }

  /* ── карточка ────────────────────────────────────────────────────── */
  function card(o) {
    return '<div class="card hov">'
      + (o.cap ? '<div class="cap">' + E(o.cap) + '</div>' : '')
      + (o.title ? '<h4>' + E(o.title) + '</h4>' : '')
      + (o.body || '')
      + '</div>';
  }

  /* ── список пунктов «три зерна» ──────────────────────────────────── */
  function beanList(arr) {
    return '<ul class="beans">' + arr.map(function (x) { return '<li>' + (typeof x === 'string' ? E(x) : x) + '</li>'; }).join('') + '</ul>';
  }

  /* ── пустое состояние ────────────────────────────────────────────── */
  function empty(text, btnLabel, onClick) {
    var bid = BOS.uid('e');
    setTimeout(function () {
      var b = document.getElementById(bid);
      if (b && onClick) b.onclick = onClick;
    }, 0);
    return '<div class="empty"><div class="e-t">Свет ещё не поднялся</div><p>' + E(text) + '</p>'
      + (btnLabel ? '<button class="btn-gold" id="' + bid + '" style="margin-top:14px">' + E(btnLabel) + '</button>' : '')
      + '</div>';
  }

  return {
    head: head, kpi: kpi, chip: chip, prChip: prChip, beans: beans, due: due,
    table: table, kanban: kanban, filters: filters, fval: fval,
    modal: modal, closeModal: closeModal, taskModal: taskModal,
    toast: toast, bindCopy: bindCopy, acc: acc, card: card, beanList: beanList,
    empty: empty, who: who, peopleOptions: peopleOptions,
    moveBtns: moveBtns, bindMove: bindMove, statusIndex: statusIndex
  };
})();
