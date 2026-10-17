// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16

// ---------- World ----------

const MAP = [
  '####################',
  '#..................#',
  '#..................#',
  '#..##..######..##..#',
  '#..#............#..#',
  '#.......#..#.......#',
  '#..#....#..#....#..#',
  '#..#..###..###..#..#',
  '#..................#',
  '#......##..##......#',
  '#......##..##......#',
  '#..................#',
  '#..#..###..###..#..#',
  '#..#....#..#....#..#',
  '#.......#..#.......#',
  '#..#............#..#',
  '#..##..######..##..#',
  '#..................#',
  '#..................#',
  '####################',
];
const GRID = MAP.length;
const TILE = 50;
const WORLD = GRID * TILE;
const SPAWNS = [[75, 75], [925, 75], [75, 925], [925, 925], [500, 75], [500, 925]];

const COLORS = {
  page: '#E8DFD2', floor: '#F4EFE6', wall: '#B9AA98', ink: '#2E4057',
  chaser: '#E07A5F', shooter: '#E9B44C', brute: '#8E7DBE',
  health: '#D1495B', armour: '#5B8DB8', power: '#81B29A',
};

const ENEMY_TYPES = {
  chaser: { r: 12, speed: 150, hp: 20, contact: 10, scrap: 6 },
  shooter: { r: 12, speed: 110, hp: 25, contact: 6, scrap: 8, range: 320, fireCd: 1.8, bulletSpeed: 260, bulletDmg: 10 },
  brute: { r: 20, speed: 75, hp: 90, contact: 25, scrap: 15 },
};

const PLAYER = { r: 13, speed: 280, health: 100, armourMax: 100, scrapMax: 100 };
const DROP_LIFE = 20; // seconds an enemy drop stays on the floor
const DEPOT_R = 32;
// Open floor a depot can land on: the centre, the four corners and the four edge midpoints.
const DEPOT_SPOTS = [[500, 500], [100, 100], [900, 100], [100, 900], [900, 900], [500, 100], [500, 900], [100, 500], [900, 500]];
const DEPOT_TYPES = {
  player: { name: 'Player', color: COLORS.armour },
  weapon: { name: 'Weapon', color: COLORS.health },
  special: { name: 'Specials', color: COLORS.brute },
};
const DASH_TIME = 0.15; // seconds a dash lasts; the player is invulnerable for this long
const SHOP = {
  health: { name: 'Repair', desc: '+30 health', amount: 30, cost: 20, costStep: 5, depot: 'player' },
  armour: { name: 'Armour', desc: '+25 armour', amount: 25, cost: 20, costStep: 10, depot: 'player' },
  damage: { name: 'Damage', desc: '+20% damage', amount: 0.2, cost: 30, costStep: 20, depot: 'weapon' },
};

const WEAPONS = {
  pistol: { cooldown: 0.7, damage: 12, bulletSpeed: 420, spreadDeg: 10 },
  melee: { cooldown: 0.4, damage: 18, range: 70, arcDeg: 100, arcPerLevelDeg: 25 },
};

const UPGRADES = {
  speed: { name: 'Move speed', short: 'Speed', desc: '+8% move speed', cost: 25, costStep: 15, depot: 'player' },
  fireRate: { name: 'Fire rate', short: 'Rate', desc: '+25% attack speed', cost: 40, costStep: 25, depot: 'weapon' },
  critChance: { name: 'Crit chance', short: 'Crit', desc: '+10% chance to crit', cost: 30, costStep: 20, depot: 'weapon' },
  critDamage: { name: 'Crit damage', short: 'Crit dmg', desc: '+50% crit damage', cost: 30, costStep: 20, depot: 'weapon' },
  projectiles: { name: 'Projectiles', short: 'Shots', desc: '+1 projectile, wider melee arc', cost: 60, costStep: 40, depot: 'weapon' },
  dashCooldown: { name: 'Dash cooldown', short: 'Dash cd', desc: '-15% dash cooldown', cost: 30, costStep: 20, depot: 'special', dash: true },
  dashDistance: { name: 'Dash distance', short: 'Dash dist', desc: '+30 dash distance', cost: 30, costStep: 20, depot: 'special', dash: true },
  magnet: { name: 'Scrap magnet', short: 'Magnet', desc: 'Pulls in scrap from +50 range', cost: 25, costStep: 15, depot: 'special' },
};

// ---------- Debug settings (persisted per browser) ----------

const DEBUG_KEY = 'ironclad.debug';
const DEFAULT_DEBUG = {
  baseAttack: 'pistol',
  shotsCostArmour: false,
  armourPerShot: 2,
  scrapSpill: true,
  spillPercent: 30,
  spillDelay: 1,
  maxSlowPercent: 65,
  damagePerKillPercent: 0,
  enemySpeedPercent: 75,
  dashEnabled: true,
  dashCooldown: 4,
  dashDistance: 180,
  waveTime: 40,
  depotTime: 20,
  pool: Object.fromEntries(Object.keys(UPGRADES).map((k) => [k, true])),
};

