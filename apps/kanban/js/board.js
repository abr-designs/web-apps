// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28

// Board rendering: lanes, cards and HTML5 drag-drop.
window.Kanban = window.Kanban || {};

(function (K) {
  'use strict';

  const { el, formatDate, isOverdue, tagColor, formatMinutes, formatTokens, assigneeLabel, CLAUDE } = K.util;

  let draggingIds = null; // the dragged card, or every ticked card when a ticked one is dragged
  const marker = el('div', { class: 'drop-marker' });

  function byOrder(a, b) {
    return a.order - b.order || a.id.localeCompare(b.id);
  }

  // Tasks whose lane id is unknown show in the first lane.
  function laneOf(task, laneIds, firstLane) {
    return laneIds.has(task.lane) ? task.lane : firstLane;
  }

  // Person, sub-agent or Claude (main session).
  function chipClass(value) {
    return value === CLAUDE ? ' claude' : value.startsWith('agent:') ? ' agent' : '';
  }

  function chipIcon(value) {
    return value === CLAUDE ? '✳ ' : value.startsWith('agent:') ? '\u{1F916} ' : '\u{1F464} ';
  }

  function renderCard(task, opts) {
    const counts = [
      task.comments.length > 0 && el('span', { title: 'Comments' }, '\u{1F4AC} ' + task.comments.length),
      task.attachments.length > 0 && el('span', { title: 'Attachments' }, '\u{1F4CE} ' + task.attachments.length),
      task.links.length > 0 && el('span', { title: 'Links' }, '\u{1F517} ' + task.links.length),
    ];
    const sprint = task.sprint && opts.project.sprints.find((s) => s.id === task.sprint);
    const minutes = task.work.reduce((n, w) => n + w.minutes, 0);
    const tokens = task.work.reduce((n, w) => n + w.tokens, 0);
    const shot = task.screenshot && K.storage.hasScreenshot(task);
    const meta = [
      task.assignee && el('span', { class: 'assignee-chip' + chipClass(task.assignee), title: 'Assignee' }, chipIcon(task.assignee) + assigneeLabel(task.assignee)),
      task.reviewer && el('span', { class: 'reviewer-chip', title: 'Reviewer' }, '\u{1F441} ' + assigneeLabel(task.reviewer)),
      sprint && el('span', { class: 'sprint-chip', title: 'Sprint' }, '\u{1F3C1} ' + sprint.name),
      task.due && el('span', { class: 'due' + (isOverdue(task.due) && task.lane !== opts.project.lanes.at(-1).id ? ' overdue' : ''), title: 'Due date' }, '\u{1F4C5} ' + formatDate(task.due)),
      task.screenshot && el('span', { class: shot ? '' : 'overdue', title: shot ? 'Screenshot attached' : 'Screenshot required' }, '\u{1F4F7}' + (shot ? '' : ' needed')),
      task.work.length > 0 && el('span', { title: 'Time and tokens spent' }, '⏱ ' + formatMinutes(minutes) + (tokens ? ' · ' + formatTokens(tokens) + ' tok' : '')),
      ...counts,
    ].filter(Boolean);
    const card = el('div', {
      class: 'card' + (opts.selected.has(task.id) ? ' selected' : ''), draggable: true, tabindex: '0',
      dataset: { id: task.id, priority: task.priority },
      onclick: () => opts.onOpen(task),
      onkeydown: (e) => { if (e.key === 'Enter') opts.onOpen(task); },
      ondragstart: (e) => {
        draggingIds = opts.dragIds(task.id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggingIds.join(' '));
        const board = card.closest('.board') || document;
        const ids = draggingIds;
        requestAnimationFrame(() => draggingIds === ids && ids.forEach((id) => { const c = board.querySelector('.card[data-id="' + id + '"]'); if (c) c.classList.add('dragging'); }));
        opts.onDragState(true);
      },
      ondragend: () => {
        draggingIds = null;
        document.querySelectorAll('.card.dragging').forEach((c) => c.classList.remove('dragging'));
        marker.remove();
        opts.onDragState(false);
      },
    },
      el('div', { class: 'card-head' },
        el('input', {
          type: 'checkbox', class: 'card-check', checked: opts.selected.has(task.id), 'aria-label': 'Select ' + task.id, title: 'Select (Shift: range)',
          // The card itself opens the editor; the box only selects.
          onclick: (e) => { e.stopPropagation(); e.preventDefault(); opts.onSelect(task.id, e.shiftKey); },
          onkeydown: (e) => e.stopPropagation(),
        }),
        el('span', { class: 'card-id', text: task.id }),
        el('span', { class: 'badge priority-' + task.priority, text: task.priority })),
      el('div', { class: 'card-title', text: task.title || '(untitled)' }),
      task.labels.length > 0 && el('div', { class: 'card-labels' }, task.labels.map((l) => el('span', { class: 'label tag-' + tagColor(l, opts.project.labels), text: l }))),
      meta.length > 0 && el('div', { class: 'card-meta' }, meta));
    return card;
  }

  function placeMarker(list, clientY) {
    const cards = [...list.querySelectorAll('.card:not(.dragging)')];
    const next = cards.find((c) => {
      const box = c.getBoundingClientRect();
      return clientY < box.top + box.height / 2;
    });
    if (next) list.insertBefore(marker, next);
    else list.append(marker);
  }

  // The drop target is "before the next visible card", or the end of the lane.
  function beforeIdAtMarker() {
    let n = marker.nextElementSibling;
    while (n && (!n.classList.contains('card') || n.classList.contains('dragging'))) n = n.nextElementSibling;
    return n ? n.dataset.id : null;
  }

  function renderLane(lane, tasks, total, opts) {
    const list = el('div', {
      class: 'lane-cards',
      ondragover: (e) => {
        if (!draggingIds) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        placeMarker(list, e.clientY);
      },
      ondrop: (e) => {
        if (!draggingIds) return;
        e.preventDefault();
        const ids = draggingIds;
        const beforeId = beforeIdAtMarker();
        marker.remove();
        opts.onMove(ids, lane.id, beforeId);
      },
    }, tasks.map((t) => renderCard(t, opts)));

    const count = tasks.length === total ? String(total) : tasks.length + ' / ' + total;
    const ids = tasks.map((t) => t.id);
    const ticked = ids.filter((id) => opts.selected.has(id)).length;
    const all = el('input', {
      type: 'checkbox', class: 'lane-check', checked: ids.length > 0 && ticked === ids.length, disabled: !ids.length,
      'aria-label': 'Select the visible tasks in ' + lane.name, title: 'Select the visible tasks',
      onclick: (e) => { e.preventDefault(); opts.onSelectLane(ids, ticked < ids.length); },
    });
    all.indeterminate = ticked > 0 && ticked < ids.length;
    return el('section', { class: 'lane', dataset: { lane: lane.id } },
      el('header', { class: 'lane-head' },
        all,
        el('span', { class: 'lane-name', text: lane.name }),
        el('span', { class: 'lane-count', text: count })),
      el('button', { class: 'lane-add', text: '+ Add task', onclick: () => opts.onAdd(lane.id) }),
      list);
  }

  // opts: { project, tasks, visible(task) -> bool, onOpen, onAdd, onMove(taskIds, laneId, beforeId), onDragState,
  //         selected: Set of ids, onSelect(id, shift), onSelectLane(ids, on), dragIds(id) -> ids to drag }
  function render(root, opts) {
    const lanes = opts.project.lanes;
    const laneIds = new Set(lanes.map((l) => l.id));
    const first = lanes[0].id;
    const scroll = root.scrollLeft;
    root.replaceChildren(...lanes.map((lane) => {
      const all = opts.tasks.filter((t) => laneOf(t, laneIds, first) === lane.id).sort(byOrder);
      return renderLane(lane, all.filter(opts.visible), all.length, opts);
    }));
    root.scrollLeft = scroll;
  }

  K.board = { render, byOrder, laneOf };
})(window.Kanban);
