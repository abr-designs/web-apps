// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28

// App wiring: connect screen, recent folders, toolbar, state, polling.
window.Kanban = window.Kanban || {};

(function (K) {
  'use strict';

  const { el, nowIso, getAuthor, setAuthor, assigneeLabel, isAgentValue, CLAUDE } = K.util;
  const S = K.storage;
  const POLL_MS = 3000;
  const NO_SPRINT = '__none';
  const ASSIGNEE_ME = '__me';
  const ASSIGNEE_AGENTS = '__agents';
  const ASSIGNEE_NONE = '__none';
  const OPEN_FOLDER = '__open';
  const FORGET_FOLDER = '__forget';
  const MOVE_TOP = '__top';
  const BROWSE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'];

  const state = {
    recent: [],     // [{ handle, name }] recently opened project folders, newest first
    handle: null,   // connected folder, null in memory mode
    hasProject: false,
    missing: false,   // the connected folder was deleted or moved
    switching: false, // a folder switch (permission prompt or picker) is in progress
    data: null,     // result of S.loadProject
    writes: 0,      // writes in flight
    dragging: false,
    polling: false,
    sprintFilter: null, // null = not chosen yet for this folder, '' = all, NO_SPRINT, or a sprint id
    assigneeFilter: '', // '' = all, ASSIGNEE_ME, ASSIGNEE_AGENTS, ASSIGNEE_NONE, or an exact assignee
    reviewerFilter: '', // same values, for the reviewer
    agents: [],       // from agents.json next to project.json
    selected: new Set(), // ids of the cards ticked for bulk edit; pruned to visible cards on render
    anchor: null,     // last card ticked without Shift, the start of a Shift range
    gen: 0,        // bumped on every write or load; a poll that started earlier discards its result
  };

  const $ = (id) => document.getElementById(id);

  async function withWrite(fn) {
    state.writes++;
    state.gen++;
    try { return await fn(); } catch (err) { alert(err.message); } finally { state.writes--; }
  }

  // ---------- Connect ----------

  function showConnect(show) {
    $('connect').hidden = !show;
    $('app').hidden = show;
  }

  // Bumping gen first makes loads and polls that started on the previous folder discard their results.
  async function connectHandle(handle) {
    state.gen++;
    S.useHandle(handle);
    state.handle = handle;
    state.sprintFilter = null;
    clearSelection();
    await start();
  }

  async function pickFolder() {
    if (state.switching) return;
    state.switching = true;
    try {
      const handle = await window.showDirectoryPicker({ id: 'kanban-data', mode: 'readwrite', startIn: state.handle || 'documents' });
      await connectHandle(handle);
    } catch (err) {
      if (err.name !== 'AbortError') alert(err.message);
    } finally {
      state.switching = false;
    }
    renderProjectSelect(); // restores the selection after a cancelled pick
  }

  // Needs a user gesture when the browser asks for permission again.
  async function openRecent(entry) {
    if (state.switching) return;
    state.switching = true;
    try {
      if (state.handle && await entry.handle.isSameEntry(state.handle).catch(() => false)) return;
      let perm = await entry.handle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') perm = await entry.handle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') await connectHandle(entry.handle);
    } catch (err) {
      alert(err.message);
    } finally {
      state.switching = false;
      renderProjectSelect();
    }
  }

  // A deleted or moved folder throws NotFoundError as soon as it is read.
  async function folderMissing(handle) {
    try {
      await handle.entries().next();
      return false;
    } catch (err) {
      return err.name === 'NotFoundError';
    }
  }

  async function forgetCurrent() {
    if (!state.handle) return;
    const handle = state.handle;
    state.recent = await S.forgetHandle(handle);
    state.gen++;
    state.handle = null;
    state.data = null;
    const next = state.recent[0];
    if (next && (await next.handle.queryPermission({ mode: 'readwrite' }).catch(() => 'denied')) === 'granted') return connectHandle(next.handle);
    renderRecentList();
    showConnect(true);
  }

  function useMemory() {
    state.gen++;
    S.useMemory();
    state.handle = null;
    state.sprintFilter = null;
    clearSelection();
    start();
  }

  async function init() {
    wireToolbar();
    $('btn-open-folder').onclick = pickFolder;
    $('btn-memory').onclick = useMemory;

    if (!S.hasFolderSupport) {
      $('btn-open-folder').hidden = true;
      $('btn-folder').hidden = true;
      $('connect-note').textContent = 'This browser cannot open local folders (use Chrome or Edge). Memory mode works; use Export to keep your data.';
      showConnect(true);
      return;
    }
    state.recent = await S.loadRecent();
    const last = state.recent[0];
    if (last && (await last.handle.queryPermission({ mode: 'readwrite' }).catch(() => 'denied')) === 'granted') return connectHandle(last.handle);
    renderRecentList();
    showConnect(true);
  }

  // Connect screen: one button per recent folder.
  function renderRecentList() {
    $('recent-list').replaceChildren(...state.recent.map((entry, i) =>
      el('button', { class: i === 0 ? 'primary' : '', text: entry.name + (entry.name !== entry.handle.name ? ' (' + entry.handle.name + ')' : ''), onclick: () => openRecent(entry) })));
    $('recent-block').hidden = !state.recent.length;
  }

  async function start() {
    showConnect(false);
    $('folder-name').textContent = S.mode === 'memory' ? 'In memory (export to keep)' : 'Folder: ' + S.rootName;
    await reload();
  }

  // ---------- Project ----------

  async function reload() {
    const handle = state.handle;
    const gen = state.gen;
    state.missing = !!handle && await folderMissing(handle);
    const agents = state.missing ? [] : await S.loadAgents();
    if (handle !== state.handle || gen !== state.gen) return; // switched folders meanwhile
    state.agents = agents;
    await openProject();
    // A missing folder stays where it is in the list instead of moving to the top.
    if (handle && !state.missing && handle === state.handle) {
      const name = state.data ? state.data.project.name : handle.name;
      const recent = await S.rememberHandle(handle, name).catch((err) => { console.warn('Could not remember folder', err); return null; });
      if (recent && handle === state.handle) state.recent = recent;
    }
    renderProjectSelect();
  }

  async function openProject() {
    const gen = ++state.gen;
    const has = !state.missing && await S.hasProject();
    const data = has ? await S.loadProject().catch((err) => { alert(err.message); return null; }) : null;
    if (gen !== state.gen) return; // a newer load, write or folder switch started meanwhile
    state.hasProject = has;
    state.data = data;
    if (data && state.sprintFilter === null) {
      // Opening a folder: default the sprint filter to the first active sprint.
      const active = data.project.sprints.find((s) => s.status === 'active');
      state.sprintFilter = active ? active.id : '';
    }
    render();
  }

  async function poll() {
    if (!state.data || state.polling || state.writes || state.dragging || document.hidden || document.querySelector('dialog[open]')) return;
    state.polling = true;
    const gen = state.gen;
    try {
      const data = await S.loadProject();
      // Discard if anything was written or loaded, or a drag or dialog started, while we were reading.
      if (gen === state.gen && data.signature !== state.data.signature && !state.dragging && !document.querySelector('dialog[open]')) {
        state.data = data;
        render();
      }
    } catch (err) {
      console.warn('Poll failed', err);
    } finally {
      state.polling = false;
    }
  }

  // ---------- Render ----------

  // Recent folders, the current one selected, then "Open folder...".
  function renderProjectSelect() {
    const select = $('project-select');
    if (!state.handle) {
      select.replaceChildren(el('option', { text: 'In memory', selected: true }), ...(S.hasFolderSupport ? [el('option', { value: OPEN_FOLDER, text: 'Open folder...' })] : []));
      return;
    }
    // Two folders can hold projects with the same name; the folder name tells them apart.
    const shared = (name) => state.recent.filter((r) => r.name === name).length > 1;
    select.replaceChildren(
      ...state.recent.map((entry, i) => el('option', { value: String(i), text: entry.name + (shared(entry.name) ? ' (' + entry.handle.name + ')' : ''), title: entry.handle.name, selected: i === 0 })),
      el('option', { value: OPEN_FOLDER, text: 'Open folder...' }),
      el('option', { value: FORGET_FOLDER, text: 'Remove this folder from recent' }));
  }

  function matches(task) {
    const q = $('search').value.trim().toLowerCase();
    const prio = $('priority-filter').value;
    if (prio && task.priority !== prio) return false;
    const sprint = state.sprintFilter;
    if (sprint === NO_SPRINT) {
      if (state.data.project.sprints.some((s) => s.id === task.sprint)) return false; // unknown ids count as no sprint
    } else if (sprint && task.sprint !== sprint) return false;
    if (!personMatches(task.assignee, state.assigneeFilter) || !personMatches(task.reviewer, state.reviewerFilter)) return false;
    if (!q) return true;
    return [task.id, task.title, task.description, task.assignee, task.reviewer, ...task.labels].some((s) => s.toLowerCase().includes(q));
  }

  // value: a task's assignee or reviewer; filter: '', ASSIGNEE_ME, ASSIGNEE_AGENTS (includes Claude), ASSIGNEE_NONE, or an exact value.
  function personMatches(value, filter) {
    return filter === ASSIGNEE_ME ? value === getAuthor()
      : filter === ASSIGNEE_AGENTS ? isAgentValue(value)
      : filter === ASSIGNEE_NONE ? value === ''
      : !filter || value === filter;
  }

  function render() {
    const has = !!state.data;
    ['btn-settings', 'btn-new-task', 'btn-export'].forEach((id) => { $(id).disabled = !has; });
    renderWarnings();
    const board = $('board');
    if (!has) {
      document.title = 'Kanban';
      board.replaceChildren(state.missing
        ? el('div', { class: 'empty' },
          el('p', { text: 'This folder no longer exists. It was moved or deleted.' }),
          el('p', { class: 'muted', text: 'Remove it from the recent list, or open it again from its new place with "Open folder...".' }),
          el('div', { class: 'row' }, el('button', { class: 'primary', text: 'Remove from recent', onclick: forgetCurrent })))
        : state.hasProject
        ? el('div', { class: 'empty' }, el('p', { text: 'Could not open this project.' }))
        : el('div', { class: 'empty' },
          el('p', { text: 'This folder has no board yet.' }),
          el('p', { class: 'muted', text: 'Create one here, or bring one in with "Import".' }),
          el('div', { class: 'row' },
            el('button', { class: 'primary', text: 'Create board here', onclick: createProject }),
            state.handle && el('button', { text: 'Remove from recent', onclick: forgetCurrent }))));
      clearSelection();
      return;
    }
    document.title = state.data.project.name + ' · Kanban';
    renderSprintFilter();
    renderPersonFilter('assignee-filter', 'assignee', 'assigneeFilter', 'All assignees');
    renderPersonFilter('reviewer-filter', 'reviewer', 'reviewerFilter', 'All reviewers');
    // Bulk edits only touch cards in view: hidden or deleted tasks leave the selection.
    const visibleIds = new Set(state.data.tasks.filter(matches).map((t) => t.id));
    for (const id of state.selected) if (!visibleIds.has(id)) state.selected.delete(id);
    K.board.render(board, {
      project: state.data.project,
      tasks: state.data.tasks,
      visible: matches,
      onOpen: (task) => openEditor(task),
      onAdd: (laneId) => openEditor(null, laneId),
      onMove: moveTasks,
      onDragState: (on) => { state.dragging = on; },
      selected: state.selected,
      onSelect: toggleSelect,
      onSelectLane: selectLane,
      // Dragging a ticked card drags every ticked card, in board order.
      dragIds: (id) => state.selected.has(id) ? boardOrder([...state.selected]) : [id],
    });
    renderBulkBar();
  }

  // Shown while cards are ticked. Each select saves on pick, then returns to its placeholder.
  function renderBulkBar() {
    const bar = $('bulk-bar');
    const n = state.selected.size;
    bar.hidden = !n;
    if (!n) return;
    const placeholder = (text) => el('option', { value: '', text, selected: true, disabled: true });
    bar.replaceChildren(
      el('span', { class: 'bulk-count', text: n + ' selected' }),
      el('select', { title: 'Move the selected tasks', onchange: (e) => moveTasks(boardOrder([...state.selected]), e.target.value, MOVE_TOP) },
        placeholder('Move to...'), ...state.data.project.lanes.map((l) => el('option', { value: l.id, text: l.name }))),
      el('select', { title: 'Assign the selected tasks', onchange: (e) => bulkSet('assignee', e.target.value) },
        placeholder('Assignee...'), ...K.taskEditor.personOptions(state.agents, null)),
      el('select', { title: 'Set the reviewer of the selected tasks', onchange: (e) => bulkSet('reviewer', e.target.value) },
        placeholder('Reviewer...'), ...K.taskEditor.personOptions(state.agents, null)),
      el('button', { class: 'bulk-clear', text: '✕', title: 'Clear selection (Esc)', onclick: () => { clearSelection(); render(); } }));
  }

  function clearSelection() {
    state.selected.clear();
    state.anchor = null;
    renderBulkBar();
  }

  // Shift extends from the anchor to id when both are visible in the same lane.
  function toggleSelect(id, shift) {
    const { project, tasks } = state.data;
    const laneIds = new Set(project.lanes.map((l) => l.id));
    const first = project.lanes[0].id;
    const laneOf = (taskId) => { const t = tasks.find((x) => x.id === taskId); return t && K.board.laneOf(t, laneIds, first); };
    const lane = laneOf(id);
    if (shift && state.anchor && state.anchor !== id && laneOf(state.anchor) === lane) {
      const ids = tasks.filter((t) => K.board.laneOf(t, laneIds, first) === lane && matches(t)).sort(K.board.byOrder).map((t) => t.id);
      const [a, b] = [ids.indexOf(state.anchor), ids.indexOf(id)].sort((x, y) => x - y);
      if (a >= 0) ids.slice(a, b + 1).forEach((x) => state.selected.add(x));
    } else {
      if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id);
      state.anchor = id;
    }
    render();
  }

  function selectLane(ids, on) {
    ids.forEach((id) => { if (on) state.selected.add(id); else state.selected.delete(id); });
    render();
  }

  // Sets key ('assignee' or 'reviewer') on every selected task whose value differs.
  async function bulkSet(key, value) {
    const changed = state.data.tasks.filter((t) => state.selected.has(t.id) && t[key] !== value);
    if (!changed.length) return render();
    changed.forEach((t) => { t[key] = value; t.updated = nowIso(); });
    render();
    await withWrite(async () => {
      for (const t of changed) await S.saveTask(t);
    });
    await openProject();
  }

  // Rebuilt on every render because sprints can change on disk.
  function renderSprintFilter() {
    const sprints = state.data.project.sprints;
    if (state.sprintFilter && state.sprintFilter !== NO_SPRINT && !sprints.some((s) => s.id === state.sprintFilter)) state.sprintFilter = '';
    const option = (value, text) => el('option', { value, text, selected: value === state.sprintFilter });
    $('sprint-filter').replaceChildren(
      option('', 'All sprints'),
      option(NO_SPRINT, 'No sprint'),
      ...sprints.map((s) => option(s.id, s.name + (s.status === 'active' ? ' (active)' : s.status === 'closed' ? ' (closed)' : ''))));
  }

  // Fixed choices, then each value of key ('assignee' or 'reviewer') used in the project.
  function renderPersonFilter(selectId, key, filterKey, allText) {
    const used = [...new Set(state.data.tasks.map((t) => t[key]).filter((v) => v && v !== CLAUDE))].sort();
    const special = [ASSIGNEE_ME, CLAUDE, ASSIGNEE_AGENTS, ASSIGNEE_NONE];
    if (state[filterKey] && !special.includes(state[filterKey]) && !used.includes(state[filterKey])) state[filterKey] = '';
    const option = (value, text) => el('option', { value, text, selected: value === state[filterKey] });
    $(selectId).replaceChildren(
      option('', allText),
      option(ASSIGNEE_ME, 'Me'),
      option(CLAUDE, 'Claude'),
      option(ASSIGNEE_AGENTS, 'Any agent or Claude'),
      option(ASSIGNEE_NONE, 'None'),
      ...used.map((a) => option(a, (a.startsWith('agent:') ? '\u{1F916} ' : '\u{1F464} ') + assigneeLabel(a))));
  }

  function renderAuthor() {
    $('author-name').textContent = getAuthor();
  }

  function renderWarnings() {
    const box = $('warnings');
    const errors = state.data ? state.data.errors : [];
    box.hidden = !errors.length;
    box.replaceChildren(
      el('strong', { text: 'Some files could not be read cleanly:' }),
      el('ul', {}, errors.map((e) => el('li', {}, el('code', { text: e.file }), ' ' + e.message))));
  }

  // ---------- Actions ----------

  function openEditor(task, laneId) {
    K.taskEditor.open({
      project: state.data.project, tasks: state.data.tasks, agents: state.agents, task, laneId,
      sprintId: state.sprintFilter === NO_SPRINT ? '' : state.sprintFilter,
      onSaved: () => openProject(),
      onDeleted: () => openProject(),
    });
  }

  // Task ids sorted as they appear on the board: lane by lane, then by order.
  function boardOrder(ids) {
    const { project, tasks } = state.data;
    const laneIds = new Set(project.lanes.map((l) => l.id));
    const first = project.lanes[0].id;
    const laneIndex = new Map(project.lanes.map((l, i) => [l.id, i]));
    return tasks.filter((t) => ids.includes(t.id))
      .sort((a, b) => laneIndex.get(K.board.laneOf(a, laneIds, first)) - laneIndex.get(K.board.laneOf(b, laneIds, first)) || K.board.byOrder(a, b))
      .map((t) => t.id);
  }

  // Inserts the tasks, in the given order, before beforeId (MOVE_TOP for the top, null for the end),
  // renumbers the lane 10, 20, 30... and saves only the tasks whose order or lane changed.
  async function moveTasks(taskIds, laneId, beforeId) {
    const { project, tasks } = state.data;
    const moving = taskIds.map((id) => tasks.find((t) => t.id === id)).filter(Boolean);
    if (!moving.length) return;
    const laneIds = new Set(project.lanes.map((l) => l.id));
    const first = project.lanes[0].id;
    const laneTasks = tasks.filter((t) => !moving.includes(t) && K.board.laneOf(t, laneIds, first) === laneId).sort(K.board.byOrder);
    let index = beforeId === MOVE_TOP ? 0 : beforeId ? laneTasks.findIndex((t) => t.id === beforeId) : -1;
    if (index < 0) index = laneTasks.length;
    laneTasks.splice(index, 0, ...moving);

    const changed = [];
    laneTasks.forEach((t, i) => {
      const order = (i + 1) * 10;
      const mover = moving.includes(t);
      // Only the moved cards change lane; neighbours in an unknown lane keep theirs.
      if (t.order === order && (!mover || t.lane === laneId)) return;
      if (mover) { t.lane = laneId; t.updated = nowIso(); }
      t.order = order;
      changed.push(t);
    });
    if (!changed.length) return render(); // resets the bulk bar's Move to select
    render();
    await withWrite(async () => {
      for (const t of changed) await S.saveTask(t);
    });
    await openProject();
  }

  async function createProject() {
    const name = (prompt('Project name', state.handle ? state.handle.name : '') || '').trim();
    if (!name) return;
    await withWrite(() => S.createProject(name));
    await reload();
  }

  function openSettings() {
    K.projectSettings.open({ project: state.data.project, tasks: state.data.tasks, onSaved: () => reload() });
  }

  async function importFile(file) {
    if (state.hasProject) return alert('This folder already holds a board. Open an empty folder ("Open folder..."), then import.');
    await withWrite(() => K.importExport.importBundle(file));
    await reload();
  }

  function wireToolbar() {
    // Arrow keys on a closed select fire "change" on every step, so keyboard browsing only
    // moves the selection; Enter opens it and leaving the select restores the open folder.
    const select = $('project-select');
    let browsing = false;
    const choose = (value) => {
      browsing = false;
      if (value === OPEN_FOLDER) return pickFolder();
      if (value === FORGET_FOLDER) return forgetCurrent();
      const entry = state.recent[Number(value)];
      if (entry) openRecent(entry);
    };
    select.onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); choose(select.value); } else if (BROWSE_KEYS.includes(e.key) && !e.altKey) browsing = true;
    };
    select.onmousedown = () => { browsing = false; };
    select.onchange = () => { if (!browsing) choose(select.value); };
    select.onblur = () => { if (browsing) { browsing = false; renderProjectSelect(); } };
    $('btn-settings').onclick = openSettings;
    $('btn-new-task').onclick = () => openEditor(null);
    $('search').oninput = render;
    $('priority-filter').onchange = render;
    $('sprint-filter').onchange = (e) => { state.sprintFilter = e.target.value; render(); };
    $('assignee-filter').onchange = (e) => { state.assigneeFilter = e.target.value; render(); };
    $('reviewer-filter').onchange = (e) => { state.reviewerFilter = e.target.value; render(); };
    $('btn-author').onclick = () => {
      const name = prompt('Your name on comments', getAuthor());
      if (name != null) { setAuthor(name); renderAuthor(); if (state.data) render(); } // the "Me" filter depends on the name
    };
    $('author-input').value = getAuthor();
    $('author-input').oninput = (e) => { setAuthor(e.target.value); renderAuthor(); };
    renderAuthor();
    $('btn-export').onclick = () => withWrite(() => K.importExport.exportProject());
    $('btn-import').onclick = () => $('import-file').click();
    $('import-file').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); };
    $('btn-reload').onclick = reload;
    $('btn-folder').onclick = pickFolder;
    $('priority-filter').append(...K.PRIORITIES.map((p) => el('option', { value: p, text: p })));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.selected.size && !document.querySelector('dialog[open]')) { clearSelection(); render(); }
    });
    setInterval(poll, POLL_MS);
  }

  // Test hook: Kanban.app.useHandle(await navigator.storage.getDirectory())
  K.app = {
    state,
    useHandle: (handle) => connectHandle(handle),
    useMemory,
  };

  document.addEventListener('DOMContentLoaded', init);
})(window.Kanban);
