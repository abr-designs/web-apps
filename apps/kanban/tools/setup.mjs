#!/usr/bin/env node
// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28

// Sets up a Kanban board in a project: copies the kanban skills to <target>/.claude/skills/,
// the CLI to <target>/.kanban/tool/, then creates the project and agents.json when missing.
// Existing copies that differ are only replaced with --update. Board data is never touched.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const HELP = `Usage: node tools/setup.mjs [--target <repo>] [--name <project name>] [--update]

  --target   project to set up (default: current directory)
  --name     project name for a new board (default: the target folder name)
  --update   replace existing skill and CLI copies that differ from this app`;

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (key === 'update' || key === 'help') flags[key] = true;
    else if (key === 'target' || key === 'name') {
      const value = argv[++i];
      if (value === undefined || value.startsWith('--')) throw new Error('--' + key + ' needs a value');
      flags[key] = value;
    } else throw new Error('Unknown argument: ' + argv[i]);
  }
  return flags;
}

// [source, destination] pairs for every managed file.
function managedFiles(target) {
  const tool = path.join(target, '.kanban', 'tool');
  const pairs = [
    [path.join(APP_DIR, 'tools', 'kanban.mjs'), path.join(tool, 'kanban.mjs')],
    [path.join(APP_DIR, 'js', 'util.js'), path.join(tool, 'js', 'util.js')],
    [path.join(APP_DIR, 'js', 'storage.js'), path.join(tool, 'js', 'storage.js')],
  ];
  const skillsDir = path.join(APP_DIR, 'skills');
  for (const name of fs.readdirSync(skillsDir)) {
    const src = path.join(skillsDir, name, 'SKILL.md');
    if (fs.existsSync(src)) pairs.push([src, path.join(target, '.claude', 'skills', name, 'SKILL.md')]);
  }
  return pairs;
}

function runCli(cli, args) {
  const res = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  process.stdout.write(res.stdout || '');
  process.stderr.write(res.stderr || '');
  if (res.status !== 0) throw new Error('kanban.mjs ' + args[0] + ' failed');
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) return console.log(HELP);
  const target = path.resolve(flags.target || process.cwd());
  if (!fs.statSync(target, { throwIfNoEntry: false })?.isDirectory()) throw new Error('Target is not a folder: ' + target);
  // Real paths resolve links and letter case; Windows compares case-insensitively.
  const canon = (p) => { const real = fs.realpathSync.native(p); return process.platform === 'win32' ? real.toLowerCase() : real; };
  const app = canon(APP_DIR);
  const real = canon(target);
  if (real === app || real.startsWith(app + path.sep)) throw new Error('Target is the kanban app or a folder inside it; run this from another project');

  const pairs = managedFiles(target);
  const same = (src, dest) => fs.readFileSync(src).equals(fs.readFileSync(dest));
  const changed = pairs.filter(([src, dest]) => fs.existsSync(dest) && !same(src, dest));
  if (changed.length && !flags.update) {
    console.log('These files already exist and differ from the kanban app. Nothing was written. Re-run with --update to replace them:');
    for (const [, dest] of changed) console.log('  ' + path.relative(target, dest).replace(/\\/g, '/'));
    process.exitCode = 1;
    return;
  }

  const report = { added: [], updated: [], unchanged: [] };
  for (const [src, dest] of pairs) {
    const rel = path.relative(target, dest).replace(/\\/g, '/');
    if (!fs.existsSync(dest)) report.added.push(rel);
    else if (same(src, dest)) { report.unchanged.push(rel); continue; }
    else report.updated.push(rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
  for (const [label, list] of Object.entries(report)) if (list.length) console.log(label + ': ' + list.join(', '));

  const board = path.join(target, '.kanban');
  const cli = path.join(board, 'tool', 'kanban.mjs');
  if (!fs.existsSync(path.join(board, 'project.json'))) runCli(cli, ['init', '--root', board, ...(flags.name ? ['--name', flags.name] : [])]);
  else console.log('Board already exists: ' + board);
  if (!fs.existsSync(path.join(board, 'agents.json'))) runCli(cli, ['agents', 'refresh', '--root', board, '--cwd', target]);
}

try {
  main();
} catch (err) {
  console.error('error: ' + err.message);
  process.exitCode = 2;
}
