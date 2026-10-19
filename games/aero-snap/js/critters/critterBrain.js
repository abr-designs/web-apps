// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Critter behavior timers: wander and idle moods, a periodic special action, and fleeing. Pure: no three.js, no DOM.

const RETRY = 2;
const FLEE_DISTANCE = 3;

/**
 * @param {{ special: string, interval: [number, number], duration: number,
 *           canSpecial?: (ctx: object) => boolean, rng?: () => number }} options
 */
export function createBrain({ special, interval, duration, canSpecial = () => true, rng = Math.random }) {
  const nextSpecial = () => interval[0] + rng() * (interval[1] - interval[0]);
  const nextMood = () => 3 + rng() * 3;
  let specialTimer = nextSpecial();
  let moodTimer = nextMood();

  const brain = {
    /** @type {'wander'|'idle'|'special'} */
    state: 'wander',
    fleeing: false,
    timeLeft: 0,
    action: () => (brain.state === 'special' ? special : null),
    /** @param {{ phase: string, playerDistance: number, playerRunning: boolean }} ctx */
    update(dt, ctx) {
      brain.fleeing = ctx.playerRunning && ctx.playerDistance < FLEE_DISTANCE;

      if (brain.state === 'special') {
        brain.timeLeft -= dt;
        if (brain.fleeing || brain.timeLeft <= 0) {
          brain.state = 'wander';
          specialTimer = nextSpecial();
        }
        return;
      }

      specialTimer -= dt;
      if (specialTimer <= 0) {
        if (!brain.fleeing && canSpecial(ctx)) {
          brain.state = 'special';
          brain.timeLeft = duration;
          return;
        }
        specialTimer = RETRY;
      }

      moodTimer -= dt;
      if (moodTimer <= 0) {
        brain.state = brain.state === 'wander' ? 'idle' : 'wander';
        moodTimer = nextMood();
      }
      if (brain.fleeing) brain.state = 'wander';
    },
  };
  return brain;
}
