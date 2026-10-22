// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21
// CommandExecutor: the one entry point for player and AI commands and the only writer of BattleState.
// Commands:
//   { type: 'deploy' }                                          phase deploy only: squad concealed, xcom side begins
//   { type: 'move', unitId, dest }
//   { type: 'ability', unitId, abilityId, targetId?, targetTile? }
//   { type: 'endTurn', side? }                                  side, when given, must be the active side
// execute validates everything first, so an InvalidCommand leaves state untouched. After the handler it runs
// TurnManager.check, ends the xcom side once no soldier has AP left, then calls the save hook when autosave is on.
// Hooks (setHooks merges per group, resetHooks restores these no-op defaults, getHooks reads the live set):
//   detection.onStep(state, ctx, mover) -> true stops the path   step 11
//   detection.onNoise(state, ctx, tile)                          step 11; effects call it through getHooks()
//   reactions.onStep(state, ctx, mover) -> true stops the path   step 11
//   abilities.validate(state, cmd) -> { ok, reason? }            step 10; no side effects
//   abilities.use(state, ctx, cmd)                               step 10; runs only after validate passed
//   save(state)                                                  step 13

import { ABILITIES } from '../data/abilities.js';
import { EVENT, createContext } from './events.js';
import { PHASE, livingUnits, unitAt } from './state.js';
import { reachable, pathTo } from './pathfinder.js';
import { beginDeploy, endSide, check } from './turns.js';

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export class InvalidCommand extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'InvalidCommand';
    this.reason = reason;
  }
}

const ABILITIES_PENDING = 'Abilities are not implemented yet';

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function defaultHooks() {
  return {
    detection: { onStep: () => false, onNoise: () => {} },
    reactions: { onStep: () => false },
    abilities: {
      validate: () => ({ ok: false, reason: ABILITIES_PENDING }),
      use: () => { throw new InvalidCommand(ABILITIES_PENDING); },
    },
    save: () => {},
  };
}

let hooks = defaultHooks();

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function pickFns(source, keys) {
  const out = {};
  for (const k of keys) if (typeof source[k] === 'function') out[k] = source[k];
  return out;
}

// Accepts module namespaces too: setHooks({ detection: Detection, reactions: Reactions }).
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function setHooks({ detection, reactions, abilities, save } = {}) {
  if (detection) hooks.detection = { ...hooks.detection, ...pickFns(detection, ['onStep', 'onNoise']) };
  if (reactions) hooks.reactions = { ...hooks.reactions, ...pickFns(reactions, ['onStep']) };
  if (abilities) hooks.abilities = { ...hooks.abilities, ...pickFns(abilities, ['validate', 'use']) };
  if (typeof save === 'function') hooks.save = save;
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function resetHooks() {
  hooks = defaultHooks();
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function getHooks() {
  return hooks;
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function validate(state, cmd) {
  const reason = rejectReason(state, cmd);
  return reason ? { ok: false, reason } : { ok: true };
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function execute(state, cmd, { autosave = true } = {}) {
  const reason = rejectReason(state, cmd);
  if (reason) throw new InvalidCommand(reason);

  const ctx = createContext(state);
  HANDLERS[cmd.type](state, ctx, cmd);
  check(state, ctx);
  // PlayerTurn -> EnemyTurn on "all AP spent". The alien side ends only through endTurn from the AI driver.
  if (state.phase === PHASE.playerTurn && livingUnits(state, 'xcom').every((u) => u.ap <= 0)) endSide(state, ctx);
  if (autosave) hooks.save(state);
  return ctx.events;
}

// Per-step loop of the Move flow, also for free moves (scamper, moveThenAct). Spends no AP and skips validation.
// Stops before a tile another unit now holds, when the mover dies, or when a hook returns true. -> steps taken.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function walkPath(state, ctx, unit, path) {
  let steps = 0;
  for (const to of path) {
    if (unit.hp <= 0) break;
    const blocker = unitAt(state, to);
    if (blocker && blocker.id !== unit.id) break;
    const from = unit.tile;
    unit.tile = to;
    steps += 1;
    ctx.emit(EVENT.UnitStepped, { unitId: unit.id, from, to });
    const spotted = hooks.detection.onStep(state, ctx, unit) === true;
    if (unit.hp <= 0) break;
    const shot = hooks.reactions.onStep(state, ctx, unit) === true;
    if (spotted || shot) break;
  }
  return steps;
}

const HANDLERS = {
  deploy: (state, ctx) => beginDeploy(state, ctx),
  endTurn: (state, ctx) => endSide(state, ctx),
  move: handleMove,
  ability: (state, ctx, cmd) => hooks.abilities.use(state, ctx, cmd),
};

// AP is paid before the first step, so reactions see the mover's remaining AP; a cut-short path still costs it.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function handleMove(state, ctx, cmd) {
  const unit = state.units[cmd.unitId];
  const reach = reachable(state, unit);
  const { apCost } = reach.get(cmd.dest);
  unit.ap -= apCost;
  walkPath(state, ctx, unit, pathTo(reach, cmd.dest));
  ctx.emit(EVENT.ApSpent, { unitId: unit.id, spent: apCost, ap: unit.ap });
}

// -> player-facing reason, or null when cmd is valid. Never writes state.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function rejectReason(state, cmd) {
  if (!cmd || typeof cmd !== 'object' || !Object.hasOwn(HANDLERS, cmd.type)) return 'Unknown command';
  if (state.outcome) return 'The battle is over';
  if (cmd.type === 'deploy') return state.phase === PHASE.deploy ? null : 'The squad is already deployed';
  if (state.phase !== PHASE.playerTurn && state.phase !== PHASE.enemyTurn) return 'The battle has not started';
  if (cmd.type === 'endTurn') return cmd.side === undefined || cmd.side === state.activeSide ? null : 'It is not your turn';

  const unit = Object.hasOwn(state.units, cmd.unitId) ? state.units[cmd.unitId] : null;
  if (!unit) return 'Unknown unit';
  if (unit.hp <= 0) return 'That unit is dead';
  if (unit.team !== state.activeSide) return 'That unit cannot act this turn';
  return cmd.type === 'move' ? moveReason(state, unit, cmd.dest) : abilityReason(state, cmd);
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function moveReason(state, unit, dest) {
  if (!Number.isInteger(dest) || dest < 0 || dest >= state.grid.heights.length) return 'Pick a tile on the map';
  if (unit.ap <= 0) return 'No actions left';
  // reachable ignores unit.ap for the blue band, so the AP check below is required.
  const step = reachable(state, unit).get(dest);
  if (!step) return 'That tile is out of reach';
  if (step.apCost > unit.ap) return 'Not enough actions to dash there';
  return null;
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function abilityReason(state, cmd) {
  if (!Object.hasOwn(ABILITIES, cmd.abilityId)) return 'Unknown ability';
  const result = hooks.abilities.validate(state, cmd);
  return result && result.ok ? null : (result?.reason ?? 'That ability cannot be used now');
}
