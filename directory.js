// Created by Claude (claude-opus-5-5)
// Date: 2026-09-30
//
// Renders apps.json, games.json and dev.json (built by scripts/build-directory.mjs) as the compact list directory with Games and In Development tabs.

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

/** @created Claude (claude-opus-5-5) 2026-10-05 */
export function tabLabel(count) {
  return `In Development (${count})`;
}

// [Claude 2026-10-19 start]
/**
 * Reads the active tab and selected tags from a location hash: "#dev", "#games" or "#games/<tag>,<tag>"; anything else is apps.
 * @created Claude (claude-opus-5-5) 2026-10-19
 */
export function parseHash(hash) {
  const value = hash.replace(/^#/, '');
  if (value === 'dev') return { tab: 'dev', tags: [] };
  if (value !== 'games' && !value.startsWith('games/')) return { tab: 'apps', tags: [] };
  let tags;
  try {
    tags = [...new Set(value.slice('games/'.length).split(',').map((t) => decodeURIComponent(t).toLowerCase()).filter(Boolean))];
  } catch {
    tags = [];
  }
  return { tab: 'games', tags };
}

/** @created Claude (claude-opus-5-5) 2026-10-19 */
export function formatHash(tab, tags) {
  if (tab === 'dev') return '#dev';
  if (tab !== 'games') return '';
  return tags.length > 0 ? `#games/${tags.map(encodeURIComponent).join(',')}` : '#games';
}

/** @created Claude (claude-opus-5-5) 2026-10-19 */
export function allTags(entries) {
  return [...new Set(entries.flatMap((entry) => entry.tags ?? []))].sort();
}

/** Entries carrying any of `tags`; every entry when no tag is selected. @created Claude (claude-opus-5-5) 2026-10-19 */
export function filterByTags(entries, tags) {
  if (tags.length === 0) return entries;
  return entries.filter((entry) => (entry.tags ?? []).some((tag) => tags.includes(tag)));
}

/** @created Claude (claude-opus-5-5) 2026-10-19 */
export function renderChips(tags, selected, doc) {
  const bar = el(doc, 'div', 'chips');
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Filter games by tag');
  for (const tag of tags) {
    const chip = el(doc, 'button', 'chip', tag);
    chip.setAttribute('type', 'button');
    chip.setAttribute('data-tag', tag);
    chip.setAttribute('aria-pressed', String(selected.includes(tag)));
    bar.append(chip);
  }
  if (selected.length > 0) {
    const clear = el(doc, 'button', 'chip chip-clear', 'Clear');
    clear.setAttribute('type', 'button');
    bar.append(clear);
  }
  return bar;
}

/** Chip bar, the filtered published games, then the filtered games from open PRs. @created Claude (claude-opus-5-5) 2026-10-19 */
export function renderGames(games, devGames, selected, doc) {
  const panel = el(doc, 'div', 'games-panel');
  const tags = allTags([...games, ...devGames]);
  if (tags.length > 0) panel.append(renderChips(tags, selected, doc));
  const emptyText = games.length === 0 ? 'No games published yet.' : 'No games match these tags.';
  panel.append(renderList(filterByTags(games, selected), doc, emptyText));
  const dev = filterByTags(devGames, selected);
  if (dev.length > 0) panel.append(el(doc, 'h2', 'section-heading', 'In development'), renderList(dev, doc));
  return panel;
}
// [Claude 2026-10-19 end]

/** @created Claude (claude-opus-5-5) 2026-09-30 */
export function renderList(entries, doc, emptyText = 'No apps published yet.') {
  if (entries.length === 0) return el(doc, 'p', 'status', emptyText);

  const list = el(doc, 'ul', 'app-list');
  for (const app of entries) {
    const tile = el(doc, 'span', `tile tile-${app.color}`);
    if (ICONS[app.icon]) tile.append(svgIcon(doc, ICONS[app.icon], 'tile-icon'));
    else tile.textContent = app.name.charAt(0).toUpperCase();

    const subtitle = app.pr ? `PR #${app.pr.number} · ${app.pr.title}` : app.description;
    const text = el(doc, 'span', 'app-text');
    text.append(el(doc, 'span', 'app-name', app.name), el(doc, 'span', 'app-desc', subtitle));
    const updated = formatUpdated(app.updated);
    if (updated) text.append(el(doc, 'span', 'app-date', updated));
    // [Claude 2026-10-19 start]
    if (app.tags?.length > 0) {
      const tags = el(doc, 'span', 'tags');
      for (const tag of app.tags) tags.append(el(doc, 'span', 'tag', tag));
      text.append(tags);
    }
    // [Claude 2026-10-19 end]

    const link = el(doc, 'a', 'app-row');
    link.href = app.url;
    link.append(tile, text, svgIcon(doc, CHEVRON, 'chevron'));

    const item = el(doc, 'li', app.pr ? 'dev-item' : undefined);
    item.append(link);
    if (app.pr) {
      const prLink = el(doc, 'a', 'pr-link', `#${app.pr.number}`);
      prLink.href = app.pr.url;
      item.append(prLink);
    }
    list.append(item);
  }
  return list;
}

async function loadJson(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function init() {
  const container = document.getElementById('app-list');
  const count = document.getElementById('app-count');
  const tabs = document.getElementById('tabs');
  const tabApps = document.getElementById('tab-apps');
  const tabGames = document.getElementById('tab-games');
  const tabDev = document.getElementById('tab-dev');

  const [apps, games, dev] = await Promise.allSettled([loadJson('apps.json'), loadJson('games.json'), loadJson('dev.json')]);
  if (apps.status === 'rejected') {
    count.textContent = '';
    container.replaceChildren(el(document, 'p', 'status', "Couldn't load the app list. Refresh to try again."));
    return;
  }
  const listOf = (result) => (result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : []);
  const gameEntries = listOf(games);
  const devEntries = listOf(dev).filter((entry) => entry.kind !== 'game');
  const devGames = listOf(dev).filter((entry) => entry.kind === 'game');
  const knownTags = allTags([...gameEntries, ...devGames]);
  const showGames = gameEntries.length + devGames.length > 0;
  const showDev = devEntries.length > 0;
  let current = { tab: 'apps', tags: [] };

  const render = () => {
    const { tab, tags } = parseHash(location.hash);
    const visible = (tab === 'games' && showGames) || (tab === 'dev' && showDev);
    current = visible ? { tab, tags: tags.filter((t) => knownTags.includes(t)) } : { tab: 'apps', tags: [] };
    // [Claude 2026-10-19 start]
    const cleanHash = formatHash(current.tab, current.tags);
    if (current.tab === 'games' && cleanHash !== location.hash) history.replaceState(null, '', cleanHash);
    // [Claude 2026-10-19 end]
    tabApps.setAttribute('aria-selected', String(current.tab === 'apps'));
    tabGames.setAttribute('aria-selected', String(current.tab === 'games'));
    tabDev.setAttribute('aria-selected', String(current.tab === 'dev'));
    if (current.tab === 'games') {
      count.textContent = gameEntries.length === 1 ? '1 game' : `${gameEntries.length} games`;
      container.replaceChildren(renderGames(gameEntries, devGames, current.tags, document));
    } else if (current.tab === 'dev') {
      count.textContent = `${devEntries.length} in development`;
      container.replaceChildren(renderList(devEntries, document));
    } else {
      count.textContent = apps.value.length === 1 ? '1 app' : `${apps.value.length} apps`;
      container.replaceChildren(renderList(apps.value, document));
    }
  };

  const go = (tab, tags) => {
    history.replaceState(null, '', formatHash(tab, tags) || location.pathname + location.search);
    render();
  };

  if (showGames || showDev) {
    tabDev.textContent = tabLabel(devEntries.length);
    tabGames.hidden = !showGames;
    tabDev.hidden = !showDev;
    tabs.hidden = false;
    tabApps.addEventListener('click', () => go('apps', []));
    tabGames.addEventListener('click', () => go('games', current.tab === 'games' ? current.tags : []));
    tabDev.addEventListener('click', () => go('dev', []));
    window.addEventListener('hashchange', render);
  }

  container.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    const tag = chip.getAttribute('data-tag');
    if (tag === null) {
      go('games', []);
      container.querySelector('.chip')?.focus();
      return;
    }
    go('games', current.tags.includes(tag) ? current.tags.filter((t) => t !== tag) : [...current.tags, tag]);
    container.querySelector(`.chip[data-tag="${tag}"]`)?.focus();
  });
  render();
}

if (typeof document !== 'undefined') init();
