// Created by Claude (claude-opus-5-5)
// Date: 2026-10-23
// EventPlayer's unit model wiring (plan 0004 step 7) against a fake renderer, fake models and a minimal DOM. Playback runs at
// speed 1000, so every tween finishes within a few milliseconds of real time.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { EventPlayer } from '../js/view/event-player.js';

// ---- Minimal DOM ----

/** @created Claude (claude-opus-5-5) - 2026-10-23 */
function fakeElement() {
  return {
    style: {}, className: '', textContent: '', id: '',
    appendChild(child) { return child; },
    setAttribute() {},
    remove() {},
  };
}

globalThis.document ??= {
  head: fakeElement(),
  body: fakeElement(),
  getElementById: () => null,
  createElement: () => fakeElement(),
};
globalThis.requestAnimationFrame ??= (callback) => setTimeout(callback, 1);
globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);

// ---- Fakes ----

// Records every call as [name, ...args] so tests read the clip sequence a unit played.
/** @created Claude (claude-opus-5-5) - 2026-10-23 */
function fakeModel() {
  const calls = [];
  return {
    calls,
    face(target, { instant = false } = {}) { calls.push(['face', target.clone(), instant]); },
    walk() { calls.push(['walk']); },
    settle() { calls.push(['settle']); },
    play(name) { calls.push(['play', name]); return Promise.resolve(); },
    finish() { calls.push(['finish']); },
    setBasePose(statuses) { calls.push(['pose', statuses]); },
    muzzleWorld() { calls.push(['muzzle']); return new THREE.Vector3(0, 1, 0); },
    names(kind) { return calls.filter((c) => c[0] === kind).map((c) => c[1]); },
  };
}

// Tile t sits at world (t, 0, 0). units: { id: { visible = true, model = true } }.
/** @created Claude (claude-opus-5-5) - 2026-10-23 */
function setup(units, { state = null } = {}) {
  const objects = new Map();
  const models = new Map();
  for (const [id, { visible = true, model = true, tile = 0 } = {}] of Object.entries(units)) {
    const object = new THREE.Group();
    object.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
    object.position.set(tile, 0, 0);
    object.visible = visible;
    objects.set(id, object);
    if (model) models.set(id, fakeModel());
  }
  const renderer = {
    canvas: { clientWidth: 800, clientHeight: 600, parentElement: null },
    camera: new THREE.PerspectiveCamera(),
    scene: new THREE.Scene(),
    colors: { crit: 0xffffff, halfCover: 0x888888 },
    unitModels: models,
    unitObject: (id) => objects.get(id) ?? null,
    unitModel: (id) => models.get(id) ?? null,
    tileCenter: (tile, out = new THREE.Vector3()) => out.set(tile, 0, 0),
    setUnitShown() {},
    removeProp() {},
  };
  const focuses = [];
  const rig = { focusTile(pos, options) { focuses.push([pos, options]); } };
  const player = new EventPlayer(renderer, rig, null, { getState: state ? () => state : null, container: fakeElement() });
  player.setSpeed(1000);
  return { player, objects, models, focuses };
}

// ---- Steps ----

test('a stepping model faces each tile and walks, then settles once its steps end', async () => {
  const { player, models } = setup({ x1: {} });
  await player.play([
    { type: 'UnitStepped', unitId: 'x1', from: 0, to: 1 },
    { type: 'UnitStepped', unitId: 'x1', from: 1, to: 2 },
  ]);
  const calls = models.get('x1').calls;
  assert.deepEqual(calls.map((c) => c[0]), ['face', 'walk', 'face', 'walk', 'settle']);
  assert.deepEqual(calls.filter((c) => c[0] === 'face').map((c) => c[1].x), [1, 2]);
});

test('a walking model settles before any other event', async () => {
  const { player, models } = setup({ x1: {}, a01: { tile: 5 } });
  await player.play([
    { type: 'UnitStepped', unitId: 'x1', from: 0, to: 1 },
    { type: 'ShotResolved', attackerId: 'a01', targetId: 'x1', abilityId: 'standardShot', result: 'hit' },
  ]);
  assert.deepEqual(models.get('x1').calls.map((c) => c[0]), ['face', 'walk', 'settle']);
});

test('a capsule unit (no model) still steps to its tile', async () => {
  const { player, objects } = setup({ x1: { model: false } });
  await player.play([{ type: 'UnitStepped', unitId: 'x1', from: 0, to: 3 }]);
  assert.equal(objects.get('x1').position.x, 3);
  assert.equal(objects.get('x1').position.y, 0);
});

// ---- Shots ----