function loadDebug() {
  try {
    const saved = JSON.parse(localStorage.getItem(DEBUG_KEY));
    if (saved) return { ...DEFAULT_DEBUG, ...saved, pool: { ...DEFAULT_DEBUG.pool, ...saved.pool } };
  } catch { /* storage unavailable or corrupt: fall back to defaults */ }
  return structuredClone(DEFAULT_DEBUG);
}

function saveDebug() {
  try { localStorage.setItem(DEBUG_KEY, JSON.stringify(debug)); } catch { /* storage unavailable */ }
}

let debug = loadDebug();

// ---------- Helpers ----------

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const solid = (tx, ty) => tx < 0 || ty < 0 || tx >= GRID || ty >= GRID || MAP[ty][tx] === '#';
const wallAt = (x, y) => solid(Math.floor(x / TILE), Math.floor(y / TILE));

/** Line of sight between two points, optionally widened by checking two parallel lines offset by pad. */
function hasLOS(ax, ay, bx, by, pad = 0) {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len * pad, ny = dx / len * pad;
  const offsets = pad ? [[0, 0], [nx, ny], [-nx, -ny]] : [[0, 0]];
  const steps = Math.ceil(len / 10);
  for (const [ox, oy] of offsets) {
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (wallAt(ax + ox + dx * t, ay + oy + dy * t)) return false;
    }
  }
  return true;
}

/** Pushes a circle out of any wall tiles it overlaps. */
function collideWalls(e) {
  const x0 = Math.floor((e.x - e.r) / TILE), x1 = Math.floor((e.x + e.r) / TILE);
  const y0 = Math.floor((e.y - e.r) / TILE), y1 = Math.floor((e.y + e.r) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!solid(tx, ty)) continue;
      const cx = clamp(e.x, tx * TILE, (tx + 1) * TILE);
      const cy = clamp(e.y, ty * TILE, (ty + 1) * TILE);
      const dx = e.x - cx, dy = e.y - cy;
      const d = Math.hypot(dx, dy);
      if (d >= e.r || d === 0) continue;
      e.x += dx / d * (e.r - d);
      e.y += dy / d * (e.r - d);
    }
  }
}

// ---------- Flow field (BFS from the player's tile) ----------

const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const flow = new Int16Array(GRID * GRID);
let flowTile = -1;

/** Diagonal steps are allowed only when both orthogonal tiles are open, so paths never cut wall corners. */
function canStep(tx, ty, dx, dy) {
  if (solid(tx + dx, ty + dy)) return false;
  return !(dx && dy) || (!solid(tx + dx, ty) && !solid(tx, ty + dy));
}

function updateFlow() {
  const ptx = Math.floor(state.player.x / TILE), pty = Math.floor(state.player.y / TILE);
  const start = pty * GRID + ptx;
  if (start === flowTile) return;
  flowTile = start;
  flow.fill(-1);
  flow[start] = 0;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const tx = cur % GRID, ty = (cur - tx) / GRID;
    for (const [dx, dy] of NEIGHBOURS) {
      if (!canStep(tx, ty, dx, dy)) continue;
      const n = (ty + dy) * GRID + tx + dx;
      if (flow[n] !== -1) continue;
      flow[n] = flow[cur] + 1;
      queue.push(n);
    }
  }
}

/** Where an enemy should walk: straight at the player when visible, else the next tile down the flow field. */
function steerTarget(e) {
  const p = state.player;
  if (hasLOS(e.x, e.y, p.x, p.y, e.r)) return p;
  const tx = Math.floor(e.x / TILE), ty = Math.floor(e.y / TILE);
  let best = null, bestDist = flow[ty * GRID + tx];
  if (bestDist < 0) bestDist = Infinity;
  for (const [dx, dy] of NEIGHBOURS) {
    if (!canStep(tx, ty, dx, dy)) continue;
    const d = flow[(ty + dy) * GRID + tx + dx];
    if (d >= 0 && d < bestDist) { bestDist = d; best = [tx + dx, ty + dy]; }
  }
  return best ? { x: (best[0] + 0.5) * TILE, y: (best[1] + 0.5) * TILE } : p;
}

// ---------- State ----------

let state;

