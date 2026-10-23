// Created by Claude (claude-opus-5-5)
// Date: 2026-10-23
// Progress: the player's run across missions, in localStorage under PROGRESS_KEY: the THREAT level and the surviving squad.
// A new player starts at THREAT.start with the full squad. record(outcome, battle) steps the level with nextThreat; a victory
// keeps the soldiers still standing as squad ({ squadId: hp }, each healed by HEAL_PER_WIN up to max), and a defeat or forfeit
// clears it so the next mission brings the full squad back. View-only like the Roster: main passes level and squad to
// buildMission. Every storage call is wrapped in try/catch like save.js, so private mode, quota errors and corrupt JSON fall
// back to THREAT.start and the full squad.

import { THREAT, nextThreat, threatLevel } from '../data/threat.js';
import { SQUAD_SLOTS } from '../sim/loadout.js';

export const PROGRESS_KEY = 'vigil.progress.v1';
export const HEAL_PER_WIN = 2;

// globalThis.localStorage itself throws a SecurityError when the browser blocks site data.
/** @created Claude (claude-opus-5-5) - 2026-10-23 */
function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// -> a { squadId: hp } map of the known slots with a positive whole hp, or null when none is left.
/** @created Claude (claude-opus-5-5) - 2026-10-23 */
function cleanSquad(squad) {
  if (!squad || typeof squad !== 'object') return null;
  const out = {};
  for (const id of SQUAD_SLOTS) if (Number.isFinite(squad[id]) && squad[id] >= 1) out[id] = Math.round(squad[id]);
  return Object.keys(out).length ? out : null;
}

export class Progress {
  /**
   * storage defaults to localStorage (null when blocked).
   * @created Claude (claude-opus-5-5) - 2026-10-23
   * @modified Claude (claude-opus-5-5) - 2026-10-23 - surviving squad
   */
  constructor(storage = defaultStorage()) {
    this._storage = storage;
    this.level = THREAT.start;
    this.squad = null;
    try {
      const stored = JSON.parse(this._storage?.getItem(PROGRESS_KEY) ?? 'null');
      if (Number.isFinite(stored?.threat)) this.level = threatLevel(stored.threat);
      this.squad = cleanSquad(stored?.squad);
    } catch {
      // Corrupt JSON: start over at THREAT.start with the full squad.
    }
  }

  /**
   * Steps the level for a finished battle, keeps or clears the squad and saves. -> { from, to }.
   * @created Claude (claude-opus-5-5) - 2026-10-23
   * @modified Claude (claude-opus-5-5) - 2026-10-23 - surviving squad
   */
  record(outcome, battle = null) {
    const from = this.level;
    this.level = nextThreat(from, outcome);
    const standing = outcome === 'victory' && battle
      ? Object.values(battle.units).filter((u) => u.team === 'xcom' && u.hp > 0)
      : [];
    this.squad = cleanSquad(Object.fromEntries(standing.map((u) => [u.id, Math.min(u.stats.hp, u.hp + HEAL_PER_WIN)])));
    try {
      this._storage?.setItem(PROGRESS_KEY, JSON.stringify({ threat: this.level, squad: this.squad }));
    } catch {
      // Quota or private mode: the run lasts until the page closes.
    }
    return { from, to: this.level };
  }
}
