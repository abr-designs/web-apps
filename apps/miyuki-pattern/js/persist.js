// Created by Claude (claude-opus-5-5)
// Date: 2026-10-30
// Saves and restores the project. Storage is injected so this runs under node --test.

export const STORAGE_KEY = 'miyuki-pattern:v1';

/** Saves state; when storage refuses it, retries without the photo. */
export function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { photoSaved: true };
  } catch {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ ...state, photo: null }));
    } catch {
      // Settings alone did not fit either; keep running without saving.
    }
    return { photoSaved: false };
  }
}

/** Loads saved state, or null when nothing valid is stored. */
export function loadState(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
