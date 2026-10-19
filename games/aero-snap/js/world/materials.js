// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Shared materials and the sky reflection environment. Built once, reused by every mesh.

import * as THREE from 'three';
import { palette } from '../palette.js';

const glossCache = new Map();

export const materials = {
  chrome: new THREE.MeshPhysicalMaterial({
    color: 0xe8eef4, metalness: 1, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05,
  }),
  glass: new THREE.MeshPhysicalMaterial({
    color: palette.glass, metalness: 0, roughness: 0.04, transmission: 0.6, thickness: 0.5,
    ior: 1.4, clearcoat: 1, transparent: true, opacity: 0.9,
  }),
  grass: new THREE.MeshStandardMaterial({ color: palette.grass, roughness: 0.75 }),
  water: new THREE.MeshPhysicalMaterial({
    color: palette.accent, roughness: 0.06, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.82,
  }),
  rail: null,
  /** Glossy toy plastic in any color; cached per hex. */
  gloss(hex, extra = {}) {
    const key = hex + JSON.stringify(extra);
    if (!glossCache.has(key)) {
      glossCache.set(key, new THREE.MeshPhysicalMaterial({
        color: hex, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, ...extra,
      }));
    }
    return glossCache.get(key);
  },
};
materials.rail = materials.chrome;

const envVertex = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const envFragment = `
varying vec3 vDir;
void main() {
  float h = vDir.y;
  vec3 top = vec3(0.12, 0.38, 0.9);
  vec3 horizon = vec3(0.75, 0.9, 1.0);
  vec3 ground = vec3(0.35, 0.6, 0.3);
  vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.5)) : mix(horizon, ground, pow(-h, 0.4));
  gl_FragColor = vec4(c, 1.0);
}`;

/** Bakes a sky-and-cloud scene into scene.environment so chrome and glass reflect the Aero sky. */
export function applyEnvironment(renderer, scene) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(
    new THREE.SphereGeometry(50, 32, 16),
    new THREE.ShaderMaterial({ vertexShader: envVertex, fragmentShader: envFragment, side: THREE.BackSide }),
  ));
  const cloud = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const blob = new THREE.Mesh(new THREE.SphereGeometry(4 + (i % 3) * 2, 16, 8), cloud);
    blob.position.set(Math.cos(a) * 40, 6 + (i % 4) * 5, Math.sin(a) * 40);
    blob.scale.y = 0.5;
    env.add(blob);
  }
  const sunBlob = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 6, 5.5) }));
  sunBlob.position.set(20, 38, 15);
  env.add(sunBlob);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(env, 0.02).texture;
  scene.environmentIntensity = 0.6;
  pmrem.dispose();
}