function newGame() {
  state = {
    mode: 'playing',
    time: 0,
    kills: 0,
    spawnTimer: 1,
    phase: 'wave',
    phaseTimer: debug.waveTime,
    depot: null,
    nextDepot: pickDepot(null),
    onDepot: false,
    player: {
      x: 500, y: 500, r: PLAYER.r,
      health: PLAYER.health, armour: 0, scrap: 0,
      cooldown: 0, hurtFlash: 0,
      bank: 0, bought: { health: 0, armour: 0, damage: 0 },
      dashTime: 0, dashCd: 0, dashVx: 0, dashVy: 0,
      upgrades: Object.fromEntries(Object.keys(UPGRADES).map((k) => [k, 0])),
    },
    enemies: [],
    bullets: [],
    enemyBullets: [],
    pickups: [],
    swings: [],
    texts: [],
  };
  flowTile = -1;
  hideOverlay();
  renderChips();
  syncUpgradeInputs();
}

// ---------- Input ----------

const keys = new Set();
const mouse = { x: 0, y: 0, down: false };

addEventListener('keydown', (ev) => {
  if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement) return;
  const k = ev.key.toLowerCase();
  keys.add(k);
  if (k === '`') toggleDebug();
  if (k === 'p' || k === 'escape') togglePause();
  if (k === 'r' && state.mode === 'over') newGame();
  if (k === ' ') ev.preventDefault();
  if (k === 'escape' && state.mode === 'shop') closeShop();
  if (state.mode === 'shop' && k.length === 1 && k >= '1' && k <= '9') {
    const btn = choicesEl.children[Number(k) - 1];
    if (btn) btn.click();
  }
});
addEventListener('keyup', (ev) => keys.delete(ev.key.toLowerCase()));
addEventListener('blur', () => { keys.clear(); mouse.down = false; });

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.addEventListener('mousemove', (ev) => { mouse.x = ev.clientX; mouse.y = ev.clientY; });
canvas.addEventListener('mousedown', (ev) => { if (ev.button === 0) mouse.down = true; });
addEventListener('mouseup', (ev) => { if (ev.button === 0) mouse.down = false; });
canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

// ---------- Player ----------

function speedMultiplier() {
  const p = state.player;
  return (1 + 0.08 * p.upgrades.speed) * (1 - (debug.maxSlowPercent / 100) * (p.scrap / PLAYER.scrapMax));
}

function dashCooldown() { return debug.dashCooldown * 0.85 ** state.player.upgrades.dashCooldown; }
function dashDistance() { return debug.dashDistance + 30 * state.player.upgrades.dashDistance; }

function weaponPower() {
  return 1 + SHOP.damage.amount * state.player.bought.damage + state.kills * debug.damagePerKillPercent / 100;
}

function fireRateMultiplier() {
  return 1 + 0.25 * state.player.upgrades.fireRate;
}

function critChance() { return Math.min(1, 0.05 + 0.10 * state.player.upgrades.critChance); }
function critMultiplier() { return 2 + 0.5 * state.player.upgrades.critDamage; }

function rollDamage(base) {
  const crit = Math.random() < critChance();
  return { dmg: base * weaponPower() * (crit ? critMultiplier() : 1), crit };
}

function aimWorld() {
  return { x: (mouse.x - view.ox) / view.scale, y: (mouse.y - view.oy) / view.scale };
}

function updatePlayer(dt) {
  const p = state.player;
  let mx = 0, my = 0;
  if (keys.has('w') || keys.has('arrowup')) my -= 1;
  if (keys.has('s') || keys.has('arrowdown')) my += 1;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  const len = Math.hypot(mx, my);
  p.dashCd -= dt;
  if (keys.has(' ') && debug.dashEnabled && p.dashCd <= 0 && p.dashTime <= 0) startDash();

  if (p.dashTime > 0) {
    updateDash(dt);
  } else if (len) {
    const v = PLAYER.speed * speedMultiplier() * dt / len;
    p.x += mx * v;
    p.y += my * v;
  }
  collideWalls(p);

  p.cooldown -= dt;
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  if (mouse.down && p.cooldown <= 0) attack();
}

/** Dashes toward the cursor; any enemy the player passes through dies instantly. */
function startDash() {
  const p = state.player;
  const aim = aimWorld();
  const a = Math.atan2(aim.y - p.y, aim.x - p.x);
  const speed = dashDistance() / DASH_TIME;
  p.dashVx = Math.cos(a) * speed;
  p.dashVy = Math.sin(a) * speed;
  p.dashTime = DASH_TIME;
  p.dashCd = dashCooldown();
}

function updateDash(dt) {
  const p = state.player;
  const step = Math.min(dt, p.dashTime);
  p.dashTime -= dt;
  // Substeps keep a fast dash from tunnelling through walls or skipping enemies.
  const subs = Math.ceil(Math.hypot(p.dashVx, p.dashVy) * step / 8);
  for (let i = 0; i < subs; i++) {
    p.x += p.dashVx * step / subs;
    p.y += p.dashVy * step / subs;
    collideWalls(p);
    for (const e of state.enemies) {
      if (e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r) {
        e.hp = 0;
        e.flash = 0.08;
      }
    }
  }
}

