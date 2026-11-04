// Created by Claude (claude-opus-5-5)
// Date: 2026-10-22
// One unit's visible body (plan 0004): a skinned clone from AssetLibrary dressed in its look's gear and tints, an AnimationMixer
// and a facing yaw. View only; the sim never sees it. Clips: a looping base pose from statuses (idle, aim, crouch), a walk loop
// while stepping, and one one-shot slot (fire, hit, throw, death, ...) that returns to walk or base when it ends. Death clamps
// on its last frame and blocks every later clip. Models face +z at yaw 0.

import * as THREE from '../../vendor/three.module.min.js';
import { SOCKETS, MATERIAL_ROLES, clipName } from '../data/looks.js';

const FADE = 0.2;           // seconds to crossfade between clips
const ONE_SHOT_FADE = 0.08; // a one-shot starts almost at once so it lines up with its event
const FACE_TIME = 0.05;     // facing eases with this time constant (about 0.15 s to settle)
const CHEST = 0.7;          // world height muzzleWorld falls back to, above the unit's feet
const DRONE_BOB = 0.08;     // model units the Specialist's drone bobs
// Logical clips that may be missing for a look, and what plays instead.
const FALLBACK = { aim: 'idle', crouch: 'idle', hit: 'idle', throw: 'fire', cast: 'fire', pistol: 'fire', stab: 'melee' };

