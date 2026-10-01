// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28

// Project settings dialog: name, description, commit URL, lanes, sprints and tag colors.
window.Kanban = window.Kanban || {};

(function (K) {
  'use strict';

  const { el, slugify, uniqueName } = K.util;

  let dlg = null;

  // opts: { project, tasks, onSaved(project) }
  function open(opts) {
    if (!dlg) {
      dlg = el('dialog', { class: 'dialog settings' });
      document.body.append(dlg);
    }
    const lanes = opts.project.lanes.map((l) => ({ ...l }));
    const laneIds = new Set(lanes.map((l) => l.id));
    const first = lanes[0].id;
    const countIn = (id) => opts.tasks.filter((t) => K.board.laneOf(t, laneIds, first) === id).length;

    const name = el('input', { value: opts.project.name });
    const description = el('textarea', { rows: 3 }, opts.project.description);
    const commitUrl = el('input', { value: opts.project.commitUrl || '', placeholder: 'https://github.com/owner/repo/commit/{sha}' });
    const list = el('ul', { class: 'plain-list lane-list' });
    const newLane = el('input', { placeholder: 'New lane name', onkeydown: (e) => { if (e.key === 'Enter') addLane(); } });

    function move(i, delta) {
      const j = i + delta;
      if (j < 0 || j >= lanes.length) return;
      [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
      renderLanes();
    }

    function renderLanes() {
      list.replaceChildren(...lanes.map((lane, i) => {
        const count = laneIds.has(lane.id) ? countIn(lane.id) : 0;
        return el('li', { class: 'row' },
          el('input', { value: lane.name, oninput: (e) => { lane.name = e.target.value; } }),
          el('span', { class: 'muted small', text: lane.id + ' · ' + count + ' task' + (count === 1 ? '' : 's') }),
          el('button', { class: 'icon', title: 'Move up', text: '↑', disabled: i === 0, onclick: () => move(i, -1) }),
          el('button', { class: 'icon', title: 'Move down', text: '↓', disabled: i === lanes.length - 1, onclick: () => move(i, 1) }),
          el('button', {
            class: 'icon danger', text: '×',
            title: count ? 'Move its tasks out first' : 'Delete lane',
            disabled: count > 0 || lanes.length === 1,
            onclick: () => { lanes.splice(i, 1); renderLanes(); },
          }));
      }));
    }

    const sprints = opts.project.sprints.map((s) => ({ ...s }));
    const sprintList = el('ul', { class: 'plain-list sprint-list' });
    const newSprint = el('input', { placeholder: 'New sprint or milestone name', onkeydown: (e) => { if (e.key === 'Enter') addSprint(); } });
    const sprintUse = (id) => opts.tasks.filter((t) => t.sprint === id).length;

    function renderSprints() {
      sprintList.replaceChildren(...sprints.map((sprint, i) => {
        const count = sprintUse(sprint.id);
        return el('li', { class: 'row' },
          el('input', { value: sprint.name, title: 'Name (id: ' + sprint.id + ')', oninput: (e) => { sprint.name = e.target.value; } }),
          el('input', { type: 'date', value: sprint.start, title: 'Start', oninput: (e) => { sprint.start = e.target.value; } }),
          el('input', { type: 'date', value: sprint.end, title: 'End', oninput: (e) => { sprint.end = e.target.value; } }),
          el('select', { title: 'Status', onchange: (e) => { sprint.status = e.target.value; } },
            K.storage.SPRINT_STATUSES.map((s) => el('option', { value: s, text: s, selected: s === sprint.status }))),
          el('span', { class: 'muted small', text: count + ' task' + (count === 1 ? '' : 's') }),
          el('button', {
            class: 'icon danger', text: '×',
            title: count ? 'Move its tasks out first' : 'Delete sprint',
            disabled: count > 0,
            onclick: () => { sprints.splice(i, 1); renderSprints(); },
          }));
      }));
    }

    function addSprint() {
      const sprintName = newSprint.value.trim();
      if (!sprintName) return;
      sprints.push({ id: uniqueName(slugify(sprintName), sprints.map((s) => s.id)), name: sprintName, start: '', end: '', status: 'planned' });
      newSprint.value = '';
      renderSprints();
    }

    // Tags used by any task plus pinned ones. Only pinned colors are saved.
    const pinned = { ...opts.project.labels };
    const tagNames = [...new Set([...opts.tasks.flatMap((t) => t.labels), ...Object.keys(pinned)])].sort((a, b) => a.localeCompare(b));
    const tagList = el('ul', { class: 'tag-list' });

    function renderTags() {
      tagList.replaceChildren(...tagNames.map((tag) => el('li', { class: 'row' },
        el('span', { class: 'label tag-' + K.util.tagColor(tag, pinned), text: tag }),
        el('select', {
          title: 'Color',
          onchange: (e) => { if (e.target.value) pinned[tag] = e.target.value; else delete pinned[tag]; renderTags(); },
        },
          el('option', { value: '', text: 'Auto' }),
          K.TAG_COLORS.map((c) => el('option', { value: c, text: c, selected: pinned[tag] === c }))))));
      if (!tagNames.length) tagList.append(el('li', { class: 'muted small', text: 'No tags yet. Add labels to a task first.' }));
    }

    function addLane() {
      const laneName = newLane.value.trim();
      if (!laneName) return;
      lanes.push({ id: uniqueName(slugify(laneName), lanes.map((l) => l.id)), name: laneName });
      newLane.value = '';
      renderLanes();
    }

    async function save() {
      const url = commitUrl.value.trim();
      if (url && !K.storage.isCommitUrl(url)) { alert('Commit URL must start with http:// or https:// and contain {sha}.'); commitUrl.focus(); return; }
      const project = {
        ...opts.project,
        name: name.value.trim() || opts.project.name,
        description: description.value,
        lanes: lanes.map((l) => ({ ...l, name: l.name.trim() || l.id })),
        sprints: sprints.map((s) => ({ ...s, name: s.name.trim() || s.id })),
        labels: pinned,
        commitUrl: url,
      };
      try {
        // Polling pauses while the dialog is open, so check for edits made on disk meanwhile (for example a sprint added by the CLI).
        const text = await K.storage.readFile('project.json');
        let disk = null;
        try { disk = text && K.storage.normalizeProject(JSON.parse(text)); } catch (e) { /* unreadable: overwrite */ }
        if (disk && JSON.stringify(disk) !== JSON.stringify(opts.project) &&
          !confirm('project.json changed on disk while settings were open (for example a new sprint). Overwrite it with your version?')) return;
        await K.storage.saveProject(project);
        dlg.close();
        opts.onSaved(project);
      } catch (err) {
        alert('Save failed: ' + err.message);
      }
    }

    dlg.replaceChildren(
      el('header', { class: 'dialog-head' },
        el('h2', { text: 'Project settings' })),
      el('div', { class: 'dialog-body' },
        el('label', { class: 'field' }, el('span', { class: 'field-label', text: 'Name' }), name),
        el('label', { class: 'field' }, el('span', { class: 'field-label', text: 'Description' }), description),
        el('label', { class: 'field' }, el('span', { class: 'field-label', text: 'Commit URL ({sha} is replaced by each commit SHA; leave empty for plain SHAs)' }), commitUrl),
        el('h3', { text: 'Lanes' }),
        list,
        el('div', { class: 'row' }, newLane, el('button', { text: 'Add lane', onclick: addLane })),
        el('h3', { text: 'Sprints and milestones' }),
        sprintList,
        el('div', { class: 'row' }, newSprint, el('button', { text: 'Add sprint', onclick: addSprint })),
        el('h3', { text: 'Tag colors' }),
        tagList),
      el('footer', { class: 'dialog-foot' },
        el('span', { class: 'spacer' }),
        el('button', { text: 'Cancel', onclick: () => dlg.close() }),
        el('button', { class: 'primary', text: 'Save', onclick: save })));

    renderLanes();
    renderSprints();
    renderTags();
    dlg.showModal();
  }

  K.projectSettings = { open };
})(window.Kanban);
