// Created by Claude (claude-opus-5-5)
// Date: 2026-10-30
// Delica catalog: code parsing, availability filter, and the colour picker dialog.

import { hexToLab } from './color.js';

/** Normalises 'db651', 'DB-0651', 'DB 651' to 'DB-651'; returns null for anything else. */
export function normalizeCode(text) {
  const m = String(text).trim().match(/^DB[\s-]*0*(\d+)([A-Z]?)$/i);
  return m ? `DB-${m[1]}${m[2].toUpperCase()}` : null;
}

/** Splits pasted text into known catalog codes and the tokens that did not match. */
export function parseCodes(text, catalog) {
  const known = new Set(catalog.map((c) => c.code));
  const codes = [];
  const unknown = [];
  const tokens = String(text).replace(/DB\s+(?=\d)/gi, 'DB').split(/[\s,;]+/).filter(Boolean);
  for (const token of tokens) {
    const code = normalizeCode(token);
    if (code && known.has(code)) {
      if (!codes.includes(code)) codes.push(code);
    } else {
      const label = code ?? token;
      if (!unknown.includes(label)) unknown.push(label);
    }
  }
  return { codes, unknown };
}

/**
 * CAD price per 5 g pack by finish, first match wins. Researched 2026-10-31 from That Bead Lady, Beadazzle and Beadfx.
 * Each pattern is matched against the colour name with hyphens read as spaces.
 */
export const PRICE_TIERS = [
  { tier: 'Gold plated', price: 25, pattern: /\bgold plated\b/i },
  { tier: 'Plated', price: 12.5, pattern: /\bplated\b/i },
  { tier: 'Duracoat galvanized', price: 7, pattern: /\bduracoat\b.*\bgalvanized\b/i },
  { tier: 'Galvanized', price: 6.75, pattern: /\bgalvanized\b/i },
  { tier: 'Metallic', price: 6, pattern: /\bmetallic\b/i },
  { tier: 'Silk or glazed', price: 5.5, pattern: /\b(silk|glazed)\b/i },
  { tier: 'Duracoat', price: 4.75, pattern: /\bduracoat\b/i },
  { tier: 'Lined, luster or AB', price: 4, pattern: /\b(lined|luster|ab|ceylon)\b/i },
  { tier: 'Basic', price: 3.5, pattern: /./ },
];

/** CAD price of one 5 g pack of the colour with this name. */
export function packPrice(name) {
  const text = String(name).replace(/-/g, ' ');
  return PRICE_TIERS.find((t) => t.pattern.test(text)).price;
}

/** Adds a Lab value and a pack price to every catalog colour. */
export function withLab(colors) {
  return colors.map((c) => ({ ...c, lab: hexToLab(c.hex), price: packPrice(c.name) }));
}

/** Ticked colours, or every colour still in production when none are ticked or none of the ticked codes exist. */
export function filterAvailable(catalog, codes) {
  const ticked = codes.size ? catalog.filter((c) => codes.has(c.code)) : [];
  return ticked.length ? ticked : catalog.filter((c) => !c.discontinued);
}

/** Fetches data/delica.json and returns the catalog with Lab values. */
export async function loadCatalog(url = 'data/delica.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Catalog request failed (${res.status})`);
  return withLab((await res.json()).colors);
}

/** Opens the colour picker; onChange receives the new set of ticked codes. */
export function openPicker(dialog, catalog, available, onChange) {
  const ticked = new Set(available);
  dialog.innerHTML = `
    <div class="picker">
      <div class="picker-head">
        <h2>Available colours</h2>
        <button type="button" class="btn btn-small" data-close>Done</button>
      </div>
      <p class="muted">Tick the colours you own or can buy. With none ticked, every colour still in production is used.</p>
      <div class="picker-tools">
        <input type="search" placeholder="Search code or name, like 651 or orange" aria-label="Search colours">
        <button type="button" class="btn btn-small" data-all>Select shown</button>
        <button type="button" class="btn btn-small" data-clear>Clear</button>
        <span class="muted" data-count></span>
      </div>
      <div class="picker-list" role="list"></div>
      <div class="picker-paste">
        <label class="muted">Paste codes
          <textarea placeholder="DB-651, DB-10, DB-200"></textarea>
        </label>
        <button type="button" class="btn btn-small" data-add>Add pasted codes</button>
        <p class="error" data-unknown></p>
      </div>
    </div>`;

  const list = dialog.querySelector('.picker-list');
  const search = dialog.querySelector('input[type="search"]');
  const count = dialog.querySelector('[data-count]');
  let shown = catalog;

  const changed = () => {
    count.textContent = ticked.size ? `${ticked.size} ticked` : 'None ticked (all in production)';
    onChange(new Set(ticked));
  };

  const render = () => {
    const q = search.value.trim().toLowerCase();
    shown = q ? catalog.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) : catalog;
    list.innerHTML = shown.map((c) => `
      <label class="picker-item" role="listitem">
        <input type="checkbox" value="${c.code}" ${ticked.has(c.code) ? 'checked' : ''}>
        <span class="swatch" style="background:${c.hex}"></span>
        <span class="code">${c.code}</span>
        <span>${c.name}${c.discontinued ? ' <span class="muted">(discontinued)</span>' : ''}</span>
      </label>`).join('');
  };

  list.addEventListener('change', (e) => {
    if (e.target.checked) ticked.add(e.target.value);
    else ticked.delete(e.target.value);
    changed();
  });
  search.addEventListener('input', render);
  dialog.querySelector('[data-all]').addEventListener('click', () => {
    shown.forEach((c) => ticked.add(c.code));
    render();
    changed();
  });
  dialog.querySelector('[data-clear]').addEventListener('click', () => {
    ticked.clear();
    render();
    changed();
  });
  dialog.querySelector('[data-add]').addEventListener('click', () => {
    const textarea = dialog.querySelector('textarea');
    const { codes, unknown } = parseCodes(textarea.value, catalog);
    codes.forEach((c) => ticked.add(c));
    dialog.querySelector('[data-unknown]').textContent = unknown.length ? `Not in the catalog: ${unknown.join(', ')}` : '';
    textarea.value = '';
    render();
    changed();
  });
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());

  render();
  count.textContent = ticked.size ? `${ticked.size} ticked` : 'None ticked (all in production)';
  dialog.showModal();
}
