// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21
// InputController: pointer and keys to commands through the Input mode state machine (plan Key Flows).
// Modes: idle, unitSelected, movePreview, targeting, animating, locked. Each is { enter, exit, pointerMove, click, key },
// called with the controller first. Layout C has no confirm button, so a second click on the previewed tile or target, or Enter,
// confirms. Every command goes through validate first; a rejected one shows its reason and keeps the mode.
// Keys: Tab / Shift+Tab next soldier (next target while targeting), 1-9 abilities (the same key again confirms), Enter confirm,
// Esc or right-click cancel, Backspace end turn, Q / E rotate, WASD pan, Space skip playback. The wheel zoom lives in CameraRig.
// main owns the command loop: onCommand(cmd) executes, calls lock(), plays the events and calls unlock().

import { ABILITIES } from '../data/abilities.js';
import { PHASE, livingUnits } from '../sim/state.js';
import { reachable } from '../sim/pathfinder.js';
import { validate } from '../sim/executor.js';
import { compute, weaponEffect, unitDef } from '../sim/hit.js';
import { coverAt } from '../sim/cover.js';
import { squadVisible, tileDistance } from '../sim/visibility.js';
import { abilitiesFor, validTargets, meleeTiles } from '../sim/abilities.js';

const PAN_SPEED = 14; // tiles per second
const CONFIRM_NOTE = 'Click again or press Enter to confirm';
const ALL_EDGES = [0, 1, 2, 3];

// ---- Mode helpers ----

// Esc (and right-click, which arrives as Escape) steps back one level; Tab, digits and Backspace work in every interactive mode.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function commonKey(ic, e) {
  if (e.key === 'Tab') {
    ic.cycleSoldier(e.shiftKey ? -1 : 1);
    return true;
  }
  if (/^[1-9]$/.test(e.key)) {
    const entry = ic.abilities[Number(e.key) - 1];
    if (entry) ic.chooseAbility(entry.id);
    return true;
  }
  if (e.key === 'Backspace') {
    ic.endTurn();
    return true;
  }
  return false;
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function soldierAt(ic, hit) {
  const unit = hit?.unitId ? ic.state.units[hit.unitId] : null;
  return unit && unit.team === 'xcom' && unit.hp > 0 ? unit : null;
}

// Edge indices of tile to draw yellow: all of its cover edges when any enemy the squad sees would flank it there.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function flankedEdges(state, tile, enemyTiles) {
  const edges = state.grid.edgeCover[tile];
  if (!enemyTiles.some((from) => coverAt(state, tile, from).flanked)) return [];
  return ALL_EDGES.filter((k) => edges[k] !== 'none');
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function hpText(unit) {
  return `${unit.hp} / ${unit.stats.hp} HP`;
}

// ---- Modes ----

const Idle = {
  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  enter(ic) {
    ic.selectedId = null;
    ic.reach = new Map();
    ic.abilities = [];
    ic.baseOverlays();
    ic.hud.showUnit(ic.state, null);
    ic.hud.showSquad(ic.state, null);
    ic.hud.showBreakdown(null);
  },
  exit() {},
  pointerMove() {},
  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  click(ic, hit) {
    const soldier = soldierAt(ic, hit);
    if (soldier) ic.select(soldier.id, { focus: false });
  },
  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  key(ic, e) {
    return commonKey(ic, e);
  },
};

const UnitSelected = {
  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  enter(ic) {
    ic.baseOverlays();
    ic.renderer.showMoveRange(ic.reach);
    ic.hud.showBreakdown(null);
    ic.hud.setActiveAbility(null);
  },
  exit() {},
  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  pointerMove(ic, hit) {
    if (hit?.tile !== undefined && ic.reach.has(hit.tile)) ic.setMode('movePreview', { tile: hit.tile });
  },
  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  click(ic, hit) {
    const soldier = soldierAt(ic, hit);
    if (soldier) {
      if (soldier.id !== ic.selectedId) ic.select(soldier.id, { focus: false });
      return;
    }
    if (hit?.tile !== undefined && ic.reach.has(hit.tile)) ic.setMode('movePreview', { tile: hit.tile, armed: hit.tile });
  },
  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  key(ic, e) {
    if (e.key === 'Escape') {
      ic.setMode('idle');
      return true;
    }
    return commonKey(ic, e);
  },
};

