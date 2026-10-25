// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Floating island: terrain disc, rocky underside, hover pods, lagoon, rail, grass and drifting clouds.

import * as THREE from 'three';
import { heightAt, ISLAND_RADIUS, WALK_RADIUS, LAGOON, PLAZA } from './islandShape.js';
import { materials } from './materials.js';
import { palette } from '../palette.js';

const RINGS = 72;
const SEGMENTS = 160;
const RAIL_RADIUS = WALK_RADIUS + 1.5;
const RAIL_HEIGHT = 1.1;

const PAVING = new THREE.Color(0xe9f1f7);
const PAVING_LINE = new THREE.Color(palette.accent);
const SAND = new THREE.Color(0xf3e6c4);
const LAGOON_FLOOR = new THREE.Color(0x2aa7c4);
const GRASS_LOW = new THREE.Color(0x63c84a);
const GRASS_HIGH = new THREE.Color(0xa6eb73);

function groundColor(x, z, y, out) {
  const dPlaza = Math.hypot(x - PLAZA.x, z - PLAZA.z);
  if (dPlaza < PLAZA.r - 0.6) return out.copy(PAVING);
  if (dPlaza < PLAZA.r + 0.4) return out.copy(PAVING_LINE);
  const dLagoon = Math.hypot(x - LAGOON.x, z - LAGOON.z);
  if (dLagoon < LAGOON.r) return out.copy(LAGOON_FLOOR);
  if (dLagoon < LAGOON.r + 2.2) return out.copy(SAND);
  return out.copy(GRASS_LOW).lerp(GRASS_HIGH, Math.min(y / 4, 1));
}

function buildTerrain() {
  const positions = [0, heightAt(0, 0), 0];
  const colors = [];
  const c = new THREE.Color();
  groundColor(0, 0, 0, c).toArray(colors, 0);
  for (let i = 1; i <= RINGS; i++) {
    const r = (i / RINGS) * ISLAND_RADIUS;
    for (let j = 0; j < SEGMENTS; j++) {
      const a = (j / SEGMENTS) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = heightAt(x, z);
      positions.push(x, y, z);
      groundColor(x, z, y, c);
      colors.push(c.r, c.g, c.b);
    }
  }
  const index = [];
  const ring = (i, j) => 1 + (i - 1) * SEGMENTS + (j % SEGMENTS);
  for (let j = 0; j < SEGMENTS; j++) index.push(0, ring(1, j + 1), ring(1, j));
  for (let i = 1; i < RINGS; i++) {
    for (let j = 0; j < SEGMENTS; j++) {
      const a = ring(i, j), b = ring(i, j + 1), c2 = ring(i + 1, j), d = ring(i + 1, j + 1);
      index.push(a, b, c2, b, d, c2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

function buildUnderside(group) {
  const profile = [
    [ISLAND_RADIUS + 0.6, 0.2], [ISLAND_RADIUS + 0.9, -0.6], [ISLAND_RADIUS, -2], [56, -5.5],
    [49, -10], [38, -15.5], [24, -20.5], [10, -24], [0, -25],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const rock = new THREE.Mesh(new THREE.LatheGeometry(profile, 96), materials.gloss(0x7f9bb8, { roughness: 0.55 }));
  group.add(rock);

  const lip = new THREE.Mesh(new THREE.TorusGeometry(ISLAND_RADIUS + 0.2, 0.7, 12, 160), materials.gloss(palette.grass));
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.1;
  group.add(lip);

  const chunk = materials.gloss(0x9fb6cc, { roughness: 0.5, flatShading: true });
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4;
    const r = 18 + (i % 5) * 7;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(3 + (i % 3) * 1.5, 0), chunk);
    m.position.set(Math.cos(a) * r, -12 - (i % 4) * 3 + r * 0.05, Math.sin(a) * r);
    m.rotation.set(i, i * 0.7, 0);
    group.add(m);
  }
}

// Chrome thrusters with glowing rings, like the reference diorama's hover pods.
function buildHoverPods(group) {
  const glow = new THREE.MeshStandardMaterial({ color: palette.accent, emissive: palette.accent, emissiveIntensity: 3 });
  const pods = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const pod = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(3, 4, 8, 24), materials.chrome);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.35, 10, 40), glow);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -2.4;
    pod.add(body, ring);
    pod.position.set(Math.cos(a) * 30, -20, Math.sin(a) * 30);
    group.add(pod);
    pods.push(pod);
  }
  return pods;
}