function attack() {
  const p = state.player;
  const weapon = WEAPONS[debug.baseAttack];
  p.cooldown = weapon.cooldown / fireRateMultiplier();

  if (debug.shotsCostArmour && p.armour > 0) p.armour = Math.max(0, p.armour - debug.armourPerShot);

  const aim = aimWorld();
  const angle = Math.atan2(aim.y - p.y, aim.x - p.x);
  const count = 1 + p.upgrades.projectiles;

  if (debug.baseAttack === 'pistol') {
    const spread = weapon.spreadDeg * Math.PI / 180;
    for (let i = 0; i < count; i++) {
      const a = angle + (i - (count - 1) / 2) * spread;
      const { dmg, crit } = rollDamage(weapon.damage);
      state.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * weapon.bulletSpeed, vy: Math.sin(a) * weapon.bulletSpeed, r: 4, dmg, crit, life: 2.5 });
    }
    return;
  }

  const arc = Math.min(Math.PI * 2, (weapon.arcDeg + weapon.arcPerLevelDeg * p.upgrades.projectiles) * Math.PI / 180);
  state.swings.push({ angle, arc, life: 0.12 });
  for (const e of state.enemies) {
    const dx = e.x - p.x, dy = e.y - p.y;
    if (Math.hypot(dx, dy) > weapon.range + e.r) continue;
    const diff = Math.abs(((Math.atan2(dy, dx) - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (diff > arc / 2) continue;
    const { dmg, crit } = rollDamage(weapon.damage);
    damageEnemy(e, dmg, crit);
  }
}

/** Armour soaks damage first; the overflow hits health. Each hit can spill carried scrap as delayed pickups. */
function hurtPlayer(amount) {
  const p = state.player;
  if (p.dashTime > 0) return;
  if (debug.scrapSpill && p.scrap > 0) {
    const spilled = p.scrap * debug.spillPercent / 100;
    p.scrap -= spilled;
    spillScrap(spilled);
  }
  const absorbed = Math.min(amount, p.armour);
  p.armour -= absorbed;
  const toHealth = amount - absorbed;
  if (toHealth <= 0) return;
  p.health -= toHealth;
  p.hurtFlash = 0.25;
  if (p.health <= 0) gameOver();
}

function spillScrap(value) {
  const p = state.player;
  const count = Math.min(6, Math.ceil(value / 5));
  for (let i = 0; i < count; i++) {
    let x = p.x, y = p.y;
    for (let tries = 0; tries < 6; tries++) {
      const a = rand(0, Math.PI * 2), d = rand(50, 110);
      const cx = p.x + Math.cos(a) * d, cy = p.y + Math.sin(a) * d;
      if (!wallAt(cx, cy)) { x = cx; y = cy; break; }
    }
    state.pickups.push({ x, y, value: value / count, wait: debug.spillDelay, life: DROP_LIFE });
  }
}

// ---------- Enemies ----------

function spawnEnemy() {
  const t = state.time;
  const roll = Math.random() * 100;
  let type = 'chaser';
  if (t > 45 && roll < 15) type = 'brute';
  else if (t > 20 && roll < 40) type = 'shooter';

  const p = state.player;
  const far = SPAWNS.filter(([x, y]) => Math.hypot(x - p.x, y - p.y) > 300);
  const [x, y] = far[Math.floor(Math.random() * far.length)] ?? SPAWNS[0];
  const def = ENEMY_TYPES[type];
  const hp = def.hp * (1 + t / 120);
  state.enemies.push({ type, def, x: x + rand(-10, 10), y: y + rand(-10, 10), r: def.r, hp, maxHp: hp, hitCd: 0, fireCd: def.fireCd ?? 0, flash: 0 });
}

function damageEnemy(e, dmg, crit) {
  e.hp -= dmg;
  e.flash = 0.08;
  if (crit) state.texts.push({ x: e.x, y: e.y - e.r, text: Math.round(dmg), life: 0.6 });
}

function updateEnemies(dt) {
  const p = state.player;
  for (const e of state.enemies) {
    e.flash = Math.max(0, e.flash - dt);
    e.hitCd -= dt;
    const dist = Math.hypot(p.x - e.x, p.y - e.y);
    let target = steerTarget(e);
    let dir = 1;

    if (e.type === 'shooter') {
      const visible = dist < e.def.range && hasLOS(e.x, e.y, p.x, p.y, 4);
      e.fireCd -= dt;
      if (visible) {
        if (e.fireCd <= 0) {
          e.fireCd = e.def.fireCd;
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          state.enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * e.def.bulletSpeed, vy: Math.sin(a) * e.def.bulletSpeed, r: 5, dmg: e.def.bulletDmg, life: 4 });
        }
        if (dist > e.def.range * 0.6) target = null;
        else { target = p; dir = -1; }
      }
    }

    if (target) {
      const dx = target.x - e.x, dy = target.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const speed = e.def.speed * debug.enemySpeedPercent / 100;
      e.x += dx / d * speed * dt * dir;
      e.y += dy / d * speed * dt * dir;
    }

    if (dist < e.r + p.r && e.hitCd <= 0) {
      e.hitCd = 0.8;
      hurtPlayer(e.def.contact);
    }
  }

  // Separation: push overlapping enemies apart, then out of walls.
  const list = state.enemies;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy), min = a.r + b.r;
      if (d >= min || d === 0) continue;
      const push = (min - d) / 2;
      a.x -= dx / d * push; a.y -= dy / d * push;
      b.x += dx / d * push; b.y += dy / d * push;
    }
  }
  for (const e of list) collideWalls(e);

  state.enemies = list.filter((e) => {
    if (e.hp > 0) return true;
    state.kills++;
    state.pickups.push({ x: e.x, y: e.y, value: e.def.scrap, wait: 0, life: DROP_LIFE });
    return false;
  });
}

