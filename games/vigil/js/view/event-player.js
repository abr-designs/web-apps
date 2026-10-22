// Created by Claude (claude-sonnet-5-5)
// Date: 2026-10-21
// EventPlayer: animates an Event[] from the sim in order and resolves when the last one is done (Event Queue consumer).
// One async handler per EVENT type. Tweens run on real time scaled by setSpeed; skip() finishes the running tween and every later one
// at once, and each handler still applies its end state (unit position, visibility, prop swap, hud calls). Transient effects
// (tracers, particles, flyover text) are not created while skipping.
// Flyover text lives in DOM elements over the canvas, projected from world positions each frame. Its small stylesheet is injected here.
// Optional hud methods used: showTurn, showConcealed, showMessage, updateUnitBars. Every call is skipped when hud is null.
// Optional getState (a function returning the BattleState) lets the player find pod units and refresh hud unit bars.
// Optional fog (plan 0003) refreshes after every step and kill from the drawn tiles and HP, since the sim state is already final.

import * as THREE from '../../vendor/three.module.min.js';
import { EVENT } from '../sim/events.js';
import { canSee } from '../sim/visibility.js';

const STEP_TIME = 0.2;       // seconds per tile moved
const HOP = 0.08;            // world units a stepping unit bobs
const TRACER_TIME = 0.18;
const TRACER_LENGTH = 0.9;
const SHAKE_TIME = 0.22;
const DEATH_TIME = 0.55;
const FLY_TIME = 1.1;
const FLY_RISE = 40;         // px a flyover climbs
const FLY_STACK = 20;        // px between flyovers on the same anchor
const HEAD = 1.35;           // world height of the anchor above a unit's feet
const MUZZLE = 0.7;          // world height tracers start and end at
const FOCUS_SETTLE = 0.3;    // seconds to let the camera ease after a focus
const STYLE_ID = 'vigil-event-player-style';
const STYLE = `
.vigil-fly-layer { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 6; }
.vigil-fly { position: absolute; left: 0; top: 0; white-space: nowrap; font: 700 18px/1 system-ui, sans-serif; letter-spacing: .04em;
  color: var(--text, #E6EEF4); text-shadow: 0 1px 3px #000, 0 0 8px #000; will-change: transform, opacity; }
.vigil-fly-dmg { color: var(--danger, #FF3B3B); font-size: 24px; }
.vigil-fly-crit { color: var(--crit, #FFB13B); font-size: 26px; text-transform: uppercase; }
.vigil-fly-graze { color: var(--move-yellow, #F2C94C); }
.vigil-fly-miss { color: var(--text-muted, #8A9BAA); }
.vigil-fly-heal { color: #5BE38A; font-size: 22px; }
.vigil-fly-shred { color: var(--half-cover, #6E9BB8); }
.vigil-fly-info { color: var(--accent, #3FD0E8); text-transform: uppercase; font-size: 14px; letter-spacing: .14em; }
`;

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

