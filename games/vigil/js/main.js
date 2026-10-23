// Created by Claude (claude-sonnet-5-5)
// Date: 2026-10-21
// Modified by Claude (claude-opus-5-5) - 2026-10-23
// Vigil bootstrap and mission loop (plan step 17). Wires the sim hooks, builds or loads a BattleState, builds the view, and drives
// every command through execute -> lock -> play -> enemy turn -> unlock. The enemy turn pulls EnemyAI commands one at a time.
// A saved battle resumes on load. Anything else, and New Mission, opens the loadout screen (plan 0002) over the new mission's map;
// Launch rebuilds that map from the same seed with the chosen loadout and deploys. window.vigil exposes the live parts for console play.
// The unit models (plan 0004) load before the first build; if they fail, every build draws capsules instead.
// Every new mission is built at the Progress threat level, which each finished battle steps up (victory) or down, with the
// soldiers who survived the last victory (Next mission); after a defeat or forfeit New mission brings the full squad back.

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
import { Hud, threatLabel } from './view/hud.js';
import { InputController } from './view/input.js';
import { Fog } from './view/fog.js';
import { Roster } from './view/roster.js';
import { Progress } from './view/progress.js';
import { LoadoutScreen } from './view/loadout-screen.js';
import { AssetLibrary } from './view/assets.js';

const ENEMY_SPEED = 3;
const OBJECTIVE = 'Eliminate all hostiles';
const MAX_AI_COMMANDS = 200; // far above any real turn; stops a misbehaving AI from hanging the page
const MAX_SIDE_SWITCHES = 50;

const roster = new Roster();
const progress = new Progress();
const saved = load();
const resuming = Boolean(saved && !saved.outcome);
// InputController draws its first mode from the state in its constructor, so the opening battle exists before the view does.
let state = resuming ? saved : buildMission(Date.now() >>> 0, { loadout: roster.loadout(), threat: progress.level, survivors: progress.squad });
let missionId = 0; // bumped by every new mission so a command still playing from the old one stops touching the page

// Autosave while the battle lasts; a finished battle leaves no save behind.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function autosave(battle) {
  if (battle.outcome) clear();
  else save(battle);
}

setHooks({ detection: Detection, reactions: Reactions, abilities: { validate: Abilities.validate, use: Abilities.use }, save: autosave });

const assets = new AssetLibrary();
const modelsLoaded = await assets.load().then(() => true, (error) => {
  console.warn('Vigil: unit models failed to load, drawing capsules', error);
  return false;
});
document.getElementById('loading').hidden = true;

const canvas = document.getElementById('viewport');
const renderer = new Renderer(canvas);
buildView(state);
const rig = new CameraRig(renderer.camera, canvas);
const picker = new Picker(renderer, renderer.camera, canvas);
const fog = new Fog({ renderer });
const hud = new Hud(document, roster);
const loadoutScreen = new LoadoutScreen(document.getElementById('loadout'), roster);
const player = new EventPlayer(renderer, rig, hud, { getState: () => state, container: canvas.parentElement, fog });
const input = new InputController({ getState: () => state, picker, renderer, cameraRig: rig, hud, onCommand: runCommand, player, fog, roster });
hud.onRename((unitId, text) => {
  roster.rename(unitId, text);
  refreshHud();
  // showUnit rebuilds the ability list, so an armed ability keeps its highlight.
  if (input.modeName === 'targeting') hud.setActiveAbility(input.data.abilityId);
});
player.onBattleEnded = (outcome) => {
  clear();
  hud.showOutcome(outcome, newMission, progress.record(outcome, state));
};

/**
 * Builds the scene and tints each soldier's ring (and model) in its roster slot colour.
 * @created Claude (claude-opus-5-5) - 2026-10-22
 * @modified Claude (claude-opus-5-5) - 2026-10-22 - unit models
 */
function buildView(battle) {
  renderer.build(battle, { assets: modelsLoaded ? assets : null });
  for (const unit of livingUnits(battle, 'xcom')) renderer.setUnitColor(unit.id, roster.colorOf(unit));
}

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function refreshHud() {
  hud.showObjective(OBJECTIVE, livingUnits(state, 'alien').length, `${threatLabel(state.threat)} · hostiles remaining`);
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
  let refocus = false;
  try {
    const events = execute(state, cmd);
    input.lock();
    await player.play(events);
    if (id !== missionId) return;
    refreshHud();
    if (state.phase === PHASE.enemyTurn) {
      await runEnemyTurn(id);
      refocus = true;
    }
  } catch (error) {
    if (error instanceof InvalidCommand) {
      hud.showMessage(error.reason);
      return;
    }
    console.error('Vigil: command failed', cmd, error);
  }
  if (id === missionId) unlock({ focus: refocus });
}

