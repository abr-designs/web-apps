#!/usr/bin/env node
// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28

// Command-line access to a Kanban project folder. Loads js/util.js and js/storage.js
// into a vm context with a Node fs backend, so files are normalized exactly as the board does.
// Run with no arguments for help.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

// js/ sits next to this file in a project copy (.kanban/tool/), or one level up in the app repo.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = fs.existsSync(path.join(HERE, 'js', 'storage.js')) ? HERE : path.resolve(HERE, '..');

const HELP = `Usage: node kanban.mjs <command> [args] [--root <project folder>] [--json]

  init [--name <n>]                         start a project in the folder (created if missing)
  project                                   lane ids, sprint ids and statuses, tag colors, tags in use
  project set [--name <n>] [--commit-url <https://.../commit/{sha}>]
  list [--lane --sprint --assignee --reviewer --label]
  show <id>                                 print the task JSON
  add --title <t> [fields] [--bottom]
  update <id> [<id>...] [fields] [--bottom] same fields on every id, all or nothing; a lane change
                                            moves the tasks to the top of the new lane, in board order
  comment <id> --text <t> [--author Claude]
  log <id> [--minutes n] [--tokens n] [--by Claude] [--note t]
  attach <id> --file <path> [--name <n>]
  commit <id> [--sha <ref>] [--subject <s>]  record a git commit (default HEAD) on the task
  commits sync [--since <ref|date>] [--all] [--dry-run]
                                            add commits whose message names a task id (T-0007)
  delete <id> --yes
  sprint add --name <n> [--id --start --end --status]
  sprint set <sprint-id> [--name --start --end --status]
  bulk --file <spec.json> [--dry-run]
  agents refresh [--cwd <repo>]             write agents.json from local agent definitions
  agents list
  validate

Fields: --title --description --lane --priority --labels a,b --due YYYY-MM-DD
        --sprint <id> --assignee <name | claude | agent:name> --reviewer <same values>
        --screenshot true|false
Descriptions and comments are Markdown. "claude" means the main Claude session, without a sub-agent.
--force skips the screenshot and agent checks.
Git commands run in --cwd (default: the current directory).
Project folder: --root, else the board holding this copy (<board>/tool/kanban.mjs),
else KANBAN_ROOT, else .kanban in the current directory.`;

// ---------- Args ----------

class UserError extends Error {}
const fail = (msg) => { throw new UserError(msg); };

// Switches take no value. Every other flag takes the next argument as-is (so "--- notes" or "" work), or --key=value.
const SWITCHES = new Set(['json', 'bottom', 'force', 'yes', 'dry-run', 'help', 'all']);

function parseArgs(argv) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { pos.push(a); continue; }
    const eq = a.indexOf('=');
    const key = eq > 0 ? a.slice(2, eq) : a.slice(2);
    if (SWITCHES.has(key)) {
      if (eq > 0) fail('--' + key + ' takes no value');
      flags[key] = true;
    } else if (eq > 0) {
      flags[key] = a.slice(eq + 1);
    } else {
      if (i + 1 >= argv.length) fail('--' + key + ' needs a value');
      flags[key] = argv[++i];
    }
  }
  return { pos, flags };
}

// "true" / "false" (or a JSON boolean from a bulk spec); anything else is an error.
function toBool(v, name) {
  if (v === true || v === 'true') return true;
  if (v === false || v === 'false') return false;
  return fail('--' + name + ' must be true or false');
}

// ---------- Load the browser modules ----------

function loadKanban() {
  const sandbox = { console, URL, TextEncoder, TextDecoder };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of ['js/util.js', 'js/storage.js']) {
    vm.runInContext(fs.readFileSync(path.join(APP_DIR, file), 'utf8'), sandbox, { filename: file });
  }
  return sandbox.Kanban;
}

