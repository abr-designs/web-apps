// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Cloud sheep: a puff of cloud on chrome legs, grazing the terraces and curling up for naps.

import * as THREE from 'three';
import { spawnCritter, wanderOnGround, eyes } from './critter.js';
import { materials } from '../world/materials.js';
import { heightAt } from '../world/islandShape.js';
import { palette } from '../palette.js';

const HOMES = [[-34, -4], [18, 34], [36, -26]];
const PUFFS = [[0, 0.75, 0, 0.55], [0.35, 0.8, 0.25, 0.4], [-0.35, 0.8, 0.25, 0.4], [0.3, 0.85, -0.3, 0.42], [-0.3, 0.85, -0.3, 0.42], [0, 1.05, 0, 0.4]];

function build() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  const wool = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, emissive: 0xe8f6ff, emissiveIntensity: 0.15 });
  for (const [x, y, z, r] of PUFFS) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), wool);
    puff.position.set(x, y, z);
    body.add(puff);
  }
  const head = new THREE.Group();
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 12), materials.gloss(0x2c4a7a));
  face.scale.set(1, 0.9, 1.1);
  const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), wool);
  tuft.position.set(0, 0.22, -0.05);
  head.add(face, tuft);
  const eyePair = eyes(head, { y: 0.05, z: 0.25, spread: 0.11, size: 0.06 });
  head.position.set(0, 0.85, 0.6);
  body.add(head);
  const legs = [[0.25, 0.25], [-0.25, 0.25], [0.25, -0.25], [-0.25, -0.25]].map(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.45, 10), materials.chrome);
    leg.position.set(x, 0.22, z);
    return leg;
  });
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), materials.gloss(palette.grass));
  bell.position.set(0, 0.62, 0.72);
  body.add(...legs, bell);
  root.add(body);
  root.userData = { body, head, legs, eyePair };
  return root;
}

function move(critter, dt, ctx) {
  const { object, data, brain } = critter;
  const { body, head, legs, eyePair } = object.userData;
  data.t = (data.t ?? Math.random() * 10) + dt;
  const asleep = brain.state === 'special';
  const moved = asleep ? 0 : wanderOnGround(critter, dt, ctx, { speed: 0.8, radius: 6 });
  if (asleep) object.position.y = heightAt(object.position.x, object.position.z);

  const s = asleep ? 0 : 1;
  data.sleep = (data.sleep ?? 0) + ((1 - s) - (data.sleep ?? 0)) * Math.min(dt * 3, 1);
  const k = data.sleep;
  body.position.y = -0.38 * k + (moved > 0 ? Math.abs(Math.sin(data.t * 7)) * 0.05 : 0);
  body.scale.set(1 + 0.12 * k, 1 - 0.15 * k + Math.sin(data.t * 2) * 0.02 * k, 1 + 0.12 * k);
  legs.forEach((leg) => { leg.scale.y = 1 - 0.85 * k; });
  eyePair.forEach((e) => { e.scale.y = 1 - 0.9 * k; });
  // Grazing nod while idle, head tucked while asleep.
  head.rotation.x = brain.state === 'idle' ? 0.5 + Math.sin(data.t * 2.5) * 0.15 : 0.35 * k;
}

export function spawnCloudSheep(scene, index) {
  const [x, z] = HOMES[index % HOMES.length];
  return spawnCritter({
    species: 'cloud-sheep',
    index,
    scene,
    build,
    move,
    home: new THREE.Vector3(x, heightAt(x, z), z),
    brainOptions: { special: 'sleeping', interval: [35, 55], duration: 20 },
  });
}
