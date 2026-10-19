// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Bubble fish: glossy fish inside a glass bubble, circling the lagoon and sometimes leaping out.

import * as THREE from 'three';
import { spawnCritter, eyes } from './critter.js';
import { materials } from '../world/materials.js';
import { LAGOON } from '../world/islandShape.js';

const SWIM_Y = -0.45;
const LEAP_TIME = 1.6;
const LEAP_HEIGHT = 2.4;
const LEAP_DISTANCE = 4;
const SWIM_SPEED = 1.6;
const EDGE = LAGOON.r - 1.6;

function build() {
  const root = new THREE.Group();
  const fish = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 14), materials.gloss(0xff9a5c));
  body.scale.set(0.8, 0.9, 1.3);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 4), materials.gloss(0xffc46b));
  tail.rotation.x = -Math.PI / 2;
  tail.position.z = -0.5;
  tail.scale.set(0.3, 1, 1);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 4), materials.gloss(0xffc46b));
  fin.position.y = 0.32;
  fin.scale.z = 0.3;
  fish.add(body, tail, fin);
  eyes(fish, { y: 0.08, z: 0.3, spread: 0.14, size: 0.06 });
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 16), materials.glass);
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  shine.position.set(0.25, 0.35, 0.3);
  root.add(fish, bubble, shine);
  root.userData.tail = tail;
  return root;
}

function move(critter, dt, ctx) {
  const { object, data, brain } = critter;
  const p = object.position;
  data.t = (data.t ?? Math.random() * 10) + dt;
  object.userData.tail.rotation.y = Math.sin(data.t * 8) * 0.4;

  if (brain.state === 'special') {
    if (data.leapT === undefined) {
      data.leapT = 0;
      data.leapFrom = p.clone();
      // Leap toward the middle so the fish always lands back in the water.
      data.heading = Math.atan2(LAGOON.x - p.x, LAGOON.z - p.z) + (Math.random() - 0.5) * 0.6;
    }
    data.leapT = Math.min(data.leapT + dt / LEAP_TIME, 1);
    const k = data.leapT;
    const dirX = Math.sin(data.heading);
    const dirZ = Math.cos(data.heading);
    p.x = data.leapFrom.x + dirX * LEAP_DISTANCE * k;
    p.z = data.leapFrom.z + dirZ * LEAP_DISTANCE * k;
    p.y = SWIM_Y + 4 * LEAP_HEIGHT * k * (1 - k);
    object.rotation.set(-Math.atan(4 * LEAP_HEIGHT * (1 - 2 * k) / LEAP_DISTANCE), data.heading, 0, 'YXZ');
    return;
  }
  data.leapT = undefined;
  object.rotation.x = 0;

  const speed = brain.fleeing ? SWIM_SPEED * 2.5 : brain.state === 'idle' ? SWIM_SPEED * 0.3 : SWIM_SPEED;
  // Steer back toward the middle near the edge so leaps and laps stay inside the lagoon.
  const dx = p.x - LAGOON.x;
  const dz = p.z - LAGOON.z;
  const d = Math.hypot(dx, dz);
  if (d > EDGE - LEAP_DISTANCE * 0.5) {
    const inward = Math.atan2(-dx, -dz);
    const diff = Math.atan2(Math.sin(inward - data.heading), Math.cos(inward - data.heading));
    data.heading += diff * Math.min(dt * 2.5, 1);
  } else {
    data.heading += Math.sin(data.t * 0.7 + critter.home.x) * dt * 0.8;
  }
  p.x += Math.sin(data.heading) * speed * dt;
  p.z += Math.cos(data.heading) * speed * dt;
  const nd = Math.hypot(p.x - LAGOON.x, p.z - LAGOON.z);
  if (nd > EDGE) {
    p.x = LAGOON.x + ((p.x - LAGOON.x) / nd) * EDGE;
    p.z = LAGOON.z + ((p.z - LAGOON.z) / nd) * EDGE;
  }
  p.y = SWIM_Y + Math.sin(data.t * 2) * 0.06;
  object.rotation.y = data.heading;
}

export function spawnBubbleFish(scene, index) {
  const a = index * 2.1;
  return spawnCritter({
    species: 'bubble-fish',
    index,
    scene,
    build,
    move,
    home: new THREE.Vector3(LAGOON.x + Math.cos(a) * 4, SWIM_Y, LAGOON.z + Math.sin(a) * 4),
    brainOptions: { special: 'leaping', interval: [20, 40], duration: LEAP_TIME },
  });
}
