// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// The island's landmarks, built from primitives in the retro-futurist Aero style, each a photo subject.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { heightAt } from './islandShape.js';
import { materials } from './materials.js';
import { palette } from '../palette.js';
import { registerSubject, samplePointsFor } from '../subjects.js';

const CREAM = 0xf7f1e6;
const RED = 0xe6463f;

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function signTexture(lines, { bg = '#F4F8FB', fg = '#0B2A4A', title, width = 512, height = 256 } = {}) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, width, height);
  g.fillStyle = fg;
  g.textAlign = 'center';
  let y = 70;
  if (title) {
    g.font = 'italic bold 64px "Trebuchet MS", sans-serif';
    g.fillText(title, width / 2, y);
    y += 60;
  }
  g.font = 'bold 34px "Trebuchet MS", sans-serif';
  for (const line of lines) {
    g.fillText(line, width / 2, y);
    y += 44;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function place(group, x, z, lift = 0) {
  group.position.set(x, heightAt(x, z) + lift, z);
  // Local +z faces the plaza center.
  group.rotation.y = Math.atan2(-x, -z);
}

function buildDiner() {
  const g = new THREE.Group();
  const base = mesh(new RoundedBoxGeometry(8, 3.4, 6, 4, 0.8), materials.gloss(CREAM), 0, 1.7, 0);
  const stripe = mesh(new RoundedBoxGeometry(8.1, 0.35, 6.1, 2, 0.15), materials.gloss(palette.accent), 0, 3.05, 0);
  const windowBand = mesh(new RoundedBoxGeometry(5, 1.4, 0.2, 2, 0.1), materials.glass, 1.2, 2, 3);
  // Bubble lounge on top: a horizontal capsule with a big glass front.
  const pod = mesh(new THREE.CapsuleGeometry(2.1, 4.5, 8, 24), materials.gloss(palette.chrome), 0, 5.6, -0.4);
  pod.rotation.z = Math.PI / 2;
  const podGlass = mesh(new THREE.CapsuleGeometry(1.75, 4.2, 8, 24, 1), materials.glass, 0, 5.6, 0.25);
  podGlass.rotation.z = Math.PI / 2;
  podGlass.scale.set(1, 1, 0.75);
  const deck = mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.25, 40), materials.gloss(palette.chrome), 0, 3.5, 0);
  deck.scale.z = 0.8;
  g.add(base, stripe, windowBand, pod, podGlass, deck);

  const door = new THREE.Group();
  door.add(mesh(new RoundedBoxGeometry(1.3, 2.3, 0.2, 3, 0.12), materials.gloss(RED), 0, 0, 0));
  door.add(mesh(new THREE.CircleGeometry(0.28, 24), materials.glass, 0, 0.45, 0.11));
  door.add(mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 24), materials.chrome, 0, 0.45, 0.11));
  door.position.set(-2.4, 1.2, 3.02);
  g.add(door);
  return { group: g, door };
}

function buildRocketSign() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.18, 0.25, 9, 16), materials.chrome, 0, 4.5, 0));
  const board = mesh(new RoundedBoxGeometry(4.2, 2, 0.3, 3, 0.25), new THREE.MeshPhysicalMaterial({
    map: signTexture(['Diner and lounge'], { title: 'Aero Bubble', bg: '#FDF5EC', fg: '#C93A35' }),
    roughness: 0.3, clearcoat: 1,
  }), 0, 6.2, 0.2);
  board.add(mesh(new THREE.TorusGeometry(1.4, 0.06, 8, 40), materials.chrome, 0, 0, 0.2));
  board.children[0].scale.set(1.6, 0.8, 1);
  g.add(board);

  const rocket = new THREE.Group();
  rocket.add(mesh(new THREE.CapsuleGeometry(0.75, 2.2, 8, 24), materials.chrome, 0, 0, 0));
  const nose = mesh(new THREE.ConeGeometry(0.72, 1.3, 24), materials.gloss(RED), 0, 1.95, 0);
  const tail = mesh(new THREE.CylinderGeometry(0.5, 0.3, 0.5, 20), materials.gloss(RED), 0, -1.75, 0);
  rocket.add(nose, tail);
  for (let i = 0; i < 3; i++) {
    const fin = mesh(new RoundedBoxGeometry(0.12, 1.2, 0.9, 2, 0.05), materials.gloss(RED), 0, -1.1, 0);
    const a = (i / 3) * Math.PI * 2;
    fin.position.x = Math.cos(a) * 0.85;
    fin.position.z = Math.sin(a) * 0.85;
    fin.rotation.y = -a;
    rocket.add(fin);
  }
  const port = mesh(new THREE.CircleGeometry(0.28, 20), materials.glass, 0, 0.4, 0.76);
  rocket.add(port);
  rocket.position.set(0, 9.6, 0);
  rocket.rotation.z = -0.5;
  g.add(rocket);
  return { group: g, rocket };
}

