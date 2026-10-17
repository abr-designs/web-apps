// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Over-the-shoulder orbit camera. Aiming eases in close over the right shoulder and narrows the lens.

import * as THREE from 'three';
import { heightAt } from '../world/islandShape.js';

const SENSITIVITY = 0.0022;
const PITCH_MIN = -0.6;
const PITCH_MAX = 0.9;
const BASE_FOV = 60;
const AIM_TIME = 0.25;
const ZOOM_STEP = 1.15;
const ZOOM_MAX = 4;

const EXPLORE = { dist: 6, height: 1.6, shoulder: 0.6 };
const AIM = { dist: 2, height: 1.75, shoulder: 0.95 };

/**
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.Object3D[]} colliders  Meshes the camera must not pass through; may grow later.
 */
export function createCameraRig(camera, colliders) {
  const ray = new THREE.Raycaster();
  const target = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const right = new THREE.Vector3();
  const dir = new THREE.Vector3();
  let blend = 0;

  const rig = {
    yaw: 0,
    pitch: 0.25,
    zoom: 1,
    update(dt, player, input, state) {
      const aiming = state === 'aim';
      if (state === 'explore' || state === 'aim') {
        const { dx, dy } = input.lookDelta();
        const slowLook = aiming ? 1 / rig.zoom : 1;
        rig.yaw -= dx * SENSITIVITY * slowLook;
        rig.pitch = THREE.MathUtils.clamp(rig.pitch + dy * SENSITIVITY * slowLook, PITCH_MIN, PITCH_MAX);
        const notches = input.consumeWheel();
        if (aiming && notches) rig.zoom = THREE.MathUtils.clamp(rig.zoom * ZOOM_STEP ** -notches, 1, ZOOM_MAX);
      }
      if (!aiming) rig.zoom = 1;

      blend = THREE.MathUtils.clamp(blend + (aiming ? dt : -dt) / AIM_TIME, 0, 1);
      const k = blend * blend * (3 - 2 * blend);
      const dist = THREE.MathUtils.lerp(EXPLORE.dist, AIM.dist, k);
      const height = THREE.MathUtils.lerp(EXPLORE.height, AIM.height, k);
      const shoulder = THREE.MathUtils.lerp(EXPLORE.shoulder, AIM.shoulder, k);

      right.set(Math.cos(rig.yaw), 0, -Math.sin(rig.yaw));
      target.copy(player.position).addScaledVector(right, shoulder).y += height;
      offset.set(
        Math.sin(rig.yaw) * Math.cos(rig.pitch),
        Math.sin(rig.pitch),
        Math.cos(rig.yaw) * Math.cos(rig.pitch),
      );

      let d = dist;
      ray.set(target, offset);
      ray.far = dist;
      const hit = ray.intersectObjects(colliders, true)[0];
      if (hit) d = Math.max(hit.distance - 0.3, 0.4);
      camera.position.copy(target).addScaledVector(offset, d);
      const floor = heightAt(camera.position.x, camera.position.z) + 0.3;
      if (camera.position.y < floor) camera.position.y = floor;

      dir.copy(offset).negate();
      camera.lookAt(dir.add(camera.position));

      const fov = THREE.MathUtils.lerp(BASE_FOV, BASE_FOV / rig.zoom, k);
      if (Math.abs(camera.fov - fov) > 1e-3) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },
  };
  return rig;
}
