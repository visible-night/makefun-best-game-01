// Lumen Drift v2 — tuning constants and palette in one place.
// The arena is a fixed logical size; the canvas backing store scales with
// devicePixelRatio and CSS scales the canvas to the page.
export const ARENA_WIDTH = 960;
export const ARENA_HEIGHT = 600;

export const COLORS = {
  background: '#070b1a',
  player: '#57f7ff',
  playerCore: '#e8feff',
  bullet: '#aefcff',
  enemyBullet: '#ff6b81',
  drifter: '#ff4d8d',
  weaver: '#b07bff',
  splitter: '#ffb02e',
  charger: '#ff5340',
  warden: '#ff7ad9',
  shard: '#ffe066',
  cell: '#7dff8a',
  nova: '#8affff',
  text: '#eaf6ff',
  dimText: '#8fa8c8',
  danger: '#ff5b7f',
};

export const PLAYER = {
  radius: 13,
  accel: 2800,
  maxSpeed: 360,
  drag: 6.5,
  bulletSpeed: 760,
  bulletDamage: 1,
  dashSpeed: 980,
  dashTime: 0.16,
  dashCooldown: 1.0,
  invulnerableTime: 1.0,
  maxHull: 3,
  novaRadius: 280,
  novaDamage: 3,
  maxNova: 3,
};

// Weapon levels. Shards collected feed the meter; reaching a level's
// shard total upgrades the gun. Level 1 is the starting single cannon.
export const WEAPONS = [
  { name: 'PULSE', shots: 1, spread: 0, side: 0, interval: 0.125, shardsNeeded: 0 },
  { name: 'TWIN', shots: 2, spread: 0, side: 7, interval: 0.12, shardsNeeded: 8 },
  { name: 'TRI-BURST', shots: 3, spread: 0.13, side: 0, interval: 0.115, shardsNeeded: 20 },
];

// Cost in wave-budget points, and the score each kill is worth (before multiplier).
export const ENEMIES = {
  drifter: { hp: 1, speed: 115, radius: 14, score: 50, cost: 1 },
  weaver: { hp: 2, speed: 130, radius: 13, score: 100, cost: 2, fireInterval: 2.0, bulletSpeed: 270 },
  splitter: { hp: 3, speed: 52, radius: 20, score: 150, cost: 3, children: 3 },
  charger: { hp: 2, speed: 95, radius: 14, score: 120, cost: 2, telegraph: 0.55, lungeSpeed: 560 },
  warden: { hp: 36, speed: 44, radius: 46, score: 1000, cost: 0, burstInterval: 2.6, burstCount: 12, spawnInterval: 6 },
};

export const WAVES = {
  baseBudget: 6,
  budgetPerWave: 3,
  spawnInterval: 0.45,
  instantSpawns: 3, // enemies already in the arena when the wave banner shows
  maxAliveBase: 14,
  maxAlivePerWave: 1,
  clearBonusPerWave: 100,
  breatherSeconds: 2.0,
  wardenEvery: 5,
};

export const COMBO = {
  window: 3.5, // seconds without a kill before the combo resets
  perMultiplier: 8, // kills per +1 multiplier step
  maxMultiplier: 5,
};

export const DROPS = {
  shardChance: 0.55,
  cellChance: 0.08,
  novaChance: 0.05,
};

// Juice tuning: hit-stop freezes, trauma shake, slow motion on death.
export const JUICE = {
  hitStopKill: 0.045,
  hitStopWarden: 0.12,
  hitStopNova: 0.09,
  hitStopHurt: 0.07,
  traumaKill: 0.22,
  traumaWarden: 0.85,
  traumaNova: 0.6,
  traumaHurt: 0.7,
  shakeMax: 16, // pixels at full trauma
  dyingSlowmo: 0.25, // time scale while the death animation plays
  dyingSeconds: 1.0,
  maxParticles: 420,
};