function buildLagoon(group) {
  const water = new THREE.Mesh(new THREE.CircleGeometry(LAGOON.r + 0.5, 64), materials.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set(LAGOON.x, -0.2, LAGOON.z);
  water.name = 'water';
  group.add(water);
}

function buildRail(group) {
  const rail = new THREE.Mesh(new THREE.TorusGeometry(RAIL_RADIUS, 0.12, 8, 240), materials.rail);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = RAIL_HEIGHT;
  group.add(rail);

  const count = 90;
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.08, 1, 8), materials.rail, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const x = Math.cos(a) * RAIL_RADIUS;
    const z = Math.sin(a) * RAIL_RADIUS;
    const base = heightAt(x, z);
    const h = RAIL_HEIGHT - base;
    m.makeScale(1, h, 1).setPosition(x, base + h / 2, z);
    posts.setMatrixAt(i, m);
  }
  posts.castShadow = true;
  group.add(posts);
}

function buildGrass(group) {
  const count = 4000;
  const geo = new THREE.ConeGeometry(0.07, 0.6, 3);
  geo.translate(0, 0.3, 0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  let placed = 0;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  while (placed < count) {
    const r = Math.sqrt(rand()) * (ISLAND_RADIUS - 1);
    const a = rand() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r + 1) continue;
    if (Math.hypot(x - LAGOON.x, z - LAGOON.z) < LAGOON.r + 2.5) continue;
    e.set((rand() - 0.5) * 0.5, rand() * Math.PI, (rand() - 0.5) * 0.5);
    const k = 0.7 + rand() * 0.8;
    m.compose(p.set(x, heightAt(x, z), z), q.setFromEuler(e), s.set(k, k, k));
    mesh.setMatrixAt(placed, m);
    mesh.setColorAt(placed, c.copy(GRASS_LOW).lerp(GRASS_HIGH, rand()));
    placed++;
  }
  mesh.receiveShadow = true;
  group.add(mesh);
}

function buildClouds(scene) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xdff4ff, emissiveIntensity: 0.25 });
  const blob = new THREE.SphereGeometry(1, 20, 12);
  const clouds = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const cloud = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const puff = new THREE.Mesh(blob, mat);
      const s = 5 + ((i + k) % 3) * 2.5;
      puff.scale.set(s, s * 0.6, s);
      puff.position.set((k - 2) * 5, (k % 2) * 1.5, ((k * 7) % 5) - 2);
      cloud.add(puff);
    }
    const a = (i / 12) * Math.PI * 2;
    const r = 95 + (i % 4) * 18;
    cloud.position.set(Math.cos(a) * r, -28 + (i % 5) * 9, Math.sin(a) * r);
    clouds.add(cloud);
  }
  scene.add(clouds);
  return clouds;
}

export function createIsland(scene) {
  const group = new THREE.Group();
  const terrain = buildTerrain();
  group.add(terrain);
  buildUnderside(group);
  const pods = buildHoverPods(group);
  buildLagoon(group);
  buildRail(group);
  buildGrass(group);
  scene.add(group);
  const clouds = buildClouds(scene);

  let t = 0;
  function update(dt) {
    t += dt;
    clouds.rotation.y += dt * 0.006;
    pods.forEach((pod, i) => { pod.position.y = -20 + Math.sin(t * 1.3 + i) * 0.4; });
  }

  return { meshes: [terrain], update };
}