function fsBackend(root) {
  const abs = (p) => {
    const full = path.resolve(root, ...String(p).split('/').filter(Boolean));
    if (full !== root && !full.startsWith(root + path.sep)) fail('Path escapes the project folder: ' + p);
    return full;
  };
  return {
    mode: 'folder',
    rootName: path.basename(root),
    async readFile(p, asBuffer) {
      try { return asBuffer ? fs.readFileSync(abs(p)) : fs.readFileSync(abs(p), 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
    },
    async writeFile(p, data) {
      const full = abs(p);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, typeof data === 'string' ? data : Buffer.from(data));
    },
    async list(p) {
      try {
        return fs.readdirSync(abs(p), { withFileTypes: true }).map((d) => ({ name: d.name, kind: d.isDirectory() ? 'directory' : 'file' }));
      } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
    },
    async remove(p) { fs.rmSync(abs(p), { recursive: true, force: true }); },
    async mkdir(p) { fs.mkdirSync(abs(p), { recursive: true }); },
  };
}

// ---------- Helpers ----------

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml', pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', json: 'application/json', log: 'text/plain', zip: 'application/zip', mp4: 'video/mp4', webm: 'video/webm' };
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);

// Runs git without a shell and returns stdout.
function git(cwd, args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 });
  } catch (e) {
    if (e.code === 'ENOENT') fail('git was not found on PATH');
    return fail('git ' + args[0] + ' failed in ' + cwd + ': ' + String(e.stderr || e.message).trim());
  }
}

// "sha\x1fsubject\x1fdate" records from git --format output.
function parseCommits(out) {
  return out.split('\x1e').map((r) => r.replace(/^\s+/, '')).filter(Boolean).map((r) => {
    const [sha, subject, date, body] = r.split('\x1f');
    return { sha, subject, date, body: body || '' };
  });
}

function print(value, flags) {
  console.log(flags.json && typeof value !== 'string' ? JSON.stringify(value, null, 2) : value);
}

function makeApi(K, root, flags) {
  const S = K.storage;
  let agentsCache = null;

  async function agents() {
    if (!agentsCache) agentsCache = await S.loadAgents();
    return agentsCache;
  }

  async function load() {
    if (!fs.existsSync(path.join(root, 'project.json'))) fail('No project in ' + root + '. Run: init, or pass --root / set KANBAN_ROOT');
    const data = await S.loadProject();
    for (const e of data.errors) console.error('warning: ' + e.file + ': ' + e.message);
    return data;
  }

  function findTask(data, id) {
    const want = String(id || '').toUpperCase();
    const task = data.tasks.find((t) => t.id.toUpperCase() === want);
    if (!task) fail('Task not found: ' + id);
    return task;
  }

  function orderAt(data, lane, exceptId, bottom) {
    const orders = data.tasks.filter((t) => t.lane === lane && t.id !== exceptId).map((t) => t.order);
    if (!orders.length) return 10;
    return bottom ? Math.max(...orders) + 10 : Math.min(...orders) - 10;
  }

  // Applies field values (CLI flags or a bulk spec entry) to task, validating ids against the project.
  async function applyFields(task, f, project) {
    if (f.title !== undefined) {
      task.title = String(f.title).trim();
      if (!task.title) fail('Title cannot be empty');
    }
    if (f.description !== undefined) task.description = String(f.description);
    if (f.lane !== undefined) {
      if (!project.lanes.some((l) => l.id === f.lane)) fail('Unknown lane "' + f.lane + '". Lane ids: ' + project.lanes.map((l) => l.id).join(', '));
      task.lane = f.lane;
    }
    if (f.priority !== undefined) {
      if (!K.PRIORITIES.includes(f.priority)) fail('Priority must be one of: ' + K.PRIORITIES.join(', '));
      task.priority = f.priority;
    }
    if (f.labels !== undefined) task.labels = (Array.isArray(f.labels) ? f.labels : String(f.labels).split(',')).map((s) => String(s).trim()).filter(Boolean);
    if (f.due !== undefined) {
      const due = String(f.due);
      if (due && !isDate(due)) fail('Due must be YYYY-MM-DD or empty');
      task.due = due;
    }
    if (f.sprint !== undefined) {
      const sprint = String(f.sprint);
      if (sprint && !project.sprints.some((s) => s.id === sprint)) fail('Unknown sprint "' + sprint + '". Sprint ids: ' + (project.sprints.map((s) => s.id).join(', ') || 'none'));
      task.sprint = sprint;
    }
    for (const key of ['assignee', 'reviewer']) {
      if (f[key] === undefined) continue;
      const who = String(f[key]).trim();
      if (who.startsWith('agent:') && !flags.force && !(await agents()).some((a) => 'agent:' + a.name === who)) {
        fail('Agent "' + who.slice(6) + '" is not in agents.json. Run: agents list (or agents refresh), or pass --force');
      }
      task[key] = who;
    }
    if (f.screenshot !== undefined) {
      const on = toBool(f.screenshot, 'screenshot');
      if (task.screenshot && !on && !flags.force) fail(task.id + ' requires a screenshot; clearing that needs --force');
      task.screenshot = on;
    }
  }

  // Tasks flagged "screenshot" need an image while in review or the last lane.
  function checkScreenshot(task, project) {
    if (flags.force || !task.screenshot || S.hasScreenshot(task)) return;
    if (task.lane === 'review' || task.lane === project.lanes.at(-1).id) {
      fail(task.id + ' requires a screenshot in "' + task.lane + '". Attach one first: attach ' + task.id + ' --file <image>');
    }
  }

  async function save(task) {
    await S.saveTask(task);
    return S.normalizeTask(JSON.parse(await S.readFile('tasks/' + task.id + '.json')), task.id);
  }

  function saveProjectGuard(data) {
    if (data.errors.some((e) => e.file === 'project.json')) fail('project.json is unreadable; fix it before changing tasks, lanes or sprints (run: validate)');
  }

  const summary = (t, project) => {
    const lane = (project.lanes.find((l) => l.id === t.lane) || { name: t.lane }).name;
    return [t.id, '[' + lane + ']', t.priority, t.title, t.assignee && '@' + t.assignee, t.reviewer && 'review:' + t.reviewer, t.sprint && '{' + t.sprint + '}', t.labels.length && '#' + t.labels.join(' #')].filter(Boolean).join('  ');
  };

  return { S, agents, load, findTask, orderAt, applyFields, checkScreenshot, save, saveProjectGuard, summary };
}

