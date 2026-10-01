// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28

// Small helpers shared by every module.
window.Kanban = window.Kanban || {};

(function (K) {
  'use strict';

  K.PRIORITIES = ['critical', 'high', 'medium', 'low'];
  K.TAG_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink', 'gray'];

  // el('div', { class: 'card', onclick: fn, dataset: { id: 'x' } }, child, 'text', [more])
  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
      if (value == null || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'dataset') Object.assign(node.dataset, value);
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
      else if (key in node && typeof value !== 'string') node[key] = value;
      else node.setAttribute(key, value === true ? '' : value);
    }
    append(node, children);
    return node;
  }

  function append(node, children) {
    for (const child of children) {
      if (child == null || child === false) continue;
      if (Array.isArray(child)) append(node, child);
      else node.append(child instanceof Node ? child : String(child));
    }
  }

  function slugify(text) {
    const slug = String(text || '').toLowerCase().normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || 'item';
  }

  // Returns base, or base-2, base-3... whichever is not in existing.
  function uniqueName(base, existing) {
    const taken = new Set(existing);
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(base + '-' + n)) n++;
    return base + '-' + n;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Formats "YYYY-MM-DD" as a date and full ISO timestamps as date plus time.
  function formatDate(value) {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
    const date = new Date(value);
    if (isNaN(date)) return value;
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function isOverdue(due) {
    return !!due && due < todayStr();
  }

  function isImage(nameOrType) {
    return /^image\//.test(nameOrType || '') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(nameOrType || '');
  }

  function download(filename, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: type || 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Comment author, remembered per browser. localStorage because Chrome keeps no cookies for file:// pages.
  const AUTHOR_KEY = 'kanban.author';

  function getAuthor() {
    try { return localStorage.getItem(AUTHOR_KEY) || 'Alex'; } catch (e) { return 'Alex'; }
  }

  function setAuthor(name) {
    name = String(name || '').trim();
    if (!name) return;
    try { localStorage.setItem(AUTHOR_KEY, name); } catch (e) { /* ignore */ }
  }

  // Pinned color from project.json labels, else a stable pick from the tag name.
  function tagColor(name, labels) {
    const pinned = labels && labels[name];
    if (K.TAG_COLORS.includes(pinned)) return pinned;
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    return K.TAG_COLORS[h % K.TAG_COLORS.length];
  }

  // "45m", "2h 5m"; tokens as "980", "48k", "1.2M".
  function formatMinutes(min) {
    min = Math.round(min);
    return min >= 60 ? Math.floor(min / 60) + 'h' + (min % 60 ? ' ' + (min % 60) + 'm' : '') : min + 'm';
  }

  function formatTokens(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(n < 1e4 ? 1 : 0).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  // Assignee and reviewer value for the main Claude session (work done inline, no sub-agent).
  const CLAUDE = 'claude';

  // True for "claude" and "agent:<name>".
  function isAgentValue(value) {
    return value === CLAUDE || String(value || '').startsWith('agent:');
  }

  // Display text for an assignee or reviewer value: "agent:x" -> "x", "claude" -> "Claude".
  function assigneeLabel(value) {
    return value === CLAUDE ? 'Claude' : String(value || '').replace(/^agent:/, '');
  }

  // Commit link from the project's commitUrl template ("...{sha}"), or '' when none is set.
  function commitLink(template, sha) {
    return template ? template.split('{sha}').join(sha) : '';
  }

  K.util = { el, slugify, uniqueName, nowIso, todayStr, formatDate, isOverdue, isImage, download, getAuthor, setAuthor, tagColor, formatMinutes, formatTokens, CLAUDE, isAgentValue, assigneeLabel, commitLink };
})(window.Kanban);
