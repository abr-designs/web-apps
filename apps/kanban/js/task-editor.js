// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28

// Task editor dialog. Edits a draft copy; nothing touches disk until Save.
window.Kanban = window.Kanban || {};

(function (K) {
  'use strict';

  const { el, nowIso, formatDate, isImage, getAuthor, formatMinutes, formatTokens, assigneeLabel, CLAUDE, commitLink } = K.util;
  const S = K.storage;

  let dlg = null;
  let ctx = null; // { opts, draft, pending, removed, urls, initial, busy }

  function field(label, input) {
    return el('label', { class: 'field' }, el('span', { class: 'field-label', text: label }), input);
  }

  function $(name) {
    return dlg.querySelector('[data-f="' + name + '"]');
  }

  // Current form values plus the unsubmitted inputs, used for the unsaved-changes check.
  function snapshot() {
    const d = collect();
    const extra = ['link-title', 'link-url', 'comment-text', 'commit-sha', 'commit-subject', 'work-minutes', 'work-tokens', 'work-note'].map((n) => $(n).value);
    return JSON.stringify([d, extra, ctx.pending.length, ctx.removed.length]);
  }

  function collect() {
    const d = ctx.draft;
    d.title = $('title').value.trim();
    d.lane = $('lane').value;
    d.priority = $('priority').value;
    d.due = $('due').value;
    d.sprint = $('sprint').value;
    d.assignee = $('assignee').value;
    d.reviewer = $('reviewer').value;
    d.screenshot = $('screenshot').checked;
    d.labels = $('labels').value.split(',').map((s) => s.trim()).filter(Boolean);
    d.description = $('description').value;
    return d;
  }

  function isDirty() {
    return snapshot() !== ctx.initial;
  }

  // ---------- Description (Markdown) ----------

  // Wraps the selection in before/after, or inserts placeholder there, and selects the inner text.
  function wrapSelection(before, after, placeholder) {
    const ta = $('description');
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const inner = value.slice(s, e) || placeholder;
    ta.focus();
    ta.setRangeText(before + inner + after, s, e, 'end');
    ta.setSelectionRange(s + before.length, s + before.length + inner.length);
  }

  // Fenced block on its own lines.
  function wrapCodeBlock() {
    const ta = $('description');
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const before = (s === 0 || value[s - 1] === '\n' ? '' : '\n') + '```\n';
    const after = '\n```' + (e === value.length || value[e] === '\n' ? '' : '\n');
    wrapSelection(before, after, 'code');
  }

  // Adds prefix to every line the selection touches.
  function prefixLines(prefix) {
    const ta = $('description');
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const start = value.lastIndexOf('\n', s - 1) + 1;
    const block = value.slice(start, e).split('\n').map((line) => prefix + line).join('\n');
    ta.focus();
    ta.setRangeText(block, start, e, 'select');
  }

  const TOOLS = [
    ['B', 'Bold (Ctrl+B)', () => wrapSelection('**', '**', 'bold text')],
    ['I', 'Italic (Ctrl+I)', () => wrapSelection('*', '*', 'italic text')],
    ['`code`', 'Inline code', () => wrapSelection('`', '`', 'code')],
    ['Code block', 'Fenced code block; add a language after the opening ``` (js, cs, py...)', wrapCodeBlock],
    ['• List', 'Bullet list', () => prefixLines('- ')],
    ['☐ Checklist', 'Checklist', () => prefixLines('- [ ] ')],
    ['Link', 'Link', () => wrapSelection('[', '](https://)', 'text')],
  ];

  function setDescriptionMode(mode) {
    const write = mode === 'write';
    $('description').hidden = !write;
    $('md-toolbar').hidden = !write;
    $('desc-preview').hidden = write;
    $('tab-write').classList.toggle('active', write);
    $('tab-preview').classList.toggle('active', !write);
    if (write) { $('description').focus(); return; }
    const text = $('description').value;
    $('desc-preview').replaceChildren(text.trim() ? K.markdown.render(text) : el('span', { class: 'muted', text: 'No description. Click to add.' }));
  }

  function descriptionBlock(text) {
    return el('div', { class: 'desc-block' },
      el('div', { class: 'desc-head' },
        el('span', { class: 'field-label', text: 'Description' }),
        el('span', { class: 'desc-tabs' },
          el('button', { type: 'button', 'data-f': 'tab-preview', text: 'Preview', onclick: () => setDescriptionMode('preview') }),
          el('button', { type: 'button', 'data-f': 'tab-write', text: 'Write', onclick: () => setDescriptionMode('write') }))),
      el('div', { class: 'md-toolbar', 'data-f': 'md-toolbar' },
        TOOLS.map(([label, title, fn]) => el('button', { type: 'button', title, text: label, onclick: fn }))),
      el('textarea', {
        'data-f': 'description', rows: 9,
        placeholder: 'Markdown: **bold**, *italic*, `code`, ```js code blocks, - [ ] checklists',
        onkeydown: (e) => {
          if (!e.ctrlKey || e.altKey) return;
          const key = e.key.toLowerCase();
          if (key === 'b') { e.preventDefault(); wrapSelection('**', '**', 'bold text'); }
          if (key === 'i') { e.preventDefault(); wrapSelection('*', '*', 'italic text'); }
        },
      }, text),
      el('div', {
        class: 'desc-preview md', 'data-f': 'desc-preview', title: 'Click to edit',
        onclick: (e) => { if (!e.target.closest('a, button, input')) setDescriptionMode('write'); },
      }));
  }

  // ---------- Sections ----------

  function renderLinks() {
    $('links').replaceChildren(...ctx.draft.links.map((link, i) =>
      el('li', { class: 'row' },
        el('a', { href: link.url, target: '_blank', rel: 'noopener', text: link.title || link.url }),
        el('button', { class: 'icon', title: 'Remove link', text: '×', onclick: () => { ctx.draft.links.splice(i, 1); renderLinks(); } }))));
  }

  function addLink() {
    const url = $('link-url').value.trim();
    if (!url) return;
    ctx.draft.links.push({ title: $('link-title').value.trim(), url });
    $('link-title').value = '';
    $('link-url').value = '';
    renderLinks();
  }

  function attachmentItem(name, type, onRemove, loadBlob) {
    const link = el('a', { target: '_blank', rel: 'noopener', title: name });
    const item = el('li', { class: 'attachment' }, link,
      el('button', { class: 'icon', title: 'Remove attachment', text: '×', onclick: onRemove }));
    const image = isImage(type || name);
    link.append(image ? el('img', { alt: name }) : el('span', { class: 'file-icon', text: '\u{1F4C4}' }), el('span', { class: 'attachment-name', text: name }));
    const session = ctx;
    loadBlob().then((blob) => {
      if (ctx !== session) return; // dialog closed or reopened while loading
      if (!blob) { item.classList.add('missing'); link.title = name + ' (file missing)'; return; }
      const url = URL.createObjectURL(blob);
      session.urls.push(url);
      link.href = url;
      if (!image) link.download = name;
      else link.querySelector('img').src = url;
    }).catch((err) => console.warn(err));
    return item;
  }

  function renderAttachments() {
    const { draft, pending, opts } = ctx;
    $('attachments').replaceChildren(
      ...draft.attachments.map((att, i) => attachmentItem(att.name, att.type || att.path,
        () => { ctx.removed.push(att.path); draft.attachments.splice(i, 1); renderAttachments(); },
        () => S.readMedia(att.path))),
      ...pending.map((p, i) => attachmentItem(p.file.name + ' (new)', p.file.type,
        () => { pending.splice(i, 1); renderAttachments(); },
        () => Promise.resolve(p.file))));
  }

  function addFiles(files) {
    for (const file of files) ctx.pending.push({ file });
    if (files.length) renderAttachments();
  }

  function renderComments() {
    $('comments').replaceChildren(...ctx.draft.comments.map((c, i) =>
      el('li', { class: 'comment' },
        el('div', { class: 'comment-head' },
          el('strong', { text: c.author || 'Unknown' }),
          el('span', { class: 'muted', text: formatDate(c.date) }),
          el('button', { class: 'icon', title: 'Remove comment', text: '×', onclick: () => { ctx.draft.comments.splice(i, 1); renderComments(); } })),
        el('div', { class: 'comment-text md' }, K.markdown.render(c.text)))));
  }

  function renderCommits() {
    const url = ctx.opts.project.commitUrl;
    $('commits').replaceChildren(...ctx.draft.commits.map((c, i) => {
      const href = commitLink(url, c.sha);
      const sha = href
        ? el('a', { class: 'commit-sha', href, target: '_blank', rel: 'noopener', title: c.sha, text: c.sha.slice(0, 7) })
        : el('span', { class: 'commit-sha', title: c.sha, text: c.sha.slice(0, 7) });
      return el('li', { class: 'row commit-row' },
        sha,
        el('span', { class: 'commit-subject', text: c.subject }),
        el('span', { class: 'muted small', text: formatDate(c.date) }),
        el('button', { class: 'icon', title: 'Remove commit', text: '×', onclick: () => { ctx.draft.commits.splice(i, 1); renderCommits(); } }));
    }));
  }

  function addCommit() {
    const sha = $('commit-sha').value.trim();
    if (!sha) return;
    if (!S.isSha(sha)) { alert('A commit SHA is 7 to 40 hex characters.'); return; }
    if (!S.addCommit(ctx.draft, { sha, subject: $('commit-subject').value.trim(), date: '' })) { alert('This commit is already listed.'); return; }
    $('commit-sha').value = '';
    $('commit-subject').value = '';
    renderCommits();
  }

  function addComment() {
    const text = $('comment-text').value.trim();
    if (!text) return;
    ctx.draft.comments.push({ author: getAuthor(), date: nowIso(), text });
    $('comment-text').value = '';
    renderComments();
  }

  function renderWork() {
    const work = ctx.draft.work;
    const minutes = work.reduce((n, w) => n + w.minutes, 0);
    const tokens = work.reduce((n, w) => n + w.tokens, 0);
    $('work-total').textContent = work.length ? 'Total ' + formatMinutes(minutes) + ' · ' + formatTokens(tokens) + ' tokens' : '';
    $('work').replaceChildren(...work.map((w, i) =>
      el('li', { class: 'row work-row' },
        el('strong', { text: w.by || 'Unknown' }),
        el('span', { text: formatMinutes(w.minutes) + ' · ' + formatTokens(w.tokens) + ' tok' }),
        el('span', { class: 'muted work-note', text: w.note }),
        el('span', { class: 'muted small', text: formatDate(w.date) }),
        el('button', { class: 'icon', title: 'Remove entry', text: '×', onclick: () => { work.splice(i, 1); renderWork(); } }))));
  }

  function addWork() {
    const minutes = Number($('work-minutes').value) || 0;
    const tokens = Math.round(Number($('work-tokens').value) || 0);
    if (minutes <= 0 && tokens <= 0) return;
    ctx.draft.work.push({ by: getAuthor(), date: nowIso(), minutes: Math.max(0, minutes), tokens: Math.max(0, tokens), note: $('work-note').value.trim() });
    ['work-minutes', 'work-tokens', 'work-note'].forEach((n) => { $(n).value = ''; });
    renderWork();
  }

  // ---------- Save / delete / close ----------

  // New tasks, and tasks moved to another lane here, go to the top of the lane.
  function topOrder(laneId, exceptId) {
    const orders = ctx.opts.tasks.filter((t) => t.lane === laneId && t.id !== exceptId).map((t) => t.order);
    return orders.length ? Math.min(...orders) - 10 : 10;
  }

  async function save() {
    if (ctx.busy) return;
    const { opts, pending, removed } = ctx;
    const draft = collect();
    if (!draft.title) { alert('Title is required.'); $('title').focus(); return; }
    ctx.busy = true;
    try {
      const now = nowIso();
      if (opts.task) {
        // Polling pauses while the dialog is open, so check for edits made on disk meanwhile.
        const text = await S.readFile('tasks/' + opts.task.id + '.json');
        let diskUpdated = null;
        try { diskUpdated = text && JSON.parse(text).updated; } catch (e) { /* unreadable: overwrite */ }
        if (diskUpdated && diskUpdated !== opts.task.updated &&
          !confirm(opts.task.id + ' changed on disk while it was open (for example a new comment). Overwrite it with your version?')) return;
      } else {
        draft.id = await S.nextTaskId();
        draft.created = now;
      }
      if (!opts.task || draft.lane !== opts.task.lane) draft.order = topOrder(draft.lane, draft.id);
      // Shift as we go so a retry after a failure does not write files twice.
      while (pending.length) {
        draft.attachments.push(await S.saveMedia(draft.id, pending[0].file));
        pending.shift();
      }
      draft.updated = now;
      await S.saveTask(draft);
      // Remove media only once the task no longer references it.
      for (const path of removed.splice(0)) {
        try { await S.removeMedia(path); } catch (err) { console.warn(err); }
      }
      close();
      opts.onSaved(draft);
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      if (ctx) ctx.busy = false;
    }
  }

  async function remove() {
    const { opts } = ctx;
    if (!confirm('Delete ' + opts.task.id + ' "' + opts.task.title + '" and its media? This cannot be undone.')) return;
    try {
      await S.deleteTask(opts.task);
      close();
      opts.onDeleted(opts.task);
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }

  function tryClose() {
    if (!ctx || ctx.busy) return; // let a running save finish
    if (isDirty() && !confirm('Discard unsaved changes?')) return;
    close();
  }

  function close() {
    if (!ctx) return;
    ctx.urls.forEach((u) => URL.revokeObjectURL(u));
    ctx = null;
    dlg.close();
  }

  // ---------- Build ----------

  function ensureDialog() {
    if (dlg) return;
    dlg = el('dialog', {
      class: 'dialog editor',
      oncancel: (e) => { e.preventDefault(); tryClose(); },
      onpaste: (e) => {
        const files = [...(e.clipboardData ? e.clipboardData.files : [])];
        if (files.length) { e.preventDefault(); addFiles(files); }
      },
      ondragover: (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); $('dropzone').classList.add('over'); } },
      ondragleave: () => $('dropzone').classList.remove('over'),
      ondrop: (e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        $('dropzone').classList.remove('over');
        addFiles([...e.dataTransfer.files]);
      },
    });
    document.body.append(dlg);
  }

  // Planned and active sprints, plus the task's own sprint even when closed or unknown.
  function sprintOptions(sprints, current) {
    const shown = sprints.filter((s) => s.status !== 'closed' || s.id === current);
    const options = shown.map((s) => el('option', { value: s.id, text: s.name + (s.status === 'closed' ? ' (closed)' : ''), selected: s.id === current }));
    if (current && !shown.some((s) => s.id === current)) {
      options.push(el('option', { value: current, text: current + ' (unknown)', selected: true }));
    }
    return [el('option', { value: '', text: 'None' }), ...options];
  }

  // Unassigned, Me, Claude, the current value when it is someone else or an unlisted agent,
  // then the agents from agents.json. Used for both the assignee and the reviewer, and by the
  // bulk bar with current null (nothing selected).
  function personOptions(agents, current) {
    const me = getAuthor();
    const option = (value, text) => el('option', { value, text, selected: value === current });
    const known = new Set(['', me, CLAUDE, ...agents.map((a) => 'agent:' + a.name)]);
    return [
      option('', 'Unassigned'),
      option(me, 'Me (' + me + ')'),
      option(CLAUDE, 'Claude (main session)'),
      current != null && !known.has(current) && option(current, assigneeLabel(current) + (current.startsWith('agent:') ? ' (agent, not in agents.json)' : '')),
      el('optgroup', { label: agents.length ? 'Agents' : 'Agents (run: node tools/kanban.mjs agents refresh)' },
        agents.map((a) => el('option', { value: 'agent:' + a.name, text: a.name, title: a.description, selected: 'agent:' + a.name === current }))),
    ];
  }

  // opts: { project, tasks, agents, task (null for new), laneId, sprintId, onSaved(task), onDeleted(task) }
  function open(opts) {
    ensureDialog();
    const task = opts.task;
    const draft = task ? JSON.parse(JSON.stringify(task)) : {
      id: '', title: '', description: '', lane: opts.laneId || opts.project.lanes[0].id, priority: 'medium',
      labels: [], due: '', sprint: opts.sprintId || '', assignee: '', reviewer: '', screenshot: false, order: 0, created: '', updated: '',
      links: [], attachments: [], comments: [], commits: [], work: [],
    };
    const laneIds = opts.project.lanes.map((l) => l.id);
    if (!laneIds.includes(draft.lane)) draft.lane = laneIds[0];
    ctx = { opts, draft, pending: [], removed: [], urls: [], initial: '', busy: false };

    const fileInput = el('input', { type: 'file', multiple: true, hidden: true, onchange: (e) => { addFiles([...e.target.files]); e.target.value = ''; } });

    dlg.replaceChildren(
      el('header', { class: 'dialog-head' },
        el('span', { class: 'card-id', text: task ? task.id : 'New task' }),
        el('input', { class: 'title-input', 'data-f': 'title', value: draft.title, placeholder: 'Task title' }),
        el('button', { class: 'icon', title: 'Close', text: '×', onclick: tryClose })),
      el('div', { class: 'editor-body' },
        el('div', { class: 'editor-main' },
          descriptionBlock(draft.description),

          el('h3', { text: 'Links' }),
          el('ul', { class: 'plain-list', 'data-f': 'links' }),
          el('div', { class: 'row' },
            el('input', { 'data-f': 'link-title', placeholder: 'Title' }),
            el('input', { 'data-f': 'link-url', placeholder: 'https://...', onkeydown: (e) => { if (e.key === 'Enter') addLink(); } }),
            el('button', { text: 'Add', onclick: addLink })),

          el('h3', { text: 'Attachments' }),
          el('ul', { class: 'attachments', 'data-f': 'attachments' }),
          el('div', { class: 'dropzone', 'data-f': 'dropzone' },
            'Drop files here, paste an image, or ',
            el('button', { class: 'linklike', text: 'choose files', onclick: () => fileInput.click() }),
            fileInput),

          el('h3', { text: 'Commits' }),
          el('ul', { class: 'plain-list', 'data-f': 'commits' }),
          el('div', { class: 'row commit-new' },
            el('input', { 'data-f': 'commit-sha', placeholder: 'SHA' }),
            el('input', { 'data-f': 'commit-subject', placeholder: 'Subject (optional)', onkeydown: (e) => { if (e.key === 'Enter') addCommit(); } }),
            el('button', { text: 'Add', onclick: addCommit })),
          el('p', { class: 'muted small', text: 'Agents record commits with "kanban commit <id>"; "kanban commits sync" adds commits whose message names this task.' }),

          el('h3', { text: 'Comments' }),
          el('ul', { class: 'plain-list', 'data-f': 'comments' }),
          el('div', { class: 'comment-new' },
            el('textarea', { 'data-f': 'comment-text', rows: 2, placeholder: 'Write a comment, Markdown supported (Ctrl+Enter to add)',
              onkeydown: (e) => { if (e.key === 'Enter' && e.ctrlKey) addComment(); } }),
            el('button', { text: 'Add comment', onclick: addComment })),
          el('p', { class: 'muted small', text: 'Commenting as ' + getAuthor() + '. Change it with the "You" button in the top bar.' }),

          el('h3', {}, 'Time and tokens ', el('span', { class: 'work-total', 'data-f': 'work-total' })),
          el('ul', { class: 'plain-list', 'data-f': 'work' }),
          el('div', { class: 'row work-new' },
            el('input', { type: 'number', min: '0', step: 'any', 'data-f': 'work-minutes', placeholder: 'Minutes' }),
            el('input', { type: 'number', min: '0', step: '1', 'data-f': 'work-tokens', placeholder: 'Tokens' }),
            el('input', { 'data-f': 'work-note', placeholder: 'Note', onkeydown: (e) => { if (e.key === 'Enter') addWork(); } }),
            el('button', { text: 'Log', onclick: addWork }))),

        el('aside', { class: 'editor-side' },
          field('Lane', el('select', { 'data-f': 'lane' }, opts.project.lanes.map((l) => el('option', { value: l.id, text: l.name, selected: l.id === draft.lane })))),
          field('Priority', el('select', { 'data-f': 'priority' }, K.PRIORITIES.map((p) => el('option', { value: p, text: p, selected: p === draft.priority })))),
          field('Assignee', el('select', { 'data-f': 'assignee' }, personOptions(opts.agents || [], draft.assignee))),
          field('Reviewer', el('select', { 'data-f': 'reviewer' }, personOptions(opts.agents || [], draft.reviewer))),
          field('Sprint', el('select', { 'data-f': 'sprint' }, sprintOptions(opts.project.sprints, draft.sprint))),
          field('Due date', el('input', { type: 'date', 'data-f': 'due', value: draft.due })),
          field('Labels (comma-separated)', el('input', { 'data-f': 'labels', value: draft.labels.join(', ') })),
          el('label', { class: 'check', title: 'Agents must attach an image before moving the task to review or the last lane' },
            el('input', { type: 'checkbox', 'data-f': 'screenshot', checked: draft.screenshot }), 'Requires screenshot'),
          task && el('p', { class: 'muted small' }, 'Created ' + formatDate(task.created), el('br'), 'Updated ' + formatDate(task.updated)))),
      el('footer', { class: 'dialog-foot' },
        task && el('button', { class: 'danger', text: 'Delete', onclick: remove }),
        el('span', { class: 'spacer' }),
        el('button', { text: 'Cancel', onclick: tryClose }),
        el('button', { class: 'primary', text: 'Save', onclick: save })));

    renderLinks();
    renderAttachments();
    renderComments();
    renderCommits();
    renderWork();
    setDescriptionMode(task && draft.description.trim() ? 'preview' : 'write');
    ctx.initial = snapshot();
    dlg.showModal();
    $('title').focus();
  }

  K.taskEditor = { open, personOptions };
})(window.Kanban);
