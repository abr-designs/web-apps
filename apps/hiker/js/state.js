// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28
// Minimal observer store: controls call set, views subscribe.

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
export function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch };
      listeners.forEach(fn => fn(state));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