// ---------- Agents discovery ----------

function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const out = {};
  if (!m) return out;
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = /^(\w[\w-]*):\s*(.*)$/.exec(lines[i]);
    if (!kv) continue;
    const parts = [kv[2].trim()];
    const block = /^[|>][-+]?$/.test(parts[0]);
    if (block) parts.pop();
    // Block scalars and wrapped plain values continue on indented lines.
    while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) parts.push(lines[++i].trim());
    out[kv[1]] = parts.join(' ').replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

function agentFile(file, prefix, source) {
  const meta = frontmatter(fs.readFileSync(file, 'utf8'));
  const name = meta.name || path.basename(file).replace(/(\.agent)?\.md$/, '');
  return { name: prefix + name, source, description: (meta.description || '').slice(0, 400) };
}

// Agent .md files in dir and its subfolders.
function readAgentDir(dir, prefix, source) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return []; }
  return entries.flatMap((d) => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) return readAgentDir(full, prefix, source);
    return d.name.endsWith('.md') ? [agentFile(full, prefix, source)] : [];
  });
}

// A plugin's default agents/ folder plus any paths listed under "agents" in its plugin.json.
function readPluginAgents(installPath, plugin) {
  const prefix = plugin + ':';
  const source = 'plugin ' + plugin;
  const out = readAgentDir(path.join(installPath, 'agents'), prefix, source);
  const manifest = readJson(path.join(installPath, '.claude-plugin', 'plugin.json')) || {};
  const extra = typeof manifest.agents === 'string' ? [manifest.agents] : Array.isArray(manifest.agents) ? manifest.agents : [];
  for (const rel of extra) {
    const full = path.resolve(installPath, String(rel));
    if (!fs.existsSync(full)) continue;
    out.push(...(fs.statSync(full).isDirectory() ? readAgentDir(full, prefix, source) : [agentFile(full, prefix, source)]));
  }
  return out;
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
}

