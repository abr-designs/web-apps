// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
//
// Game loop, camera, pointer input and HUD for Cozy Chaos.
// The day lasts DAY_SECONDS. The score timer drains 1 s/s plus 1 s/s per active event; what is left at night is the score.

import * as THREE from '../vendor/three.module.min.js';
import { buildRoom } from './room.js';
import { createEvents } from './events.js';

const DAY_SECONDS = 120;
const START_SECONDS = 180;
const BEST_KEY = 'cozy-chaos.best';

const $ = (id) => document.getElementById(id);
const stage = $('stage');

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera();
const CAMERA_OFFSET = new THREE.Vector3(20, 20, 20);
const ROOM_VIEW = new THREE.Vector3(0, 1.8, 0);
const camTarget = ROOM_VIEW.clone();
camera.position.copy(camTarget).add(CAMERA_OFFSET);
camera.lookAt(camTarget);

const room = buildRoom(scene);
// Aim a little below the sheet so the zoomed desk sits above the worksheet card.
const DESK_VIEW = room.homework.focus.clone().add(new THREE.Vector3(0, -0.7, 0));
const projected = new THREE.Vector3();
const ui = {
  bubble: $('phone-bubble'),
  bubbleText: $('phone-bubble-text'),
  bubbleBar: $('phone-bubble-bar'),
  bubbleFill: $('phone-bubble-fill'),
  project(v) {
    projected.copy(v).project(camera);
    return { x: (projected.x + 1) / 2 * stage.clientWidth, y: (1 - projected.y) / 2 * stage.clientHeight };
  },
};
const events = createEvents(room, ui);
const slots = new Map([...document.querySelectorAll('.slot')].map((el) => [el.dataset.key, el]));

/** Keeps the whole room in view for any aspect ratio. @created Claude (claude-opus-5-5) 2026-10-16 */
function resize() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  const aspect = w / h;
  const halfH = Math.max(7.4, 7.9 / aspect);
  Object.assign(camera, { left: -halfH * aspect, right: halfH * aspect, top: halfH, bottom: -halfH, near: 0.1, far: 100 });
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', resize);
resize();

// ---- Pointer input ----

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let state = 'title';
let captured = null;

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function aim(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray;
}

