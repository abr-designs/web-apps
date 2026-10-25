// Created by Claude (claude-sonnet-5-5)
// Date: 2026-10-21
// Modified by Claude (claude-opus-5-5) - 2026-10-23
// Tactical camera: a pitched perspective camera orbiting a focus point. Yaw snaps in quarter turns, everything follows its target with SmoothDamp, so a moving target never makes the camera jump.
// World units: x east, z south, 1 unit per tile (see renderer.js). Yaw 0 puts the camera south of the focus looking north.
// Press and drag: one finger or the left mouse button pans, two fingers twist to rotate and pinch to zoom, the middle button
// rotates. A rotation snaps to the nearest quarter turn on release. A press that travels under DRAG_THRESHOLD stays a tap (click).

import * as THREE from '../../vendor/three.module.min.js';

const PITCH = THREE.MathUtils.degToRad(52);
const START_YAW = Math.PI / 4;
const START_DISTANCE = 18;
const MIN_DISTANCE = 6;
const MAX_DISTANCE = 36;
const WHEEL_SENSITIVITY = 0.0015; // distance scale per wheel delta unit (one notch is about 100)
const FOCUS_SMOOTH = 0.25;        // seconds SmoothDamp takes to roughly catch the focus target
const ORBIT_SMOOTH = 0.15;        // the same for yaw and zoom
const QUARTER = Math.PI / 2;
const DRAG_THRESHOLD = 8;         // px a press travels before it counts as a drag
const MOUSE_ROTATE_SPEED = 0.01;  // radians per px of middle-button drag

export class CameraRig {
  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.focus = new THREE.Vector3();
    this.focusTarget = new THREE.Vector3();
    this.yaw = START_YAW;
    this.yawTarget = START_YAW;
    this.distance = START_DISTANCE;
    this.distanceTarget = START_DISTANCE;
    this.focusVelocity = new THREE.Vector3();
    this.yawVelocity = 0;
    this.distanceVelocity = 0;
    this.bounds = null; // { width, depth } in tiles; the focus stays inside

    this._onWheel = (e) => {
      e.preventDefault();
      this.zoom(e.deltaY);
    };
    domElement.addEventListener('wheel', this._onWheel, { passive: false });