// data: { tile, armed, enemyTiles }. Hover moves tile; a click arms it and a second click on the armed tile moves.
const MovePreview = {
  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  enter(ic, data) {
    ic.baseOverlays();
    ic.renderer.showMoveRange(ic.reach);
    // Enemies the squad sees decide which shields turn yellow; their tiles do not change while hovering.
    const seen = squadVisible(ic.state, 'xcom');
    data.enemyTiles = [...seen].sort().map((id) => ic.state.units[id].tile);
    MovePreview.show(ic, data);
  },
  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  show(ic, data) {
    const state = ic.state;
    const flankEdges = flankedEdges(state, data.tile, data.enemyTiles);
    ic.renderer.showCoverShields(state, data.tile, flankEdges);
    const { apCost } = ic.reach.get(data.tile);
    const edges = state.grid.edgeCover[data.tile];
    const cover = edges.includes('full') ? 'Full cover' : edges.includes('half') ? 'Half cover' : 'No cover';
    const flanked = flankEdges.length > 0;
    ic.hud.showBreakdown(null, {
      title: apCost === 1 ? 'Move' : 'Dash',
      subtitle: `${apCost === 1 ? '1 action' : '2 actions'} · ${cover}${flanked ? ' · flanked' : ''}`,
      note: CONFIRM_NOTE,
    });
  },
  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  exit(ic) {
    ic.hud.showBreakdown(null);
  },
  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  pointerMove(ic, hit, data) {
    const tile = hit?.tile;
    if (tile === data.tile) return;
    if (tile !== undefined && ic.reach.has(tile)) {
      data.tile = tile;
      data.armed = null;
      MovePreview.show(ic, data);
    } else {
      ic.setMode('unitSelected');
    }
  },
  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  click(ic, hit, data) {
    const soldier = soldierAt(ic, hit);
    if (soldier) {
      if (soldier.id !== ic.selectedId) ic.select(soldier.id, { focus: false });
      return;
    }
    if (hit?.tile === undefined || !ic.reach.has(hit.tile)) return;
    if (hit.tile === data.armed) {
      MovePreview.confirm(ic, data);
      return;
    }
    data.tile = hit.tile;
    data.armed = hit.tile;
    MovePreview.show(ic, data);
  },
  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  key(ic, e, data) {
    if (e.key === 'Enter') {
      MovePreview.confirm(ic, data);
      return true;
    }
    if (e.key === 'Escape') {
      ic.setMode('unitSelected');
      return true;
    }
    return commonKey(ic, e);
  },
  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  confirm(ic, data) {
    ic.issue({ type: 'move', unitId: ic.selectedId, dest: data.tile });
  },
};