/**
 * Fresh fog for the settled state, then the input mode. focus brings the camera back to the squad after an enemy turn.
 * @created Claude (claude-opus-5-5) - 2026-10-22
 * @modified Claude (claude-opus-5-5) - 2026-10-23 - focus option
 */
function unlock({ focus = false } = {}) {
  fog.refresh(state);
  input.unlock({ focus });
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

// Makes `battle` the live state and shows its map with input in idle; startBattle and openLoadout both start here.
/** @created Claude (claude-opus-5-5) - 2026-10-22 */
function showMap(battle, { built = false } = {}) {
  state = battle;
  hud.showOutcome(null);
  if (!built) buildView(state);
  renderer.syncUnits(state);
  fog.refresh(state);
  rig.setBounds(state.grid.width, state.grid.depth);
  // A new map starts with this battle's banners, so the last mission's turn line and messages never linger.
  hud.showTurn(state.activeSide, state.turn);
  hud.showConcealed(state.squadConcealed);
  hud.showMessage(null);
  input.setMode('idle');
}

// The loadout screen over the mission's map: input stays locked, nothing deploys or autosaves until Launch.
/** @created Claude (claude-opus-5-5) - 2026-10-22 */
function openLoadout(seed, { built = false } = {}) {
  const id = ++missionId;
  showMap(built ? state : buildMission(seed, { loadout: roster.loadout(), threat: progress.level, survivors: progress.squad }), { built });
  input.lock();
  rig.focusTile(renderer.tileCenter(livingUnits(state, 'xcom')[0].tile), { animate: false });
  refreshHud();
  loadoutScreen.open(state, (loadout) => {
    if (id !== missionId) return;
    startBattle(buildMission(seed, { loadout, threat: progress.level, survivors: progress.squad })).catch((error) => console.error('Vigil: start failed', error));
  });
}

// Builds the view for `battle` and starts play: a loaded battle resumes where it stopped, a fresh one deploys first.
/**
 * @created Claude (claude-sonnet-5-5) - 2026-10-21
 * @modified Claude (claude-opus-5-5) - 2026-10-22 - map setup split out into showMap
 */
async function startBattle(battle, { built = false } = {}) {
  const id = ++missionId;
  showMap(battle, { built });

  if (state.phase === PHASE.deploy) {
    input.lock();
    rig.focusTile(renderer.tileCenter(livingUnits(state, 'xcom')[0].tile), { animate: false });
    await play({ type: 'deploy' });
  } else {
    // A loaded battle never replays its TurnStarted; showMap set the banner and concealment light, the objective is set here.
    const soldier = livingUnits(state, 'xcom')[0];
    if (soldier) rig.focusTile(renderer.tileCenter(soldier.tile), { animate: false });
    refreshHud();
    if (state.phase === PHASE.enemyTurn) {
      input.lock();
      await runEnemyTurn(id);
    }
  }
  if (id === missionId) unlock({ focus: true });
}

/**
 * @created Claude (claude-sonnet-5-5) - 2026-10-21
 * @modified Claude (claude-opus-5-5) - 2026-10-22 - opens the loadout screen first
 */
function newMission() {
  clear();
  openLoadout(Date.now() >>> 0);
}

let last = performance.now();
/**
 * @created Claude (claude-sonnet-5-5) - 2026-10-21
 * @modified Claude (claude-opus-5-5) - 2026-10-22 - unit model clips
 */
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  rig.update(dt);
  input.update(dt);
  renderer.update(player.playing ? dt * player.speed : dt); // clips keep pace with fast enemy turns
  if (state) hud.updateUnitBars(state, (unitId) => player.project(unitId), (unit) => player.shownHp(unit), player.shows, player.projectAnchor);
  renderer.render();
  requestAnimationFrame(frame);
}

if (resuming) startBattle(state, { built: true }).catch((error) => console.error('Vigil: start failed', error));
else openLoadout(state.seed, { built: true });
requestAnimationFrame(frame);

window.vigil = {
  get state() { return state; },
  renderer, rig, picker, player, hud, input, fog, roster, progress, loadoutScreen, assets, runCommand, newMission,
};
