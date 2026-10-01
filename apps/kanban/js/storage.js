// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28

// Storage: a folder backend (File System Access API) and an in-memory backend
// share one interface: readFile, writeFile, list, remove, mkdir.
// Project and task helpers sit on top of whichever backend is active.
window.Kanban = window.Kanban || {};

(function (K) {
  'use strict';

  const DEFAULT_LANES = [
    { id: 'backlog', name: 'Backlog' },
    { id: 'todo', name: 'To Do' },
    { id: 'in-progress', name: 'In Progress' },
    { id: 'review', name: 'Review' },
    { id: 'done', name: 'Done' },
  ];

  function splitPath(path) {
    return String(path).split('/').filter(Boolean);
  }

  function isMissing(err) {
    return err && (err.name === 'NotFoundError' || err.name === 'TypeMismatchError');
  }

  // ---------- Folder backend ----------

  function folderBackend(root) {
    async function dirAt(parts, create) {
      let dir = root;
      for (const part of parts) dir = await dir.getDirectoryHandle(part, { create });
      return dir;
    }

    return {
      mode: 'folder',
      rootName: root.name,

      async readFile(path, asBlob) {
        const parts = splitPath(path);
        try {
          const dir = await dirAt(parts.slice(0, -1), false);
          const file = await (await dir.getFileHandle(parts[parts.length - 1])).getFile();
          return asBlob ? file : await file.text();
        } catch (err) {
          if (isMissing(err)) return null;
          throw err;
        }
      },

      async writeFile(path, data) {
        const parts = splitPath(path);
        const dir = await dirAt(parts.slice(0, -1), true);
        const handle = await dir.getFileHandle(parts[parts.length - 1], { create: true });
        const writable = await handle.createWritable();
        await writable.write(data);
        await writable.close();
      },

      async list(path) {
        try {
          const dir = await dirAt(splitPath(path), false);
          const out = [];
          for await (const [name, handle] of dir.entries()) out.push({ name, kind: handle.kind });
          return out;
        } catch (err) {
          if (isMissing(err)) return [];
          throw err;
        }
      },

      async remove(path) {
        const parts = splitPath(path);
        try {
          const dir = await dirAt(parts.slice(0, -1), false);
          await dir.removeEntry(parts[parts.length - 1], { recursive: true });
        } catch (err) {
          if (!isMissing(err)) throw err;
        }
      },

      async mkdir(path) {
        await dirAt(splitPath(path), true);
      },
    };
  }

  // ---------- Memory backend ----------

  function memoryBackend() {
    const files = new Map();
    const dirs = new Set(['']);

    function norm(path) {
      return splitPath(path).join('/');
    }

    function addDirs(path) {
      const parts = splitPath(path);
      for (let i = 1; i <= parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
    }

    return {
      mode: 'memory',
      rootName: 'memory',

      async readFile(path, asBlob) {
        const value = files.get(norm(path));
        if (value === undefined) return null;
        if (asBlob) return value instanceof Blob ? value : new Blob([value]);
        return typeof value === 'string' ? value : await value.text();
      },

      async writeFile(path, data) {
        const key = norm(path);
        addDirs(splitPath(key).slice(0, -1).join('/'));
        files.set(key, data);
      },

      async list(path) {
        const base = norm(path);
        const prefix = base ? base + '/' : '';
        const out = new Map();
        for (const key of files.keys()) {
          if (!key.startsWith(prefix)) continue;
          const rest = key.slice(prefix.length).split('/');
          out.set(rest[0], rest.length === 1 ? 'file' : 'directory');
        }
        for (const dir of dirs) {
          if (dir && dir.startsWith(prefix) && !dir.slice(prefix.length).includes('/')) out.set(dir.slice(prefix.length), 'directory');
        }
        return [...out].map(([name, kind]) => ({ name, kind }));
      },

      async remove(path) {
        const key = norm(path);
        files.delete(key);
        dirs.delete(key);
        for (const k of [...files.keys()]) if (k.startsWith(key + '/')) files.delete(k);
        for (const d of [...dirs]) if (d.startsWith(key + '/')) dirs.delete(d);
      },

      async mkdir(path) {
        addDirs(path);
      },
    };
  }

  // ---------- Active backend ----------

  let backend = null;

  function active() {
    if (!backend) throw new Error('No storage connected');
    return backend;
  }

  const readFile = (path, asBlob) => active().readFile(path, asBlob);
  const writeFile = (path, data) => active().writeFile(path, data);
  const list = (path) => active().list(path);
  const remove = (path) => active().remove(path);
  const mkdir = (path) => active().mkdir(path);

  // ---------- Normalizing ----------

  const str = (v) => (typeof v === 'string' ? v : '');
  const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const SPRINT_STATUSES = ['planned', 'active', 'closed'];

  // Keys the app does not know about are kept after the known ones, so saving never drops them.
  function withExtras(known, raw) {
    for (const key of Object.keys(raw)) if (!Object.hasOwn(known, key)) known[key] = raw[key];
    return known;
  }

  function normalizeProject(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    let lanes = Array.isArray(raw.lanes) ? raw.lanes.filter((l) => l && l.id).map((l) => withExtras({ id: String(l.id), name: str(l.name) || String(l.id) }, l)) : [];
    if (!lanes.length) lanes = DEFAULT_LANES.map((l) => ({ ...l }));
    const sprints = Array.isArray(raw.sprints) ? raw.sprints.filter((s) => s && s.id).map((s) => withExtras({
      id: String(s.id),
      name: str(s.name) || String(s.id),
      start: isDate(s.start) ? s.start : '',
      end: isDate(s.end) ? s.end : '',
      status: SPRINT_STATUSES.includes(s.status) ? s.status : 'planned',
    }, s)) : [];
    const labels = {};
    if (raw.labels && typeof raw.labels === 'object' && !Array.isArray(raw.labels)) {
      for (const [tag, color] of Object.entries(raw.labels)) if (K.TAG_COLORS.includes(color)) labels[tag] = color;
    }
    const commitUrl = isCommitUrl(raw.commitUrl) ? raw.commitUrl : '';
    return withExtras({ name: str(raw.name) || 'Untitled', description: str(raw.description), lanes, sprints, labels, commitUrl, created: str(raw.created) }, raw);
  }

  function isCommitUrl(v) {
    return typeof v === 'string' && /^https?:\/\//i.test(v) && v.includes('{sha}');
  }

  const isSha = (v) => typeof v === 'string' && /^[0-9a-f]{7,40}$/i.test(v);

  // Adds commit to task.commits unless it is already there. A short and a full SHA of the
  // same commit count as one; the longer SHA is kept. Returns true when task.commits changed.
  function addCommit(task, commit) {
    const sha = str(commit.sha).toLowerCase();
    if (!isSha(sha)) throw new Error('Invalid commit SHA "' + commit.sha + '" (7 to 40 hex characters)');
    const same = task.commits.find((c) => c.sha.startsWith(sha) || sha.startsWith(c.sha));
    if (!same) {
      task.commits.push({ sha, subject: str(commit.subject), date: str(commit.date) });
      return true;
    }
    if (sha.length <= same.sha.length) return false;
    same.sha = sha;
    if (!same.subject) same.subject = str(commit.subject);
    if (!same.date) same.date = str(commit.date);
    return true;
  }

  function normalizeCommits(raw) {
    const task = { commits: [] };
    if (!Array.isArray(raw)) return task.commits;
    for (const c of raw) if (c && isSha(c.sha)) addCommit(task, c);
    return task.commits;
  }

  const count = (v) => (Number.isFinite(v) && v > 0 ? v : 0);

  // Fixed key order keeps files diff-friendly.
  function normalizeTask(raw, id) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Task is not a JSON object');
    return withExtras({
      id,
      title: str(raw.title),
      description: str(raw.description),
      lane: str(raw.lane),
      priority: K.PRIORITIES.includes(raw.priority) ? raw.priority : 'medium',
      labels: Array.isArray(raw.labels) ? raw.labels.map(String).filter(Boolean) : [],
      due: isDate(raw.due) ? raw.due : '',
      sprint: str(raw.sprint),
      assignee: str(raw.assignee),
      reviewer: str(raw.reviewer),
      screenshot: raw.screenshot === true,
      order: Number.isFinite(raw.order) ? raw.order : 0,
      created: str(raw.created),
      updated: str(raw.updated),
      links: Array.isArray(raw.links) ? raw.links.filter((l) => l && l.url).map((l) => withExtras({ title: str(l.title), url: str(l.url) }, l)) : [],
      attachments: Array.isArray(raw.attachments) ? raw.attachments.filter((a) => a && a.path).map((a) => withExtras({ name: str(a.name) || str(a.path).split('/').pop(), path: str(a.path), type: str(a.type) }, a)) : [],
      comments: Array.isArray(raw.comments) ? raw.comments.filter((c) => c && c.text).map((c) => withExtras({ author: str(c.author), date: str(c.date), text: str(c.text) }, c)) : [],
      commits: normalizeCommits(raw.commits),
      work: Array.isArray(raw.work) ? raw.work.filter((w) => w && typeof w === 'object').map((w) => withExtras({
        by: str(w.by), date: str(w.date), minutes: count(w.minutes), tokens: Math.round(count(w.tokens)), note: str(w.note),
      }, w)) : [],
    }, raw);
  }

  // True when the task has at least one image attachment.
  function hasScreenshot(task) {
    return task.attachments.some((a) => K.util.isImage(a.type || a.path));
  }

  function toJson(value) {
    return JSON.stringify(value, null, 2) + '\n';
  }

  // ---------- Project ----------

  // The connected folder holds one project: project.json, tasks/ and media/ at its top level.
  async function hasProject() {
    return (await readFile('project.json')) != null;
  }

  // Returns { project, tasks, errors, signature }. Bad task files land in errors.
  async function loadProject() {
    const projectText = await readFile('project.json');
    if (projectText == null) throw new Error('No project.json in this folder');
    const errors = [];
    let project;
    try {
      const raw = JSON.parse(projectText);
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('project.json is not a JSON object');
      project = normalizeProject(raw);
    } catch (err) {
      errors.push({ file: 'project.json', message: err.message });
      project = normalizeProject({});
    }

    const tasks = [];
    const sig = [projectText];
    const entries = (await list('tasks')).filter((e) => e.kind === 'file' && /^T-\d+\.json$/i.test(e.name));
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const text = await readFile('tasks/' + entry.name);
      sig.push(entry.name, text);
      const id = entry.name.replace(/\.json$/i, '');
      try {
        const raw = JSON.parse(text);
        if (raw && raw.id && raw.id !== id) errors.push({ file: 'tasks/' + entry.name, message: 'id "' + raw.id + '" does not match the filename, using "' + id + '"' });
        tasks.push(normalizeTask(raw, id));
      } catch (err) {
        errors.push({ file: 'tasks/' + entry.name, message: err.message });
      }
    }
    return { project, tasks, errors, signature: sig.join('\u0000') };
  }

  async function saveProject(project) {
    await writeFile('project.json', toJson(project));
  }

  // Starts a project in the connected folder. Pass project to reuse an existing definition (import).
  async function createProject(name, project) {
    if (await hasProject()) throw new Error('This folder already holds a project');
    await saveProject(project || { name, description: '', lanes: DEFAULT_LANES.map((l) => ({ ...l })), sprints: [], created: K.util.nowIso() });
    await mkdir('tasks');
    await mkdir('media');
  }

  // ---------- Tasks ----------

  async function saveTask(task) {
    await writeFile('tasks/' + task.id + '.json', toJson(normalizeTask(task, task.id)));
  }

  async function deleteTask(task) {
    await remove('tasks/' + task.id + '.json');
    for (const att of task.attachments || []) {
      try { await removeMedia(att.path); } catch (err) { console.warn(err); }
    }
    for (const name of await listMedia()) {
      if (name.startsWith(task.id + '-')) await remove('media/' + name);
    }
  }

  async function nextTaskId() {
    let max = 0;
    for (const entry of await list('tasks')) {
      const m = /^T-(\d+)\.json$/i.exec(entry.name);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return 'T-' + String(max + 1).padStart(4, '0');
  }

  // ---------- Media ----------

  function safeFileName(name) {
    return String(name || 'file').replace(/[^\w.-]+/g, '-').replace(/\.{2,}/g, '.').replace(/^[-.]+/, '') || 'file';
  }

  // Writes file to media/<taskId>-<name> and returns the attachment record.
  async function saveMedia(taskId, file) {
    const existing = await listMedia();
    const clean = safeFileName(file.name);
    const dot = clean.lastIndexOf('.');
    const stem = taskId + '-' + (dot > 0 ? clean.slice(0, dot) : clean);
    const ext = dot > 0 ? clean.slice(dot) : '';
    let name = stem + ext;
    for (let n = 2; existing.includes(name); n++) name = stem + '-' + n + ext;
    await writeFile('media/' + name, file);
    return { name: file.name || name, path: 'media/' + name, type: file.type || '' };
  }

  function mediaPath(path) {
    const name = String(path).replace(/^media\//, '');
    if (!name || /[\\/]/.test(name) || name === '.' || name === '..') throw new Error('Invalid media path: ' + path);
    return 'media/' + name;
  }

  async function readMedia(path) {
    return readFile(mediaPath(path), true);
  }

  async function removeMedia(path) {
    await remove(mediaPath(path));
  }

  async function listMedia() {
    return (await list('media')).filter((e) => e.kind === 'file').map((e) => e.name);
  }

  // ---------- Agents ----------

  // agents.json next to project.json, written by `node tools/kanban.mjs agents refresh`.
  async function loadAgents() {
    try {
      const raw = JSON.parse(await readFile('agents.json'));
      return (Array.isArray(raw && raw.agents) ? raw.agents : [])
        .filter((a) => a && typeof a.name === 'string' && a.name)
        .map((a) => ({ name: a.name, source: str(a.source), description: str(a.description) }));
    } catch (e) {
      return [];
    }
  }

  // ---------- Handle persistence (IndexedDB) ----------

  function idb(mode, fn) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open('kanban', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('kv');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction('kv', mode);
        const req = fn(tx.objectStore('kv'));
        tx.oncomplete = () => resolve(req && req.result);
        tx.onerror = () => reject(tx.error);
      };
    });
  }

  const RECENT_MAX = 12;

  // Recently opened project folders, newest first: [{ handle, name }]. Falls back to the single folder older versions stored.
  async function loadRecent() {
    const recent = await idb('readonly', (store) => store.get('recent')).catch(() => null);
    if (Array.isArray(recent)) return recent.filter((r) => r && r.handle);
    const old = await idb('readonly', (store) => store.get('root')).catch(() => null);
    return old ? [{ handle: old, name: old.name }] : [];
  }

  async function saveRecent(recent) {
    await idb('readwrite', (store) => store.put(recent.slice(0, RECENT_MAX), 'recent'));
  }

  async function indexOfHandle(recent, handle) {
    for (let i = 0; i < recent.length; i++) {
      if (await recent[i].handle.isSameEntry(handle).catch(() => false)) return i;
    }
    return -1;
  }

  // Moves handle to the front of the recent list under the given display name.
  async function rememberHandle(handle, name) {
    const recent = await loadRecent();
    const i = await indexOfHandle(recent, handle);
    if (i >= 0) recent.splice(i, 1);
    recent.unshift({ handle, name: name || handle.name });
    await saveRecent(recent);
    return recent;
  }

  async function forgetHandle(handle) {
    const recent = await loadRecent();
    const i = await indexOfHandle(recent, handle);
    if (i >= 0) recent.splice(i, 1);
    await saveRecent(recent);
    return recent;
  }

  K.storage = {
    DEFAULT_LANES,
    SPRINT_STATUSES,
    get mode() { return backend ? backend.mode : null; },
    get rootName() { return backend ? backend.rootName : ''; },
    hasFolderSupport: typeof window.showDirectoryPicker === 'function',
    useHandle(handle) { backend = folderBackend(handle); },
    useMemory() { backend = memoryBackend(); },
    useBackend(b) { backend = b; }, // Node CLI: fs-based backend with the same interface
    readFile, writeFile, list, remove, mkdir,
    normalizeProject, normalizeTask, hasScreenshot, toJson, loadAgents, addCommit, isCommitUrl, isSha,
    hasProject, loadProject, saveProject, createProject,
    saveTask, deleteTask, nextTaskId,
    saveMedia, readMedia, removeMedia, listMedia, mediaPath,
    loadRecent, rememberHandle, forgetHandle,
  };
})(window.Kanban);
