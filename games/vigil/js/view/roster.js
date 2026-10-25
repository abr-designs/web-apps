// Created by Claude (claude-opus-5-5)
// Date: 2026-10-22
// Roster: per-slot soldier names, colours and utility items that survive new missions (plans 0003 and 0002). Slot records are
// { name, utility, color }.
// View-only: BattleState and the battle save never see it; main passes loadout() to buildMission.
// Names start as random picks from NAME_POOL and live in localStorage under ROSTER_KEY. Every storage call is wrapped in
// try/catch like save.js, so private mode, quota errors and corrupt JSON fall back to fresh random names.
// Slot colours start as DEFAULT_COLORS (palette 2 Field Muted, the same values as the --slot-N tokens in style.css). The roster
// writes each slot's colour back onto those tokens, so every var(--slot-N) in the HUD and loadout screen follows a recolour.

import { unitDef } from '../sim/hit.js';
import { SQUAD_SLOTS, defaultLoadout, normalizeLoadout } from '../sim/loadout.js';

export const ROSTER_KEY = 'vigil.roster.v1';
export const SLOTS = SQUAD_SLOTS;
export const NAME_MAX = 16;
export const NAME_POOL = Object.freeze([
  'Okafor', 'Vasquez', 'Lindqvist', 'Mbeki', 'Novak', 'Haddad', 'Tanaka', 'Moreau', 'Kowalski', 'Adeyemi', 'Reyes', 'Ivanova',
  'Brennan', 'Castillo', 'Nakamura', 'Okoro', 'Petrov', 'Sandoval', 'Whitlock', 'Yilmaz', 'Duarte', 'Hale', 'Kaur', 'Larsen',
]);
export const DEFAULT_COLORS = Object.freeze({ x1: '#8FB8DE', x2: '#C9A0DC', x3: '#9CCB9A', x4: '#E0B27A' });
// The loadout screen's colour row: the four defaults, then four more muted tones that read on the dark map. Any hex is allowed.
export const SWATCHES = Object.freeze([...Object.values(DEFAULT_COLORS), '#E08F8F', '#7FCFC9', '#E6D27A', '#B8B8C8']);

// globalThis.localStorage itself throws a SecurityError when the browser blocks site data.
/** @created Claude (claude-opus-5-5) - 2026-10-22 */
function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** @created Claude (claude-opus-5-5) - 2026-10-22 */
function cleanName(text) {
  return typeof text === 'string' ? text.trim().slice(0, NAME_MAX).trim() : '';
}

/** -> '#RRGGBB' (upper case) for a 6-digit hex string, else null. @created Claude (claude-opus-5-5) - 2026-10-23 */
export function cleanColor(text) {
  return typeof text === 'string' && /^#[0-9a-f]{6}$/i.test(text.trim()) ? text.trim().toUpperCase() : null;
}

export class Roster {
  /** storage defaults to localStorage (null when blocked); random is a () => [0, 1) source for name picks. @created Claude (claude-opus-5-5) - 2026-10-22 */
  constructor(storage = defaultStorage(), random = Math.random) {
    this._storage = storage;
    this._random = random;
    this.slots = this._load();
    this._applyColors();
  }

  /** -> slot name for soldiers, class name for aliens. @created Claude (claude-opus-5-5) - 2026-10-22 */
  nameOf(unit) {
    return this.slots[unit.id]?.name ?? unitDef(unit).name;
  }

  /**
   * -> the slot's colour hex for x1..x4, null for aliens.
   * @created Claude (claude-opus-5-5) - 2026-10-22
   * @modified Claude (claude-opus-5-5) - 2026-10-23 - stored per slot
   */
  colorOf(unit) {
    return this.slots[unit.id]?.color ?? null;
  }

  /** Stores a 6-digit hex (upper-cased); anything else keeps the current colour. Saves and updates --slot-N. -> the stored colour. @created Claude (claude-opus-5-5) - 2026-10-23 */
  recolor(unitId, text) {
    if (!this.slots[unitId]) return null;
    const color = cleanColor(text);
    if (!color) return this.slots[unitId].color;
    this.slots[unitId] = { ...this.slots[unitId], color };
    this._save();
    this._applyColors();
    return color;
  }

