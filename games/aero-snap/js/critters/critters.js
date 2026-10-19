// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Spawns every critter on the island and updates them with what they can sense.

import { spawnBubbleFish } from './bubbleFish.js';
import { spawnChromeSparrow } from './chromeSparrow.js';
import { spawnJellyDrone } from './jellyDrone.js';
import { spawnCloudSheep } from './cloudSheep.js';

export function createCritters(scene, { rocketPerch }) {
  const all = [
    ...[0, 1, 2].map((i) => spawnBubbleFish(scene, i)),
    ...[0, 1, 2].map((i) => spawnChromeSparrow(scene, i, rocketPerch)),
    ...[0, 1].map((i) => spawnJellyDrone(scene, i)),
    ...[0, 1, 2].map((i) => spawnCloudSheep(scene, i)),
  ];

  const ctx = { phase: 'day', playerDistance: Infinity, playerRunning: false, playerPosition: null };

  function update(dt, phase, player) {
    ctx.phase = phase;
    ctx.playerRunning = player.isRunning();
    ctx.playerPosition = player.position;
    for (const c of all) {
      ctx.playerDistance = c.object.position.distanceTo(player.position);
      c.update(dt, ctx);
    }
  }

  return { all, objects: all.map((c) => c.object), update };
}