export class EventPlayer {
  /** options.getState: () => BattleState, used for pod lookups and hud bar refreshes. options.container: element for flyovers, default the canvas parent. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  constructor(renderer, cameraRig, hud = null, { getState = null, container = null, fog = null } = {}) {
    this.renderer = renderer;
    this.rig = cameraRig;
    this.hud = hud;
    this.getState = getState;
    this.fog = fog;
    this.onBattleEnded = null; // (outcome) => void, called after the BattleEnded beat; step 17 shows the overlay
    this.speed = 1;
    this.skipping = false;
    this.playing = false;

    this._active = new Set();  // running tweens
    this._queue = Promise.resolve();
    this._running = false;
    this._frame = 0;
    this._timer = 0;
    this._last = 0;
    this._flyCount = new Map(); // anchor key -> flyovers alive on it
    this._hp = new Map();       // unit id -> hit points as of the last damage or heal event played; empty when idle
    this._tiles = new Map();    // unit id -> tile it is drawn on while its steps play; empty when idle
    this._hpOf = (unit) => this.shownHp(unit);
    this._tileOf = (unit) => this.shownTile(unit);
    this._alive = (unit) => this.shownHp(unit) > 0;
    // Bound helpers for Hud.updateUnitBars, shared with main's per-frame call.
    this.shows = (unit) => this.fog?.shows(unit) ?? true;
    this.projectAnchor = (tile, unit = null) => this.projectTile(unit ? this.shownTile(unit) : tile);
    this._tmp = new THREE.Vector3();
    this._project = (unitId) => this.project(unitId);

    this._box = new THREE.BoxGeometry(1, 1, 1);
    this._cylinder = new THREE.CylinderGeometry(1, 1, 1, 6);
    this._sphere = new THREE.SphereGeometry(1, 16, 12);

    this._injectStyle();
    const parent = container ?? renderer.canvas.parentElement ?? document.body;
    this.layer = document.createElement('div');
    this.layer.className = 'vigil-fly-layer';
    this.layer.setAttribute('aria-hidden', 'true');
    parent.appendChild(this.layer);

    this._handlers = {
      [EVENT.UnitStepped]: (e) => this._onUnitStepped(e),
      [EVENT.ApSpent]: (e) => this._onApSpent(e),
      [EVENT.ShotResolved]: (e) => this._onShotResolved(e),
      [EVENT.UnitDamaged]: (e) => this._onUnitDamaged(e),
      [EVENT.UnitHealed]: (e) => this._onUnitHealed(e),
      [EVENT.UnitKilled]: (e) => this._onUnitKilled(e),
      [EVENT.ArmorShredded]: (e) => this._onArmorShredded(e),
      [EVENT.StatusApplied]: (e) => this._onStatusApplied(e),
      [EVENT.StatusExpired]: (e) => this._onStatusExpired(e),
      [EVENT.CoverDamaged]: (e) => this._onCoverDamaged(e),
      [EVENT.CoverDestroyed]: (e) => this._onCoverDestroyed(e),
      [EVENT.Explosion]: (e) => this._onExplosion(e),
      [EVENT.OverwatchSet]: (e) => this._onOverwatchSet(e),
      [EVENT.OverwatchTriggered]: (e) => this._onOverwatchTriggered(e),
      [EVENT.ConcealmentBroken]: (e) => this._onConcealmentBroken(e),
      [EVENT.PodRevealed]: (e) => this._onPodRevealed(e),
      [EVENT.ScamperStarted]: (e) => this._onScamperStarted(e),
      [EVENT.TurnStarted]: (e) => this._onTurnStarted(e),
      [EVENT.BattleEnded]: (e) => this._onBattleEnded(e),
    };
  }

  /** Plays events in order. Calls queue, so overlapping play() calls never interleave. Resolves when the last one is done. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  play(events) {
    const run = async () => {
      this.playing = true;
      this._holdHp(events);
      this._holdTiles(events);
      try {
        for (const event of events) {
          const handler = this._handlers[event.type];
          if (!handler) {
            console.warn('EventPlayer: unknown event type', event.type, event);
            continue;
          }
          try {
            await handler(event);
          } catch (error) {
            console.error('EventPlayer: handler failed for', event.type, error);
          }
        }
      } finally {
        this._hp.clear();
        this._tiles.clear();
        this._refreshFog();
        this._refreshBars();
        this.playing = false;
        this.skipping = false;
      }
    };
    const result = this._queue.then(run);
    this._queue = result;
    return result;
  }

  /** 1 normal, 3 fast (enemy turns). Applies to tweens already running. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  setSpeed(multiplier) {
    this.speed = Math.max(0.1, Number(multiplier) || 1);
  }

  /** Space: finishes the running tweens and plays the rest of the current play() batch instantly. No effect while idle. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  skip() {
    if (!this.playing) return;
    this.skipping = true;
    for (const tween of [...this._active]) this._finish(tween);
  }

  /** Screen position (px, relative to the canvas) above a unit's head, or null when off screen or unknown. For hud unit bars. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  project(unitId) {
    const object = this.renderer.unitObject(unitId);
    if (!object) return null;
    return this._toScreen(this._head(object, this._tmp));
  }

  /** Hit points to draw for a unit: the value as of the last played damage or heal event, else the state's. @created Claude (claude-opus-5-5) - 2026-10-22 */
  shownHp(unit) {
    return this._hp.get(unit.id) ?? unit.hp;
  }