function buildTower() {
  const g = new THREE.Group();
  const H = 28;
  const shaft = mesh(new THREE.CylinderGeometry(3.4, 3.8, H, 40, 1), materials.glass, 0, H / 2, 0);
  shaft.scale.x = 1.4;
  const core = mesh(new THREE.CylinderGeometry(2.6, 3, H - 0.5, 24), materials.gloss(0x2a6fa8, { roughness: 0.2 }), 0, H / 2, 0);
  core.scale.x = 1.4;
  g.add(core, shaft);
  for (let y = 4; y < H; y += 4) {
    const band = mesh(new THREE.TorusGeometry(3.6, 0.12, 8, 48), materials.chrome, 0, y, 0);
    band.rotation.x = Math.PI / 2;
    band.scale.x = 1.4;
    g.add(band);
  }
  const trim = mesh(new RoundedBoxGeometry(0.5, H, 0.6, 2, 0.2), materials.gloss(palette.grass, { emissive: palette.grass, emissiveIntensity: 0.35 }), 4.9, H / 2, 0.8);
  const cap = mesh(new THREE.SphereGeometry(3.8, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), materials.gloss(palette.chrome), 0, H, 0);
  cap.scale.set(1.4, 0.45, 1);
  const lobby = mesh(new THREE.CylinderGeometry(5.6, 5.6, 0.4, 40), materials.gloss(palette.chrome), 0, 0.2, 0);
  g.add(trim, cap, lobby);
  return g;
}

function buildFountain() {
  const g = new THREE.Group();
  const basin = mesh(new THREE.CylinderGeometry(3, 3.2, 0.7, 48), materials.gloss(palette.chrome), 0, 0.35, 0);
  const rim = mesh(new THREE.TorusGeometry(3, 0.18, 10, 64), materials.chrome, 0, 0.72, 0);
  rim.rotation.x = Math.PI / 2;
  const pool = mesh(new THREE.CircleGeometry(2.85, 48), materials.water, 0, 0.62, 0);
  pool.rotation.x = -Math.PI / 2;
  const column = mesh(new THREE.CylinderGeometry(0.3, 0.45, 2.2, 24), materials.chrome, 0, 1.4, 0);
  const bowl = mesh(new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), materials.gloss(palette.accent), 0, 2.6, 0);
  bowl.scale.y = 0.4;
  const orb = mesh(new THREE.SphereGeometry(0.45, 24, 16), materials.glass, 0, 3, 0);
  g.add(basin, rim, pool, column, bowl, orb);

  // Droplets cycling along arcs from the bowl to the pool.
  const count = 64;
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshStandardMaterial({
    color: palette.glass, emissive: palette.glass, emissiveIntensity: 0.6, transparent: true, opacity: 0.85,
  }), count);
  g.add(drops);
  const m = new THREE.Matrix4();
  function update(t) {
    for (let i = 0; i < count; i++) {
      const a = (i % 16) / 16 * Math.PI * 2;
      const k = ((t * 0.7 + Math.floor(i / 16) * 0.25) % 1);
      const r = 0.9 + k * 1.6;
      const y = 3 + Math.sin(k * Math.PI) * 0.9 - k * 2.3;
      m.makeTranslation(Math.cos(a) * r, y, Math.sin(a) * r);
      drops.setMatrixAt(i, m);
    }
    drops.instanceMatrix.needsUpdate = true;
  }
  return { group: g, update };
}

