// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Shared critter wrapper: mesh, brain, photo subject registration and ground wandering helpers.

import * as THREE from 'three';
import { createBrain } from './critterBrain.js';
import { registerSubject, samplePointsFor } from '../subjects.js';
import { heightAt, clampToWalkable } from '../world/islandShape.js';

/**
 * @returns {{ species: string, object: THREE.Object3D, brain: object, home: THREE.Vector3, data: object,
 *             update(dt: number, ctx: object): void }}
 */
export function spawnCritter({ species, index, scene, build, brainOptions, move, home, getAction }) {
  const object = build();
  object.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  object.position.copy(home);
  scene.add(object);
  const brain = createBrain(brainOptions);
  const critter = {
    species,
    object,
    brain,
    home: home.clone(),
    data: { heading: Math.random() * Math.PI * 2, target: null },
    update(dt, ctx) {
      brain.update(dt, ctx);
      move(critter, dt, ctx);
    },
  };
  registerSubject({
    id: `${species}-${index}`,
    type: species,
    kind: 'critter',
    object3d: object,
    samplePoints: samplePointsFor(object, 0.8),
    getAction: getAction ? () => getAction(critter) : brain.action,
  });
  return critter;
}

function turnToward(current, target, k) {
  const d = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + d * Math.min(k, 1);
}

/**
 * Walks a ground critter: toward random spots near home while wandering, away from the player while fleeing.
 * Returns the distance moved this frame (for hop and leg animation).
 */
export function wanderOnGround(critter, dt, ctx, { speed, radius, lift = 0 }) {
  const { object, data, brain, home } = critter;
  const p = object.position;
  let goalX;
  let goalZ;
  let pace = speed;
  if (brain.fleeing) {
    goalX = p.x + (p.x - ctx.playerPosition.x);
    goalZ = p.z + (p.z - ctx.playerPosition.z);
    pace = speed * 2.5;
  } else if (brain.state === 'wander') {
    if (!data.target || Math.hypot(data.target.x - p.x, data.target.z - p.z) < 0.4) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius;
      data.target = clampToWalkable(home.x + Math.cos(a) * r, home.z + Math.sin(a) * r);
    }
    goalX = data.target.x;
    goalZ = data.target.z;
  } else {
    p.y = heightAt(p.x, p.z) + lift;
    return 0;
  }
  const dx = goalX - p.x;
  const dz = goalZ - p.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-4) return 0;
  const step = Math.min(pace * dt, len);
  const next = clampToWalkable(p.x + (dx / len) * step, p.z + (dz / len) * step);
  p.x = next.x;
  p.z = next.z;
  p.y = heightAt(p.x, p.z) + lift;
  object.rotation.y = turnToward(object.rotation.y, Math.atan2(dx, dz), dt * 8);
  return step;
}

export function eyes(object, { y, z, spread, size = 0.07 }) {
  const white = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2, clearcoat: 1 });
  const dark = new THREE.MeshPhysicalMaterial({ color: 0x0b2a4a, roughness: 0.1, clearcoat: 1 });
  const out = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 8), white);
    eye.position.set(s * spread, y, z);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(size * 0.55, 10, 6), dark);
    pupil.position.set(0, 0, size * 0.6);
    eye.add(pupil);
    object.add(eye);
    out.push(eye);
  }
  return out;
}
