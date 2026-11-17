// Lumen Drift — the simulation: player, enemies, bullets, pickups, waves.
// Pure state plus one update step; rendering lives in render.js and input
// handling in main.js. Nothing here touches the DOM or the network.
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  PLAYER,
  ENEMIES,
  WAVES,
  COMBO,
  DROPS,
  COLORS,
} from './config.js';
import { makeRng, range, pick, angleTo, clamp, distance } from './random.js';

export function createWorld(seed = (Math.random() * 0xffffffff) >>> 0) {
  return {
    rng: makeRng(seed),
    time: 0,
    state: 'title', // title | playing | paused | over
    player: {
      x: ARENA_WIDTH / 2,
      y: ARENA_HEIGHT / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      hull: PLAYER.maxHull,
      fireTimer: 0,
      dashTimer: 0,
      dashCooldown: 0,
      dashDirX: 0,
      dashDirY: -1,
      invulnerable: 0,
      nova: 1,
      thrust: 0,
    },
    bullets: [], // {x, y, vx, vy, friendly, damage, life}
    enemies: [], // {kind, x, y, vx, vy, hp, maxHp, radius, angle, fireTimer, mode, modeTimer, flash}
    particles: [], // {x, y, vx, vy, life, maxLife, size, color}
    pickups: [], // {kind, x, y, vx, vy, life}
    texts: [], // {x, y, text, life, color, size}
    stars: makeStars(),
    score: 0,
    best: loadBest(),
    combo: 0,
    wave: 0,
    waveQueue: [],
    spawnTimer: 0,
    breather: 0,
    enemiesLeft: 0,
    shake: 0,
    banner: '',
    bannerTimer: 0,
    newBest: false,
    muted: false,
  };
}

function loadBest() {
  try {
    return Number(window.localStorage.getItem('lumen-drift-best') || 0) || 0;
  } catch (error) {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem('lumen-drift-best', String(value));
  } catch (error) {
    // Storage may be unavailable (file://, private mode); the run still counts.
  }
}

function makeStars() {
  const stars = [];
  const rng = makeRng(1337);
  for (let layer = 0; layer < 3; layer += 1) {
    for (let i = 0; i < 42; i += 1) {
      stars.push({
        x: rng() * ARENA_WIDTH,
        y: rng() * ARENA_HEIGHT,
        layer,
        size: 0.6 + layer * 0.7 + rng() * 0.6,
        twinkle: rng() * Math.PI * 2,
      });
    }
  }
  return stars;
}

export function multiplier(world) {
  return 1 + Math.min(COMBO.maxMultiplier - 1, Math.floor(world.combo / COMBO.perMultiplier));
}

export function startRun(world) {
  const fresh = createWorld();
  fresh.best = world.best;
  fresh.muted = world.muted;
  Object.assign(world, fresh);
  world.state = 'playing';
  nextWave(world);
}

export function nextWave(world) {
  world.wave += 1;
  const budget = WAVES.baseBudget + world.wave * WAVES.budgetPerWave;
  const queue = [];
  let spent = 0;
  const kinds = ['drifter'];
  if (world.wave >= 2) kinds.push('weaver');
  if (world.wave >= 3) kinds.push('charger');
  if (world.wave >= 4) kinds.push('splitter');
  while (spent < budget) {
    const kind = pick(world.rng, kinds);
    const cost = ENEMIES[kind].cost;
    if (spent + cost > budget + 2) break;
    queue.push(kind);
    spent += cost;
  }
  if (world.wave % WAVES.wardenEvery === 0) queue.unshift('warden');
  world.waveQueue = queue;
  world.spawnTimer = 0.4;
  world.enemiesLeft = queue.length;
  world.banner = world.wave % WAVES.wardenEvery === 0 ? `WAVE ${world.wave} — THE WARDEN WAKES` : `WAVE ${world.wave}`;
  world.bannerTimer = 2.2;
}

function spawnPoint(world) {
  const edge = Math.floor(world.rng() * 4);
  const margin = 30;
  if (edge === 0) return { x: range(world.rng, 0, ARENA_WIDTH), y: -margin };
  if (edge === 1) return { x: ARENA_WIDTH + margin, y: range(world.rng, 0, ARENA_HEIGHT) };
  if (edge === 2) return { x: range(world.rng, 0, ARENA_WIDTH), y: ARENA_HEIGHT + margin };
  return { x: -margin, y: range(world.rng, 0, ARENA_HEIGHT) };
}

