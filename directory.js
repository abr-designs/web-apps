// Created by Claude (claude-opus-5-5)
// Date: 2026-09-30
//
// Renders apps.json (built by scripts/build-directory.mjs) as the compact list directory.

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Stroke path data on a 24x24 grid, keyed by app.json "icon". */
export const ICONS = {
  'mountain': 'M3 20h18L14 7l-4 7-2-3-5 9z',
  'layout-kanban': 'M4 4h6M14 4h6M4 8h6v12H4zM14 8h6v6h-6z',
  'car': 'M5 17H3v-5l2-5h14l2 5v5h-2M5 12h14M7 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M13 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
  'brush': 'M3 21v-4a4 4 0 1 1 4 4H3M21 3A16 16 0 0 0 8.2 13.2M21 3a16 16 0 0 1-10.2 12.8M10.6 9a9 9 0 0 1 4.4 4.4',
  'book': 'M3 19a9 9 0 0 1 9 0 9 9 0 0 1 9 0V6a9 9 0 0 0-9 0 9 9 0 0 0-9 0zM12 6v13',
};

const CHEVRON = 'M9 6l6 6-6 6';

/** @created Claude (claude-opus-5-5) 2026-09-30 */
export function formatUpdated(iso) {
  if (!iso) return '';
  const date = new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `Updated ${date}`;
}

function svgIcon(doc, d, className) {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', className);
  const path = doc.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** @created Claude (claude-opus-5-5) 2026-09-30 */
export function renderList(entries, doc) {
  if (entries.length === 0) return el(doc, 'p', 'status', 'No apps published yet.');

  const list = el(doc, 'ul', 'app-list');
  for (const app of entries) {
    const tile = el(doc, 'span', `tile tile-${app.color}`);
    if (ICONS[app.icon]) tile.append(svgIcon(doc, ICONS[app.icon], 'tile-icon'));
    else tile.textContent = app.name.charAt(0).toUpperCase();

    const text = el(doc, 'span', 'app-text');
    text.append(el(doc, 'span', 'app-name', app.name), el(doc, 'span', 'app-desc', app.description));
    const updated = formatUpdated(app.updated);
    if (updated) text.append(el(doc, 'span', 'app-date', updated));

    const link = el(doc, 'a', 'app-row');
    link.href = app.url;
    link.append(tile, text, svgIcon(doc, CHEVRON, 'chevron'));

    const item = el(doc, 'li');
    item.append(link);
    list.append(item);
  }
  return list;
}

async function init() {
  const container = document.getElementById('app-list');
  const count = document.getElementById('app-count');
  try {
    const response = await fetch('apps.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const entries = await response.json();
    count.textContent = entries.length === 1 ? '1 app' : `${entries.length} apps`;
    container.replaceChildren(renderList(entries, document));
  } catch {
    count.textContent = '';
    container.replaceChildren(el(document, 'p', 'status', "Couldn't load the app list. Refresh to try again."));
  }
}

if (typeof document !== 'undefined') init();
