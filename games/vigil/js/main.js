// Created by Claude (claude-sonnet-5-5)
// Date: 2026-10-21
// Vigil bootstrap and mission loop (plan step 17). Wires the sim hooks, builds or loads a BattleState, builds the view, and drives
// every command through execute -> lock -> play -> enemy turn -> unlock. The enemy turn pulls EnemyAI commands one at a time.
// A saved battle resumes on load; a finished or abandoned one starts fresh. window.vigil exposes the live parts for console play.

import { buildMission } from './sim/map-builder.js';
import { execute, setHooks, InvalidCommand } from './sim/executor.js';
import { PHASE, livingUnits } from './sim/state.js';
import * as Abilities from './sim/abilities.js';
import * as Detection from './sim/detection.js';
import * as Reactions from './sim/reactions.js';
import * as Ai from './sim/ai.js';
import { save, load, clear } from './sim/save.js';
import { Renderer } from './view/renderer.js';
import { CameraRig } from './view/camera.js';
import { Picker } from './view/picker.js';
import { EventPlayer } from './view/event-player.js';
import { Hud } from './view/hud.js';
import { InputController } from './view/input.js';

const ENEMY_SPEED = 3;
const OBJECTIVE = 'Eliminate all hostiles';
const MAX_AI_COMMANDS = 200; // far above any real turn; stops a misbehaving AI from hanging the page
const MAX_SIDE_SWITCHES = 50;

const saved = load();
// InputController draws its first mode from the state in its constructor, so the opening battle exists before the view does.
let state = saved && !saved.outcome ? saved : buildMission(Date.now() >>> 0);
let missionId = 0; // bumped by every new mission so a command still playing from the old one stops touching the page

// Autosave while the battle lasts; a finished battle leaves no save behind.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function autosave(battle) {
  if (battle.outcome) clear();
  else save(battle);
}

setHooks({ detection: Detection, reactions: Reactions, abilities: { validate: Abilities.validate, use: Abilities.use }, save: autosave });

const canvas = document.getElementById('viewport');
const renderer = new Renderer(canvas);
renderer.build(state);
const rig = new CameraRig(renderer.camera, canvas);
const picker = new Picker(renderer, renderer.camera, canvas);
const hud = new Hud(document);
const player = new EventPlayer(renderer, rig, hud, { getState: () => state, container: canvas.parentElement });
const input = new InputController({ getState: () => state, picker, renderer, cameraRig: rig, hud, onCommand: runCommand, player });
player.onBattleEnded = (outcome) => {
  clear();
  hud.showOutcome(outcome, newMission);
};

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function refreshHud() {
  hud.showObjective(OBJECTIVE, livingUnits(state, 'alien').length);
  hud.showSquad(state, input.selectedId);
  const selected = input.selected;
  if (selected) hud.showUnit(state, selected, Abilities.abilitiesFor(state, selected));
}

// Executes a command and plays its events; a rejected command throws InvalidCommand before anything changes.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
async function play(cmd) {
  const events = execute(state, cmd);
  await player.play(events);
  refreshHud();
}

// execute -> lock -> play -> enemy turn when the side passed -> unlock. A rejection shows its reason and changes nothing.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
async function runCommand(cmd) {
  const id = missionId;
  try {
    const events = execute(state, cmd);
    input.lock();
    await player.play(events);
    if (id !== missionId) return;
    refreshHud();
    if (state.phase === PHASE.enemyTurn) await runEnemyTurn(id);
  } catch (error) {
    if (error instanceof InvalidCommand) {
      hud.showMessage(error.reason);
      return;
    }
    console.error('Vigil: command failed', cmd, error);
  }
  if (id === missionId) input.unlock();
}

// Alien commands one at a time at speed 3, then endTurn (the executor never ends the alien side itself).
// The outer loop covers a squad that starts its turn with no AP, which the executor hands straight back to the aliens.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
async function runEnemyTurn(id) {
  player.setSpeed(ENEMY_SPEED);
  try {
    for (let switches = 0; switches < MAX_SIDE_SWITCHES && state.phase === PHASE.enemyTurn && !state.outcome; switches++) {
      for (let n = 0; n < MAX_AI_COMMANDS && !state.outcome; n++) {
        const cmd = Ai.nextCommand(state);
        if (!cmd) break;
        try {
          await play(cmd);
        } catch (error) {
          if (!(error instanceof InvalidCommand)) throw error;
          console.warn('Vigil: AI issued an invalid command', cmd, error.reason);
          break;
        }
        if (id !== missionId) return;
      }
      if (!state.outcome) await play({ type: 'endTurn' });
      if (id !== missionId) return;
    }
  } finally {
    player.setSpeed(1);
  }
}

// Builds the view for `battle` and starts play: a loaded battle resumes where it stopped, a fresh one deploys first.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
async function startBattle(battle, { built = false } = {}) {
  const id = ++missionId;
  state = battle;
  hud.showOutcome(null);
  if (!built) renderer.build(state);
  renderer.syncUnits(state);
  rig.setBounds(state.grid.width, state.grid.depth);
  input.setMode('idle');

  if (state.phase === PHASE.deploy) {
    input.lock();
    rig.focusTile(renderer.tileCenter(state.units.x1.tile), { animate: false });
    await play({ type: 'deploy' });
  } else {
    // A loaded battle never replays its TurnStarted, so the banner, concealment light and objective are set by hand.
    const soldier = livingUnits(state, 'xcom')[0];
    if (soldier) rig.focusTile(renderer.tileCenter(soldier.tile), { animate: false });
    hud.showTurn(state.activeSide, state.turn);
    hud.showConcealed(state.squadConcealed);
    refreshHud();
    if (state.phase === PHASE.enemyTurn) {
      input.lock();
      await runEnemyTurn(id);
    }
  }
  if (id === missionId) input.unlock();
}

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function newMission() {
  clear();
  startBattle(buildMission(Date.now() >>> 0)).catch((error) => console.error('Vigil: start failed', error));
}

let last = performance.now();
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  rig.update(dt);
  input.update(dt);
  if (state) hud.updateUnitBars(state, (unitId) => player.project(unitId), (unit) => player.shownHp(unit));
  renderer.render();
  requestAnimationFrame(frame);
}

startBattle(state, { built: true }).catch((error) => console.error('Vigil: start failed', error));
requestAnimationFrame(frame);

window.vigil = {
  get state() { return state; },
  renderer, rig, picker, player, hud, input, runCommand, newMission,
};
