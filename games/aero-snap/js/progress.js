// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Request progress, camera roll and scrapbook layout as plain data. Pure: no three.js, no DOM.

import { REQUESTS } from './requests.js';

const ROLL_CAP = 60;
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function emptyProgress() {
  return { version: 1, requests: {}, roll: [], coverPhotoId: null };
}

export function emptyScrapbook() {
  return { version: 1, stickers: [], captions: {} };
}

function parse(json) {
  try {
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

export function parseProgress(json) {
  const p = parse(json);
  const valid = isObject(p) && p.version === 1 && isObject(p.requests) && Array.isArray(p.roll)
    && (p.coverPhotoId === null || typeof p.coverPhotoId === 'string');
  return valid ? p : emptyProgress();
}

export function parseScrapbook(json) {
  const s = parse(json);
  const valid = isObject(s) && s.version === 1 && Array.isArray(s.stickers) && isObject(s.captions);
  return valid ? s : emptyScrapbook();
}

/** Which photo the keep prompt preselects when a request already has one. */
export function defaultKeep(oldStars, newStars) {
  return oldStars === undefined || newStars > oldStars ? 'new' : 'old';
}

export function applyMatch(progress, requestId, photoId, stars) {
  return { ...progress, requests: { ...progress.requests, [requestId]: { photoId, stars } } };
}

/** Appends to the camera roll; past the cap, drops the oldest photos nothing else uses. */
export function pushToRoll(progress, photoId, cap = ROLL_CAP) {
  // The photo just taken is never dropped, nor any photo a slot or the cover uses.
  const kept = new Set(Object.values(progress.requests).map((r) => r.photoId));
  kept.add(photoId);
  if (progress.coverPhotoId) kept.add(progress.coverPhotoId);
  const roll = [...progress.roll, photoId];
  const dropped = [];
  for (let i = 0; i < roll.length && roll.length > cap; ) {
    if (kept.has(roll[i])) i++;
    else dropped.push(...roll.splice(i, 1));
  }
  return { progress: { ...progress, roll }, dropped };
}

export function isComplete(progress) {
  return REQUESTS.every((r) => (r.id === 'favorite' ? Boolean(progress.coverPhotoId) : Boolean(progress.requests[r.id])));
}
