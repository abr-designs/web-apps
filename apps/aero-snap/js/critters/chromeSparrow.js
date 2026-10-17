// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Chrome sparrow: hops around the plaza and now and then flies up to perch on the rocket sign.

import * as THREE from 'three';
import { spawnCritter, wanderOnGround, eyes } from './critter.js';
import { materials } from '../world/materials.js';
import { heightAt } from '../world/islandShape.js';
import { palette } from '../palette.js';

const FLIGHT_TIME = 2;
const PERCH_TIME = 10;
const HOMES = [[7, -6], [-9, -7], [9, 12]];

function build() {
  const root = new THREE.Group();
  const bird = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), materials.chrome);
  body.scale.set(0.9, 0.85, 1.2);
  body.position.y = 0.38;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 12), materials.chrome);
  head.position.set(0, 0.66, 0.22);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 8), materials.gloss(0xffa53a));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.64, 0.46);
  const wingMat = materials.gloss(palette.accent);
  const wings = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.22, 0.45, 0);
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), wingMat);
    wing.scale.set(0.25, 0.6, 1);
    wing.position.set(s * 0.04, 0, -0.04);
    pivot.add(wing);
    return pivot;
  });
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 4), wingMat);
  tail.rotation.x = -Math.PI / 2 - 0.4;
  tail.position.set(0, 0.42, -0.38);
  tail.scale.x = 1.6;
  const legs = [-0.08, 0.08].map((x) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14), materials.gloss(0xffa53a));
    leg.position.set(x, 0.07, 0);
    return leg;
  });
  bird.add(body, head, beak, tail, ...wings, ...legs);
  eyes(head, { y: 0.04, z: 0.14, spread: 0.09, size: 0.05 });
  root.add(bird);
  root.userData = { bird, wings };
  return root;
}

function makeMove(perch) {
  const homeSpot = new THREE.Vector3();
  return function move(critter, dt, ctx) {
    const { object, data, brain } = critter;
    const { bird, wings } = object.userData;
    const p = object.position;
    data.t = (data.t ?? Math.random() * 10) + dt;
    data.mode ??= 'ground';

    const flying = data.mode === 'toPerch' || data.mode === 'perched';
    if (brain.state === 'special' && data.mode === 'ground') Object.assign(data, { mode: 'toPerch', k: 0, from: p.clone() });
    if (brain.state !== 'special' && flying) Object.assign(data, { mode: 'toHome', k: 0, from: p.clone() });

    if (data.mode === 'toPerch' || data.mode === 'toHome') {
      const to = data.mode === 'toPerch'
        ? perch
        : homeSpot.set(critter.home.x, heightAt(critter.home.x, critter.home.z), critter.home.z);
      data.k = Math.min(data.k + dt / FLIGHT_TIME, 1);
      p.lerpVectors(data.from, to, data.k);
      p.y += Math.sin(data.k * Math.PI) * 2.5;
      object.rotation.y = Math.atan2(to.x - data.from.x, to.z - data.from.z);
      wings.forEach((w, i) => { w.rotation.z = Math.sin(data.t * 30) * 0.9 * (i ? -1 : 1); });
      if (data.k >= 1) data.mode = data.mode === 'toPerch' ? 'perched' : 'ground';
      return;
    }
    if (data.mode === 'perched') {
      wings.forEach((w) => { w.rotation.z = 0; });
      object.rotation.y += dt * 0.2;
      return;
    }

    const moved = wanderOnGround(critter, dt, ctx, { speed: 1.4, radius: 5 });
    bird.position.y = moved > 0 ? Math.abs(Math.sin(data.t * 10)) * 0.15 : 0;
    // Idle pecking.
    bird.rotation.x = brain.state === 'idle' ? Math.max(0, Math.sin(data.t * 3)) * 0.5 : 0;
    wings.forEach((w) => { w.rotation.z = brain.fleeing ? Math.sin(data.t * 30) * 0.8 : 0; });
  };
}

export function spawnChromeSparrow(scene, index, rocketPerch) {
  const [x, z] = HOMES[index % HOMES.length];
  // Spread perched sparrows around the nose so they don't overlap.
  const a = (index / HOMES.length) * Math.PI * 2;
  const perch = rocketPerch.clone().add(new THREE.Vector3(Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35));
  return spawnCritter({
    species: 'chrome-sparrow',
    index,
    scene,
    build,
    move: makeMove(perch),
    home: new THREE.Vector3(x, heightAt(x, z), z),
    brainOptions: { special: 'perched-rocket', interval: [50, 70], duration: FLIGHT_TIME + PERCH_TIME },
    // Only a bird actually sitting on the rocket counts, not one on its way there.
    getAction: (c) => (c.data.mode === 'perched' && c.brain.state === 'special' ? 'perched-rocket' : null),
  });
}