function buildHoverCar() {
  const g = new THREE.Group();
  const body = mesh(new THREE.CapsuleGeometry(0.9, 3.2, 8, 24), materials.gloss(RED), 0, 0, 0);
  body.rotation.z = Math.PI / 2;
  body.scale.set(0.7, 1, 1.15);
  const cabin = mesh(new THREE.SphereGeometry(1.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), materials.glass, -0.2, 0.45, 0);
  cabin.scale.set(1.5, 0.8, 0.9);
  const bumper = mesh(new THREE.TorusGeometry(1.05, 0.1, 8, 40), materials.chrome, 0, -0.25, 0);
  bumper.rotation.x = Math.PI / 2;
  bumper.scale.set(2.2, 1, 1);
  const finL = mesh(new RoundedBoxGeometry(1.2, 0.6, 0.1, 2, 0.04), materials.gloss(RED), -2, 0.55, 0.8);
  const finR = finL.clone();
  finR.position.z = -0.8;
  const glow = mesh(new THREE.TorusGeometry(0.8, 0.1, 8, 32), new THREE.MeshStandardMaterial({
    color: palette.accent, emissive: palette.accent, emissiveIntensity: 2.5,
  }), 0, -0.7, 0);
  glow.rotation.x = Math.PI / 2;
  glow.scale.set(2, 1, 1);
  const lights = [0.55, -0.55].map((z) => mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0xfff6d8, emissiveIntensity: 2,
  }), 2.55, 0, z));
  g.add(body, cabin, bumper, finL, finR, glow, ...lights);
  return g;
}

function buildSpecialsSign() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.3, 2.4, 16), materials.chrome, 0, 1.2, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.25, 24), materials.chrome, 0, 0.12, 0));
  const frame = mesh(new RoundedBoxGeometry(3, 2, 0.35, 4, 0.4), materials.gloss(0xb8cce0), 0, 3.2, 0);
  const screen = mesh(new RoundedBoxGeometry(2.6, 1.6, 0.1, 3, 0.25), new THREE.MeshPhysicalMaterial({
    map: signTexture(['Bubble tea ..... 2.50', 'Cloud fries ..... 2.00', 'Jelly pops ..... 1.50'], { title: 'Specials', bg: '#CFEFD0', fg: '#1F5E3A' }),
    roughness: 0.25, clearcoat: 1,
  }), 0, 3.2, 0.15);
  g.add(frame, screen);
  return g;
}

const NAMES = {
  'rocket-sign': 'Rocket sign', diner: 'Bubble diner', tower: 'Aero tower',
  fountain: 'Fountain', 'hover-car': 'Hover car', 'specials-sign': 'Specials sign',
};

export function createLandmarks(scene) {
  const meshes = [];
  const blockers = [];
  const named = [];

  function add(id, group, blockR, subjectObject = group) {
    scene.add(group);
    meshes.push(group);
    blockers.push({ x: group.position.x, z: group.position.z, r: blockR });
    registerSubject({ id, type: id, kind: 'landmark', object3d: subjectObject, samplePoints: samplePointsFor(subjectObject) });
    named.push({ name: NAMES[id], object: subjectObject });
  }

  const diner = buildDiner();
  place(diner.group, 14, -10);
  add('diner', diner.group, 5);
  registerSubject({ id: 'diner-door', type: 'diner-door', kind: 'landmark', object3d: diner.door, samplePoints: samplePointsFor(diner.door, 0.85) });

  const rocket = buildRocketSign();
  place(rocket.group, 20, -4);
  add('rocket-sign', rocket.group, 0.6);

  const tower = buildTower();
  place(tower, -6, -32);
  add('tower', tower, 5.6);

  const fountain = buildFountain();
  fountain.group.position.set(0, 0, 0);
  add('fountain', fountain.group, 3.4);

  const car = buildHoverCar();
  place(car, 22, 4, 0.8);
  car.rotation.y += Math.PI / 2;
  add('hover-car', car, 2.4);
  const carBase = car.position.y;

  const specials = buildSpecialsSign();
  place(specials, 8, 7);
  add('specials-sign', specials, 0.8);

  // Where perched sparrows land: just above the rocket's nose cone, in world space.
  rocket.rocket.updateMatrixWorld(true);
  const rocketPerch = new THREE.Vector3(0, 2.7, 0).applyMatrix4(rocket.rocket.matrixWorld);

  const fwd = new THREE.Vector3();
  const to = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  function nearestNamed(position, yaw) {
    fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    let best = '';
    let bestAngle = Math.PI / 3;
    for (const { name, object } of named) {
      object.getWorldPosition(tmp);
      to.set(tmp.x - position.x, 0, tmp.z - position.z).normalize();
      const angle = Math.acos(THREE.MathUtils.clamp(fwd.dot(to), -1, 1));
      if (angle < bestAngle) {
        bestAngle = angle;
        best = name;
      }
    }
    return best;
  }

  let t = 0;
  function update(dt) {
    t += dt;
    fountain.update(t);
    car.position.y = carBase + Math.sin(t * 1.6) * 0.2;
  }

  return { meshes, blockers, rocketPerch, nearestNamed, update };
}
