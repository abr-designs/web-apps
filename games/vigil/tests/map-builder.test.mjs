// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMission, rotateParcel } from '../js/sim/map-builder.js';
import { PARCELS } from '../js/data/parcels.js';
import { toXZ, isWalkable } from '../js/sim/grid.js';
import { livingUnits } from '../js/sim/state.js';

const SEEDS = Array.from({ length: 200 }, (_, k) => k * 7919 + 1);
const dist = (grid, a, b) => {
  const [ax, az] = toXZ(grid, a);
  const [bx, bz] = toXZ(grid, b);
  return Math.hypot(ax - bx, az - bz);
};

test('parcels are 8x8 with valid codes, spawn parcels have 4 S and no P, others have a P', () => {
  assert.ok(PARCELS.length >= 6);
  assert.ok(PARCELS.filter((p) => p.tags.includes('spawn')).length >= 2);
  for (const p of PARCELS) {
    assert.equal(p.heights.length, 8, p.id);
    assert.equal(p.props.length, 8, p.id);
    for (let r = 0; r < 8; r++) {
      assert.match(p.heights[r], /^[0-3]{8}$/, `${p.id} heights row ${r}`);
      assert.match(p.props[r], /^[.cbwrSP]{8}$/, `${p.id} props row ${r}`);
    }
    const text = p.props.join('');
    const count = (ch) => [...text].filter((c) => c === ch).length;
    if (p.tags.includes('spawn')) {
      assert.equal(count('S'), 4, p.id);
      assert.equal(count('P'), 0, p.id);
    } else {
      assert.ok(count('P') >= 1, p.id);
      assert.equal(count('S'), 0, p.id);
    }
    // Borders at height 0 so any rotation joins cleanly.
    const h = p.heights;
    assert.match(h[0] + h[7] + h.map((row) => row[0] + row[7]).join(''), /^0+$/, `${p.id} border`);
  }
});

test('rotateParcel turns clockwise and four turns return the original', () => {
  const p = PARCELS.find((x) => x.id === 'warehouse');
  assert.deepEqual(rotateParcel(p, 4), p);
  assert.deepEqual(rotateParcel(rotateParcel(p, 3), 1), p);
  const marker = { id: 't', tags: [], heights: Array(8).fill('00000000'), props: ['P.......', ...Array(7).fill('........')] };
  const once = rotateParcel(marker, 1);
  assert.equal(once.props[0][7], 'P');        // north-west corner moves to north-east
  assert.equal(rotateParcel(marker, 2).props[7][7], 'P');
  assert.equal(rotateParcel(marker, -1).props[7][0], 'P');
});

test('buildMission is deterministic per seed', () => {
  assert.deepEqual(buildMission(123), buildMission(123));
  assert.notDeepEqual(buildMission(123).grid, buildMission(124).grid);
});

test('buildMission returns a deploy-phase BattleState with a 24x24 grid', () => {
  const s = buildMission(5);
  assert.equal(s.phase, 'deploy');
  assert.equal(s.squadConcealed, true);
  assert.equal(s.grid.width, 24);
  assert.equal(s.grid.depth, 24);
  assert.equal(s.grid.edgeCover.length, 576);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});

test('across many seeds: 4 soldiers on walkable tiles, pods 10+ tiles away, valid patrols', () => {
  for (const seed of SEEDS) {
    const s = buildMission(seed);
    const squad = livingUnits(s, 'xcom');
    const aliens = livingUnits(s, 'alien');
    assert.deepEqual(squad.map((u) => u.defId), ['ranger', 'sharpshooter', 'grenadier', 'specialist'], `seed ${seed}`);
    const tiles = new Set([...squad, ...aliens].map((u) => u.tile));
    assert.equal(tiles.size, squad.length + aliens.length, `seed ${seed}: units share a tile`);
    for (const u of [...squad, ...aliens]) assert.ok(isWalkable(s.grid, u.tile), `seed ${seed}: ${u.id} on a prop`);

    assert.equal(s.pods.length, 3, `seed ${seed}`);
    for (const pod of s.pods) {
      assert.ok(pod.unitIds.length >= 2 && pod.unitIds.length <= 3, `seed ${seed}: pod size`);
      assert.equal(pod.alert, 'unaware');
      assert.ok(pod.patrolRoute.length >= 3 && pod.patrolRoute.length <= 4, `seed ${seed}: patrol length`);
      for (const t of pod.patrolRoute) assert.ok(isWalkable(s.grid, t), `seed ${seed}: patrol tile on a prop`);
      for (const id of pod.unitIds) {
        for (const soldier of squad) {
          assert.ok(dist(s.grid, s.units[id].tile, soldier.tile) >= 10, `seed ${seed}: ${id} too close to ${soldier.id}`);
        }
      }
    }
  }
});

test('units start with full hp and ammo, zero AP and their charges', () => {
  const s = buildMission(77);
  const grenadier = s.units.x3;
  assert.equal(grenadier.hp, grenadier.stats.hp);
  assert.equal(grenadier.ammo, 3);
  assert.equal(grenadier.ap, 0);
  assert.deepEqual(grenadier.charges, { launchGrenade: 2, fragGrenade: 1 });
  assert.deepEqual(s.units.x2.charges, { fragGrenade: 1 });
});
