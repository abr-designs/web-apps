// Created by Claude (claude-opus-5-5)
// Date: 2026-10-22
// Loadout rules (plan 0002). A loadout is a plain { x1..x4: itemId } with one RULES.loadout item per soldier. Pure.

import { RULES } from '../data/rules.js';

export const SQUAD_SLOTS = Object.freeze(['x1', 'x2', 'x3', 'x4']);
const DEFAULT_ITEMS = Object.freeze({ x3: 'rocket' }); // the grenadier carries the Rocket; everyone else takes defaultItem

/** @created Claude (claude-opus-5-5) - 2026-10-22 */
export function defaultLoadout() {
  return Object.fromEntries(SQUAD_SLOTS.map((id) => [id, DEFAULT_ITEMS[id] ?? RULES.loadout.defaultItem]));
}

// -> a new loadout. Missing or unknown items become defaultItem; past an item's cap, later slots in SQUAD_SLOTS order do too.
/** @created Claude (claude-opus-5-5) - 2026-10-22 */
export function normalizeLoadout(loadout) {
  const { items, caps, defaultItem } = RULES.loadout;
  const counts = {};
  const out = {};
  for (const id of SQUAD_SLOTS) {
    let item = loadout?.[id];
    if (!items.includes(item) || (counts[item] ?? 0) >= (caps[item] ?? Infinity)) item = defaultItem;
    counts[item] = (counts[item] ?? 0) + 1;
    out[id] = item;
  }
  return out;
}

// False when itemId is no loadout item or the other slots already hold its cap.
/** @created Claude (claude-opus-5-5) - 2026-10-22 */
export function itemAllowed(loadout, slotId, itemId) {
  const { items, caps } = RULES.loadout;
  if (!items.includes(itemId)) return false;
  const held = SQUAD_SLOTS.filter((id) => id !== slotId && loadout[id] === itemId).length;
  return held < (caps[itemId] ?? Infinity);
}
