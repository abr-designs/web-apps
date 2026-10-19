// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
//
// The room's interruptions. Each event is an object the game loop drives:
//   active      true while the event still needs the player (drains the timer faster)
//   targets     meshes that count as clicking this event
//   idle()      true when it can start again (no exit animation still playing)
//   start(), reset(), update(dt, t)
//   onDown(ray, object), onDrag(ray), onUp(), onMiss(ray) for pointer input

import * as THREE from '../vendor/three.module.min.js';

const { clamp, lerp } = THREE.MathUtils;
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/** Point where the ray crosses the horizontal plane at height y. @created Claude (claude-opus-5-5) 2026-10-16 */
function hitPlaneY(ray, y) {
  floorPlane.constant = -y;
  return ray.intersectPlane(floorPlane, new THREE.Vector3());
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function rand(a, b) {
  return a + Math.random() * (b - a);
}

/** Random spot on the open part of the floor, clear of furniture. @created Claude (claude-opus-5-5) 2026-10-16 */
function openFloorSpot() {
  return new THREE.Vector2(rand(-0.8, 3.0), rand(-2.8, 4.2));
}

/** Window swings open; drag the sash back against the frame. @created Claude (claude-opus-5-5) 2026-10-16 */
function createWindowEvent(room) {
  const { pivot, curtains } = room.window;
  const hinge = pivot.position;
  const OPEN = 1.25;
  let angle = 0;
  let target = 0;
  let dragging = false;

  return {
    key: 'window',
    active: false,
    targets: [pivot],
    idle() { return !this.active && angle < 0.01; },
    start() { this.active = true; target = OPEN; },
    reset() { this.active = false; angle = target = 0; dragging = false; },
    update(dt, t) {
      // Wind keeps nudging a half-closed window back open.
      if (this.active && !dragging) target = Math.min(OPEN, target + dt * 0.12);
      if (!dragging) angle += (target - angle) * Math.min(1, dt * 4);
      pivot.rotation.y = -angle;
      const gust = angle / OPEN;
      curtains.forEach((c, i) => { c.rotation.x = -gust * (0.3 + 0.15 * Math.sin(t * 3 + i * 1.7)); });
    },
    onDown() { dragging = true; },
    onDrag(ray) {
      const p = hitPlaneY(ray, hinge.y);
      if (!p) return;
      angle = target = clamp(Math.atan2(p.z - hinge.z, p.x - hinge.x), 0, OPEN + 0.2);
      if (angle < 0.15) {
        angle = target = 0;
        dragging = false;
        this.active = false;
      }
    },
    onUp() { dragging = false; },
  };
}

/** Mouse wanders out of its hole; clicks near it scare it away from the cursor until it runs home. @created Claude (claude-opus-5-5) 2026-10-16 */
function createMouseEvent(room) {
  const model = room.mouse;
  const home = new THREE.Vector2(room.hole.x, room.hole.z);
  const pos = new THREE.Vector2();
  const vel = new THREE.Vector2();
  const goal = new THREE.Vector2();
  const step = new THREE.Vector2();
  const SCARE_RADIUS = 3.2;
  let mode = 'gone';
  let timer = 0;

  // Prefer goals far from the hole so the player has to herd it back.
  const pickGoal = () => {
    let best = openFloorSpot();
    for (let i = 0; i < 2; i++) {
      const c = openFloorSpot();
      if (c.distanceTo(home) > best.distanceTo(home)) best = c;
    }
    goal.copy(best);
  };

  const pushOutOfObstacles = () => {
    for (const o of room.obstacles) {
      const x0 = o.x0 - 0.25, x1 = o.x1 + 0.25, z0 = o.z0 - 0.25, z1 = o.z1 + 0.25;
      if (pos.x <= x0 || pos.x >= x1 || pos.y <= z0 || pos.y >= z1) continue;
      const dx = Math.min(pos.x - x0, x1 - pos.x);
      const dz = Math.min(pos.y - z0, z1 - pos.y);
      if (dx < dz) pos.x = pos.x - x0 < x1 - pos.x ? x0 : x1;
      else pos.y = pos.y - z0 < z1 - pos.y ? z0 : z1;
    }
  };

  return {
    key: 'mouse',
    active: false,
    targets: [],
    idle() { return mode === 'gone'; },
    start() {
      this.active = true;
      mode = 'emerge';
      // Dashes well into the room before it can be shooed.
      timer = 0.85;
      pos.set(-5.1, home.y);
      vel.set(5.5, rand(-1.5, 1.5));
      model.visible = true;
    },
    reset() { this.active = false; mode = 'gone'; model.visible = false; },
    update(dt, t) {
      if (mode === 'gone') return;
      timer -= dt;

      if (mode === 'emerge' && timer <= 0) { mode = 'roam'; pickGoal(); }
      if (mode === 'roam') {
        step.subVectors(goal, pos);
        if (step.length() < 0.3) pickGoal();
        step.normalize().multiplyScalar(1.1);
        vel.lerp(step, Math.min(1, dt * 3));
      }
      if (mode === 'flee') {
        vel.multiplyScalar(1 - Math.min(1, dt * 1.2));
        if (timer <= 0) { mode = 'roam'; pickGoal(); }
      }
      if (mode === 'exit') {
        vel.set(-2.5, 0);
        if (pos.x < -5.3) { mode = 'gone'; model.visible = false; return; }
      }

      pos.addScaledVector(vel, dt);
      if (mode !== 'exit') {
        pos.x = clamp(pos.x, -4.7, 4.7);
        pos.y = clamp(pos.y, -4.7, 4.7);
        pushOutOfObstacles();
        // Only a scared mouse dives home, so it never solves itself while roaming.
        if (mode === 'flee' && pos.distanceTo(home) < 0.8) {
          mode = 'exit';
          pos.y = home.y;
          this.active = false;
        }
      }

      if (vel.lengthSq() > 0.01) model.rotation.y = -Math.atan2(vel.y, vel.x);
      model.position.set(pos.x, Math.abs(Math.sin(t * 18)) * 0.04 * Math.min(1, vel.length()), pos.y);
    },
    onMiss(ray) {
      if (mode !== 'roam' && mode !== 'flee') return;
      const p = hitPlaneY(ray, 0);
      if (!p) return;
      step.set(pos.x - p.x, pos.y - p.z);
      if (step.length() > SCARE_RADIUS) return;
      if (step.lengthSq() < 0.01) step.copy(vel).negate();
      vel.copy(step.normalize().multiplyScalar(3.8));
      mode = 'flee';
      timer = 0.9;
    },
  };
}

/** Spider lowers itself down a wall on a thread; click it to send it back up. @created Claude (claude-opus-5-5) 2026-10-16 */
function createSpiderEvent(room) {
  const { group, thread, legs, hit } = room.spider;
  const anchor = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const linePos = thread.geometry.attributes.position;
  const TOP = 6.4;
  let mode = 'gone';
  let y = TOP;

  return {
    key: 'spider',
    active: false,
    targets: [hit],
    idle() { return mode === 'gone'; },
    start() {
      this.active = true;
      mode = 'down';
      y = TOP + 0.6;
      if (Math.random() < 0.5) {
        anchor.set(rand(-4.3, -0.2), 0, -4.65);
        tangent.set(1, 0, 0);
        group.rotation.y = 0;
      } else {
        anchor.set(-4.65, 0, rand(-4.3, 4.3));
        tangent.set(0, 0, 1);
        group.rotation.y = Math.PI / 2;
      }
      group.visible = thread.visible = true;
    },
    reset() { this.active = false; mode = 'gone'; group.visible = thread.visible = false; },
    update(dt, t) {
      if (mode === 'gone') return;
      if (mode === 'down') y = Math.max(1.6, y - 0.35 * dt);
      if (mode === 'up') {
        y += 7 * dt;
        if (y > TOP + 1) { mode = 'gone'; group.visible = thread.visible = false; return; }
      }
      const sway = Math.sin(t * 1.3) * 0.15;
      group.position.copy(anchor).addScaledVector(tangent, sway);
      group.position.y = y;
      group.rotation.z = Math.sin(t * 1.3) * 0.1;
      linePos.setXYZ(0, anchor.x, TOP, anchor.z);
      linePos.setXYZ(1, group.position.x, y + 0.2, group.position.z);
      linePos.needsUpdate = true;
      legs.forEach((leg, i) => { leg.rotation.z = -0.45 + Math.sin(t * 10 + i * 1.3) * 0.15; });
    },
    onDown() {
      if (mode !== 'down') return;
      mode = 'up';
      this.active = false;
    },
  };
}

/** Phone rings; click to pick up, then hold the pointer on it while the caller talks. @created Claude (claude-opus-5-5) 2026-10-16 */
function createPhoneEvent(room, ui) {
  const { group, handset, hit } = room.phone;
  const home = handset.position.clone();
  const lifted = home.clone().add(new THREE.Vector3(0.1, 0.55, 0));
  const anchor = new THREE.Vector3();
  const LISTEN_SECONDS = 2;
  let mode = 'idle';
  let holding = false;
  let progress = 0;

  return {
    key: 'phone',
    active: false,
    targets: [hit],
    idle() { return mode === 'idle' && !this.active; },
    start() { this.active = true; mode = 'ring'; progress = 0; },
    reset() {
      this.active = holding = false;
      mode = 'idle';
      handset.position.copy(home);
      handset.rotation.set(0, 0, 0);
      ui.bubble.hidden = true;
    },
    update(dt, t) {
      if (mode === 'ring') {
        const burst = Math.sin(t * 5) > 0 ? 1 : 0;
        handset.position.copy(home);
        handset.position.y += burst * Math.abs(Math.sin(t * 40)) * 0.05;
        handset.rotation.x = burst * Math.sin(t * 40) * 0.15;
      } else if (mode === 'talk') {
        handset.position.lerp(lifted, Math.min(1, dt * 8));
        handset.rotation.x = lerp(handset.rotation.x, 0.6, Math.min(1, dt * 8));
        if (holding) progress += dt / LISTEN_SECONDS;
        if (progress >= 1) { mode = 'idle'; holding = false; this.active = false; }
      } else {
        handset.position.lerp(home, Math.min(1, dt * 8));
        handset.rotation.x = lerp(handset.rotation.x, 0, Math.min(1, dt * 8));
      }

      ui.bubble.hidden = mode === 'idle';
      if (mode === 'idle') return;
      ui.bubbleText.textContent = mode === 'ring' ? 'Ring ring!' : holding ? 'Mm-hmm, uh-huh...' : 'Hold to listen';
      ui.bubbleFill.style.width = `${Math.round(progress * 100)}%`;
      ui.bubbleBar.hidden = mode === 'ring';
      group.getWorldPosition(anchor);
      anchor.y += 1.3;
      const s = ui.project(anchor);
      ui.bubble.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
    },
    onDown() {
      if (mode === 'ring') mode = 'talk';
      if (mode === 'talk') holding = true;
    },
    onUp() { holding = false; },
  };
}

/** Books tumble off the shelf; drag each one back onto its shelf slot. @created Claude (claude-opus-5-5) 2026-10-16 */
function createBooksEvent(room) {
  const books = room.books.map((b) => ({
    ...b, state: 'home', k: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), fromRot: new THREE.Vector3(), spin: 0,
  }));
  const loose = () => books.filter((b) => b.state === 'fall' || b.state === 'floor' || b.state === 'held');
  const dragPlane = new THREE.Plane();
  const lastRay = new THREE.Ray();
  const SNAP_DISTANCE = 0.9;
  let held = null;

  const dropToFloor = (b) => {
    const spot = hitPlaneY(lastRay, 0.1) ?? b.mesh.position.clone();
    b.state = 'fall';
    b.k = 0;
    b.from.copy(b.mesh.position);
    b.to.set(clamp(spot.x, -4.6, 4.6), 0.1, clamp(spot.z, -4.6, 4.6));
    b.spin = rand(-2, 2);
  };

  const sendHome = (b) => {
    b.state = 'back';
    b.k = 0;
    b.from.copy(b.mesh.position);
    b.fromRot.set(b.mesh.rotation.x, b.mesh.rotation.y, b.mesh.rotation.z);
  };

  return {
    key: 'books',
    active: false,
    get targets() { return loose().map((b) => b.mesh); },
    idle() { return books.every((b) => b.state === 'home'); },
    start() {
      this.active = true;
      const count = 2 + Math.floor(Math.random() * 2);
      const pool = books.slice().sort(() => Math.random() - 0.5).slice(0, count);
      for (const b of pool) {
        const spot = openFloorSpot();
        b.state = 'fall';
        b.k = -Math.random() * 0.4;
        b.from.copy(b.home);
        b.to.set(spot.x, 0.1, spot.y);
        b.spin = rand(-2, 2);
      }
    },
    reset() {
      this.active = false;
      held = null;
      for (const b of books) {
        b.state = 'home';
        b.mesh.position.copy(b.home);
        b.mesh.rotation.set(0, 0, 0);
      }
    },
    update(dt) {
      for (const b of books) {
        if (b.state === 'fall') {
          b.k += dt / 0.7;
          const k = clamp(b.k, 0, 1);
          b.mesh.position.lerpVectors(b.from, b.to, k);
          b.mesh.position.y = lerp(b.from.y, b.to.y, k * k) + Math.sin(Math.PI * k) * 0.6;
          b.mesh.rotation.set(0, b.spin * k, (Math.PI / 2) * k);
          if (b.k >= 1) b.state = 'floor';
        } else if (b.state === 'held') {
          const ease = Math.min(1, dt * 10);
          b.mesh.rotation.set(lerp(b.mesh.rotation.x, 0, ease), lerp(b.mesh.rotation.y, 0, ease), lerp(b.mesh.rotation.z, 0.25, ease));
        } else if (b.state === 'back') {
          b.k += dt / 0.5;
          const k = clamp(b.k, 0, 1);
          b.mesh.position.lerpVectors(b.from, b.home, k);
          b.mesh.position.y += Math.sin(Math.PI * k) * 1.0;
          b.mesh.rotation.set(lerp(b.fromRot.x, 0, k), lerp(b.fromRot.y, 0, k), lerp(b.fromRot.z, 0, k));
          if (b.k >= 1) b.state = 'home';
        }
      }
    },
    onDown(ray, object) {
      const b = books.find((book) => book.mesh === object || book.mesh === object.parent);
      if (!b || (b.state !== 'fall' && b.state !== 'floor')) return;
      held = b;
      b.state = 'held';
      // Carry the book on a camera-facing plane through its shelf slot, so it lands exactly when the pointer is over the slot.
      dragPlane.setFromNormalAndCoplanarPoint(ray.direction.clone().negate(), b.home);
      this.onDrag(ray);
    },
    onDrag(ray) {
      if (!held) return;
      lastRay.copy(ray);
      ray.intersectPlane(dragPlane, held.mesh.position);
    },
    onUp() {
      if (!held) return;
      if (lastRay.distanceToPoint(held.home) < SNAP_DISTANCE) sendHome(held);
      else dropToFloor(held);
      held = null;
      if (loose().length === 0) this.active = false;
    },
  };
}

/** Creates every event in bottom-bar order. @created Claude (claude-opus-5-5) 2026-10-16 */
export function createEvents(room, ui) {
  return [
    createWindowEvent(room),
    createMouseEvent(room),
    createSpiderEvent(room),
    createPhoneEvent(room, ui),
    createBooksEvent(room),
  ];
}
