// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heightAt, clampToWalkable, isInLagoon, LAGOON, PLAZA, ISLAND_RADIUS, WALK_RADIUS } from '../js/world/islandShape.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('plaza center is flat at 0', () => {
  assert.equal(heightAt(PLAZA.x, PLAZA.z), 0);
  assert.equal(heightAt(5, -5), 0);
});

test('lagoon center sits at -1.2', () => {
  assert.equal(heightAt(LAGOON.x, LAGOON.z), -1.2);
  assert.ok(isInLagoon(LAGOON.x, LAGOON.z));
});

test('terrain never rises above 4 m', () => {
  for (let x = -ISLAND_RADIUS; x <= ISLAND_RADIUS; x += 2) {
    for (let z = -ISLAND_RADIUS; z <= ISLAND_RADIUS; z += 2) {
      if (x * x + z * z > ISLAND_RADIUS * ISLAND_RADIUS) continue;
      assert.ok(heightAt(x, z) <= 4, `heightAt(${x}, ${z}) = ${heightAt(x, z)}`);
    }
  }
});

test('clampToWalkable projects points outside the rail onto the walk circle', () => {
  const p = clampToWalkable(100, 0);
  close(p.x, WALK_RADIUS);
  close(p.z, 0);
});

test('clampToWalkable pushes points out of the lagoon to its edge', () => {
  const p = clampToWalkable(LAGOON.x + 2, LAGOON.z + 1);
  close(Math.hypot(p.x - LAGOON.x, p.z - LAGOON.z), LAGOON.r);
});

test('clampToWalkable leaves plaza points alone', () => {
  assert.deepEqual(clampToWalkable(3, 4), { x: 3, z: 4 });
});

test('terrain settles to 0 at the rim', () => {
  for (let a = 0; a < Math.PI * 2; a += 0.3) {
    close(heightAt(Math.cos(a) * ISLAND_RADIUS, Math.sin(a) * ISLAND_RADIUS), 0);
  }
});