// Built-ins, then project agents (they win over user agents with the same name), user agents and enabled plugins.
function discoverAgents(cwd) {
  const home = path.join(os.homedir(), '.claude');
  const projectSource = 'project ' + cwd.replace(/\\/g, '/');
  const out = [
    { name: 'general-purpose', source: 'built-in', description: 'Researches complex questions, searches code and runs multi-step tasks.' },
    { name: 'Explore', source: 'built-in', description: 'Read-only search agent for broad codebase sweeps.' },
    { name: 'Plan', source: 'built-in', description: 'Software architect agent that designs implementation plans.' },
  ];
  out.push(...readAgentDir(path.join(cwd, '.claude', 'agents'), '', projectSource));
  out.push(...readAgentDir(path.join(home, 'agents'), '', 'user'));

  // Enabled plugins: user settings, then project settings, then local settings (later wins).
  const enabled = {};
  for (const file of [path.join(home, 'settings.json'), path.join(cwd, '.claude', 'settings.json'), path.join(cwd, '.claude', 'settings.local.json')]) {
    Object.assign(enabled, (readJson(file) || {}).enabledPlugins || {});
  }
  const installed = (readJson(path.join(home, 'plugins', 'installed_plugins.json')) || {}).plugins || {};
  for (const [key, on] of Object.entries(enabled)) {
    if (on !== true || !Array.isArray(installed[key])) continue;
    // Prefer the install for this project, then a user-scope install.
    const entry = installed[key].find((e) => e.projectPath && path.resolve(e.projectPath) === cwd) || installed[key].find((e) => !e.projectPath);
    if (!entry || !entry.installPath) continue;
    out.push(...readPluginAgents(entry.installPath, key.split('@')[0]));
  }

  const seen = new Set();
  return out.filter((a) => !seen.has(a.name) && seen.add(a.name));
}

// ---------- Commands ----------