export function spawnEnemy(world, kind, x, y) {
  const spec = ENEMIES[kind];
  const at = x === undefined ? spawnPoint(world) : { x, y };
  world.enemies.push({
    kind,
    x: at.x,
    y: at.y,
    vx: 0,
    vy: 0,
    hp: spec.hp,
    maxHp: spec.hp,
    radius: spec.radius,
    angle: 0,
    fireTimer: range(world.rng, 1, 2.5),
    burstTimer: 2,
    spawnTimer: 4,
    mode: 'chase',
    modeTimer: range(world.rng, 1.5, 3),
    lungeX: 0,
    lungeY: 0,
    flash: 0,
    wobble: world.rng() * Math.PI * 2,
  });
}

function burst(world, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const angle = world.rng() * Math.PI * 2;
    const v = range(world.rng, speed * 0.3, speed);
    world.particles.push({
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life: range(world.rng, 0.3, 0.7),
      maxLife: 0.7,
      size: range(world.rng, 1.5, 3.5),
      color,
    });
  }
}

function floatText(world, x, y, text, color, size = 14) {
  world.texts.push({ x, y, text, color, size, life: 0.9 });
}

function dropPickup(world, x, y, kind) {
  world.pickups.push({
    kind,
    x,
    y,
    vx: range(world.rng, -40, 40),
    vy: range(world.rng, -40, 40),
    life: 9,
  });
}

function killEnemy(world, enemy, audio) {
  const spec = ENEMIES[enemy.kind];
  const gained = spec.score * multiplier(world);
  world.score += gained;
  world.combo += 1;
  world.enemiesLeft -= 1;
  floatText(world, enemy.x, enemy.y - 14, `+${gained}`, COLORS.text);
  burst(world, enemy.x, enemy.y, COLORS[enemy.kind], enemy.kind === 'warden' ? 60 : 18, 220);
  audio.explosion(enemy.kind === 'warden');
  if (enemy.kind === 'splitter') {
    for (let i = 0; i < spec.children; i += 1) {
      const angle = (i / spec.children) * Math.PI * 2;
      spawnEnemy(world, 'drifter', enemy.x + Math.cos(angle) * 18, enemy.y + Math.sin(angle) * 18);
      world.enemiesLeft += 1;
    }
  }
  if (enemy.kind === 'warden') {
    dropPickup(world, enemy.x, enemy.y, 'nova');
    dropPickup(world, enemy.x + 20, enemy.y, 'cell');
    world.shake = Math.max(world.shake, 14);
  } else {
    const roll = world.rng();
    if (roll < DROPS.cellChance) dropPickup(world, enemy.x, enemy.y, 'cell');
    else if (roll < DROPS.cellChance + DROPS.novaChance) dropPickup(world, enemy.x, enemy.y, 'nova');
    else if (world.rng() < DROPS.shardChance) dropPickup(world, enemy.x, enemy.y, 'shard');
  }
}

export function fireNova(world, audio) {
  const player = world.player;
  if (player.nova <= 0) return false;
  player.nova -= 1;
  world.shake = Math.max(world.shake, 10);
  audio.nova();
  burst(world, player.x, player.y, COLORS.nova, 50, 420);
  // Enemy bullets inside the blast dissolve; enemies take heavy damage.
  world.bullets = world.bullets.filter((bullet) => {
    if (bullet.friendly) return true;
    return distance(bullet.x, bullet.y, player.x, player.y) > PLAYER.novaRadius;
  });
  for (const enemy of world.enemies) {
    if (distance(enemy.x, enemy.y, player.x, player.y) <= PLAYER.novaRadius + enemy.radius) {
      enemy.hp -= PLAYER.novaDamage;
      enemy.flash = 0.15;
    }
  }
  return true;
}

function hurtPlayer(world, audio) {
  const player = world.player;
  if (player.invulnerable > 0 || player.dashTimer > 0) return;
  player.hull -= 1;
  player.invulnerable = PLAYER.invulnerableTime;
  world.combo = 0;
  world.shake = Math.max(world.shake, 12);
  burst(world, player.x, player.y, COLORS.player, 30, 300);
  audio.hurt();
  if (player.hull <= 0) {
    world.state = 'over';
    world.newBest = world.score > world.best;
    if (world.newBest) {
      world.best = world.score;
      saveBest(world.best);
    }
    burst(world, player.x, player.y, COLORS.player, 80, 380);
    audio.explosion(true);
    audio.gameOver();
    audio.stopMusic();
  }
}