// data: { abilityId, kind: 'self' | 'unit' | 'tile', targets, target, armed }. target is a unit id, or a tile for kind 'tile'.
// armed is the target a click picked; hovering or Tab moves target and disarms, so only a second click on the same target confirms.
const Targeting = {
  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  enter(ic, data) {
    const state = ic.state;
    const unit = ic.selected;
    const def = ABILITIES[data.abilityId];
    data.kind = def.targeting === 'self' ? 'self' : def.targeting === 'tile' ? 'tile' : 'unit';
    data.targets = validTargets(state, unit, data.abilityId);
    if (data.kind === 'unit') {
      // Nearest first, so the first target and Tab order match what the player sees.
      const d = (id) => tileDistance(state.grid, unit.tile, state.units[id].tile);
      data.targets.sort((a, b) => d(a) - d(b) || (a < b ? -1 : 1));
    }
    if (data.targets.length === 0) {
      // abilitiesFor already greys these out; this covers a list shown before the state changed.
      ic.hud.showMessage('No valid targets');
      ic.setMode('unitSelected');
      return;
    }
    data.tileSet = data.kind === 'tile' ? new Set(data.targets) : null;
    data.target = data.kind === 'tile' ? null : data.targets[0];
    ic.hud.setActiveAbility(data.abilityId);
    if (data.kind === 'unit') ic.focusTile(state.units[data.target].tile);
    Targeting.show(ic, data);
  },
  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  exit(ic) {
    ic.hud.setActiveAbility(null);
    ic.hud.showBreakdown(null);
  },
  /** Redraws overlays and the breakdown for the current target. @created Claude (claude-opus-5-5) - 2026-10-21 */
  show(ic, data) {
    const state = ic.state;
    const unit = ic.selected;
    const def = ABILITIES[data.abilityId];
    ic.baseOverlays();

    if (data.kind === 'self') {
      ic.renderer.showCoverShields(state, unit.tile);
      ic.hud.showBreakdown(null, { title: def.name, subtitle: def.description, note: 'Press Enter or the ability again to confirm' });
      return;
    }

    if (data.kind === 'tile') {
      // Range as a blue outline; the blast as red hatch through showDetection, which takes any { squadConcealed, units }.
      ic.renderer.showMoveRange(new Map(data.targets.map((t) => [t, { apCost: 1 }])));
      if (data.target === null) {
        ic.hud.showBreakdown(null, { title: def.name, subtitle: `Range ${def.range} · radius ${def.radius}`, note: 'Hover a tile in range' });
        return;
      }
      const blast = { team: 'alien', hp: 1, tile: data.target, stats: { detection: def.radius } };
      ic.renderer.showDetection({ squadConcealed: true, units: { blast } });
      ic.renderer.showTargetLine(unit.tile, data.target);
      const caught = livingUnits(state).filter((u) => tileDistance(state.grid, u.tile, data.target) <= def.radius);
      ic.hud.showBreakdown(null, {
        title: def.name,
        subtitle: `Radius ${def.radius} · destroys cover`,
        lines: caught.length > 0
          ? caught.map((u) => ({ label: unitDef(u).name, value: u.team === 'xcom' ? 'Squad' : hpText(u) }))
          : [{ label: 'No one in the blast', value: '' }],
        note: CONFIRM_NOTE,
      });
      return;
    }

    const target = state.units[data.target];
    const hostile = target.team !== unit.team;
    ic.renderer.showTargetLine(unit.tile, target.tile, hostile ? ic.renderer.colors.crit : ic.renderer.colors.accent);
    if (!hostile) {
      ic.hud.showBreakdown(null, { title: unitDef(target).name, subtitle: hpText(target), lines: [{ label: def.description }], note: CONFIRM_NOTE });
      return;
    }
    const fromTile = def.targeting === 'melee' ? (meleeTiles(state, unit, target.id)[0] ?? unit.tile) : unit.tile;
    const breakdown = weaponEffect(data.abilityId) || def.guaranteedHit
      ? compute(state, unit, target, data.abilityId, { fromTile })
      : null;
    const cover = coverAt(state, target.tile, fromTile);
    ic.renderer.showCoverShields(state, target.tile, cover.flanked ? ALL_EDGES : []);
    const coverText = def.targeting === 'melee' ? 'melee ignores cover' : cover.flanked ? 'flanked' : `${cover.level} cover`;
    ic.hud.showBreakdown(breakdown, {
      title: `${def.name}: ${unitDef(target).name}`,
      subtitle: `${hpText(target)} · ${coverText}`,
      hostile: true,
      lines: breakdown ? [] : [{ label: def.description }],
      note: data.targets.length > 1 ? `${CONFIRM_NOTE}. Tab for next target` : CONFIRM_NOTE,
    });
  },
  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  pointerMove(ic, hit, data) {
    if (data.kind === 'unit') {
      if (hit?.unitId && hit.unitId !== data.target && data.targets.includes(hit.unitId)) {
        data.target = hit.unitId;
        data.armed = null;
        Targeting.show(ic, data);
      }
    } else if (data.kind === 'tile') {
      const tile = hit?.tile ?? (hit?.unitId ? ic.state.units[hit.unitId].tile : undefined);
      if (tile !== undefined && tile !== data.target && data.tileSet.has(tile)) {
        data.target = tile;
        data.armed = null;
        Targeting.show(ic, data);
      }
    }
  },
  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  click(ic, hit, data) {
    let picked;
    if (data.kind === 'tile') picked = hit?.tile ?? (hit?.unitId ? ic.state.units[hit.unitId].tile : undefined);
    else picked = data.targets.includes(hit?.unitId) ? hit.unitId : undefined;
    if (picked === undefined || (data.kind === 'tile' && !data.tileSet.has(picked))) return;
    // The first click picks (and arms) a target, a second click on the armed one confirms.
    if (picked === data.armed) {
      Targeting.confirm(ic, data);
      return;
    }
    data.target = picked;
    data.armed = picked;
    Targeting.show(ic, data);
  },
  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  key(ic, e, data) {
    if (e.key === 'Enter') {
      Targeting.confirm(ic, data);
      return true;
    }
    if (e.key === 'Escape') {
      ic.setMode('unitSelected');
      return true;
    }
    if (e.key === 'Tab' && data.kind === 'unit') {
      if (data.targets.length > 1) {
        const k = data.targets.indexOf(data.target);
        data.target = data.targets[(k + (e.shiftKey ? -1 : 1) + data.targets.length) % data.targets.length];
        data.armed = null;
        ic.focusTile(ic.state.units[data.target].tile);
        Targeting.show(ic, data);
      }
      return true;
    }
    return commonKey(ic, e);
  },
  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  confirm(ic, data) {
    if (data.target === null) {
      ic.hud.showMessage('Pick a tile first');
      return;
    }
    const cmd = { type: 'ability', unitId: ic.selectedId, abilityId: data.abilityId };
    if (data.kind === 'tile') cmd.targetTile = data.target;
    else if (data.kind === 'unit') cmd.targetId = data.target;
    if (ABILITIES[data.abilityId].targeting === 'melee') cmd.targetTile = meleeTiles(ic.state, ic.selected, data.target)[0];
    ic.issue(cmd);
  },
};

