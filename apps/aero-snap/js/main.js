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
import { createLandmarks } from './world/landmarks.js';
import { getSubjects } from './subjects.js';
import { createCritters } from './critters/critters.js';
import { createInput } from './input.js';
import { createPlayer } from './player/controller.js';
import { createCameraRig } from './player/cameraRig.js';

const canvas = document.getElementById('game');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 900);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.35, 0.4, 0.92);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const sky = createSky(scene);
applyEnvironment(renderer, scene);
const island = createIsland(scene);
const landmarks = createLandmarks(scene);
const critters = createCritters(scene, landmarks);
const colliders = [...island.meshes, ...landmarks.meshes];
const input = createInput(canvas);
const player = createPlayer(scene);
player.blockers.push(...landmarks.blockers);
const rig = createCameraRig(camera, colliders);

let state = 'explore';
let worldTime = 0;
// Debug aid: ?fast runs the day cycle 10x so golden hour and dusk arrive quickly.
const timeScale = new URLSearchParams(location.search).has('fast') ? 10 : 1;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w === 0 || h === 0) return; // minimized or hidden: keep the last size
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloomPass.resolution.set(w / 2, h / 2);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function tick(dt) {
  if (state !== 'scrapbook') {
    worldTime += dt * timeScale;
    sky.update(worldTime);
    island.update(dt);
    landmarks.update(dt);
    critters.update(dt, sky.phase(), player);
    if (state === 'explore' || state === 'aim') state = input.aiming ? 'aim' : 'explore';
    player.update(dt, input, rig.yaw, state === 'aim');
    rig.update(dt, player, input, state);
  }
  composer.render(dt);
}

let last = performance.now();
function frame(now) {
  tick(clampDt((now - last) / 1000));
  last = now;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug aid: ?debug exposes live game objects on window for the console.
if (new URLSearchParams(location.search).has('debug')) {
  window.__game = { scene, landmarks, critters, sky, getSubjects, camera, player, rig, input, getState: () => state, getTime: () => worldTime,
    step(seconds) { for (let i = 0; i < Math.round(seconds * 60); i++) tick(1 / 60); },
  };
}
