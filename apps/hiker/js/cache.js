// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28
// localStorage with TTL. Storage can be missing or throw (private mode), so every access is guarded.

const PREFIX = 'hiker:';

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
export function cacheGet(key) {
  try {
    const entry = JSON.parse(localStorage.getItem(PREFIX + key));
    if (!entry || Date.now() > entry.expires) return null;
    return entry.value;
  } catch {
    return null;
  }
}

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
export function cacheSet(key, value, ttlMs) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ value, expires: Date.now() + ttlMs }));
  } catch {
    // Quota or disabled storage: the app still works, just without caching.
  }
}