  /** Tile to draw a unit on: where its steps have reached during playback, else the state's. @created Claude (claude-opus-5-5) - 2026-10-22 */
  shownTile(unit) {
    return this._tiles.get(unit.id) ?? unit.tile;
  }

  /** Screen position (px, relative to the canvas) above a tile, or null when off screen. For the barrel hit badge. @created Claude (claude-opus-5-5) - 2026-10-22 */
  projectTile(tile) {
    const p = this.renderer.tileCenter(tile, this._tmp);
    p.y += HEAD * 0.6;
    return this._toScreen(p);
  }

  /** Removes the flyover layer and frees shared geometry. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  dispose() {
    this.skipping = true;
    for (const tween of [...this._active]) this._finish(tween);
    this.layer.remove();
    this._box.dispose();
    this._cylinder.dispose();
    this._sphere.dispose();
  }

  // ---- Handlers ----

  // Steps no soldier can see at either end snap into place with no camera focus, so unseen patrols cost no time.
  // A seen alien step shows the alien for the whole hop, so one walking into view is drawn from its first tile; the fog
  // refresh after the step hides it again when it walked out of sight.
  /**
   * @created Claude (claude-sonnet-5-5) - 2026-10-21
   * @modified Claude (claude-opus-5-5) - 2026-10-22 - unseen steps snap, fog
   */
  async _onUnitStepped({ unitId, from, to }) {
    const object = this.renderer.unitObject(unitId);
    if (!object) return;
    const a = this.renderer.tileCenter(from);
    const b = this.renderer.tileCenter(to);
    if (this._unseenStep(unitId, from, to)) {
      object.position.copy(b);
      this._tiles.set(unitId, to);
      this._refreshFog();
      return;
    }
    if (this.fog && this.getState?.()?.units[unitId]?.team !== 'xcom') this.renderer.setUnitShown(unitId, true);
    this._focus(b);
    await this._tween(STEP_TIME, (t) => {
      object.position.lerpVectors(a, b, t);
      object.position.y += Math.sin(Math.PI * t) * HOP;
    });
    object.position.copy(b);
    this._tiles.set(unitId, to);
    this._refreshFog();
  }