async function main() {
  const { pos, flags } = parseArgs(process.argv.slice(2));
  const [cmd, ...args] = pos;
  if (!cmd || cmd === 'help' || flags.help) return console.log(HELP);

  // A project copy (<board>/tool/kanban.mjs) always serves its own board, whatever the current directory.
  const ownBoard = path.basename(HERE) === 'tool' && fs.existsSync(path.join(HERE, '..', 'project.json')) ? path.dirname(HERE) : '';
  const root = path.resolve(flags.root || ownBoard || process.env.KANBAN_ROOT || '.kanban');
  if (cmd === 'init') fs.mkdirSync(root, { recursive: true });
  else if (!fs.existsSync(root)) fail('Project folder not found: ' + root + '. Run: init, or pass --root / set KANBAN_ROOT');
  const K = loadKanban();
  K.storage.useBackend(fsBackend(root));
  const api = makeApi(K, root, flags);
  const { S } = api;
  const now = () => new Date().toISOString();

  switch (cmd) {
    case 'init': {
      if (await S.hasProject()) fail('A project already exists in ' + root);
      // Default name: the repo folder for <repo>/.kanban, else the folder itself.
      const name = (flags.name || '').trim() || path.basename(path.basename(root) === '.kanban' ? path.dirname(root) : root);
      await S.createProject(name);
      return print('Created project "' + name + '" in ' + root, flags);
    }

    case 'project': {
      const data = await api.load();
      const { project } = data;
      if (args[0] === 'set') {
        api.saveProjectGuard(data);
        if (flags.name !== undefined) project.name = flags.name.trim() || project.name;
        if (flags['commit-url'] !== undefined) {
          const url = flags['commit-url'].trim();
          if (url && !S.isCommitUrl(url)) fail('--commit-url must start with http(s):// and contain {sha}, for example https://github.com/owner/repo/commit/{sha}');
          project.commitUrl = url;
        }
        await S.saveProject(project);
        return print(flags.json ? project : 'Updated project "' + project.name + '"' + (project.commitUrl ? ' (commit URL ' + project.commitUrl + ')' : ''), flags);
      }
      if (args[0]) fail('Use: project, or project set');
      const tags = [...new Set(data.tasks.flatMap((t) => t.labels))].sort();
      if (flags.json) return print({ name: project.name, lanes: project.lanes, sprints: project.sprints, labels: project.labels, commitUrl: project.commitUrl, tags }, flags);
      return console.log([
        project.name,
        'Lanes (id: name): ' + project.lanes.map((l) => l.id + ': ' + l.name).join(', '),
        'Sprints:' + (project.sprints.length ? '' : ' none'),
        ...project.sprints.map((s) => '  ' + s.id + '  ' + s.status + '  "' + s.name + '"' + (s.start || s.end ? '  ' + (s.start || '?') + ' to ' + (s.end || '?') : '')),
        'Tags in use: ' + (tags.join(', ') || 'none'),
        'Pinned tag colors: ' + (Object.entries(project.labels).map(([k, v]) => k + '=' + v).join(', ') || 'none'),
        'Commit URL: ' + (project.commitUrl || 'none'),
      ].join('\n'));
    }

    case 'list': {
      const data = await api.load();
      const laneIndex = new Map(data.project.lanes.map((l, i) => [l.id, i]));
      const tasks = data.tasks.filter((t) =>
        (!flags.lane || t.lane === flags.lane) &&
        (!flags.sprint || t.sprint === flags.sprint) &&
        (!flags.assignee || t.assignee === flags.assignee) &&
        (!flags.reviewer || t.reviewer === flags.reviewer) &&
        (!flags.label || t.labels.includes(flags.label)))
        .sort((a, b) => (laneIndex.get(a.lane) ?? 0) - (laneIndex.get(b.lane) ?? 0) || a.order - b.order || a.id.localeCompare(b.id));
      return print(flags.json ? tasks : tasks.map((t) => api.summary(t, data.project)).join('\n') || '(no tasks)', flags);
    }

    case 'show': {
      const data = await api.load();
      return console.log(JSON.stringify(api.findTask(data, args[0]), null, 2));
    }

    case 'add': {
      const data = await api.load();
      api.saveProjectGuard(data);
      if (!flags.title) fail('--title is required');
      const t = now();
      const task = S.normalizeTask({ lane: data.project.lanes[0].id, created: t, updated: t }, await S.nextTaskId());
      await api.applyFields(task, flags, data.project);
      task.order = api.orderAt(data, task.lane, task.id, flags.bottom);
      api.checkScreenshot(task, data.project);
      const saved = await api.save(task);
      return print(flags.json ? saved : 'Created ' + api.summary(saved, data.project), flags);
    }

    case 'update': {
      if (!args.length) fail('update needs a task id');
      const data = await api.load();
      api.saveProjectGuard(data);
      // Several ids get the same fields; everything is checked before any file is written.
      const laneIndex = new Map(data.project.lanes.map((l, i) => [l.id, i]));
      const tasks = [...new Set(args.map((id) => api.findTask(data, id)))]
        .sort((a, b) => (laneIndex.get(a.lane) ?? 0) - (laneIndex.get(b.lane) ?? 0) || a.order - b.order || a.id.localeCompare(b.id));
      const before = new Map(tasks.map((t) => [t, { lane: t.lane, shot: t.screenshot }]));
      for (const task of tasks) await api.applyFields(task, flags, data.project);
      // Placing the last one first at the top (or the first one first at the bottom) keeps their board order.
      for (const task of flags.bottom ? tasks : [...tasks].reverse()) {
        if (task.lane !== before.get(task).lane || flags.bottom) task.order = api.orderAt(data, task.lane, task.id, flags.bottom);
      }
      for (const task of tasks) {
        const old = before.get(task);
        if (task.lane !== old.lane || (task.screenshot && !old.shot)) api.checkScreenshot(task, data.project);
      }
      const saved = [];
      for (const task of tasks) {
        task.updated = now();
        saved.push(await api.save(task));
      }
      if (flags.json) return print(saved.length === 1 ? saved[0] : saved, flags);
      return print(saved.map((t) => 'Updated ' + api.summary(t, data.project)).join('\n'), flags);
    }

    case 'comment': {
      const [id] = args;
      if (!flags.text) fail('--text is required');
      const data = await api.load();
      const task = api.findTask(data, id);
      task.comments.push({ author: flags.author || 'Claude', date: now(), text: flags.text });
      task.updated = now();
      await api.save(task);
      return print('Commented on ' + task.id, flags);
    }

    case 'log': {
      const [id] = args;
      const num = (key) => {
        const n = flags[key] === undefined ? 0 : Number(flags[key]);
        if (!Number.isFinite(n) || n < 0 || flags[key] === '') fail('--' + key + ' must be a number of 0 or more');
        return n;
      };
      const minutes = num('minutes');
      const tokens = Math.round(num('tokens'));
      if (minutes === 0 && tokens === 0) fail('Pass --minutes and/or --tokens');
      const data = await api.load();
      const task = api.findTask(data, id);
      task.work.push({ by: flags.by || 'Claude', date: now(), minutes, tokens, note: flags.note || '' });
      task.updated = now();
      const saved = await api.save(task);
      const total = saved.work.reduce((a, w) => ({ m: a.m + w.minutes, t: a.t + w.tokens }), { m: 0, t: 0 });
      return print('Logged on ' + task.id + ' (total ' + K.util.formatMinutes(total.m) + ', ' + K.util.formatTokens(total.t) + ' tokens)', flags);
    }

    case 'attach': {
      const [id] = args;
      if (!flags.file || !fs.existsSync(flags.file)) fail('--file must point to an existing file');
      const data = await api.load();
      const task = api.findTask(data, id);
      const buf = fs.readFileSync(flags.file);
      const name = path.basename(flags.name || flags.file);
      const ext = name.split('.').pop().toLowerCase();
      const att = await S.saveMedia(task.id, Object.assign(buf, { name, type: MIME[ext] || '' }));
      task.attachments.push({ name: att.name, path: att.path, type: att.type });
      task.updated = now();
      await api.save(task);
      return print('Attached ' + att.path + ' to ' + task.id, flags);
    }

    case 'commit': {
      const [id] = args;
      const data = await api.load();
      const task = api.findTask(data, id);
      let commit;
      if (flags.subject !== undefined) {
        // Recorded as given, without git.
        if (!S.isSha(flags.sha)) fail('With --subject, pass the full or short hex SHA as --sha');
        commit = { sha: flags.sha, subject: flags.subject, date: '' };
      } else {
        const ref = flags.sha || 'HEAD';
        if (ref.startsWith('-')) fail('Invalid --sha: ' + ref);
        const cwd = path.resolve(flags.cwd || process.cwd());
        [commit] = parseCommits(git(cwd, ['show', '-s', '--format=%H%x1f%s%x1f%cI%x1e', ref + '^{commit}']));
      }
      if (!S.addCommit(task, commit)) return print(task.id + ' already lists ' + commit.sha.slice(0, 7), flags);
      task.updated = now();
      await api.save(task);
      return print('Recorded ' + commit.sha.slice(0, 7) + ' "' + commit.subject + '" on ' + task.id, flags);
    }

    case 'commits': {
      if (args[0] !== 'sync') fail('Use: commits sync');
      const data = await api.load();
      const cwd = path.resolve(flags.cwd || process.cwd());
      const range = flags.all ? ['--all'] : ['HEAD'];
      if (flags.since) {
        if (flags.since.startsWith('-')) fail('Invalid --since: ' + flags.since);
        if (isDate(flags.since)) range.push('--since=' + flags.since);
        else range.push('^' + flags.since);
      }
      const commits = parseCommits(git(cwd, ['log', ...range, '--format=%H%x1f%s%x1f%cI%x1f%b%x1e']));
      // Task ids compared by number, so "T-7" in a message matches T-0007.
      const byNumber = new Map(data.tasks.map((t) => [Number(t.id.slice(2)), t]));
      const changed = new Map();
      const unknown = new Set();
      for (const c of commits) {
        const nums = new Set([...(c.subject + '\n' + c.body).matchAll(/\bT-(\d+)\b/gi)].map((m) => Number(m[1])));
        for (const n of nums) {
          const task = byNumber.get(n);
          if (!task) { unknown.add('T-' + String(n).padStart(4, '0')); continue; }
          if (S.addCommit(task, c)) changed.set(task, (changed.get(task) || 0) + 1);
        }
      }
      if (!flags['dry-run']) {
        for (const task of changed.keys()) {
          task.updated = now();
          await api.save(task);
        }
      }
      const verb = flags['dry-run'] ? 'Would add' : 'Added';
      if (flags.json) return print({ scanned: commits.length, added: Object.fromEntries([...changed].map(([t, n]) => [t.id, n])), unknown: [...unknown] }, flags);
      return console.log([
        'Scanned ' + commits.length + ' commit(s).',
        changed.size ? verb + ': ' + [...changed].map(([t, n]) => t.id + ' +' + n).join(', ') : 'No new commits for tasks.',
        unknown.size && 'Ids with no task: ' + [...unknown].join(', '),
      ].filter(Boolean).join('\n'));
    }

    case 'delete': {
      const [id] = args;
      if (flags.yes !== true) fail('Deleting removes the task file and its media. Pass --yes to confirm.');
      const data = await api.load();
      const task = api.findTask(data, id);
      await S.deleteTask(task);
      return print('Deleted ' + task.id, flags);
    }

    case 'sprint': {
      const [action, sprintId] = args;
      const data = await api.load();
      api.saveProjectGuard(data);
      const project = data.project;
      const setFields = (s) => {
        if (flags.name !== undefined) s.name = flags.name.trim() || s.id;
        for (const key of ['start', 'end']) {
          if (flags[key] === undefined) continue;
          const v = flags[key];
          if (v && !isDate(v)) fail('--' + key + ' must be YYYY-MM-DD');
          s[key] = v;
        }
        if (flags.status !== undefined) {
          if (!S.SPRINT_STATUSES.includes(flags.status)) fail('--status must be one of: ' + S.SPRINT_STATUSES.join(', '));
          s.status = flags.status;
        }
      };
      let sprint;
      if (action === 'add') {
        if (!flags.name || !flags.name.trim()) fail('--name is required');
        const ids = project.sprints.map((s) => s.id);
        const id = flags.id || K.util.uniqueName(K.util.slugify(flags.name), ids);
        if (ids.includes(id)) fail('Sprint id already exists: ' + id);
        sprint = { id, name: '', start: '', end: '', status: 'planned' };
        setFields(sprint);
        project.sprints.push(sprint);
      } else if (action === 'set') {
        sprint = project.sprints.find((s) => s.id === sprintId) || fail('Unknown sprint: ' + sprintId);
        setFields(sprint);
      } else fail('Use: sprint add|set');
      await S.saveProject(project);
      return print(flags.json ? sprint : (action === 'add' ? 'Added' : 'Updated') + ' sprint ' + sprint.id + ' (' + sprint.status + ')', flags);
    }

    // spec: { "sprint": "<existing id>" | { id?, name, start?, end?, status? }, "tasks": [{ title, description?, lane?, priority?, labels?, due?, assignee?, reviewer?, screenshot?, sprint? }] }
    // Tasks keep the listed order: the first one sits highest in its lane.
    case 'bulk': {
      const data = await api.load();
      api.saveProjectGuard(data);
      const spec = readJson(String(flags.file)) || fail('--file must be a readable JSON spec');
      if (!Array.isArray(spec.tasks) || !spec.tasks.length) fail('spec.tasks must be a non-empty array');
      const project = data.project;
      let sprintId = '';
      let newSprint = null;
      if (typeof spec.sprint === 'string') {
        if (!project.sprints.some((s) => s.id === spec.sprint)) fail('Unknown sprint: ' + spec.sprint);
        sprintId = spec.sprint;
      } else if (spec.sprint && typeof spec.sprint === 'object') {
        const existing = spec.sprint.id && project.sprints.find((s) => s.id === spec.sprint.id);
        if (existing) sprintId = existing.id;
        else {
          api.saveProjectGuard(data);
          if (!spec.sprint.name) fail('spec.sprint.name is required for a new sprint');
          // Re-running a plan should reuse its sprint deliberately, so a matching name is an error.
          const want = String(spec.sprint.name).trim().toLowerCase();
          const same = project.sprints.find((s) => s.name.trim().toLowerCase() === want || s.id === K.util.slugify(spec.sprint.name));
          if (same) fail('A sprint named "' + same.name + '" already exists (id ' + same.id + '). Set "sprint": "' + same.id + '" to add to it, or choose another name.');
          newSprint = S.normalizeProject({ sprints: [{ status: 'planned', ...spec.sprint, id: spec.sprint.id || K.util.uniqueName(K.util.slugify(spec.sprint.name), project.sprints.map((s) => s.id)) }] }).sprints[0];
          project.sprints.push(newSprint);
          sprintId = newSprint.id;
        }
      }

      // Validate everything before writing anything.
      const t = now();
      let next = Number((await S.nextTaskId()).slice(2));
      const tasks = [];
      for (const [i, entry] of spec.tasks.entries()) {
        if (!entry || typeof entry !== 'object' || !entry.title) fail('spec.tasks[' + i + '] needs a title');
        const task = S.normalizeTask({ lane: project.lanes[0].id, sprint: sprintId, created: t, updated: t }, 'T-' + String(next++).padStart(4, '0'));
        await api.applyFields(task, entry, project);
        api.checkScreenshot(task, project);
        tasks.push(task);
      }
      for (const lane of new Set(tasks.map((x) => x.lane))) {
        const group = tasks.filter((x) => x.lane === lane);
        const orders = data.tasks.filter((x) => x.lane === lane).map((x) => x.order);
        const start = orders.length ? Math.min(...orders) - 10 * group.length : 10;
        group.forEach((x, i) => { x.order = start + 10 * i; });
      }

      if (flags['dry-run']) return print(flags.json ? { sprint: newSprint || sprintId, tasks } : [newSprint ? 'Would add sprint ' + newSprint.id : sprintId && 'Sprint ' + sprintId, ...tasks.map((x) => 'Would create ' + api.summary(x, project))].filter(Boolean).join('\n'), flags);
      if (newSprint) await S.saveProject(project);
      for (const task of tasks) await S.saveTask(task);
      return print(flags.json ? { sprint: sprintId, ids: tasks.map((x) => x.id) } : [newSprint && 'Added sprint ' + newSprint.id, ...tasks.map((x) => 'Created ' + api.summary(x, project))].filter(Boolean).join('\n'), flags);
    }

    case 'agents': {
      if (args[0] === 'refresh') {
        const cwd = path.resolve(flags.cwd || process.cwd());
        const agents = discoverAgents(cwd);
        await S.writeFile('agents.json', S.toJson({ generated: now(), agents }));
        return print(flags.json ? agents : 'Wrote ' + agents.length + ' agents to ' + path.join(root, 'agents.json'), flags);
      }
      if (args[0] === 'list') {
        const agents = await api.agents();
        return print(flags.json ? agents : agents.map((a) => a.name + '  (' + a.source + ')  ' + a.description.slice(0, 110)).join('\n') || '(none: run agents refresh)', flags);
      }
      return fail('Use: agents refresh|list');
    }

    case 'validate': {
      const data = await api.load();
      const { project } = data;
      const agentNames = new Set((await api.agents()).map((a) => 'agent:' + a.name));
      const issues = [];
      for (const e of data.errors) issues.push(e.file + ': ' + e.message);
      const rawProject = readJson(path.join(root, 'project.json')) || {};
      if (rawProject.commitUrl && !S.isCommitUrl(rawProject.commitUrl)) issues.push('project.json: commitUrl needs http(s):// and {sha}, ignored: "' + rawProject.commitUrl + '"');
      for (const task of data.tasks) {
        const at = task.id + ': ';
        const raw = readJson(path.join(root, 'tasks', task.id + '.json')) || {};
        for (const c of Array.isArray(raw.commits) ? raw.commits : []) {
          if (!c || !S.isSha(c.sha)) issues.push(at + 'invalid commit SHA ' + JSON.stringify(c && c.sha) + ', ignored');
        }
        if (task.reviewer.startsWith('agent:') && !agentNames.has(task.reviewer)) issues.push(at + 'reviewer agent not in agents.json "' + task.reviewer + '"');
        if (!project.lanes.some((l) => l.id === task.lane)) issues.push(at + 'unknown lane "' + task.lane + '"');
        if (task.sprint && !project.sprints.some((s) => s.id === task.sprint)) issues.push(at + 'unknown sprint "' + task.sprint + '"');
        if (task.assignee.startsWith('agent:') && !agentNames.has(task.assignee)) issues.push(at + 'agent not in agents.json "' + task.assignee + '"');
        if (task.screenshot && !S.hasScreenshot(task) && (task.lane === 'review' || task.lane === project.lanes.at(-1).id)) issues.push(at + 'requires a screenshot but has no image attached');
        for (const att of task.attachments) {
          if (!fs.existsSync(path.join(root, att.path))) issues.push(at + 'missing media file ' + att.path);
        }
      }
      if (flags.json) print(issues, flags);
      else console.log(issues.length ? issues.join('\n') : 'OK: ' + data.tasks.length + ' task(s), no issues');
      process.exitCode = issues.length ? 1 : 0;
      return;
    }

    default:
      fail('Unknown command "' + cmd + '". Run with no arguments for help.');
  }
}

main().catch((err) => {
  console.error('error: ' + (err instanceof UserError ? err.message : err.stack || err.message));
  process.exitCode = 2;
});
