// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21
// Object.freeze is shallow; data tables nest objects and arrays, so freeze all the way down.

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