// Playback of the player's own command; Space (global) skips it.
const Animating = {
  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  enter(ic) {
    ic.baseOverlays();
    ic.hud.showBreakdown(null);
    ic.hud.setLocked(true);
  },
  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  exit(ic) {
    ic.hud.setLocked(false);
  },
  pointerMove() {},
  click() {},
  key() { return false; },
};

// Enemy turn and the end of the battle: same as Animating, a separate mode so main can tell them apart.
const Locked = { ...Animating };

const MODES = { idle: Idle, unitSelected: UnitSelected, movePreview: MovePreview, targeting: Targeting, animating: Animating, locked: Locked };
const INTERACTIVE = new Set(['idle', 'unitSelected', 'movePreview', 'targeting']);

export class InputController {
  /** player is the EventPlayer, used for Space skip. onCommand(cmd) runs the command loop in main. @created Claude (claude-opus-5-5) - 2026-10-21 */
  constructor({ getState, picker, renderer, cameraRig, hud, onCommand, player = null }) {
    this.getState = getState;
    this.picker = picker;
    this.renderer = renderer;
    this.rig = cameraRig;
    this.hud = hud;
    this.onCommand = onCommand;
    this.player = player;

    this.selectedId = null;
    this.reach = new Map();  // selected soldier's affordable move tiles (apCost <= ap)
    this.abilities = [];     // abilitiesFor the selected soldier, in hud row order
    this.held = new Set();   // WASD keys down
    this.modeName = null;
    this.mode = null;
    this.data = {};

    const el = picker.domElement;
    this._onPointerMove = (e) => this._pointer(e, 'pointerMove');
    this._onClick = (e) => this._pointer(e, 'click');
    this._onContextMenu = (e) => {
      e.preventDefault();
      this._key({ key: 'Escape', shiftKey: false, preventDefault() {} });
    };
    this._onLeave = () => { if (INTERACTIVE.has(this.modeName)) this.mode.pointerMove(this, null, this.data); };
    this._onKeyDown = (e) => this._keyDown(e);
    this._onKeyUp = (e) => this.held.delete(e.key.toLowerCase());
    this._onBlur = () => this.held.clear();
    el.addEventListener('pointermove', this._onPointerMove);
    el.addEventListener('click', this._onClick);
    el.addEventListener('contextmenu', this._onContextMenu);
    el.addEventListener('pointerleave', this._onLeave);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);

