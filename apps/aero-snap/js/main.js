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
import { capturePhoto, toJpeg } from './photo/capture.js';
import { analyzeShot } from './photo/analyze.js';
import { REQUESTS, matchRequests } from './requests.js';
import { showPolaroid, chooseAll } from './ui/polaroid.js';
import { createHud } from './ui/hud.js';
import { createGadget } from './ui/gadget.js';
import { openStore, loadProgress, saveProgress } from './save.js';
import { applyMatch, defaultKeep, pushToRoll } from './progress.js';
import { unlockAudio, startAmbient, playShutter } from './audio.js';
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
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
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
const occluders = [...island.meshes, ...landmarks.meshes, ...critters.objects];
const requestText = new Map(REQUESTS.map((r) => [r.id, r.text]));
const flashEl = document.getElementById('flash');
const storeReady = openStore();
let progress = loadProgress();
// Listeners notified whenever progress changes (gadget, scrapbook).
const progressListeners = [];
function setProgress(next) {
  progress = next;
  saveProgress(progress);
  progressListeners.forEach((fn) => fn(progress));
}
input.onKey('KeyN', () => chooseAll('new'));
input.onKey('KeyO', () => chooseAll('old'));

window.addEventListener('mousedown', () => {
  unlockAudio();
  startAmbient();
});

let state = 'explore';
let worldTime = 0;
// Debug aid: ?fast runs the day cycle 10x so golden hour and dusk arrive quickly.
const timeScale = new URLSearchParams(location.search).has('fast') ? 10 : 1;
const FILM_ROLL = 24;
let film = FILM_ROLL;
let persistent = true;
// Fed to the player while a menu is open so held keys don't walk them around.
const IDLE_INPUT = { keys: { f: false, b: false, l: false, r: false }, slow: false, consumeJump: () => false };

const hud = createHud(document.getElementById('hud'));
const gadget = createGadget(document.getElementById('gadget'), { onScrapbook: () => openScrapbook() });
function renderGadget() {
  gadget.render(progress, film, persistent);
}
progressListeners.push(renderGadget);
renderGadget();
storeReady.then((store) => {
  persistent = store.persistent;
  renderGadget();
});

function openGadget() {
  state = 'gadget';
  input.release();
  gadget.open();
}
function closeGadget() {
  gadget.close();
  state = 'explore';
  canvas.requestPointerLock?.();
}
function openScrapbook() {}
input.onKey('Tab', () => {
  if (state === 'scrapbook') return;
  if (gadget.isOpen()) closeGadget();
  else openGadget();
});
input.onKey('Escape', () => {
  if (gadget.isOpen()) closeGadget();
});
// Losing pointer lock (Esc, alt-tab) drops out of aiming.
document.addEventListener('pointerlockchange', () => {
  if (!input.locked && state === 'aim') state = 'explore';
});

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

/** Snaps the aim camera's view, grades it, saves it and shows the result card. Runs inside tick, before the frame renders. */
function takePhoto() {
  film = film > 1 ? film - 1 : FILM_ROLL;
  renderGadget();
  const shot = capturePhoto({ renderer, composer, renderPass, camera, hidden: [player.object] });
  playShutter();
  flashEl.classList.remove('is-on');
  void flashEl.offsetWidth;
  flashEl.classList.add('is-on');
  const subjects = analyzeShot(shot.camera, getSubjects(), occluders);
  const matches = matchRequests({ subjects, phase: sky.phase() });
  return finishPhoto(shot.canvas, subjects, matches);
}

async function finishPhoto(canvas, subjects, matches) {
  const blob = await toJpeg(canvas);
  const store = await storeReady;
  const id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await store.putPhoto({ id, blob, takenAt: Date.now(), matches: matches.map(({ requestId, stars }) => ({ requestId, stars })) });

  let { progress: next, dropped } = pushToRoll(progress, id);
  dropped.forEach((d) => store.deletePhoto(d));
  const entries = matches.map((m) => {
    const existing = next.requests[m.requestId];
    const choice = defaultKeep(existing?.stars, m.stars);
    if (choice === 'new') next = applyMatch(next, m.requestId, id, m.stars);
    return { ...m, text: requestText.get(m.requestId), existing, choice };
  });
  setProgress(next);

  showPolaroid({
    url: URL.createObjectURL(blob),
    matches: entries,
    onChoice(requestId, choice) {
      const e = entries.find((x) => x.requestId === requestId);
      const keep = choice === 'new' ? { photoId: id, stars: e.stars } : e.existing;
      setProgress(applyMatch(progress, requestId, keep.photoId, keep.stars));
    },
  });
  return { id, blob, subjects, matches };
}

function tick(dt) {
  if (state !== 'scrapbook') {
    worldTime += dt * timeScale;
    sky.update(worldTime);
    island.update(dt);
    landmarks.update(dt);
    critters.update(dt, sky.phase(), player);
    const active = state === 'explore' || state === 'aim';
    if (active) state = input.aiming ? 'aim' : 'explore';
    player.update(dt, active ? input : IDLE_INPUT, rig.yaw, state === 'aim');
    rig.update(dt, player, input, state);
    if (input.consumeClick() && state === 'aim') takePhoto();
    // Zoomed in, the head would fill the frame; step out of the shot like a viewfinder.
    player.object.visible = !(state === 'aim' && rig.zoom > 1.5);
    hud.setAim(state === 'aim', rig.zoom);
    hud.setCompass(landmarks.nearestNamed(player.position, rig.yaw));
    hud.setHint(active && !input.locked ? 'Click to look around' : null);
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
    snap: takePhoto, getProgress: () => progress, gadget, openGadget, closeGadget,
    step(seconds) { for (let i = 0; i < Math.round(seconds * 60); i++) tick(1 / 60); },
  };
}