    this.pointers = new Map(); // pointerId -> { x, y } for every press on the canvas
    this.dragged = false;      // the current (or last) press became a drag; InputController drops its click
    this._press = null;        // { x, y } where the first pointer went down
    this._last = null;         // gesture reading at the previous move: { x, y, angle, spread }
    this._rotating = false;    // middle-button drag
    this._twisted = false;     // yaw moved during this gesture, so release snaps it
    this._onPointerDown = (e) => this._pointerDown(e);
    this._onPointerMove = (e) => this._pointerMove(e);
    this._onPointerUp = (e) => this._pointerUp(e);
    domElement.addEventListener('pointerdown', this._onPointerDown);
    domElement.addEventListener('pointermove', this._onPointerMove);
    domElement.addEventListener('pointerup', this._onPointerUp);
    domElement.addEventListener('pointercancel', this._onPointerUp);
    this._apply();
  }

  /** Keeps the focus point inside a width x depth tile grid. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  setBounds(width, depth) {
    this.bounds = { width, depth };
    this._clampTarget();
  }

  /** worldPos is a THREE.Vector3, typically Renderer.tileCenter(tile). @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  focusTile(worldPos, { animate = true } = {}) {
    this.focusTarget.copy(worldPos);
    this._clampTarget();
    if (!animate) {
      this.focus.copy(this.focusTarget);
      this.focusVelocity.set(0, 0, 0);
      this._apply();
    }
  }

  /** direction -1 turns left (Q), +1 turns right (E). @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  rotateQuarter(direction) {
    this.yawTarget += Math.sign(direction) * QUARTER;
  }

  /** dx is screen-right and dz is screen-down, in tiles, relative to the camera's final yaw. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  pan(dx, dz) {
    const sin = Math.sin(this.yawTarget);
    const cos = Math.cos(this.yawTarget);
    this.focusTarget.x += cos * dx + sin * dz;
    this.focusTarget.z += -sin * dx + cos * dz;
    this._clampTarget();
  }

  /** delta is a wheel deltaY: positive zooms out. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  zoom(delta) {
    this.distanceTarget = THREE.MathUtils.clamp(this.distanceTarget * Math.exp(delta * WHEEL_SENSITIVITY), MIN_DISTANCE, MAX_DISTANCE);
  }

  /** True while a press on the canvas is dragging the camera. @created Claude (claude-opus-5-5) - 2026-10-23 */
  get dragging() {
    return this.dragged && this.pointers.size > 0;
  }

  /** Moves the view so the ground under the pointer follows it by (dx, dy) screen px, without easing. @created Claude (claude-opus-5-5) - 2026-10-23 */
  dragPixels(dx, dy) {
    const height = this.domElement.clientHeight;
    if (height === 0) return;
    const perPx = 2 * this.distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) / height;
    this.pan(-dx * perPx, -dy * perPx / Math.sin(PITCH));
    this.focus.copy(this.focusTarget);
    this.focusVelocity.set(0, 0, 0);
    this._apply();
  }

  /** Turns the camera by radians without easing; snapYaw settles it on a quarter turn. @created Claude (claude-opus-5-5) - 2026-10-23 */
  twist(radians) {
    this.yaw += radians;
    this.yawTarget = this.yaw;
    this.yawVelocity = 0;
    this._twisted = true;
    this._apply();
  }

  /** Eases yaw to the nearest of the four quarter-turn views. @created Claude (claude-opus-5-5) - 2026-10-23 */
  snapYaw() {
    this.yawTarget = START_YAW + Math.round((this.yaw - START_YAW) / QUARTER) * QUARTER;
  }

  /** Pinch: scale > 1 brings the camera closer, without easing. @created Claude (claude-opus-5-5) - 2026-10-23 */
  pinch(scale) {
    this.distance = THREE.MathUtils.clamp(this.distance / scale, MIN_DISTANCE, MAX_DISTANCE);
    this.distanceTarget = this.distance;
    this.distanceVelocity = 0;
    this._apply();
  }

  /**
   * Call every frame with the elapsed seconds.
   * @created Claude (claude-sonnet-5-5) - 2026-10-21
   * @modified Claude (claude-opus-5-5) - 2026-10-23 - SmoothDamp in place of exponential easing
   */
  update(dt) {
    dt = Math.min(dt, 0.1);
    if (dt <= 0) return;
    const v = this.focusVelocity;
    [this.focus.x, v.x] = smoothDamp(this.focus.x, this.focusTarget.x, v.x, FOCUS_SMOOTH, dt);
    [this.focus.y, v.y] = smoothDamp(this.focus.y, this.focusTarget.y, v.y, FOCUS_SMOOTH, dt);
    [this.focus.z, v.z] = smoothDamp(this.focus.z, this.focusTarget.z, v.z, FOCUS_SMOOTH, dt);
    [this.yaw, this.yawVelocity] = smoothDamp(this.yaw, this.yawTarget, this.yawVelocity, ORBIT_SMOOTH, dt);
    [this.distance, this.distanceVelocity] = smoothDamp(this.distance, this.distanceTarget, this.distanceVelocity, ORBIT_SMOOTH, dt);
    this._apply();
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  dispose() {
    this.domElement.removeEventListener('wheel', this._onWheel);
    this.domElement.removeEventListener('pointerdown', this._onPointerDown);
    this.domElement.removeEventListener('pointermove', this._onPointerMove);
    this.domElement.removeEventListener('pointerup', this._onPointerUp);
    this.domElement.removeEventListener('pointercancel', this._onPointerUp);
  }

  // Right-click stays InputController's Escape, so only the left and middle buttons start a drag.
  /** @created Claude (claude-opus-5-5) - 2026-10-23 */
  _pointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
    if (e.button === 1) e.preventDefault(); // no autoscroll
    this.domElement.setPointerCapture?.(e.pointerId);
    if (this.pointers.size === 0) {
      this.dragged = false;
      this._twisted = false;
      this._press = { x: e.clientX, y: e.clientY };
      this._rotating = e.button === 1;
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size > 1) this.dragged = true;
    this._last = this._reading();
  }

  /** @created Claude (claude-opus-5-5) - 2026-10-23 */
  _pointerMove(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (!this.dragged) {
      if (Math.hypot(e.clientX - this._press.x, e.clientY - this._press.y) < DRAG_THRESHOLD) return;
      this.dragged = true;
    }
    const now = this._reading();
    const last = this._last;
    this._last = now;
    if (this._rotating) {
      this.twist((now.x - last.x) * MOUSE_ROTATE_SPEED);
      return;
    }
    this.dragPixels(now.x - last.x, now.y - last.y);
    if (this.pointers.size < 2) return;
    // Screen y points down, so a clockwise twist grows the angle and turns the map clockwise with the fingers.
    const turn = Math.atan2(Math.sin(now.angle - last.angle), Math.cos(now.angle - last.angle));
    if (turn !== 0) this.twist(turn);
    if (last.spread > 0 && now.spread > 0) this.pinch(now.spread / last.spread);
  }

  /** @created Claude (claude-opus-5-5) - 2026-10-23 */
  _pointerUp(e) {
    if (!this.pointers.delete(e.pointerId)) return;
    if (this.pointers.size > 0) {
      this._last = this._reading(); // the remaining finger carries on panning from where it is
      return;
    }
    if (this._twisted) this.snapYaw();
    this._rotating = false;
  }

  // Centroid of the pressed pointers, plus the angle and distance between the first two.
  /** @created Claude (claude-opus-5-5) - 2026-10-23 */
  _reading() {
    const pts = [...this.pointers.values()];
    const x = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
    const y = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
    if (pts.length < 2) return { x, y, angle: 0, spread: 0 };
    const [a, b] = pts;
    return { x, y, angle: Math.atan2(b.y - a.y, b.x - a.x), spread: Math.hypot(b.x - a.x, b.y - a.y) };
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _clampTarget() {
    if (!this.bounds) return;
    this.focusTarget.x = THREE.MathUtils.clamp(this.focusTarget.x, 0, this.bounds.width);
    this.focusTarget.z = THREE.MathUtils.clamp(this.focusTarget.z, 0, this.bounds.depth);
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _apply() {
    const flat = Math.cos(PITCH) * this.distance;
    this.camera.position.set(
      this.focus.x + Math.sin(this.yaw) * flat,
      this.focus.y + Math.sin(PITCH) * this.distance,
      this.focus.z + Math.cos(this.yaw) * flat,
    );
    this.camera.lookAt(this.focus);
  }
}

/**
 * Critically damped spring toward target (Unity's SmoothDamp). Velocity carries across calls, so a target that moves every frame is followed without jumps. Returns [value, velocity].
 * @created Claude (claude-opus-5-5) - 2026-10-23
 */
export function smoothDamp(current, target, velocity, smoothTime, dt) {
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity + omega * change) * dt;
  let next = target + (change + temp) * decay;
  velocity = (velocity - omega * temp) * decay;
  // Land on the target and stop once a step would pass it.
  if (target - current > 0 === next > target) {
    next = target;
    velocity = 0;
  }
  return [next, velocity];
}