  /** Squad chevrons live in the hud bars, so an AP change just refreshes them. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  async _onApSpent() {
    this._refreshBars();
  }

  // A shooter the fog hides gets no camera focus or tracer, so the shot never gives its position away.
  /**
   * @created Claude (claude-sonnet-5-5) - 2026-10-21
   * @modified Claude (claude-opus-5-5) - 2026-10-22 - hidden shooters
   */
  async _onShotResolved({ attackerId, targetId, result }) {
    const attacker = this.renderer.unitObject(attackerId);
    const target = this.renderer.unitObject(targetId);
    if (attacker && target && !attacker.visible) {
      this._focus(target.position);
      await this._wait(FOCUS_SETTLE);
    } else if (attacker && target) {
      this._focus(attacker.position.clone().lerp(target.position, 0.5));
      await this._wait(FOCUS_SETTLE);
      const from = attacker.position.clone();
      const to = target.position.clone();
      from.y += MUZZLE;
      to.y += MUZZLE;
      if (result === 'miss') {
        // A miss flies wide of the target, past it.
        const side = new THREE.Vector3(to.z - from.z, 0, from.x - to.x).normalize().multiplyScalar(0.55 * (Math.random() < 0.5 ? 1 : -1));
        to.add(side);
      }
      await this._tracer(from, to);
    }
    if (result === 'crit') this._flyUnit(targetId, 'Critical', 'crit');
    else if (result === 'graze') this._flyUnit(targetId, 'Graze', 'graze');
    else if (result === 'miss') {
      this._flyUnit(targetId, 'Miss', 'miss');
      await this._wait(0.35);
    }
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  async _onUnitDamaged({ unitId, amount, armorAbsorbed = 0, hp }) {
    const object = this.renderer.unitObject(unitId);
    this._hp.set(unitId, hp);
    const text = amount > 0 ? `-${amount}` : 'Blocked';
    this._flyUnit(unitId, armorAbsorbed > 0 ? `${text} (${armorAbsorbed} armor)` : text, 'dmg');
    this._refreshBars();
    if (object) await this._shake(object, 0.12, SHAKE_TIME);
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  async _onUnitHealed({ unitId, amount, hp }) {
    this._hp.set(unitId, hp);
    this._flyUnit(unitId, `+${amount}`, 'heal');
    this._refreshBars();
    await this._wait(0.2);
  }

  // Materials are shared per team, so the fade runs on clones that are swapped back before the unit is hidden.
  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  async _onUnitKilled({ unitId }) {
    const object = this.renderer.unitObject(unitId);
    if (!object) return;
    const baseY = object.position.y;
    const originals = [];
    object.traverse((o) => {
      if (!o.isMesh) return;
      originals.push([o, o.material]);
      o.material = o.material.clone();
      o.material.transparent = true;
    });
    try {
      await this._tween(DEATH_TIME, (t) => {
        for (const [mesh] of originals) mesh.material.opacity = 1 - t;
        object.position.y = baseY - 0.3 * t;
      });
    } finally {
      for (const [mesh, material] of originals) {
        mesh.material.dispose();
        mesh.material = material;
      }
      object.position.y = baseY;
      object.visible = false;
      this._hp.set(unitId, 0);
      this._refreshFog();
      this._refreshBars();
    }
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  async _onArmorShredded({ unitId, amount }) {
    this._flyUnit(unitId, `Armor -${amount}`, 'shred');
    this._refreshBars();
    await this._wait(0.2);
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  async _onStatusApplied({ unitId, status }) {
    this._flyUnit(unitId, status.charAt(0).toUpperCase() + status.slice(1), 'info');
    this._refreshBars();
    await this._wait(0.15);
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  async _onStatusExpired() {
    this._refreshBars();
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  async _onCoverDamaged({ tile }) {
    const prop = this.renderer.propObjects.get(tile);
    const center = this.renderer.tileCenter(tile);
    center.y += 0.4;
    const dust = this._burst(center, this.renderer.colors.halfCover, { count: 6, speed: 1.4, size: 0.08, seconds: 0.35 });
    if (prop) await this._shake(prop, 0.05, 0.18);
    await dust;
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  async _onCoverDestroyed({ tile, rubbleKind = null }) {
    const center = this.renderer.tileCenter(tile);
    center.y += 0.4;
    const debris = this._burst(center, this.renderer.colors.halfCover, { count: 14, speed: 2.4, size: 0.13, seconds: 0.55 });
    await this._wait(0.1);
    this.renderer.removeProp(tile, rubbleKind);
    await debris;
  }

  // center is a tile index; the flash spans the blast radius in tiles.
  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  async _onExplosion({ center, radius = 1 }) {
    if (!Number.isInteger(center)) return;
    const origin = this.renderer.tileCenter(center);
    origin.y += 0.5;
    this._focus(origin);
    await this._wait(FOCUS_SETTLE);
    const burst = this._burst(origin, this.renderer.colors.crit, { count: 22, speed: 4, size: 0.16, seconds: 0.6 });
    await Promise.all([this._flash(origin, radius + 0.5, 0.45), burst]);
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  async _onOverwatchSet({ unitId }) {
    this._flyUnit(unitId, 'Overwatch', 'info');
    await this._wait(0.25);
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  async _onOverwatchTriggered({ unitId }) {
    const object = this.renderer.unitObject(unitId);
    if (object?.visible) this._focus(object.position);
    this._flyUnit(unitId, 'Overwatch', 'crit');
    await this._wait(0.4);
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  async _onConcealmentBroken({ byUnitId }) {
    this.hud?.showConcealed?.(false);
    this.hud?.showMessage?.('Concealment broken');
    this.renderer.showDetection({ squadConcealed: false }); // clears the red detection tiles
    const object = this.renderer.unitObject(byUnitId);
    if (object) this._focus(object.position);
    this._flyUnit(byUnitId, 'Concealment broken', 'info');
    await this._wait(0.5);
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  async _onPodRevealed({ podId, byUnitId }) {
    const members = this._podUnits(podId);
    const focus = this._centroid(members) ?? this.renderer.unitObject(byUnitId)?.position;
    if (focus) this._focus(focus);
    for (const id of members) this._flyUnit(id, '!', 'crit');
    await this._wait(0.7);
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  async _onScamperStarted({ podId }) {
    const members = this._podUnits(podId);
    const focus = this._centroid(members);
    if (focus) this._focus(focus);
    for (const id of members) this._flyUnit(id, 'Scamper', 'info');
    await this._wait(0.4);
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  async _onTurnStarted({ side, turn }) {
    // Deploy is the only TurnStarted that begins a concealed squad; later breaks arrive as ConcealmentBroken.
    if (turn === 1 && side === 'xcom') this.hud?.showConcealed?.(true);
    this.hud?.showTurn?.(side, turn);
    this._refreshBars();
    await this._wait(0.7);
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  async _onBattleEnded({ outcome }) {
    await this._wait(0.6);
    this.onBattleEnded?.(outcome);
  }

  // ---- Effects ----

  // Moves a short bright segment from one point to another.
  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  async _tracer(from, to) {
    if (this.skipping) return;
    const dir = to.clone().sub(from);
    const distance = dir.length();
    if (distance === 0) return;
    dir.normalize();
    const material = new THREE.MeshBasicMaterial({ color: this.renderer.colors.crit, transparent: true, depthTest: false });
    const mesh = new THREE.Mesh(this._cylinder, material);
    mesh.scale.set(0.035, TRACER_LENGTH, 0.035);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    mesh.renderOrder = 4;
    this.renderer.scene.add(mesh);
    try {
      await this._tween(TRACER_TIME, (t) => {
        mesh.position.copy(from).addScaledVector(dir, -TRACER_LENGTH / 2 + t * (distance + TRACER_LENGTH));
      });
    } finally {
      this.renderer.scene.remove(mesh);
      material.dispose();
    }
  }

  // Expanding, fading sphere.
  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  async _flash(center, radius, seconds) {
    if (this.skipping) return;
    const material = new THREE.MeshBasicMaterial({ color: this.renderer.colors.crit, transparent: true, opacity: 0.85, depthWrite: false });
    const mesh = new THREE.Mesh(this._sphere, material);
    mesh.position.copy(center);
    mesh.renderOrder = 4;
    this.renderer.scene.add(mesh);
    try {
      await this._tween(seconds, (t) => {
        mesh.scale.setScalar(Math.max(0.01, radius * easeOut(t)));
        material.opacity = 0.85 * (1 - t);
      });
    } finally {
      this.renderer.scene.remove(mesh);
      material.dispose();
    }
  }

  // Small cubes thrown up and out under gravity. Positions are a function of elapsed game time, so speed changes stay smooth.
  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  async _burst(center, color, { count = 12, speed = 2.5, size = 0.1, seconds = 0.5, gravity = 7 } = {}) {
    if (this.skipping) return;
    const material = new THREE.MeshBasicMaterial({ color, transparent: true });
    const group = new THREE.Group();
    group.position.copy(center);
    const bits = [];
    for (let k = 0; k < count; k++) {
      const mesh = new THREE.Mesh(this._box, material);
      mesh.scale.setScalar(size * (0.6 + Math.random() * 0.8));
      const velocity = new THREE.Vector3(Math.random() - 0.5, 0.5 + Math.random(), Math.random() - 0.5)
        .normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.6));
      group.add(mesh);
      bits.push({ mesh, velocity });
    }
    this.renderer.scene.add(group);
    try {
      await this._tween(seconds, (t) => {
        const tau = t * seconds;
        for (const { mesh, velocity } of bits) {
          mesh.position.set(velocity.x * tau, velocity.y * tau - 0.5 * gravity * tau * tau, velocity.z * tau);
        }
        material.opacity = 1 - t * t;
      });
    } finally {
      this.renderer.scene.remove(group);
      material.dispose();
    }
  }

  // Quick decaying horizontal jitter around the object's starting position.
  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  async _shake(object, amplitude, seconds) {
    const base = object.position.clone();
    try {
      await this._tween(seconds, (t) => {
        object.position.x = base.x + Math.sin(t * 45) * amplitude * (1 - t);
      });
    } finally {
      object.position.copy(base);
    }
  }

  // Floating DOM text anchored above a unit. Fire and forget; it joins the tween set, so skip() clears it. Not created while skipping.
  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _flyUnit(unitId, text, kind = 'info') {
    const object = this.renderer.unitObject(unitId);
    if (!object || !object.visible || this.skipping) return;
    const element = document.createElement('div');
    element.className = `vigil-fly vigil-fly-${kind}`;
    element.textContent = text;
    this.layer.appendChild(element);
    const slot = this._flyCount.get(unitId) ?? 0;
    this._flyCount.set(unitId, slot + 1);
    const anchor = new THREE.Vector3();
    this._tween(FLY_TIME, (t) => {
      if (t >= 1) {
        element.remove();
        this._flyCount.set(unitId, Math.max(0, (this._flyCount.get(unitId) ?? 1) - 1));
        return;
      }
      const p = this._toScreen(this._head(object, anchor));
      if (!p) {
        element.style.opacity = '0';
        return;
      }
      const rise = FLY_RISE * easeOut(t) + slot * FLY_STACK;
      element.style.transform = `translate(${p.x.toFixed(1)}px, ${(p.y - rise).toFixed(1)}px) translate(-50%, -100%)`;
      element.style.opacity = t < 0.7 ? '1' : String(1 - (t - 0.7) / 0.3);
    });
  }

  // ---- Helpers ----

  /** Eases the camera onto a world position; jumps there while skipping. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _focus(worldPos) {
    this.rig.focusTile(worldPos.clone(), { animate: !this.skipping });
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _head(object, out) {
    out.copy(object.position);
    out.y += HEAD;
    return out;
  }

  /** World position to canvas pixels, or null behind the camera. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _toScreen(world) {
    const camera = this.renderer.camera;
    camera.updateMatrixWorld();
    const v = world.clone().project(camera);
    if (v.z > 1) return null;
    const canvas = this.renderer.canvas;
    return { x: (v.x * 0.5 + 0.5) * canvas.clientWidth, y: (-v.y * 0.5 + 0.5) * canvas.clientHeight };
  }

  /** Ids of a pod's living members, from the state when available. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _podUnits(podId) {
    const state = this.getState?.();
    const pod = state?.pods?.find((p) => p.id === podId);
    if (!pod) return [];
    return pod.unitIds.filter((id) => this.renderer.unitObject(id)?.visible);
  }

  /** Average world position of the given units' objects, or null. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _centroid(unitIds) {
    const objects = unitIds.map((id) => this.renderer.unitObject(id)).filter(Boolean);
    if (objects.length === 0) return null;
    const sum = new THREE.Vector3();
    for (const o of objects) sum.add(o.position);
    return sum.divideScalar(objects.length);
  }

  // The state is final before playback starts, so each unit's HP before the batch is read back from its first damage or heal event.
  /** @created Claude (claude-opus-5-5) - 2026-10-22 */
  _holdHp(events) {
    for (const e of events) {
      if (this._hp.has(e.unitId)) continue;
      if (e.type === EVENT.UnitDamaged) this._hp.set(e.unitId, e.hp + e.amount);
      else if (e.type === EVENT.UnitHealed) this._hp.set(e.unitId, e.hp - e.amount);
    }
  }

  // The state is final before playback starts, so each mover's tile before the batch is its first UnitStepped.from.
  /** @created Claude (claude-opus-5-5) - 2026-10-22 */
  _holdTiles(events) {
    for (const e of events) {
      if (e.type === EVENT.UnitStepped && !this._tiles.has(e.unitId)) this._tiles.set(e.unitId, e.from);
    }
  }

  /** @created Claude (claude-opus-5-5) - 2026-10-22 */
  _refreshFog() {
    const state = this.getState?.();
    if (this.fog && state) this.fog.refresh(state, this._tileOf, this._alive);
  }

  // True for an alien step that no living soldier sees at its start or end tile. Soldiers look from their drawn tiles with
  // their drawn HP, the same view the fog uses.
  /**
   * @created Claude (claude-opus-5-5) - 2026-10-22
   * @modified Claude (claude-opus-5-5) - 2026-10-22 - drawn soldier tiles
   */
  _unseenStep(unitId, from, to) {
    const state = this.getState?.();
    const unit = state?.units[unitId];
    if (!unit || unit.team === 'xcom') return false;
    const soldiers = Object.values(state.units).filter((s) => s.team === 'xcom' && this.shownHp(s) > 0);
    return !soldiers.some((s) => {
      const fromTile = this.shownTile(s);
      return canSee(state, s, unit, { fromTile, targetTile: from }) || canSee(state, s, unit, { fromTile, targetTile: to });
    });
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _refreshBars() {
    const state = this.getState?.();
    if (this.hud && state) this.hud.updateUnitBars?.(state, this._project, this._hpOf, this.shows, this.projectAnchor);
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  // ---- Tween loop ----

  /** update(t) runs each frame with t in 0..1 and always once with exactly 1. Resolves at 1. Instant while skipping. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _tween(seconds, update) {
    return new Promise((resolve) => {
      if (this.skipping || seconds <= 0) {
        update(1);
        resolve();
        return;
      }
      this._active.add({ seconds, t: 0, update, resolve });
      this._start();
    });
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _wait(seconds) {
    return this._tween(seconds, () => {});
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _finish(tween) {
    if (!this._active.delete(tween)) return;
    tween.update(1);
    tween.resolve();
  }

  // requestAnimationFrame pauses in hidden tabs, so a timer backs it up; progress uses real elapsed time either way.
  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _start() {
    if (this._running) return;
    this._running = true;
    this._last = performance.now();
    this._schedule();
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _schedule() {
    this._frame = requestAnimationFrame(() => this._tick());
    this._timer = setTimeout(() => this._tick(), 120);
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _tick() {
    cancelAnimationFrame(this._frame);
    clearTimeout(this._timer);
    const now = performance.now();
    const dt = Math.min((now - this._last) / 1000, 0.25);
    this._last = now;
    for (const tween of [...this._active]) {
      if (!this._active.has(tween)) continue; // finished by an earlier update this tick
      tween.t += (dt * this.speed) / tween.seconds;
      if (tween.t >= 1) this._finish(tween);
      else tween.update(tween.t);
    }
    if (this._active.size > 0) this._schedule();
    else this._running = false;
  }
}
