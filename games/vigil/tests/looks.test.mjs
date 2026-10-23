// Created by Claude (claude-opus-5-5)
// Date: 2026-10-22

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CLIPS, SOCKETS, MODEL_FILES, CODE_GEAR, UNIT_LOOKS, lookFor, clipName } from '../js/data/looks.js';
import { CLASSES } from '../js/data/classes.js';
import { ENEMIES } from '../js/data/enemies.js';

// The 16 clips kept in assets/models/clips.glb (see assets/models/CREDITS.md).
const CLIP_FILE = ['Death_A', 'Hit_A', 'Idle_A', 'Throw', 'Walking_A', 'Crouching', 'Running_HoldingRifle', 'Ranged_1H_Shoot',
  'Ranged_2H_Aiming', 'Ranged_2H_Reload', 'Ranged_2H_Shoot', 'Ranged_Magic_Shoot', 'Melee_1H_Attack_Chop', 'Melee_2H_Attack_Stab',
  'Skeletons_Idle', 'Skeletons_Walking'];
const GAME_DIR = fileURLToPath(new URL('../', import.meta.url));

test('every class and enemy has a look', () => {
  for (const id of [...Object.keys(CLASSES), ...Object.keys(ENEMIES)]) assert.ok(UNIT_LOOKS[id], id);
});

test('every look names a known model, sockets and gear', () => {
  for (const [id, look] of Object.entries(UNIT_LOOKS)) {
    assert.ok(MODEL_FILES.characters[look.model], `${id} model ${look.model}`);
    assert.ok(look.scale > 0, `${id} scale`);
    for (const gear of look.gear) {
      assert.ok(SOCKETS[gear.socket], `${id} socket ${gear.socket}`);
      assert.ok(gear.asset ? MODEL_FILES.gear[gear.asset] : CODE_GEAR.includes(gear.mesh), `${id} gear ${gear.asset ?? gear.mesh}`);
    }
  }
});

test('the mannequin has no handslot bone, so squad gear never mounts on slotR', () => {
  for (const [id, look] of Object.entries(UNIT_LOOKS)) {
    if (look.model === 'mannequin') assert.ok(look.gear.every((g) => g.socket !== 'slotR'), id);
  }
});

test('every clip a look can play is in clips.glb', () => {
  for (const name of Object.values(CLIPS)) assert.ok(CLIP_FILE.includes(name), name);
  for (const [id, look] of Object.entries(UNIT_LOOKS)) {
    for (const name of Object.values(look.clips ?? {})) assert.ok(CLIP_FILE.includes(name), `${id} ${name}`);
  }
});

test('every model file exists on disk', () => {
  const files = [MODEL_FILES.clips, ...Object.values(MODEL_FILES.characters), ...Object.values(MODEL_FILES.gear)];
  for (const file of files) assert.ok(existsSync(GAME_DIR + file), file);
});

test('lookFor falls back to the trooper look', () => {
  assert.equal(lookFor('ranger'), UNIT_LOOKS.ranger);
  assert.equal(lookFor('nope'), UNIT_LOOKS.trooper);
});

test('clipName prefers the look override, then CLIPS, then null', () => {
  assert.equal(clipName(UNIT_LOOKS.trooper, 'idle'), 'Skeletons_Idle');
  assert.equal(clipName(UNIT_LOOKS.ranger, 'idle'), CLIPS.idle);
  assert.equal(clipName(UNIT_LOOKS.sectoid, 'fire'), CLIPS.cast);
  assert.equal(clipName(UNIT_LOOKS.ranger, 'nope'), null);
});

test('looks are frozen', () => {
  assert.ok(Object.isFrozen(UNIT_LOOKS.ranger.gear[0]));
  assert.ok(Object.isFrozen(MODEL_FILES.characters));
});
