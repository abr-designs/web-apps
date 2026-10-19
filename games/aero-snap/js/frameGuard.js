// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Watches frame times and reports once when the trailing average stays too slow. Pure: no three.js, no DOM.

export function createFrameGuard({ windowSeconds = 3, maxAvgMs = 22 } = {}) {
  const frames = [];
  let sum = 0;
  let tripped = false;

  return {
    /** @returns {boolean} true exactly once, the first time a full window averages over maxAvgMs */
    push(dt) {
      if (tripped) return false;
      frames.push(dt);
      sum += dt;
      while (frames.length > 1 && sum - frames[0] >= windowSeconds) sum -= frames.shift();
      if (sum < windowSeconds) return false;
      if ((sum / frames.length) * 1000 > maxAvgMs) {
        tripped = true;
        return true;
      }
      return false;
    },
  };
}