/** Nearest active event under the pointer, with the mesh that was hit. @created Claude (claude-opus-5-5) 2026-10-16 */
function pick() {
  let best = null;
  for (const ev of events) {
    if (!ev.active) continue;
    const hit = raycaster.intersectObjects(ev.targets, true)[0];
    if (hit && (!best || hit.distance < best.distance)) best = { ev, object: hit.object, distance: hit.distance };
  }
  return best;
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function overHomework() {
  return raycaster.intersectObject(room.homework.hit).length > 0;
}

canvas.addEventListener('pointerdown', (e) => {
  if (state !== 'playing') return;
  // Clicking the room while focused means looking up from the homework.
  if (homework.focused) { setFocus(false); return; }
  const ray = aim(e);
  const hit = pick();
  if (hit) {
    captured = hit.ev;
    canvas.setPointerCapture(e.pointerId);
    hit.ev.onDown?.(ray, hit.object);
  } else if (overHomework()) {
    setFocus(true);
  } else {
    for (const ev of events) if (ev.active) ev.onMiss?.(ray);
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (state !== 'playing') return;
  const ray = aim(e);
  if (captured) {
    if (captured.active) captured.onDrag?.(ray);
    else { captured.onUp?.(); captured = null; }
    return;
  }
  canvas.style.cursor = !homework.focused && (pick() || overHomework()) ? 'pointer' : '';
});

const release = () => {
  captured?.onUp?.();
  captured = null;
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

// ---- Game state ----

let dayTime = 0;
let timeLeft = START_SECONDS;
let nextSpawn = 0;

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function readBest() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function writeBest(v) {
  try { localStorage.setItem(BEST_KEY, String(v)); } catch { /* storage blocked; best score just won't persist */ }
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function fmt(seconds) {
  const s = Math.ceil(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---- Homework ----
// Each page is SUMS_PER_PAGE sums. A finished page adds PAGE_BONUS seconds; a wrong answer costs WRONG_COST.

const SUMS_PER_PAGE = 5;
const PAGE_BONUS = 10;
const WRONG_COST = 2;
const FOCUS_ZOOM = 3.2;
const homework = { focused: false, page: 1, step: 0, pages: 0, answer: 0 };
const hwCard = $('homework');
const hwButtons = [...hwCard.querySelectorAll('.homework__answer')];
let focusAmount = 0;

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

/** Sum for the given page: addition first, then subtraction, then times tables. @created Claude (claude-opus-5-5) 2026-10-16 */
function makeSum(page) {
  const ops = page < 3 ? ['+'] : page < 5 ? ['+', '-'] : ['+', '-', '×'];
  const op = ops[randInt(0, ops.length - 1)];
  if (op === '+') { const a = randInt(2, 12), b = randInt(2, 12); return { text: `${a} + ${b}`, answer: a + b }; }
  if (op === '-') { const a = randInt(6, 20), b = randInt(1, a - 1); return { text: `${a} − ${b}`, answer: a - b }; }
  const a = randInt(2, 9), b = randInt(2, 9);
  return { text: `${a} × ${b}`, answer: a * b };
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function nextSum() {
  const sum = makeSum(homework.page);
  homework.answer = sum.answer;
  const options = new Set([sum.answer]);
  while (options.size < 3) {
    const c = sum.answer + randInt(-4, 4);
    if (c >= 0) options.add(c);
  }
  const shuffled = [...options].sort(() => Math.random() - 0.5);
  hwButtons.forEach((btn, i) => { btn.textContent = shuffled[i]; btn.dataset.value = shuffled[i]; });
  $('hw-sum').textContent = `${sum.text} =`;
  $('hw-page').textContent = `Page ${homework.page}`;
  $('hw-step').textContent = `${homework.step + 1} / ${SUMS_PER_PAGE}`;
}

/** Floats a "+10s" or "-2s" label under the clock. @created Claude (claude-opus-5-5) 2026-10-16 */
function flashBonus(text, good) {
  const el = $('bonus');
  el.textContent = text;
  el.classList.toggle('is-bad', !good);
  el.classList.remove('is-showing');
  void el.offsetWidth;
  el.classList.add('is-showing');
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function answerSum(value) {
  if (state !== 'playing' || !homework.focused) return;
  if (value !== homework.answer) {
    timeLeft = Math.max(0, timeLeft - WRONG_COST);
    flashBonus(`-${WRONG_COST}s`, false);
    hwCard.classList.remove('is-wrong');
    void hwCard.offsetWidth;
    hwCard.classList.add('is-wrong');
    return;
  }
  homework.step += 1;
  if (homework.step >= SUMS_PER_PAGE) {
    homework.step = 0;
    homework.page += 1;
    homework.pages += 1;
    timeLeft += PAGE_BONUS;
    flashBonus(`+${PAGE_BONUS}s`, true);
  }
  nextSum();
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function setFocus(on) {
  homework.focused = on;
  hwCard.hidden = !on;
  canvas.style.cursor = '';
  if (on) release();
}

hwButtons.forEach((btn) => btn.addEventListener('click', () => answerSum(Number(btn.dataset.value))));
window.addEventListener('keydown', (e) => {
  if (!homework.focused) return;
  if (e.key === 'Escape') setFocus(false);
  const i = ['1', '2', '3'].indexOf(e.key);
  if (i >= 0) answerSum(Number(hwButtons[i].dataset.value));
});

/** Eases the camera between the room view and the zoomed desk view, fading the vignette with it. @created Claude (claude-opus-5-5) 2026-10-16 */
function updateFocusCamera(dt) {
  focusAmount += ((homework.focused ? 1 : 0) - focusAmount) * Math.min(1, dt * 4);
  const e = focusAmount * focusAmount * (3 - 2 * focusAmount);
  camTarget.lerpVectors(ROOM_VIEW, DESK_VIEW, e);
  camera.position.copy(camTarget).add(CAMERA_OFFSET);
  camera.lookAt(camTarget);
  camera.zoom = 1 + (FOCUS_ZOOM - 1) * e;
  camera.updateProjectionMatrix();
  document.documentElement.style.setProperty('--focus', e.toFixed(3));
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function startGame() {
  events.forEach((ev) => ev.reset());
  release();
  dayTime = 0;
  timeLeft = START_SECONDS;
  nextSpawn = 3;
  Object.assign(homework, { page: 1, step: 0, pages: 0 });
  setFocus(false);
  nextSum();
  state = 'playing';
  $('title-screen').hidden = true;
  $('end-screen').hidden = true;
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function endGame() {
  state = 'over';
  setFocus(false);
  release();
  events.forEach((ev) => ev.reset());
  updateHud(0);
  canvas.style.cursor = '';
  const score = Math.ceil(timeLeft);
  const best = readBest();
  if (score > best) writeBest(score);
  $('end-score').textContent = fmt(score);
  $('end-best').textContent = score > best ? 'New best!' : `Best: ${fmt(best)}`;
  $('end-pages').textContent = `Homework pages finished: ${homework.pages}`;
  $('end-screen').hidden = false;
}

/** Starts a random event that is free; the gap between events shrinks as the day goes on. @created Claude (claude-opus-5-5) 2026-10-16 */
function spawn() {
  const free = events.filter((ev) => ev.idle());
  if (free.length === 0) { nextSpawn = 1; return; }
  free[Math.floor(Math.random() * free.length)].start();
  if (homework.focused) setFocus(false);
  const progress = dayTime / DAY_SECONDS;
  nextSpawn = THREE.MathUtils.lerp(8, 2.5, progress) * (0.7 + Math.random() * 0.6);
}

$('start-button').addEventListener('click', startGame);
$('again-button').addEventListener('click', startGame);
const bestOnTitle = readBest();
if (bestOnTitle > 0) $('title-best').textContent = `Best: ${fmt(bestOnTitle)}`;

// ---- HUD ----

const dayArc = $('clock-day');
const timerText = $('timer');
const drainBadge = $('drain');

/** Pie slice of the clock face for the fraction of the day gone by. @created Claude (claude-opus-5-5) 2026-10-16 */
function dayPath(f) {
  const a = Math.min(f, 0.9999) * Math.PI * 2;
  const x = 50 + 40 * Math.sin(a);
  const y = 50 - 40 * Math.cos(a);
  return `M50 50 L50 10 A40 40 0 ${f > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function updateHud(activeCount) {
  dayArc.setAttribute('d', dayPath(dayTime / DAY_SECONDS));
  timerText.textContent = fmt(timeLeft);
  drainBadge.hidden = activeCount === 0;
  drainBadge.textContent = `×${activeCount + 1}`;
  timerText.classList.toggle('is-draining', activeCount > 0);
  for (const ev of events) slots.get(ev.key).classList.toggle('is-on', ev.active);
}

// ---- Loop ----

let last = performance.now();

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;

  if (state === 'playing') {
    const activeCount = events.filter((ev) => ev.active).length;
    dayTime += dt;
    timeLeft = Math.max(0, timeLeft - dt * (1 + activeCount));
    nextSpawn -= dt;
    if (nextSpawn <= 0) spawn();
    updateHud(activeCount);
    if (dayTime >= DAY_SECONDS) endGame();
  }

  updateFocusCamera(dt);
  for (const ev of events) ev.update(dt, t);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