export class UnitModel {
  /**
   * assets: a loaded AssetLibrary. look: a UNIT_LOOKS entry. palette: renderer colors (THREE.Color by palette key).
   * @created Claude (claude-opus-5-5) - 2026-10-22
   */
  constructor(assets, look, palette) {
    this.look = look;
    this.root = new THREE.Group();
    this.rig = assets.cloneRig(look.model);
    this.rig.scale.setScalar(look.scale);
    this.root.add(this.rig);

    this._ownMaterials = [];
    this._trimMaterials = [];
    this.rig.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false; // skinned bounds stay at the bind pose, so a crouch or death could cull wrongly
      for (const material of [o.material].flat()) this._tint(material, palette);
    });

    this._muzzle = null;
    this._drone = null;
    for (const gear of look.gear) this._mount(assets, gear);

    this.mixer = new THREE.AnimationMixer(this.rig);
    this.mixer.addEventListener('finished', (e) => this._onFinished(e.action));
    this._assets = assets;
    this._actions = new Map(); // logical name -> AnimationAction
    this._current = null;      // the action fading in or playing at full weight
    this._base = 'idle';
    this._walking = false;
    this._oneShot = null;      // { action, resolve }
    this._dead = false;
    this._yaw = 0;
    this._targetYaw = 0;
    this._time = 0;
    this._fadeTo('idle', 0);
  }

  /** Roster slot colour onto the trim materials (the whole mannequin body). @created Claude (claude-opus-5-5) - 2026-10-22 */
  setTrim(color) {
    for (const material of this._trimMaterials) material.color.set(color);
  }

  /** Base pose from unit statuses: hunkered crouches, overwatch aims, else idle. Waits out a walk or one-shot. @created Claude (claude-opus-5-5) - 2026-10-22 */
  setBasePose(statuses) {
    const has = (id) => statuses.some((s) => s.id === id);
    const base = has('hunkered') ? 'crouch' : has('overwatch') ? 'aim' : 'idle';
    if (base === this._base) return;
    this._base = base;
    if (!this._dead && !this._walking && !this._oneShot) this._fadeTo(base);
  }

  /** Turns toward a world point on the xz plane; instant snaps, otherwise update eases. @created Claude (claude-opus-5-5) - 2026-10-22 */
  face(point, { instant = false } = {}) {
    const at = this.root.getWorldPosition(_tmp);
    const dx = point.x - at.x;
    const dz = point.z - at.z;
    if (dx * dx + dz * dz < 1e-6) return;
    this._targetYaw = Math.atan2(dx, dz);
    if (instant) this._snapFacing();
  }

  /** Loops the walk clip; repeat calls while walking do nothing. Ends any one-shot. @created Claude (claude-opus-5-5) - 2026-10-22 */
  walk() {
    if (this._dead || this._walking) return;
    this._walking = true;
    this._resolveOneShot();
    this._fadeTo('walk', 0.12);
  }

  /** Walk back to the base pose; no-op when not walking. @created Claude (claude-opus-5-5) - 2026-10-22 */
  settle() {
    if (!this._walking) return;
    this._walking = false;
    if (!this._dead && !this._oneShot) this._fadeTo(this._base);
  }

  /**
   * Plays a one-shot clip (fire, hit, throw, melee, death, ...). Resolves when it ends, is replaced, finished early or disposed.
   * Death clamps on its last frame and every later call resolves at once.
   * @created Claude (claude-opus-5-5) - 2026-10-22
   */
  play(name) {
    if (this._dead) return Promise.resolve();
    if (name === 'death') this._dead = true;
    this._resolveOneShot();
    this._walking = false;
    const action = this._fadeTo(name, ONE_SHOT_FADE, { once: true });
    return new Promise((resolve) => { this._oneShot = { action, resolve }; });
  }

  /** Skip: jumps a running one-shot to its end (death to its clamped last frame) and snaps facing. @created Claude (claude-opus-5-5) - 2026-10-22 */
  finish() {
    this._snapFacing();
    if (!this._oneShot) return;
    const { action } = this._oneShot;
    action.time = action.getClip().duration;
    this._onFinished(action, 0);
    this.mixer.update(0);
  }

  /** World position of the weapon's muzzle, else chest height over the unit. @created Claude (claude-opus-5-5) - 2026-10-22 */
  muzzleWorld(target = new THREE.Vector3()) {
    if (!this._muzzle) {
      this.root.getWorldPosition(target);
      target.y += CHEST;
      return target;
    }
    this.root.updateWorldMatrix(true, true);
    return this._muzzle.getWorldPosition(target);
  }

  /** Advances clips and the facing ease. @created Claude (claude-opus-5-5) - 2026-10-22 */
  update(dt) {
    this._time += dt;
    let diff = this._targetYaw - this._yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest way round
    this._yaw += diff * (1 - Math.exp(-dt / FACE_TIME));
    this.root.rotation.y = this._yaw;
    if (this._drone) this._drone.position.y = this._drone.userData.baseY + Math.sin(this._time * 3) * DRONE_BOB;
    this.mixer.update(dt);
  }

  /** Stops clips, resolves a pending one-shot and frees this unit's own materials. Geometry stays with the library. @created Claude (claude-opus-5-5) - 2026-10-22 */
  dispose() {
    this._resolveOneShot();
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.rig);
    for (const material of this._ownMaterials) material.dispose();
    this.root.removeFromParent();
  }

  // ---- internals ----

  // The library cloned every material with a tint role, so this unit owns those and may recolour them.
  /** @created Claude (claude-opus-5-5) - 2026-10-22 */
  _tint(material, palette) {
    const role = MATERIAL_ROLES[material.name];
    if (!role) return;
    this._ownMaterials.push(material);
    if (role === 'trim') this._trimMaterials.push(material);
    const color = palette[this.look.tints?.[role]];
    if (!color) return;
    material.color.copy(color);
    if (role === 'visor' && material.emissive) material.emissive.copy(color);
  }

  /** @created Claude (claude-opus-5-5) - 2026-10-22 */
  _mount(assets, gear) {
    const bone = this.rig.getObjectByName(SOCKETS[gear.socket]);
    if (!bone) throw new Error(`UnitModel: ${this.look.model} has no bone for socket ${gear.socket}`);
    const object = gear.asset ? assets.cloneGear(gear.asset) : buildCodeGear(gear.mesh);
    if (gear.offset) object.position.fromArray(gear.offset);
    if (gear.rotation) object.rotation.fromArray(gear.rotation);
    bone.add(object);
    if (gear.mesh === 'drone') {
      object.userData.baseY = object.position.y;
      this._drone = object;
    }
    if (gear.muzzle) this._muzzle = muzzleMarker(object);
  }

  /** The action for a logical clip, falling back when the look's asset clip is missing. @created Claude (claude-opus-5-5) - 2026-10-22 */
  _action(name) {
    if (!this._actions.has(name)) {
      const clip = this._assets.clip(clipName(this.look, name), this.look.model);
      if (clip) this._actions.set(name, this.mixer.clipAction(clip));
      else if (FALLBACK[name]) this._actions.set(name, this._action(FALLBACK[name]));
      else if (name !== 'idle') this._actions.set(name, this._action('idle'));
      else throw new Error(`UnitModel: ${this.look.model} has no idle clip`);
    }
    return this._actions.get(name);
  }

  /** Crossfades from the current action to a logical clip and returns its action. @created Claude (claude-opus-5-5) - 2026-10-22 */
  _fadeTo(name, duration = FADE, { once = false } = {}) {
    const action = this._action(name);
    action.reset();
    action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = once;
    action.setEffectiveWeight(1);
    if (this._current && this._current !== action && duration > 0) {
      this._current.fadeOut(duration);
      action.fadeIn(duration);
    } else if (this._current && this._current !== action) {
      this._current.stop();
    }
    action.play();
    this._current = action;
    return action;
  }

  /** A one-shot reached its end: resolve it and return to walk or base, unless it was death. @created Claude (claude-opus-5-5) - 2026-10-22 */
  _onFinished(action, fade = FADE) {
    if (!this._oneShot || this._oneShot.action !== action) return;
    this._resolveOneShot();
    if (this._dead) return;
    this._fadeTo(this._walking ? 'walk' : this._base, fade);
  }

  /** @created Claude (claude-opus-5-5) - 2026-10-22 */
  _resolveOneShot() {
    const pending = this._oneShot;
    this._oneShot = null;
    pending?.resolve();
  }

  /** @created Claude (claude-opus-5-5) - 2026-10-22 */
  _snapFacing() {
    this._yaw = this._targetYaw;
    this.root.rotation.y = this._yaw;
  }
}