    hud.onAbility((id) => this.chooseAbility(id));
    hud.onEndTurn(() => this.endTurn());
    hud.onSelectUnit((id) => { if (INTERACTIVE.has(this.modeName)) this.select(id, { focus: true }); });

    this.setMode('idle');
  }

  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  get state() {
    return this.getState();
  }

  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  get selected() {
    return this.selectedId ? this.state.units[this.selectedId] : null;
  }

  /** Exits the current mode and enters the next one with data (a fresh object per entry). @created Claude (claude-opus-5-5) - 2026-10-21 */
  setMode(name, data = {}) {
    this.mode?.exit(this, this.data);
    this.modeName = name;
    this.mode = MODES[name];
    this.data = data;
    this.mode.enter(this, data);
  }

  /** Enters Animating for the player's own playback, Locked once the turn has passed to the aliens or the battle ended. @created Claude (claude-opus-5-5) - 2026-10-21 */
  lock() {
    this.setMode(this.state.phase === PHASE.playerTurn ? 'animating' : 'locked');
  }

  /** Keeps the selected soldier when it has AP, else selects the next one that does, else Idle. Stays Locked outside the player turn. @created Claude (claude-opus-5-5) - 2026-10-21 */
  unlock() {
    const state = this.state;
    if (state.phase !== PHASE.playerTurn) {
      this.setMode('locked');
      return;
    }
    const current = this.selected;
    if (current && current.hp > 0 && current.ap > 0) {
      this.select(current.id, { focus: false });
      return;
    }
    const next = livingUnits(state, 'xcom').find((u) => u.ap > 0);
    if (next) this.select(next.id, { focus: true });
    else this.setMode('idle');
  }

  /** Selects a soldier, recomputing its move range and ability list, and enters UnitSelected. @created Claude (claude-opus-5-5) - 2026-10-21 */
  select(unitId, { focus = true } = {}) {
    const state = this.state;
    const unit = state.units[unitId];
    if (!unit || unit.team !== 'xcom' || unit.hp <= 0) return;
    this.selectedId = unitId;
    this.reach = new Map();
    if (state.phase === PHASE.playerTurn && unit.ap > 0) {
      for (const [tile, step] of reachable(state, unit)) if (step.apCost <= unit.ap) this.reach.set(tile, step);
    }
    this.abilities = abilitiesFor(state, unit);
    this.hud.showUnit(state, unit, this.abilities);
    this.hud.showSquad(state, unitId);
    if (focus) this.focusTile(unit.tile);
    this.setMode('unitSelected');
  }

  /** Tab: the next (dir 1) or previous (dir -1) living soldier with AP, or with none left, any living soldier. @created Claude (claude-opus-5-5) - 2026-10-21 */
  cycleSoldier(dir) {
    const living = livingUnits(this.state, 'xcom');
    const ready = living.filter((u) => u.ap > 0);
    const pool = ready.length > 0 ? ready : living;
    if (pool.length === 0) return;
    const ids = living.map((u) => u.id);
    const at = this.selectedId ? ids.indexOf(this.selectedId) : (dir > 0 ? -1 : ids.length);
    // Walk the full id ring from the current soldier so the order stays stable when the current one is not in the pool.
    for (let step = 1; step <= ids.length; step++) {
      const id = ids[(at + dir * step + ids.length * 2) % ids.length];
      if (pool.some((u) => u.id === id) && (id !== this.selectedId || pool.length === 1)) {
        this.select(id, { focus: true });
        return;
      }
    }
  }

  /** Ability row or number key. Disabled abilities show their reason; the targeted ability again confirms. @created Claude (claude-opus-5-5) - 2026-10-21 */
  chooseAbility(abilityId) {
    if (!INTERACTIVE.has(this.modeName) || !this.selected) return;
    if (this.modeName === 'targeting' && this.data.abilityId === abilityId) {
      Targeting.confirm(this, this.data);
      return;
    }
    const entry = this.abilities.find((a) => a.id === abilityId);
    if (!entry) return;
    if (!entry.usable) {
      this.hud.showMessage(entry.reason);
      return;
    }
    this.setMode('targeting', { abilityId });
  }

  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  endTurn() {
    if (INTERACTIVE.has(this.modeName)) this.issue({ type: 'endTurn', side: 'xcom' });
  }

  /** Validates, then hands the command to main. A rejection shows its reason and leaves the mode as it is. @created Claude (claude-opus-5-5) - 2026-10-21 */
  issue(cmd) {
    const result = validate(this.state, cmd);
    if (!result.ok) {
      this.hud.showMessage(result.reason);
      return;
    }
    this.onCommand(cmd);
  }

  /** Clears every overlay and redraws the detection tiles, the base every mode draws on. @created Claude (claude-opus-5-5) - 2026-10-21 */
  baseOverlays() {
    this.renderer.clearOverlays();
    this.renderer.showDetection(this.state);
  }

  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  focusTile(tile) {
    this.rig.focusTile(this.renderer.tileCenter(tile));
  }

  /** Call every frame with elapsed seconds: WASD pan. @created Claude (claude-opus-5-5) - 2026-10-21 */
  update(dt) {
    if (this.held.size === 0) return;
    const step = PAN_SPEED * dt;
    const h = this.held;
    this.rig.pan((h.has('d') ? step : 0) - (h.has('a') ? step : 0), (h.has('s') ? step : 0) - (h.has('w') ? step : 0));
  }

  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  dispose() {
    const el = this.picker.domElement;
    el.removeEventListener('pointermove', this._onPointerMove);
    el.removeEventListener('click', this._onClick);
    el.removeEventListener('contextmenu', this._onContextMenu);
    el.removeEventListener('pointerleave', this._onLeave);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
  }

  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  _pointer(e, handler) {
    if (!INTERACTIVE.has(this.modeName)) return;
    this.mode[handler](this, this.picker.pick(e.clientX, e.clientY), this.data);
  }

  // Camera keys and Space work in every mode; the rest go to the mode.
  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  _keyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof HTMLElement && e.target.matches('input, textarea, select')) return;
    const key = e.key.toLowerCase();
    if ('wasd'.includes(key) && key.length === 1) {
      this.held.add(key);
      return;
    }
    if (e.repeat) return;
    if (key === 'q' || key === 'e') {
      this.rig.rotateQuarter(key === 'q' ? -1 : 1);
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      this.player?.skip();
      return;
    }
    this._key(e);
  }

  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  _key(e) {
    if (['Tab', 'Backspace', 'Enter'].includes(e.key)) e.preventDefault();
    if (INTERACTIVE.has(this.modeName)) this.mode.key(this, e, this.data);
  }
}
