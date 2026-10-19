// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Jelly drone: a translucent jelly with a spinning chrome rotor, drifting over the terraces and glowing at dusk.

import * as THREE from 'three';
import { spawnCritter, wanderOnGround, eyes } from './critter.js';
import { materials } from '../world/materials.js';
import { heightAt } from '../world/islandShape.js';

const HOVER = 3.2;
const HOMES = [[-26, -18], [26, 24]];
const GLOW = 0xff8fd8;

function build() {
  const root = new THREE.Group();
  const jelly = new THREE.Group();
  // Each drone owns its dome material so its glow is independent.
  const domeMat = new THREE.MeshPhysicalMaterial({
    color: 0xffb3e6, roughness: 0.1, transmission: 0.4, thickness: 0.6, clearcoat: 1,
    transparent: true, opacity: 0.85, emissive: GLOW, emissiveIntensity: 0,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.75, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), domeMat);
  dome.scale.y = 0.8;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), materials.gloss(0xffffff, { emissive: GLOW, emissiveIntensity: 0.2 }));
  core.position.y = 0.2;
  const rotor = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.06, 8, 40), materials.chrome);
  ring.rotation.x = Math.PI / 2;
  rotor.add(ring);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.03, 0.12), materials.chrome);
    blade.rotation.y = (i / 3) * Math.PI * 2;
    blade.position.set(Math.cos(-blade.rotation.y) * 0.4, 0, Math.sin(-blade.rotation.y) * 0.4);
    rotor.add(blade);
  }
  rotor.position.y = 0.72;
  const tentacles = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.6, 4, 8), domeMat);
    t.position.set(Math.cos(a) * 0.45, -0.35, Math.sin(a) * 0.45);
    jelly.add(t);
    tentacles.push(t);
  }
  jelly.add(dome, core, rotor);
  eyes(jelly, { y: 0.15, z: 0.62, spread: 0.2, size: 0.08 });
  root.add(jelly);
  root.userData = { jelly, rotor, tentacles, domeMat, core };
  return root;
}

function move(critter, dt, ctx) {
  const { object, data, brain } = critter;
  const { jelly, rotor, tentacles, domeMat } = object.userData;
  data.t = (data.t ?? Math.random() * 10) + dt;
  if (brain.state !== 'special') wanderOnGround(critter, dt, ctx, { speed: 0.9, radius: 7, lift: HOVER });
  else object.position.y = heightAt(object.position.x, object.position.z) + HOVER;

  jelly.position.y = Math.sin(data.t * 1.4) * 0.25;
  rotor.rotation.y += dt * 9;
  tentacles.forEach((t, i) => { t.rotation.x = Math.sin(data.t * 2 + i) * 0.25; });
  const target = brain.state === 'special' ? 2.2 + Math.sin(data.t * 5) * 1.2 : 0;
  domeMat.emissiveIntensity += (target - domeMat.emissiveIntensity) * Math.min(dt * 4, 1);
}

export function spawnJellyDrone(scene, index) {
  const [x, z] = HOMES[index % HOMES.length];
  return spawnCritter({
    species: 'jelly-drone',
    index,
    scene,
    build,
    move,
    home: new THREE.Vector3(x, heightAt(x, z) + HOVER, z),
    brainOptions: { special: 'glowing', interval: [8, 14], duration: 6, canSpecial: (c) => c.phase === 'dusk' },
  });
}
