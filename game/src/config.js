// Lumen Drift — tuning constants and palette in one place.
// The arena is a fixed logical size; CSS scales the canvas to the page.
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
};

export const PLAYER = {
  radius: 13,
  accel: 2600,
  maxSpeed: 340,
  drag: 6.5,
  fireInterval: 0.125,
  bulletSpeed: 720,
  bulletDamage: 1,
  dashSpeed: 950,
  dashTime: 0.16,
  dashCooldown: 1.1,
  invulnerableTime: 1.2,
  maxHull: 3,
  novaRadius: 260,
  novaDamage: 3,
  maxNova: 3,
};

// Cost in wave-budget points, and the score each kill is worth (before multiplier).
export const ENEMIES = {
  drifter: { hp: 1, speed: 105, radius: 14, score: 50, cost: 1 },
  weaver: { hp: 2, speed: 130, radius: 13, score: 100, cost: 2, fireInterval: 2.2, bulletSpeed: 260 },
  splitter: { hp: 3, speed: 48, radius: 20, score: 150, cost: 3, children: 3 },
  charger: { hp: 2, speed: 90, radius: 14, score: 120, cost: 2, telegraph: 0.6, lungeSpeed: 540 },
  warden: { hp: 42, speed: 42, radius: 46, score: 1000, cost: 0, burstInterval: 2.6, burstCount: 12, spawnInterval: 6 },
};

export const WAVES = {
  baseBudget: 4,
  budgetPerWave: 3,
  maxAliveBase: 12,
  maxAlivePerWave: 1,
  clearBonusPerWave: 100,
  breatherSeconds: 2.5,
  wardenEvery: 5,
};

export const COMBO = {
  perMultiplier: 8, // kills per +1 multiplier step
  maxMultiplier: 5,
};

export const DROPS = {
  shardChance: 0.55,
  cellChance: 0.08,
  novaChance: 0.05,
};
