// Created by Claude (claude-sonnet-5-5)
// Date: 2026-10-21
// Tactical camera: a pitched perspective camera orbiting a focus point. Yaw snaps in quarter turns, everything eases toward its target.
// World units: x east, z south, 1 unit per tile (see renderer.js). Yaw 0 puts the camera south of the focus looking north.

import * as THREE from '../../vendor/three.module.min.js';

const PITCH = THREE.MathUtils.degToRad(52);
const START_YAW = Math.PI / 4;
const START_DISTANCE = 18;
const MIN_DISTANCE = 6;
const MAX_DISTANCE = 36;
const WHEEL_SENSITIVITY = 0.0015; // distance scale per wheel delta unit (one notch is about 100)
const DAMPING = 10;               // higher eases faster

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
    this.bounds = null; // { width, depth } in tiles; the focus stays inside

    this._onWheel = (e) => {
      e.preventDefault();
      this.zoom(e.deltaY);
    };
    domElement.addEventListener('wheel', this._onWheel, { passive: false });
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
      this._apply();
    }
  }

  /** direction -1 turns left (Q), +1 turns right (E). @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  rotateQuarter(direction) {
    this.yawTarget += Math.sign(direction) * Math.PI / 2;
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

  /** Call every frame with the elapsed seconds. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  update(dt) {
    const k = 1 - Math.exp(-DAMPING * Math.min(dt, 0.1));
    this.yaw += (this.yawTarget - this.yaw) * k;
    this.distance += (this.distanceTarget - this.distance) * k;
    this.focus.lerp(this.focusTarget, k);
    this._apply();
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  dispose() {
    this.domElement.removeEventListener('wheel', this._onWheel);
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