// ---------- Projectiles and pickups ----------

function updateProjectiles(dt) {
  const p = state.player;
  state.bullets = state.bullets.filter((b) => {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0 || wallAt(b.x, b.y)) return false;
    for (const e of state.enemies) {
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
        damageEnemy(e, b.dmg, b.crit);
        return false;
      }
    }
    return true;
  });

  state.enemyBullets = state.enemyBullets.filter((b) => {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0 || wallAt(b.x, b.y)) return false;
    if (Math.hypot(p.x - b.x, p.y - b.y) < p.r + b.r) {
      hurtPlayer(b.dmg);
      return false;
    }
    return true;
  });

  const reach = p.r + 10;
  const magnet = 50 * p.upgrades.magnet;
  state.pickups = state.pickups.filter((s) => {
    if (s.wait > 0) { s.wait -= dt; return true; }
    s.life -= dt;
    if (s.life <= 0) return false;
    const d = Math.hypot(p.x - s.x, p.y - s.y);
    if (d < reach) {
      p.scrap = Math.min(PLAYER.scrapMax, p.scrap + s.value);
      return false;
    }
    if (d < reach + magnet) {
      s.x += (p.x - s.x) / d * 360 * dt;
      s.y += (p.y - s.y) / d * 360 * dt;
    }
    return true;
  });

  for (const s of state.swings) s.life -= dt;
  state.swings = state.swings.filter((s) => s.life > 0);
  for (const t of state.texts) { t.life -= dt; t.y -= 30 * dt; }
  state.texts = state.texts.filter((t) => t.life > 0);
}

// ---------- Loop ----------

/** Picks the next depot's type and spot, never repeating the previous depot's type or spot. */
function pickDepot(prev) {
  const pick = (list, not) => {
    const options = list.filter((v) => v !== not);
    return options[Math.floor(Math.random() * options.length)];
  };
  const spot = pick(DEPOT_SPOTS, prev?.spot);
  return { type: pick(Object.keys(DEPOT_TYPES), prev?.type), spot, x: spot[0], y: spot[1] };
}

/** Alternates waves, where enemies spawn, with depot visits, where one depot is open and nothing spawns. */
function updatePhase(dt) {
  state.phaseTimer -= dt;
  if (state.phaseTimer > 0) return;
  if (state.phase === 'wave') {
    state.phase = 'depot';
    state.phaseTimer = debug.depotTime;
    state.depot = state.nextDepot;
  } else {
    state.phase = 'wave';
    state.phaseTimer = debug.waveTime;
    state.nextDepot = pickDepot(state.depot);
    state.depot = null;
    state.spawnTimer = 1;
  }
}

function update(dt) {
  state.time += dt;
  updatePhase(dt);
  if (state.phase === 'wave') {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnEnemy();
      state.spawnTimer = Math.max(0.35, 2 - state.time * 0.012);
    }
  }
  updateFlow();
  updatePlayer(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  // The shop opens on stepping onto the depot, so leaving it and walking back reopens it.
  const p = state.player, d = state.depot;
  const onDepot = !!d && Math.hypot(p.x - d.x, p.y - d.y) < DEPOT_R;
  if (state.mode === 'playing' && onDepot && !state.onDepot) {
    p.bank += p.scrap;
    p.scrap = 0;
    openShop();
  }
  state.onDepot = onDepot;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(1 / 30, (now - last) / 1000);
  last = now;
  if (state.mode === 'playing') update(dt);
  render();
  updateHud();
  requestAnimationFrame(frame);
}

// ---------- Rendering ----------

const view = { ox: 0, oy: 0, scale: 1 };

function resize() {
  const dpr = devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const size = Math.min(innerWidth, innerHeight) - 24;
  view.scale = size / WORLD;
  view.ox = (innerWidth - size) / 2;
  view.oy = (innerHeight - size) / 2;
}
addEventListener('resize', resize);