function updatePlayer(world, input, dt, audio) {
  const player = world.player;
  const move = input.moveVector();
  player.angle = angleTo(player.x, player.y, input.mouseX, input.mouseY);

  if (player.dashCooldown > 0) player.dashCooldown -= dt;
  if (player.invulnerable > 0) player.invulnerable -= dt;

  if (input.wasPressed(' ') && player.dashCooldown <= 0 && (move.x !== 0 || move.y !== 0)) {
    player.dashTimer = PLAYER.dashTime;
    player.dashCooldown = PLAYER.dashCooldown;
    player.dashDirX = move.x;
    player.dashDirY = move.y;
    audio.dash();
  }

  if (player.dashTimer > 0) {
    player.dashTimer -= dt;
    player.vx = player.dashDirX * PLAYER.dashSpeed;
    player.vy = player.dashDirY * PLAYER.dashSpeed;
    world.particles.push({
      x: player.x,
      y: player.y,
      vx: -player.dashDirX * 60,
      vy: -player.dashDirY * 60,
      life: 0.25,
      maxLife: 0.25,
      size: 4,
      color: COLORS.player,
    });
  } else {
    player.vx += move.x * PLAYER.accel * dt;
    player.vy += move.y * PLAYER.accel * dt;
    const drag = Math.max(0, 1 - PLAYER.drag * dt);
    player.vx *= drag;
    player.vy *= drag;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > PLAYER.maxSpeed) {
      player.vx = (player.vx / speed) * PLAYER.maxSpeed;
      player.vy = (player.vy / speed) * PLAYER.maxSpeed;
    }
  }

  player.x = clamp(player.x + player.vx * dt, PLAYER.radius, ARENA_WIDTH - PLAYER.radius);
  player.y = clamp(player.y + player.vy * dt, PLAYER.radius, ARENA_HEIGHT - PLAYER.radius);
  player.thrust = Math.hypot(player.vx, player.vy) / PLAYER.maxSpeed;

  // Engine trail.
  if (player.thrust > 0.25 && world.rng() < 0.6) {
    const back = player.angle + Math.PI;
    world.particles.push({
      x: player.x + Math.cos(back) * 14,
      y: player.y + Math.sin(back) * 14,
      vx: Math.cos(back) * 60 + range(world.rng, -20, 20),
      vy: Math.sin(back) * 60 + range(world.rng, -20, 20),
      life: 0.3,
      maxLife: 0.3,
      size: 2.5,
      color: COLORS.player,
    });
  }

  player.fireTimer -= dt;
  if (input.firing && player.fireTimer <= 0) {
    player.fireTimer = PLAYER.fireInterval;
    const nose = player.angle;
    world.bullets.push({
      x: player.x + Math.cos(nose) * 18,
      y: player.y + Math.sin(nose) * 18,
      vx: Math.cos(nose) * PLAYER.bulletSpeed + player.vx * 0.25,
      vy: Math.sin(nose) * PLAYER.bulletSpeed + player.vy * 0.25,
      friendly: true,
      damage: PLAYER.bulletDamage,
      life: 1.1,
    });
    audio.shoot();
  }

  if (input.wasPressed('e') || input.wasPressed('nova')) {
    fireNova(world, audio);
  }
}

