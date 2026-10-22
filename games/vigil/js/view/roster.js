// Created by Claude (claude-opus-5-5)
// Date: 2026-10-22
// Roster: per-slot soldier names that survive new missions (plan 0003). View-only: BattleState and the battle save never see it.
// Names start as random picks from NAME_POOL and live in localStorage under ROSTER_KEY. Every storage call is wrapped in
// try/catch like save.js, so private mode, quota errors and corrupt JSON fall back to fresh random names.
// Slot colours are the CSS tokens --slot-1..--slot-4 in style.css (palette 2 Field Muted), read like readPalette().

import { unitDef } from '../sim/hit.js';

export const ROSTER_KEY = 'vigil.roster.v1';
export const SLOTS = Object.freeze(['x1', 'x2', 'x3', 'x4']);
export const NAME_MAX = 16;
export const NAME_POOL = Object.freeze([
  'Okafor', 'Vasquez', 'Lindqvist', 'Mbeki', 'Novak', 'Haddad', 'Tanaka', 'Moreau', 'Kowalski', 'Adeyemi', 'Reyes', 'Ivanova',
  'Brennan', 'Castillo', 'Nakamura', 'Okoro', 'Petrov', 'Sandoval', 'Whitlock', 'Yilmaz', 'Duarte', 'Hale', 'Kaur', 'Larsen',
]);
// Palette 2 Field Muted, used when the page has no CSS tokens (tests, a missing stylesheet).
const FALLBACK_COLORS = Object.freeze({ x1: '#8FB8DE', x2: '#C9A0DC', x3: '#9CCB9A', x4: '#E0B27A' });

/** @created Claude (claude-opus-5-5) - 2026-10-22 */
function readSlotColors() {
  const colors = { ...FALLBACK_COLORS };
  try {
    const style = getComputedStyle(document.documentElement);
    SLOTS.forEach((id, k) => { colors[id] = style.getPropertyValue(`--slot-${k + 1}`).trim() || colors[id]; });
  } catch {
    // No DOM: keep the fallback colours.
  }
  return colors;
}

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

export class Roster {
  /** storage defaults to localStorage (null when blocked); random is a () => [0, 1) source for name picks. @created Claude (claude-opus-5-5) - 2026-10-22 */
  constructor(storage = defaultStorage(), random = Math.random) {
    this._storage = storage;
    this._random = random;
    this._colors = null;
    this.slots = this._load();
  }

  /** -> slot name for soldiers, class name for aliens. @created Claude (claude-opus-5-5) - 2026-10-22 */
  nameOf(unit) {
    return this.slots[unit.id]?.name ?? unitDef(unit).name;
  }

  /** -> the --slot-N colour for x1..x4, null for aliens. @created Claude (claude-opus-5-5) - 2026-10-22 */
  colorOf(unit) {
    if (!this.slots[unit.id]) return null;
    this._colors ??= readSlotColors();
    return this._colors[unit.id];
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

  // A pool name no other slot holds (the pool is larger than the squad, so one always exists).
  /** @created Claude (claude-opus-5-5) - 2026-10-22 */
  _randomName(taken) {
    const free = NAME_POOL.filter((n) => !taken.includes(n));
    return free[Math.floor(this._random() * free.length) % free.length];
  }

  // Stored names that pass cleanName and are not already used by an earlier slot are kept; missing, bad or repeated ones get
  // random names, and the result is saved when anything changed.
  /** @created Claude (claude-opus-5-5) - 2026-10-22 */
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
    this.slots = slots;
    if (changed) this._save();
    return slots;
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