  /** Trims and caps at NAME_MAX; blank draws a new random name, and a name another slot holds keeps the current one. Saves. -> the stored name. @created Claude (claude-opus-5-5) - 2026-10-22 */
  rename(unitId, text) {
    if (!this.slots[unitId]) return null;
    const taken = SLOTS.filter((id) => id !== unitId).map((id) => this.slots[id].name);
    const typed = cleanName(text);
    if (typed && taken.includes(typed)) return this.slots[unitId].name;
    const name = typed || this._randomName(taken);
    this.slots[unitId] = { ...this.slots[unitId], name };
    this._save();
    return name;
  }

  /** -> { x1..x4: itemId }, always normalized. @created Claude (claude-opus-5-5) - 2026-10-22 */
  loadout() {
    return Object.fromEntries(SLOTS.map((id) => [id, this.slots[id].utility]));
  }

  /** Normalizes, stores and saves. -> the stored loadout. @created Claude (claude-opus-5-5) - 2026-10-22 */
  setLoadout(loadout) {
    const items = normalizeLoadout(loadout);
    for (const id of SLOTS) this.slots[id] = { ...this.slots[id], utility: items[id] };
    this._save();
    return this.loadout();
  }

  // A pool name no other slot holds (the pool is larger than the squad, so one always exists).
  /** @created Claude (claude-opus-5-5) - 2026-10-22 */
  _randomName(taken) {
    const free = NAME_POOL.filter((n) => !taken.includes(n));
    return free[Math.floor(this._random() * free.length) % free.length];
  }

  // Stored names that pass cleanName and are not already used by an earlier slot are kept; missing, bad or repeated ones get
  // random names. A slot with no stored utility takes its defaultLoadout item, then normalizeLoadout repairs bad or over-cap
  // items. A missing or bad colour takes its DEFAULT_COLORS entry. The result is saved when anything changed.
  /**
   * @created Claude (claude-opus-5-5) - 2026-10-22
   * @modified Claude (claude-opus-5-5) - 2026-10-22 - utility per slot (plan 0002)
   * @modified Claude (claude-opus-5-5) - 2026-10-23 - colour per slot
   */
  _load() {
    let stored = null;
    try {
      const parsed = JSON.parse(this._storage?.getItem(ROSTER_KEY) ?? 'null');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) stored = parsed.slots ?? null;
    } catch {
      stored = null;
    }
    const slots = {};
    let changed = false;
    for (const id of SLOTS) {
      const name = cleanName(stored?.[id]?.name);
      if (name && !Object.values(slots).some((s) => s.name === name)) slots[id] = { name };
      else changed = true;
    }
    for (const id of SLOTS) {
      if (!slots[id]) slots[id] = { name: this._randomName(Object.values(slots).map((s) => s.name)) };
    }
    const defaults = defaultLoadout();
    const items = normalizeLoadout(Object.fromEntries(SLOTS.map((id) => [id, stored?.[id]?.utility ?? defaults[id]])));
    for (const id of SLOTS) {
      slots[id].utility = items[id];
      if (stored?.[id]?.utility !== items[id]) changed = true;
      slots[id].color = cleanColor(stored?.[id]?.color) ?? DEFAULT_COLORS[id];
      if (stored?.[id]?.color !== slots[id].color) changed = true;
    }
    this.slots = slots;
    if (changed) this._save();
    return slots;
  }

  /** Writes each slot's colour onto its --slot-N token. @created Claude (claude-opus-5-5) - 2026-10-23 */
  _applyColors() {
    try {
      SLOTS.forEach((id, k) => document.documentElement.style.setProperty(`--slot-${k + 1}`, this.slots[id].color));
    } catch {
      // No DOM (tests): colorOf still answers.
    }
  }

  /** @created Claude (claude-opus-5-5) - 2026-10-22 */
  _save() {
    try {
      this._storage?.setItem(ROSTER_KEY, JSON.stringify({ slots: this.slots }));
    } catch {
      // Quota or private mode: names last until the page closes.
    }
  }
}