function circle(x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function render() {
  const dpr = devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = COLORS.page;
  ctx.fillRect(0, 0, innerWidth, innerHeight);

  ctx.translate(view.ox, view.oy);
  ctx.scale(view.scale, view.scale);

  ctx.fillStyle = COLORS.floor;
  ctx.fillRect(0, 0, WORLD, WORLD);
  ctx.fillStyle = COLORS.wall;
  for (let ty = 0; ty < GRID; ty++) {
    for (let tx = 0; tx < GRID; tx++) {
      if (MAP[ty][tx] === '#') ctx.fillRect(tx * TILE, ty * TILE, TILE + 0.5, TILE + 0.5);
    }
  }

  const d = state.depot;
  if (d) {
    const type = DEPOT_TYPES[d.type];
    // Blinks in the last 3 seconds before it leaves.
    const blink = state.phaseTimer < 3 ? 0.4 + 0.6 * Math.abs(Math.sin(state.time * 6)) : 1;
    ctx.beginPath();
    ctx.arc(d.x, d.y, DEPOT_R, 0, Math.PI * 2);
    ctx.globalAlpha = 0.45 * blink;
    ctx.fillStyle = type.color;
    ctx.fill();
    ctx.globalAlpha = blink;
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = type.color;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.ink;
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(type.name.toUpperCase(), d.x, d.y + DEPOT_R + 13);
    ctx.globalAlpha = 1;
  }

  for (const s of state.pickups) {
    // Faded while not yet collectable, blinking in the last 3 seconds before it expires.
    ctx.globalAlpha = s.wait > 0 ? 0.3 : s.life < 3 ? 0.6 + 0.4 * Math.sin(state.time * 12) : 1;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = COLORS.power;
    ctx.fillRect(-6, -6, 12, 12);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  const p = state.player;
  for (const e of state.enemies) drawEnemy(e, p);

  for (const b of state.enemyBullets) {
    circle(b.x, b.y, b.r + 1.5, COLORS.ink);
    circle(b.x, b.y, b.r, COLORS.shooter);
  }
  for (const b of state.bullets) circle(b.x, b.y, b.r, b.crit ? COLORS.health : COLORS.ink);

  for (const s of state.swings) {
    ctx.globalAlpha = s.life / 0.12 * 0.35;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.arc(p.x, p.y, WEAPONS.melee.range + p.r, s.angle - s.arc / 2, s.angle + s.arc / 2);
    ctx.closePath();
    ctx.fillStyle = COLORS.ink;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  drawPlayer(p);

  ctx.fillStyle = COLORS.health;
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const t of state.texts) {
    ctx.globalAlpha = Math.min(1, t.life * 3);
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;

  if (p.hurtFlash > 0) {
    ctx.globalAlpha = p.hurtFlash * 1.2;
    ctx.strokeStyle = COLORS.health;
    ctx.lineWidth = 24;
    ctx.strokeRect(0, 0, WORLD, WORLD);
    ctx.globalAlpha = 1;
  }
}

function drawEnemy(e, p) {
  const color = e.flash > 0 ? '#FFFFFF' : COLORS[e.type];
  if (e.type === 'shooter') {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(Math.atan2(p.y - e.y, p.x - e.x));
    ctx.fillStyle = color;
    ctx.fillRect(-e.r, -e.r, e.r * 2, e.r * 2);
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(e.r - 2, -2, 8, 4);
    ctx.restore();
  } else {
    circle(e.x, e.y, e.r, color);
    if (e.type === 'brute') {
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  if (e.hp < e.maxHp) {
    ctx.fillStyle = 'rgba(46,64,87,0.25)';
    ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2, 3);
    ctx.fillStyle = COLORS.health;
    ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2 * Math.max(0, e.hp / e.maxHp), 3);
  }
}

function drawPlayer(p) {
  const aim = aimWorld();
  const a = Math.atan2(aim.y - p.y, aim.x - p.x);
  if (p.armour > 0) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 2 + 6 * (p.armour / PLAYER.armourMax), 0, Math.PI * 2);
    ctx.fillStyle = COLORS.armour;
    ctx.fill();
  }
  if (p.dashTime > 0) {
    ctx.globalAlpha = 0.3;
    circle(p.x - p.dashVx * 0.04, p.y - p.dashVy * 0.04, p.r, COLORS.ink);
    circle(p.x - p.dashVx * 0.08, p.y - p.dashVy * 0.08, p.r * 0.8, COLORS.ink);
    ctx.globalAlpha = 1;
  }
  circle(p.x, p.y, p.r, p.hurtFlash > 0 ? COLORS.health : COLORS.ink);
  circle(p.x + Math.cos(a) * (p.r + 4), p.y + Math.sin(a) * (p.r + 4), 4, COLORS.ink);
}

// ---------- HUD ----------

const $ = (id) => document.getElementById(id);
const hud = {
  health: $('bar-health'), armour: $('bar-armour'), scrap: $('bar-scrap'),
  healthVal: $('val-health'), armourVal: $('val-armour'), scrapVal: $('val-scrap'),
  chips: $('chips'), stats: $('stats'), depot: $('depot-timer'),
};

function updateHud() {
  const p = state.player;
  hud.health.style.width = `${clamp(p.health / PLAYER.health, 0, 1) * 100}%`;
  hud.armour.style.width = `${p.armour / PLAYER.armourMax * 100}%`;
  hud.scrap.style.width = `${p.scrap / PLAYER.scrapMax * 100}%`;
  hud.healthVal.textContent = Math.max(0, Math.ceil(p.health));
  hud.armourVal.textContent = Math.round(p.armour);
  hud.scrapVal.textContent = Math.floor(p.scrap);
  const secs = Math.floor(state.time);
  const clock = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  const dash = !debug.dashEnabled ? '' : p.dashCd > 0 ? ` · Dash ${p.dashCd.toFixed(1)}s` : ' · Dash ready';
  hud.stats.textContent = `Kills ${state.kills} · ${clock} · Bank ${Math.floor(p.bank)} · Speed ${Math.round(speedMultiplier() * 100)}% · Dmg x${weaponPower().toFixed(2)} · Rate x${fireRateMultiplier().toFixed(2)}${dash}`;

  const open = state.phase === 'depot';
  const type = DEPOT_TYPES[(open ? state.depot : state.nextDepot).type];
  const left = Math.ceil(state.phaseTimer);
  hud.depot.style.borderLeftColor = type.color;
  hud.depot.textContent = open ? `${type.name} depot open · leaves in ${left}s` : `${type.name} depot arrives in ${left}s`;
}

function renderChips() {
  const ups = state.player.upgrades;
  hud.chips.replaceChildren(...Object.keys(UPGRADES).filter((k) => ups[k] > 0).map((k) => {
    const chip = document.createElement('span');
    chip.textContent = `${UPGRADES[k].short} ${ups[k]}`;
    return chip;
  }));
}

// ---------- Overlay: depot, pause, game over ----------

const overlayEl = $('overlay');
const choicesEl = $('choices');

function showOverlay(title, text) {
  $('overlay-title').textContent = title;
  $('overlay-text').textContent = text;
  $('overlay-title').style.color = '';
  choicesEl.replaceChildren();
  overlayEl.hidden = false;
  mouse.down = false;
}

function hideOverlay() { overlayEl.hidden = true; }

/** Opens when the player banks scrap at the depot; stays open so several purchases can be made. */
function openShop() {
  const p = state.player;
  const type = DEPOT_TYPES[state.depot.type];
  state.mode = 'shop';
  showOverlay(`${type.name} depot`, `Bank ${Math.floor(p.bank)} scrap. Buy with the number keys, leave with Esc.`);
  $('overlay-title').style.color = type.color;
  // Basics count purchases in p.bought; upgrades count levels in p.upgrades.
  const sells = (item) => item.depot === state.depot.type && (debug.dashEnabled || !item.dash);
  const items = [
    ...Object.keys(SHOP).filter((k) => sells(SHOP[k])).map((key) => ({ key, item: SHOP[key], owned: p.bought })),
    ...Object.keys(UPGRADES).filter((k) => debug.pool[k] && sells(UPGRADES[k])).map((key) => ({ key, item: UPGRADES[key], owned: p.upgrades })),
  ];
  for (const { key, item, owned } of items) {
    const cost = item.cost + item.costStep * owned[key];
    const full = (key === 'health' && p.health >= PLAYER.health) || (key === 'armour' && p.armour >= PLAYER.armourMax);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.disabled = p.bank < cost || full;
    const name = document.createElement('b');
    name.textContent = `${choicesEl.children.length + 1}. ${item.name} (${cost})`;
    btn.append(name, item.desc);
    btn.addEventListener('click', () => {
      p.bank -= cost;
      owned[key]++;
      if (key === 'health') p.health = Math.min(PLAYER.health, p.health + item.amount);
      if (key === 'armour') p.armour = Math.min(PLAYER.armourMax, p.armour + item.amount);
      renderChips();
      syncUpgradeInputs();
      openShop();
    });
    choicesEl.append(btn);
  }
  const leave = document.createElement('button');
  leave.type = 'button';
  leave.textContent = 'Leave (Esc)';
  leave.addEventListener('click', closeShop);
  choicesEl.append(leave);
}

function closeShop() {
  hideOverlay();
  state.mode = 'playing';
}

function togglePause() {
  if (state.mode === 'playing') {
    state.mode = 'paused';
    showOverlay('Paused', 'Press P to resume');
  } else if (state.mode === 'paused') {
    state.mode = 'playing';
    hideOverlay();
  }
}

const BEST_KEY = 'ironclad.best';
function gameOver() {
  state.mode = 'over';
  let best = 0;
  try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch { /* storage unavailable */ }
  if (state.time > best) {
    best = state.time;
    try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* storage unavailable */ }
  }
  showOverlay('You died', `Survived ${Math.floor(state.time)}s with ${state.kills} kills. Best ${Math.floor(best)}s. Press R to restart.`);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Restart';
  btn.addEventListener('click', newGame);
  choicesEl.append(btn);
}