const _tmp = new THREE.Vector3();

// A marker at the far end of the gear's longest axis on its positive side: the crossbow's front, the staff's tip, a gun's barrel.
/** @created Claude (claude-opus-5-5) - 2026-10-22 */
function muzzleMarker(gear) {
  const box = new THREE.Box3();
  gear.updateMatrixWorld(true);
  const toGear = gear.matrixWorld.clone().invert();
  gear.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld).applyMatrix4(toGear));
  });
  const size = box.getSize(new THREE.Vector3());
  const point = box.getCenter(new THREE.Vector3());
  const axis = size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z';
  point[axis] = box.max[axis];
  const marker = new THREE.Object3D();
  marker.position.copy(point);
  gear.add(marker);
  return marker;
}

// ---- code-built gear (CODE_GEAR in looks.js) ----
// In model units (the Rig_Medium character is about 2.2 tall before look.scale). Parts are laid out along +z, then guns are
// turned so the barrel runs along the hand slot's +x, which points at the target in the aim and fire clips. Geometry and
// materials are shared by every unit and live as long as the page.

let shared = null;

/** @created Claude (claude-opus-5-5) - 2026-10-22 */
function sharedParts() {
  shared ??= {
    dark: new THREE.MeshStandardMaterial({ color: 0x2b3138, roughness: 0.7, metalness: 0.2 }),
    mid: new THREE.MeshStandardMaterial({ color: 0x59636e, roughness: 0.7, metalness: 0.2 }),
    light: new THREE.MeshStandardMaterial({ color: 0xc8d2dc, roughness: 0.5 }),
    glow: new THREE.MeshStandardMaterial({ color: 0x3fd0e8, emissive: 0x3fd0e8, emissiveIntensity: 0.8 }),
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 10).rotateX(Math.PI / 2), // along z
    disc: new THREE.CylinderGeometry(1, 1, 1, 14),
  };
  return shared;
}

/** @created Claude (claude-opus-5-5) - 2026-10-22 */
function part(group, geometry, material, [x, y, z], [sx, sy, sz]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  group.add(mesh);
  return mesh;
}

/** Builds one CODE_GEAR piece. @created Claude (claude-opus-5-5) - 2026-10-22 */
function buildCodeGear(id) {
  const p = sharedParts();
  const g = new THREE.Group();
  switch (id) {
    case 'rifle':
      part(g, p.box, p.dark, [0, 0, 0.25], [0.1, 0.16, 0.9]);
      part(g, p.box, p.mid, [0, -0.15, 0.15], [0.08, 0.2, 0.12]);
      part(g, p.cyl, p.dark, [0, 0.02, 0.8], [0.035, 0.035, 0.3]);
      break;
    case 'shotgun':
      part(g, p.box, p.dark, [0, 0, 0.2], [0.12, 0.15, 0.75]);
      part(g, p.box, p.mid, [0, -0.1, 0.35], [0.14, 0.1, 0.25]);
      part(g, p.cyl, p.dark, [0, 0.02, 0.62], [0.05, 0.05, 0.2]);
      break;
    case 'sniper':
      part(g, p.box, p.dark, [0, 0, 0.1], [0.09, 0.15, 0.7]);
      part(g, p.cyl, p.dark, [0, 0.03, 0.85], [0.028, 0.028, 0.9]);
      part(g, p.cyl, p.light, [0, 0.14, 0.15], [0.045, 0.045, 0.3]);
      break;
    case 'cannon':
      part(g, p.cyl, p.dark, [0, 0, 0.35], [0.12, 0.12, 1.0]);
      part(g, p.box, p.mid, [0, -0.12, 0.0], [0.24, 0.22, 0.3]);
      break;
    case 'pistol':
      part(g, p.box, p.dark, [0, 0, 0.12], [0.08, 0.12, 0.35]);
      break;
    case 'sword':
      part(g, p.box, p.light, [0, 0.55, 0], [0.05, 1.0, 0.14]);
      part(g, p.box, p.dark, [0, 0, 0], [0.06, 0.12, 0.3]);
      break;
    case 'drone':
      part(g, p.box, p.dark, [0, 0, 0], [0.3, 0.1, 0.3]);
      for (const s of [-1, 1]) part(g, p.disc, p.mid, [s * 0.26, 0.04, 0], [0.14, 0.02, 0.14]);
      part(g, p.box, p.glow, [0, -0.02, 0.16], [0.08, 0.05, 0.02]);
      break;
    default:
      throw new Error(`UnitModel: no code gear "${id}"`);
  }
  if (!GUNS.has(id)) return g;
  const slot = new THREE.Group();
  g.rotation.y = Math.PI / 2; // +z onto the slot's +x
  slot.add(g);
  return slot;
}

const GUNS = new Set(['rifle', 'shotgun', 'sniper', 'cannon', 'pistol']);