function updateEnemy(world, enemy, dt, audio) {
  const player = world.player;
  const spec = ENEMIES[enemy.kind];
  const toPlayer = angleTo(enemy.x, enemy.y, player.x, player.y);
  const dist = distance(enemy.x, enemy.y, player.x, player.y);
  enemy.flash = Math.max(0, enemy.flash - dt);
  enemy.wobble += dt * 3;

  if (enemy.kind === 'drifter') {
    enemy.vx += Math.cos(toPlayer) * 260 * dt;
    enemy.vy += Math.sin(toPlayer) * 260 * dt;
  } else if (enemy.kind === 'weaver') {
    // Keep a ring around the player and strafe; fire aimed shots.
    const orbit = dist > 300 ? 1 : dist < 200 ? -1 : 0;
    const strafe = Math.sin(enemy.wobble) > 0 ? 1 : -1;
    enemy.vx += (Math.cos(toPlayer) * orbit + Math.cos(toPlayer + Math.PI / 2) * strafe) * 220 * dt;
    enemy.vy += (Math.sin(toPlayer) * orbit + Math.sin(toPlayer + Math.PI / 2) * strafe) * 220 * dt;
    enemy.fireTimer -= dt;
    if (enemy.fireTimer <= 0 && dist < 520) {
      enemy.fireTimer = spec.fireInterval * range(world.rng, 0.85, 1.2);
      world.bullets.push({
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(toPlayer) * spec.bulletSpeed,
        vy: Math.sin(toPlayer) * spec.bulletSpeed,
        friendly: false,
        damage: 1,
        life: 3,
      });
      audio.enemyShoot();
    }
  } else if (enemy.kind === 'splitter') {
    enemy.vx += Math.cos(toPlayer) * 120 * dt;
    enemy.vy += Math.sin(toPlayer) * 120 * dt;
  } else if (enemy.kind === 'charger') {
    enemy.modeTimer -= dt;
    if (enemy.mode === 'chase') {
      enemy.vx += Math.cos(toPlayer) * 200 * dt;
      enemy.vy += Math.sin(toPlayer) * 200 * dt;
      if (enemy.modeTimer <= 0 && dist < 420) {
        enemy.mode = 'telegraph';
        enemy.modeTimer = spec.telegraph;
      }
    } else if (enemy.mode === 'telegraph') {
      enemy.vx *= 0.9;
      enemy.vy *= 0.9;
      if (enemy.modeTimer <= 0) {
        enemy.mode = 'lunge';
        enemy.modeTimer = 0.55;
        enemy.lungeX = Math.cos(toPlayer);
        enemy.lungeY = Math.sin(toPlayer);
        audio.enemyShoot();
      }
    } else {
      enemy.vx = enemy.lungeX * spec.lungeSpeed;
      enemy.vy = enemy.lungeY * spec.lungeSpeed;
      if (enemy.modeTimer <= 0) {
        enemy.mode = 'chase';
        enemy.modeTimer = range(world.rng, 1.2, 2.2);
      }
    }
  } else if (enemy.kind === 'warden') {
    enemy.vx += Math.cos(toPlayer) * 90 * dt;
    enemy.vy += Math.sin(toPlayer) * 90 * dt;
    enemy.burstTimer -= dt;
    if (enemy.burstTimer <= 0) {
      enemy.burstTimer = spec.burstInterval;
      const offset = world.rng() * Math.PI * 2;
      for (let i = 0; i < spec.burstCount; i += 1) {
        const a = offset + (i / spec.burstCount) * Math.PI * 2;
        world.bullets.push({
          x: enemy.x + Math.cos(a) * enemy.radius,
          y: enemy.y + Math.sin(a) * enemy.radius,
          vx: Math.cos(a) * 190,
          vy: Math.sin(a) * 190,
          friendly: false,
          damage: 1,
          life: 4,
        });
      }
      audio.enemyShoot();
    }
    enemy.spawnTimer -= dt;
    if (enemy.spawnTimer <= 0 && world.enemies.length < 22) {
      enemy.spawnTimer = spec.spawnInterval;
      spawnEnemy(world, 'drifter', enemy.x, enemy.y);
      world.enemiesLeft += 1;
    }
  }

  // Cap speed and integrate.
  const speed = Math.hypot(enemy.vx, enemy.vy);
  const cap = enemy.kind === 'charger' && enemy.mode === 'lunge' ? spec.lungeSpeed : spec.speed;
  if (speed > cap) {
    enemy.vx = (enemy.vx / speed) * cap;
    enemy.vy = (enemy.vy / speed) * cap;
  }
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  enemy.angle = toPlayer;
}

