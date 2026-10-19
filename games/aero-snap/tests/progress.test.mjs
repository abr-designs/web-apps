// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyProgress, emptyScrapbook, parseProgress, parseScrapbook, defaultKeep, applyMatch, pushToRoll, isComplete,
} from '../js/progress.js';
import { REQUESTS } from '../js/requests.js';

test('parseProgress falls back to empty on missing, broken or unknown data', () => {
  assert.deepEqual(parseProgress(null), emptyProgress());
  assert.deepEqual(parseProgress('{oops'), emptyProgress());
  assert.deepEqual(parseProgress('{"version":2}'), emptyProgress());
  assert.deepEqual(parseProgress('{"version":1,"requests":[]}'), emptyProgress());
});

test('parseScrapbook falls back to empty on broken data', () => {
  assert.deepEqual(parseScrapbook('garbage'), emptyScrapbook());
  assert.deepEqual(parseScrapbook('{"version":1,"stickers":{},"captions":{}}'), emptyScrapbook());
});

test('progress survives a JSON round trip', () => {
  let p = applyMatch(emptyProgress(), 'rocket-sign', 'photo-1', 2);
  p = pushToRoll(p, 'photo-1').progress;
  assert.deepEqual(parseProgress(JSON.stringify(p)), p);
});

test('defaultKeep prefers the higher-star photo and keeps the old one on ties', () => {
  assert.equal(defaultKeep(undefined, 1), 'new');
  assert.equal(defaultKeep(3, 2), 'old');
  assert.equal(defaultKeep(2, 2), 'old');
  assert.equal(defaultKeep(1, 3), 'new');
});

test('applyMatch returns new progress without mutating the old', () => {
  const before = emptyProgress();
  const after = applyMatch(before, 'diner-door', 'p9', 3);
  assert.deepEqual(after.requests['diner-door'], { photoId: 'p9', stars: 3 });
  assert.deepEqual(before.requests, {});
});

test('pushToRoll drops the oldest unslotted photo past 60', () => {
  let p = emptyProgress();
  for (let i = 0; i < 60; i++) p = pushToRoll(p, `p${i}`).progress;
  const { progress, dropped } = pushToRoll(p, 'p60');
  assert.deepEqual(dropped, ['p0']);
  assert.equal(progress.roll.length, 60);
  assert.equal(progress.roll.at(-1), 'p60');
});

test('pushToRoll never drops slotted photos, even past the cap', () => {
  let p = emptyProgress();
  for (let i = 0; i < 60; i++) {
    p = pushToRoll(p, `p${i}`).progress;
    p = applyMatch(p, `req-${i}`, `p${i}`, 1);
  }
  const { progress, dropped } = pushToRoll(p, 'p60');
  assert.deepEqual(dropped, []);
  assert.equal(progress.roll.length, 61);
});

test('pushToRoll never drops the cover photo', () => {
  let p = emptyProgress();
  for (let i = 0; i < 60; i++) p = pushToRoll(p, `p${i}`).progress;
  p = { ...p, coverPhotoId: 'p0' };
  const { dropped } = pushToRoll(p, 'p60');
  assert.deepEqual(dropped, ['p1']);
});

test('isComplete needs all nine matchable requests and a cover', () => {
  let p = emptyProgress();
  for (const r of REQUESTS.filter((r) => r.id !== 'favorite')) p = applyMatch(p, r.id, 'x', 1);
  assert.equal(isComplete(p), false);
  assert.equal(isComplete({ ...p, coverPhotoId: 'x' }), true);
});
