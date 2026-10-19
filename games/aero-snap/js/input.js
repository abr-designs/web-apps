// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Keyboard, mouse and pointer lock state, read once per frame by the game loop.

const MOVE_KEYS = { KeyW: 'f', KeyS: 'b', KeyA: 'l', KeyD: 'r', ArrowUp: 'f', ArrowDown: 'b', ArrowLeft: 'l', ArrowRight: 'r' };

export function createInput(canvas) {
  const keys = { f: false, b: false, l: false, r: false };
  const handlers = new Map();
  let slow = false;
  let aiming = false;
  let click = false;
  let jump = false;
  let wheel = 0;
  let dx = 0;
  let dy = 0;

  const locked = () => document.pointerLockElement === canvas;
  // Browsers refuse the lock without a fresh user gesture; the start hint covers that case.
  const lock = () => {
    try {
      return Promise.resolve(canvas.requestPointerLock?.()).catch(() => {});
    } catch {
      return Promise.resolve();
    }
  };

  function clearHeld() {
    keys.f = keys.b = keys.l = keys.r = false;
    slow = aiming = click = jump = false;
  }

  const typing = (e) => e.target instanceof Element && e.target.matches('input, textarea');

  window.addEventListener('keydown', (e) => {
    // Typing a caption must not trigger shortcuts or walk the player; Escape still closes menus.
    if (typing(e) && e.code !== 'Escape') return;
    const handler = handlers.get(e.code);
    if (handler) {
      // A handler returns false to leave the browser default alone (Tab moving focus in a menu).
      const handled = e.repeat ? true : handler(e);
      if (handled !== false) e.preventDefault();
      return;
    }
    if (MOVE_KEYS[e.code]) keys[MOVE_KEYS[e.code]] = true;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') slow = true;
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) jump = true;
    }
  });
  window.addEventListener('keyup', (e) => {
    if (MOVE_KEYS[e.code]) keys[MOVE_KEYS[e.code]] = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') slow = false;
  });
  window.addEventListener('blur', clearHeld);

  canvas.addEventListener('mousedown', (e) => {
    if (!locked()) {
      lock();
      return;
    }
    if (e.button === 2) aiming = true;
    if (e.button === 0) click = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 2) aiming = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('mousemove', (e) => {
    if (!locked()) return;
    dx += e.movementX;
    dy += e.movementY;
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    wheel += Math.sign(e.deltaY);
  }, { passive: false });
  document.addEventListener('pointerlockchange', () => {
    if (!locked()) aiming = false;
  });

  return {
    keys,
    get slow() { return slow; },
    get aiming() { return aiming; },
    get locked() { return locked(); },
    consumeClick() { const c = click; click = false; return c; },
    consumeJump() { const j = jump; jump = false; return j; },
    consumeWheel() { const w = wheel; wheel = 0; return w; },
    lookDelta() { const d = { dx, dy }; dx = dy = 0; return d; },
    onKey(code, fn) { handlers.set(code, fn); },
    lock,
    release() { if (locked()) document.exitPointerLock(); clearHeld(); },
  };
}