test('a shooter faces its target, plays the clip for its ability and fires the tracer from its muzzle', async () => {
  const cases = [['standardShot', 'fire'], ['slash', 'melee'], ['stunLance', 'stab'], ['pistolShot', 'pistol']];
  for (const [abilityId, clip] of cases) {
    const { player, models } = setup({ x1: {}, a01: { tile: 4 } });
    await player.play([{ type: 'ShotResolved', attackerId: 'x1', targetId: 'a01', abilityId, result: 'hit' }]);
    const model = models.get('x1');
    assert.deepEqual(model.names('play'), [clip], abilityId);
    const face = model.calls.find((c) => c[0] === 'face');
    assert.equal(face[1].x, 4);
    assert.equal(face[2], false, 'turns over time');
    assert.ok(model.calls.some((c) => c[0] === 'muzzle'));
  }
});

test('a hidden shooter turns instantly and plays nothing', async () => {
  const { player, models } = setup({ a01: { visible: false, tile: 4 }, x1: {} });
  await player.play([{ type: 'ShotResolved', attackerId: 'a01', targetId: 'x1', abilityId: 'standardShot', result: 'hit' }]);
  const model = models.get('a01');
  assert.deepEqual(model.names('play'), []);
  assert.equal(model.calls.find((c) => c[0] === 'face')[2], true);
});

// ---- Damage and death ----

test('damage plays hit on a visible model only', async () => {
  const { player, models } = setup({ x1: {}, a01: { visible: false } });
  await player.play([
    { type: 'UnitDamaged', unitId: 'x1', amount: 2, armorAbsorbed: 0, hp: 2 },
    { type: 'UnitDamaged', unitId: 'a01', amount: 2, armorAbsorbed: 0, hp: 2 },
  ]);
  assert.deepEqual(models.get('x1').names('play'), ['hit']);
  assert.deepEqual(models.get('a01').names('play'), []);
});

test('a killed model plays death, lands on its last frame, then fades and hides', async () => {
  const { player, models, objects } = setup({ a01: {} });
  await player.play([{ type: 'UnitKilled', unitId: 'a01' }]);
  const calls = models.get('a01').calls.map((c) => c[0]);
  assert.deepEqual(models.get('a01').names('play'), ['death']);
  assert.ok(calls.indexOf('finish') > calls.indexOf('play'));
  assert.equal(objects.get('a01').visible, false);
  assert.equal(objects.get('a01').position.y, 0);
});

// ---- Explosions ----

test('an explosion source throws a grenade and fires launchers and rockets', async () => {
  const cases = [['fragGrenade', 'throw'], ['launchGrenade', 'fire'], ['rocket', 'fire']];
  for (const [abilityId, clip] of cases) {
    const { player, models } = setup({ x1: {} });
    await player.play([{ type: 'Explosion', center: 6, radius: 2, tiles: [6], sourceId: 'x1', abilityId }]);
    const model = models.get('x1');
    assert.deepEqual(model.names('play'), [clip], abilityId);
    assert.equal(model.calls.find((c) => c[0] === 'face')[1].x, 6);
  }
});

test('a barrel blast plays no clip, and a hidden source only turns', async () => {
  const { player, models } = setup({ x1: {}, a01: { visible: false } });
  await player.play([
    { type: 'Explosion', center: 6, radius: 1, tiles: [6] },
    { type: 'Explosion', center: 6, radius: 2, tiles: [6], sourceId: 'a01', abilityId: 'fragGrenade' },
  ]);
  assert.deepEqual(models.get('x1').calls, []);
  const hidden = models.get('a01');
  assert.deepEqual(hidden.names('play'), []);
  assert.equal(hidden.calls.find((c) => c[0] === 'face')[2], true);
});

// ---- Skip ----

test('skip finishes running clips and plays the rest of the batch instantly', async () => {
  const { player, models } = setup({ x1: {}, a01: { tile: 4 } });
  player.setSpeed(1);
  const done = player.play([
    { type: 'ShotResolved', attackerId: 'x1', targetId: 'a01', abilityId: 'standardShot', result: 'hit' },
    { type: 'UnitDamaged', unitId: 'a01', amount: 1, armorAbsorbed: 0, hp: 3 },
  ]);
  await new Promise((resolve) => setTimeout(resolve, 5));
  const started = performance.now();
  player.skip();
  await done;
  assert.ok(performance.now() - started < 100, 'no real-time waits after skip');
  assert.ok(models.get('x1').calls.some((c) => c[0] === 'finish'), 'shooter clip finished');
  const target = models.get('a01').calls.map((c) => c[0]);
  assert.deepEqual(target.slice(target.indexOf('play')), ['play', 'finish'], 'hit clip jumps to its end');
});

// ---- Base poses ----

test('status events and the batch end set each model to its final statuses', async () => {
  const state = { units: { x1: { id: 'x1', team: 'xcom', statuses: { hunkered: 1 } }, x2: { id: 'x2', team: 'xcom', statuses: {} } } };
  const { player, models } = setup({ x1: {}, x2: {} }, { state });
  await player.play([{ type: 'StatusApplied', unitId: 'x1', status: 'hunkered', turns: 1 }]);
  assert.deepEqual(models.get('x1').names('pose'), [{ hunkered: 1 }, { hunkered: 1 }], 'on the event and at batch end');
  assert.deepEqual(models.get('x2').names('pose'), [{}], 'batch end only');
});
