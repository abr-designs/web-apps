// Created by Claude (claude-haiku-5-5)
// Date: 2026-10-21
// Versioned autosave of BattleState to localStorage. Storage is reached only through globalThis, and every call is wrapped
// in try/catch, so private mode, quota errors and a missing localStorage degrade to "no save" instead of a throw.
// This module does not import executor.js: the executor calls save() through the hook that main.js installs.

import { STATE_VERSION } from './state.js';

export const SAVE_KEY = 'vigil.battle.v1';

/** @created Claude (claude-haiku-5-5) - 2026-10-21 */
function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** @created Claude (claude-haiku-5-5) - 2026-10-21 */
export function save(state) {
  try {
    const store = storage();
    if (store) store.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Quota or private mode: the battle carries on without a fresh snapshot.
  }
}

// -> BattleState | null. Null on a missing key, corrupt JSON, a non-object, or a version other than STATE_VERSION.
/** @created Claude (claude-haiku-5-5) - 2026-10-21 */
export function load() {
  try {
    const store = storage();
    if (!store) return null;
    const raw = store.getItem(SAVE_KEY);
    if (raw === null) return null;
    const state = JSON.parse(raw);
    if (!state || typeof state !== 'object' || Array.isArray(state)) return null;
    if (state.version !== STATE_VERSION) return null;
    // The RNG reads rngState as a uint32; a hand-edited or legacy value is coerced here.
    state.rngState = state.rngState >>> 0;
    return state;
  } catch {
    return null;
  }
}

/** @created Claude (claude-haiku-5-5) - 2026-10-21 */
export function clear() {
  try {
    storage()?.removeItem(SAVE_KEY);
  } catch {
    // Storage unavailable: nothing was saved, so nothing to remove.
  }
}
