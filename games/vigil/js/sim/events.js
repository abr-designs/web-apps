// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21
// The event contract between sim and view. An event is { type, ...payload } and carries ids, tiles and numbers only.

export const EVENT = Object.freeze({
  UnitStepped: 'UnitStepped',             // { unitId, from, to }
  ApSpent: 'ApSpent',                     // { unitId, spent, ap } ap is what remains
  ShotResolved: 'ShotResolved',           // { attackerId, targetId, abilityId, result: 'hit'|'graze'|'miss'|'crit', roll, breakdown }
  UnitDamaged: 'UnitDamaged',             // { unitId, amount, armorAbsorbed, hp }
  UnitHealed: 'UnitHealed',               // { unitId, amount, hp }
  UnitKilled: 'UnitKilled',               // { unitId }
  ArmorShredded: 'ArmorShredded',         // { unitId, amount }
  StatusApplied: 'StatusApplied',         // { unitId, status, turns }
  StatusExpired: 'StatusExpired',         // { unitId, status }
  CoverDamaged: 'CoverDamaged',           // { tile, hp }
  CoverDestroyed: 'CoverDestroyed',       // { tile, rubbleKind }
  Explosion: 'Explosion',                 // { center, radius, tiles, sourceId?, abilityId? } source fields only on an ability's blast
  OverwatchSet: 'OverwatchSet',           // { unitId }
  OverwatchTriggered: 'OverwatchTriggered', // { unitId, targetId }
  ConcealmentBroken: 'ConcealmentBroken', // { byUnitId, reason }
  PodRevealed: 'PodRevealed',             // { podId, byUnitId }
  ScamperStarted: 'ScamperStarted',       // { podId }
  TurnStarted: 'TurnStarted',             // { side, turn }
  BattleEnded: 'BattleEnded',             // { outcome }
});

const TYPES = new Set(Object.values(EVENT));

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function createContext(state) {
  const events = [];
  return {
    state,
    events,
    emit(type, payload = {}) {
      if (!TYPES.has(type)) throw new Error(`unknown event type ${type}`);
      const event = { type, ...payload };
      events.push(event);
      return event;
    },
  };
}