function updateBullets(world, dt, audio) {
  const player = world.player;
  for (const bullet of world.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
  }
  world.bullets = world.bullets.filter(
    (b) => b.life > 0 && b.x > -20 && b.x < ARENA_WIDTH + 20 && b.y > -20 && b.y < ARENA_HEIGHT + 20,
  );

  // Friendly bullets against enemies.
  for (const bullet of world.bullets) {
    if (!bullet.friendly || bullet.life <= 0) continue;
    for (const enemy of world.enemies) {
      if (enemy.hp <= 0) continue;
      if (distance(bullet.x, bullet.y, enemy.x, enemy.y) < enemy.radius + 4) {
        enemy.hp -= bullet.damage;
        enemy.flash = 0.12;
        bullet.life = 0;
        burst(world, bullet.x, bullet.y, COLORS.bullet, 4, 120);
        audio.hit();
        break;
      }
    }
  }
  world.bullets = world.bullets.filter((b) => b.life > 0);

  // Enemy bullets and bodies against the player.
  for (const bullet of world.bullets) {
    if (bullet.friendly) continue;
    if (distance(bullet.x, bullet.y, player.x, player.y) < PLAYER.radius + 4) {
      bullet.life = 0;
      hurtPlayer(world, audio);
      if (world.state !== 'playing') return;
    }
  }
  world.bullets = world.bullets.filter((b) => b.life > 0);
  for (const enemy of world.enemies) {
    if (enemy.hp > 0 && distance(enemy.x, enemy.y, player.x, player.y) < enemy.radius + PLAYER.radius - 2) {
      enemy.hp = 0; // a kamikaze hit destroys the enemy too
      hurtPlayer(world, audio);
      if (world.state !== 'playing') return;
    }
  }

  // Sweep the dead.
  const dead = world.enemies.filter((e) => e.hp <= 0);
  if (dead.length > 0) {
    world.enemies = world.enemies.filter((e) => e.hp > 0);
    for (const enemy of dead) killEnemy(world, enemy, audio);
  }
}

function updatePickups(world, dt, audio) {
  const player = world.player;
  for (const pickup of world.pickups) {
    pickup.life -= dt;
    const dist = distance(pickup.x, pickup.y, player.x, player.y);
    if (dist < 110) {
      const angle = angleTo(pickup.x, pickup.y, player.x, player.y);
      pickup.vx += Math.cos(angle) * 900 * dt;
      pickup.vy += Math.sin(angle) * 900 * dt;
    } else {
      pickup.vx *= 0.98;
      pickup.vy *= 0.98;
    }
    pickup.x += pickup.vx * dt;
    pickup.y += pickup.vy * dt;
    if (dist < PLAYER.radius + 12) {
      pickup.life = 0;
      if (pickup.kind === 'shard') {
        const gained = 25 * multiplier(world);
        world.score += gained;
        floatText(world, pickup.x, pickup.y - 10, `+${gained}`, COLORS.shard);
        audio.pickup();
      } else if (pickup.kind === 'cell') {
        player.hull = Math.min(PLAYER.maxHull, player.hull + 1);
        floatText(world, pickup.x, pickup.y - 10, '+1 HULL', COLORS.cell);
        audio.heal();
      } else if (pickup.kind === 'nova') {
        player.nova = Math.min(PLAYER.maxNova, player.nova + 1);
        floatText(world, pickup.x, pickup.y - 10, '+1 NOVA', COLORS.nova);
        audio.pickup();
      }
      burst(world, pickup.x, pickup.y, COLORS[pickup.kind], 8, 140);
    }
  }
  world.pickups = world.pickups.filter((p) => p.life > 0);
}

export function update(world, input, dt, audio) {
  if (world.state !== 'playing') return;
  world.time += dt;
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 30);
  if (world.bannerTimer > 0) world.bannerTimer -= dt;

  // Spawn the wave's queue a few at a time.
  const maxAlive = WAVES.maxAliveBase + world.wave * WAVES.maxAlivePerWave;
  if (world.waveQueue.length > 0) {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0 && world.enemies.length < maxAlive) {
      world.spawnTimer = 0.55;
      spawnEnemy(world, world.waveQueue.shift());
    }
  } else if (world.enemies.length === 0 && world.enemiesLeft <= 0) {
    // Wave cleared: bonus, breather, next wave.
    if (world.breather <= 0) {
      const bonus = WAVES.clearBonusPerWave * world.wave;
      world.score += bonus;
      world.banner = `WAVE ${world.wave} CLEARED  +${bonus}`;
      world.bannerTimer = 2.2;
      world.breather = WAVES.breatherSeconds;
      audio.wave();
    } else {
      world.breather -= dt;
      if (world.breather <= 0) nextWave(world);
    }
  }

  updatePlayer(world, input, dt, audio);
  if (world.state !== 'playing') return;
  for (const enemy of world.enemies) updateEnemy(world, enemy, dt, audio);
  updateBullets(world, dt, audio);
  if (world.state !== 'playing') return;
  updatePickups(world, dt, audio);

  for (const particle of world.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.96;
    particle.vy *= 0.96;
    particle.life -= dt;
  }
  world.particles = world.particles.filter((p) => p.life > 0);
  for (const text of world.texts) {
    text.y -= 34 * dt;
    text.life -= dt;
  }
  world.texts = world.texts.filter((t) => t.life > 0);
}
