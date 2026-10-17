// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Boot, renderer, post-processing and the game loop.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clampDt } from './world/dayCycle.js';
import { createSky } from './world/sky.js';
import { applyEnvironment } from './world/materials.js';
import { createIsland } from './world/island.js';

const canvas = document.getElementById('game');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 900);
camera.position.set(0, 40, 105);
camera.lookAt(0, -4, 0);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.35, 0.4, 0.92);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const sky = createSky(scene);
applyEnvironment(renderer, scene);
const island = createIsland(scene);

let state = 'explore';
let worldTime = 0;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloomPass.resolution.set(w / 2, h / 2);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
function frame(now) {
  const dt = clampDt((now - last) / 1000);
  last = now;
  if (state !== 'scrapbook') {
    worldTime += dt;
    sky.update(worldTime);
    island.update(dt);
  }
  composer.render(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
