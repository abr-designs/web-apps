// Created by Claude (claude-opus-5-5)
// Date: 2026-10-05

// Movement below this counts as a tap; movement between this and the swipe threshold is ignored.
const TAP_SLOP_PX = 10;

/**
 * Turns gestures on `el` into navigation: swipe up or tap calls onNext, swipe down calls onPrev.
 * Pointers that start on a link are left alone so the link can open.
 * @created Claude (claude-opus-5-5) — 2026-10-05
 */
export function attachSwipe(el, { onNext, onPrev, thresholdPx }) {
  let start = null; // the first pointer only; extra fingers are ignored

  el.addEventListener("pointerdown", (e) => {
    if (start || e.target.closest("a")) return;
    start = { id: e.pointerId, x: e.clientX, y: e.clientY };
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener("pointerup", (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (dy > thresholdPx) onPrev();
    else if (dy < -thresholdPx || Math.hypot(dx, dy) < TAP_SLOP_PX) onNext(); // swipe up, or a tap
  });

  el.addEventListener("pointercancel", (e) => {
    if (start && e.pointerId === start.id) start = null;
  });
}
