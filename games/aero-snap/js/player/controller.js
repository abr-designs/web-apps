// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// The photographer: a small glossy explorer with a chrome helmet, walking the island heightmap.

import * as THREE from 'three';
import { heightAt, clampToWalkable } from '../world/islandShape.js';
import { materials } from '../world/materials.js';
import { palette } from '../palette.js';
import { moveVector, WALK_SPEED, SLOW_SPEED, JUMP_SPEED, GRAVITY } from './movement.js';

const TURN_RATE = 12;

function buildCharacter() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.5, 8, 20), materials.gloss(palette.highlight));
  torso.position.y = 0.72;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), materials.gloss(palette.chrome));
  head.position.y = 1.38;
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 24, 12, -Math.PI * 0.4, Math.PI * 0.8, Math.PI * 0.3, Math.PI * 0.35),
    materials.gloss(0x0e3a5c, { roughness: 0.05 }),
  );
  visor.rotation.y = Math.PI;
  visor.position.set(0, 1.38, -0.07);
  visor.scale.setScalar(1.12);
  const pack = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.25, 6, 12), materials.gloss(palette.accent));
  pack.position.set(0, 0.85, 0.32);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35), materials.chrome);
  antenna.position.set(0.12, 1.75, 0.05);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), materials.gloss(palette.grass, { emissive: palette.grass, emissiveIntensity: 1.5 }));
  bulb.position.set(0.12, 1.93, 0.05);
  const cam = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.17, 0.12), materials.gloss(0x223344));
  cam.position.set(0.2, 0.95, -0.36);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 16), materials.chrome);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0.2, 0.95, -0.45);
  const feet = [-0.15, 0.15].map((x) => {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), materials.gloss(palette.chrome));
    foot.scale.set(1, 0.6, 1.4);
    foot.position.set(x, 0.08, -0.03);
    return foot;
  });

  body.add(torso, head, visor, pack, antenna, bulb, cam, lens, ...feet);
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, body, feet };
}

function turnToward(current, target, k) {
  let d = target - current;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return current + d * Math.min(k, 1);
}

export function createPlayer(scene) {
  const { root, body, feet } = buildCharacter();
  scene.add(root);
  const position = root.position.set(0, 0, 6);
  // Circular blockers (landmark footprints) that push the player out: { x, z, r }.
  const blockers = [];
  let velY = 0;
  let grounded = true;
  let moving = false;
  let slowNow = false;
  let aimingNow = false;
  let walkPhase = 0;

  function update(dt, input, yaw, aiming) {
    const dir = moveVector(input.keys, yaw);
    moving = dir.x !== 0 || dir.z !== 0;
    slowNow = input.slow;
    aimingNow = aiming;
    const speed = input.slow || aiming ? SLOW_SPEED : WALK_SPEED;

    let x = position.x + dir.x * speed * dt;
    let z = position.z + dir.z * speed * dt;
    for (const b of blockers) {
      const dx = x - b.x;
      const dz = z - b.z;
      const d = Math.hypot(dx, dz);
      if (d < b.r && d > 1e-6) {
        x = b.x + (dx / d) * b.r;
        z = b.z + (dz / d) * b.r;
      }
    }
    ({ x, z } = clampToWalkable(x, z));
    position.x = x;
    position.z = z;

    const ground = heightAt(x, z);
    if (grounded && input.consumeJump()) {
      velY = JUMP_SPEED;
      grounded = false;
    }
    velY -= GRAVITY * dt;
    position.y += velY * dt;
    if (position.y <= ground) {
      position.y = ground;
      velY = 0;
      grounded = true;
    } else if (grounded && position.y - ground < 0.3) {
      // Walking downhill: stick to the slope instead of hopping.
      position.y = ground;
      velY = 0;
    } else {
      grounded = false;
    }

    if (aiming) root.rotation.y = turnToward(root.rotation.y, yaw, dt * TURN_RATE);
    else if (moving) root.rotation.y = turnToward(root.rotation.y, Math.atan2(-dir.x, -dir.z), dt * TURN_RATE);

    walkPhase = moving && grounded ? walkPhase + dt * speed * 2.2 : walkPhase * 0.9;
    body.position.y = Math.abs(Math.sin(walkPhase)) * 0.06;
    feet[0].position.z = -0.03 + Math.sin(walkPhase) * 0.12;
    feet[1].position.z = -0.03 - Math.sin(walkPhase) * 0.12;
  }

  return {
    object: root,
    position,
    blockers,
    update,
    isRunning: () => moving && !slowNow && !aimingNow,
  };
}