// ---------- Debug panel ----------

const debugEl = $('debug');
const upgradeInputs = {};
$('debug-toggle').addEventListener('click', toggleDebug);

function toggleDebug() { debugEl.hidden = !debugEl.hidden; }

function row(labelText, input, out) {
  const label = document.createElement('label');
  label.append(labelText, ...(out ? [input, out] : [input]));
  return label;
}

function heading(text) {
  const h = document.createElement('h3');
  h.textContent = text;
  return h;
}

function checkbox(get, set) {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = get();
  input.addEventListener('change', () => { set(input.checked); saveDebug(); });
  return input;
}

function slider(key, min, max, step, unit) {
  const input = Object.assign(document.createElement('input'), { type: 'range', min, max, step, value: debug[key] });
  const out = document.createElement('output');
  const show = () => { out.textContent = `${debug[key]}${unit}`; };
  input.addEventListener('input', () => { debug[key] = Number(input.value); show(); saveDebug(); });
  show();
  return [input, out];
}

function buildDebug() {
  const select = document.createElement('select');
  for (const [value, text] of [['pistol', 'Slow pistol'], ['melee', 'Melee']]) {
    select.append(Object.assign(document.createElement('option'), { value, textContent: text, selected: debug.baseAttack === value }));
  }
  select.addEventListener('change', () => { debug.baseAttack = select.value; saveDebug(); });

  const levels = Object.keys(UPGRADES).map((k) => {
    const input = Object.assign(document.createElement('input'), { type: 'number', min: 0, max: 20, step: 1 });
    input.addEventListener('input', () => {
      state.player.upgrades[k] = clamp(Math.floor(Number(input.value) || 0), 0, 20);
      renderChips();
    });
    upgradeInputs[k] = input;
    return row(UPGRADES[k].name, input);
  });

  const restart = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Restart run' });
  restart.addEventListener('click', newGame);
  const reset = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Reset debug' });
  reset.addEventListener('click', () => { debug = structuredClone(DEFAULT_DEBUG); saveDebug(); buildDebug(); });
  const buttons = document.createElement('div');
  buttons.className = 'buttons';
  buttons.append(restart, reset);

  debugEl.replaceChildren(
    heading('Base attack'),
    row('Weapon', select),
    row('Damage per kill', ...slider('damagePerKillPercent', 0, 10, 0.5, '%')),
    heading('Dash (Space)'),
    row('Dash kills on contact', checkbox(() => debug.dashEnabled, (v) => { debug.dashEnabled = v; })),
    row('Cooldown', ...slider('dashCooldown', 0.5, 10, 0.5, 's')),
    row('Distance', ...slider('dashDistance', 80, 320, 20, '')),
    heading('Depots'),
    row('Wave length', ...slider('waveTime', 10, 120, 5, 's')),
    row('Depot stays', ...slider('depotTime', 5, 60, 5, 's')),
    heading('Enemies'),
    row('Speed', ...slider('enemySpeedPercent', 40, 120, 5, '%')),
    heading('Scrap'),
    row('Max slow at full scrap', ...slider('maxSlowPercent', 0, 90, 5, '%')),
    row('Hits spill scrap', checkbox(() => debug.scrapSpill, (v) => { debug.scrapSpill = v; })),
    row('Spilled per hit', ...slider('spillPercent', 10, 100, 10, '%')),
    row('Pickup delay', ...slider('spillDelay', 0, 10, 0.5, 's')),
    heading('Armour'),
    row('Shots cost armour', checkbox(() => debug.shotsCostArmour, (v) => { debug.shotsCostArmour = v; })),
    row('Armour per shot', ...slider('armourPerShot', 1, 10, 1, '')),
    heading('Depot upgrades'),
    ...Object.keys(UPGRADES).map((k) => row(UPGRADES[k].name, checkbox(() => debug.pool[k], (v) => { debug.pool[k] = v; }))),
    heading('Upgrade levels (this run)'),
    ...levels,
    buttons,
  );
  syncUpgradeInputs();
}

function syncUpgradeInputs() {
  if (!state) return;
  for (const [k, input] of Object.entries(upgradeInputs)) {
    if (document.activeElement !== input) input.value = state.player.upgrades[k];
  }
}

// ---------- Boot ----------

resize();
newGame();
buildDebug();
requestAnimationFrame(frame);
