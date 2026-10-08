// Created by Claude (claude-opus-5-5)
// Date: 2026-10-05

export const config = {
  preloadMode: "live", // "live": next game runs hidden for instant swaps. "light": cover only, game starts on arrival.
  slotCount: 3, // 3 = prev, current, next. 4 = two ahead.
  loadTimeoutMs: 10000,
  swipeThresholdPx: 50,
  transitionMs: 250,
  squareTolerance: 1.15, // games whose sides are within this ratio fit both orientations
  historyMax: 50, // games kept in History
  undoMs: 4000, // how long the "Marked broken" Undo toast stays
  gamesUrl: "data/games.json",
  supabaseUrl: "https://igsloliwkybcmpqqrjnc.supabase.co", // public; empty turns shared data off
  supabaseAnonKey: "sb_publishable_-1T_q2nzrTjnbe1ZSb9fNg_A5OY8fW0", // public publishable key, guarded by RLS
  reportHideCount: 3, // reports in one orientation that hide a game there for everyone
  connectTimeoutMs: 8000, // after this the bundled games.json stays for the session
};
