// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Gradient sky dome, sun and fill light, blended through the day cycle keyframes.

import * as THREE from 'three';
import { DAY_LENGTH, dayPhaseAt } from './dayCycle.js';

// Looks per phase. Keyframes below hold each look and crossfade between them.
const LOOKS = {
  day: { top: 0x1e6fe8, horizon: 0x8fd3ff, sun: 0xffffff, sunI: 2.2, hemiI: 0.5, elev: 1.05 },
  golden: { top: 0x3d7bd9, horizon: 0xffc98a, sun: 0xffc07a, sunI: 1.8, hemiI: 0.4, elev: 0.32 },
  dusk: { top: 0x3a3f8f, horizon: 0xf49ac2, sun: 0xf7a1c4, sunI: 0.6, hemiI: 0.25, elev: 0.12 },
};
const KEYS = [
  [0, 'day'], [280, 'day'], [320, 'golden'], [370, 'golden'],
  [410, 'dusk'], [460, 'dusk'], [DAY_LENGTH, 'day'],
];

const vertexShader = `
varying vec3 vWorld;
void main() {
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;
const fragmentShader = `
uniform vec3 top;
uniform vec3 horizon;
varying vec3 vWorld;
void main() {
  float h = normalize(vWorld - cameraPosition).y;
  float k = pow(clamp(h, 0.0, 1.0), 0.6);
  vec3 below = mix(horizon, horizon * 0.85, clamp(-h * 2.0, 0.0, 1.0));
  gl_FragColor = vec4(h >= 0.0 ? mix(horizon, top, k) : below, 1.0);
}`;

function blendAt(t) {
  const local = ((t % DAY_LENGTH) + DAY_LENGTH) % DAY_LENGTH;
  let i = 0;
  while (KEYS[i + 1][0] <= local) i++;
  const [t0, a] = KEYS[i];
  const [t1, b] = KEYS[i + 1];
  return { a: LOOKS[a], b: LOOKS[b], k: (local - t0) / (t1 - t0) };
}

export function createSky(scene) {
  const uniforms = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(400, 32, 16),
    new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, side: THREE.BackSide, depthWrite: false }),
  );
  dome.renderOrder = -1;
  scene.add(dome);

  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const cam = sun.shadow.camera;
  cam.left = cam.bottom = -75;
  cam.right = cam.top = 75;
  cam.near = 1;
  cam.far = 260;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xbfe8ff, 0x7ed957, 1.1);
  scene.add(hemi);

  scene.fog = new THREE.Fog(0x8fd3ff, 180, 460);

  const ca = new THREE.Color();
  const cb = new THREE.Color();
  let current = 'day';

  function mixColor(out, x, y, k) {
    return out.copy(ca.setHex(x)).lerp(cb.setHex(y), k);
  }

  function update(t) {
    const { a, b, k } = blendAt(t);
    mixColor(uniforms.top.value, a.top, b.top, k);
    mixColor(uniforms.horizon.value, a.horizon, b.horizon, k);
    scene.fog.color.copy(uniforms.horizon.value);
    mixColor(sun.color, a.sun, b.sun, k);
    sun.intensity = a.sunI + (b.sunI - a.sunI) * k;
    hemi.intensity = a.hemiI + (b.hemiI - a.hemiI) * k;
    const elev = a.elev + (b.elev - a.elev) * k;
    const az = 0.6 + (t / DAY_LENGTH) * 0.8;
    sun.position.set(Math.cos(az) * Math.cos(elev), Math.sin(elev), Math.sin(az) * Math.cos(elev)).multiplyScalar(120);
    current = dayPhaseAt(t);
  }

  update(0);
  return { update, phase: () => current, sun, hemi };
}
