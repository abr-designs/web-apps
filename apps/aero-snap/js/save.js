// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Browser storage: photo blobs in IndexedDB, progress and scrapbook layout in localStorage.
// Storage can be missing or throw (private mode, blocked site data), so every access is guarded.

import { parseProgress, parseScrapbook } from './progress.js';

const DB_NAME = 'aero-snap';
const STORE = 'photos';
const PROGRESS_KEY = 'aero-snap:progress';
const SCRAPBOOK_KEY = 'aero-snap:scrapbook';

function memoryStore() {
  const photos = new Map();
  return {
    persistent: false,
    async putPhoto(rec) { photos.set(rec.id, rec); },
    async getPhoto(id) { return photos.get(id); },
    async deletePhoto(id) { photos.delete(id); },
  };
}

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** @returns {Promise<{ persistent: boolean, putPhoto(rec): Promise<void>, getPhoto(id): Promise<object|undefined>, deletePhoto(id): Promise<void> }>} */
export async function openStore() {
  try {
    if (!window.indexedDB) return memoryStore();
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE, { keyPath: 'id' });
    const db = await request(open);
    const tx = (mode) => db.transaction(STORE, mode).objectStore(STORE);
    return {
      persistent: true,
      async putPhoto(rec) { await request(tx('readwrite').put(rec)); },
      async getPhoto(id) { return request(tx('readonly').get(id)); },
      async deletePhoto(id) { await request(tx('readwrite').delete(id)); },
    };
  } catch {
    return memoryStore();
  }
}

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or blocked storage: the session keeps working, it just won't persist.
  }
}

export const loadProgress = () => parseProgress(read(PROGRESS_KEY));
export const saveProgress = (p) => write(PROGRESS_KEY, p);
export const loadScrapbook = () => parseScrapbook(read(SCRAPBOOK_KEY));
export const saveScrapbook = (s) => write(SCRAPBOOK_KEY, s);
