// Screenshot staging: ?shot=title|play|late|over builds a representative
// state of the real game and renders it, so the screenshots are true renders
// of this code — a title screen over a live demo run, mid-run action, a
// late boss fight, and the game-over screen with its stats. Staged states
// use a fixed seed so they render the same way every time; normal play
// never reads this module's staging.
import { ARENA_WIDTH, ARENA_HEIGHT, COLORS } from './config.js';
import { createWorld, spawnEnemy, update } from './world.js';
import { silentAudio } from './audio.js';
import { makeRng, range } from './random.js';
import { burst, ring } from './juice.js';

function seedBullets(world, rng, count, friendly) {
  for (let i = 0; i < count; i += 1) {
    const angle = rng() * Math.PI * 2;
    world.bullets.push({
      x: range(rng, 120, ARENA_WIDTH - 120),
      y: range(rng, 100, ARENA_HEIGHT - 100),
      vx: Math.cos(angle) * (friendly ? 760 : 220),
      vy: Math.sin(angle) * (friendly ? 760 : 220),
      friendly,
      damage: 1,
      life: 1,
    });
  }
}

function seedBurst(world, rng, x, y, color, count) {
  burst(world.juice, rng, x, y, color, count, 280);
}

function settleEnemies(world) {
  for (const enemy of world.enemies) enemy.spawnT = 1;
}

function stagePlay(world, rng) {
  world.state = 'playing';
  world.wave = 3;
  world.score = 2450;
  world.combo = 18;
  world.comboTimer = 2.0;
  world.maxCombo = 18;
  world.kills = 24;
  world.player.x = 470;
  world.player.y = 330;
  world.player.angle = -0.6;
  world.player.nova = 2;
  world.player.weapon = 1;
  world.player.shards = 12;
  spawnEnemy(world, 'drifter', 620, 180);
  spawnEnemy(world, 'drifter', 700, 420);
  spawnEnemy(world, 'drifter', 300, 150);
  spawnEnemy(world, 'weaver', 760, 250);
  spawnEnemy(world, 'weaver', 250, 430);
  spawnEnemy(world, 'splitter', 560, 120);
  spawnEnemy(world, 'charger', 180, 300);
  spawnEnemy(world, 'drifter', 820, 520);
  world.enemies[0].flash = 0.1;
  seedBullets(world, rng, 6, true);
  seedBullets(world, rng, 3, false);
  seedBurst(world, rng, 640, 200, COLORS.drifter, 14);
  seedBurst(world, rng, 300, 430, COLORS.weaver, 10);
  ring(world.juice, 640, 200, COLORS.drifter, 90);
  world.pickups.push({ kind: 'shard', x: 520, y: 420, vx: 0, vy: 0, life: 9 });
  world.pickups.push({ kind: 'shard', x: 380, y: 250, vx: 0, vy: 0, life: 9 });
  world.pickups.push({ kind: 'cell', x: 700, y: 320, vx: 0, vy: 0, life: 9 });
  world.enemiesLeft = 0;
  world.waveQueue = ['drifter', 'drifter', 'weaver'];
  settleEnemies(world);
}

function stageLate(world, rng) {
  world.state = 'playing';
  world.wave = 10;
  world.score = 9870;
  world.combo = 31;
  world.comboTimer = 1.5;
  world.maxCombo = 31;
  world.kills = 96;
  world.player.x = 300;
  world.player.y = 400;
  world.player.angle = 0.5;
  world.player.hull = 2;
  world.player.nova = 1;
  world.player.dashCooldown = 0.4;
  world.player.weapon = 2;
  world.player.shards = 20;
  spawnEnemy(world, 'warden', 660, 220);
  spawnEnemy(world, 'drifter', 760, 420);
  spawnEnemy(world, 'drifter', 580, 480);
  spawnEnemy(world, 'weaver', 820, 160);
  spawnEnemy(world, 'splitter', 480, 140);
  spawnEnemy(world, 'charger', 200, 180);
  world.enemies[0].hp = 22;
  // A radial burst frozen mid-flight around the warden.
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2 + 0.3;
    world.bullets.push({
      x: 660 + Math.cos(a) * 150,
      y: 220 + Math.sin(a) * 150,
      vx: Math.cos(a) * 190,
      vy: Math.sin(a) * 190,
      friendly: false,
      damage: 1,
      life: 3,
    });
  }
  seedBullets(world, rng, 5, true);
  seedBurst(world, rng, 700, 260, COLORS.warden, 22);
  seedBurst(world, rng, 330, 380, COLORS.player, 12);
  ring(world.juice, 660, 220, COLORS.warden, 160);
  world.pickups.push({ kind: 'cell', x: 420, y: 500, vx: 0, vy: 0, life: 9 });
  world.enemiesLeft = 0;
  world.waveQueue = ['drifter', 'weaver', 'splitter', 'charger'];
  world.banner = 'WAVE 10 — THE WARDEN WAKES';
  world.bannerTimer = 1.5;
  settleEnemies(world);
}

function stageOver(world) {
  world.state = 'over';
  world.wave = 9;
  world.score = 12450;
  world.best = 12450;
  world.newBest = true;
  world.kills = 87;
  world.maxCombo = 24;
  world.runTime = 342;
  world.player.hull = 0;
}

function stageTitle(world, rng) {
  // The cover: a dense mid-combat scene behind the title text. Enemies,
  // bullets and pickups sit in the clear bands the title scrim leaves
  // open (top, bottom and far edges) so the action reads around the text.
  world.state = 'playing';
  world.wave = 2;
  world.score = 1250;
  world.combo = 12;
  world.comboTimer = 2.5;
  world.maxCombo = 12;
  world.kills = 15;
  world.player.x = 300;
  world.player.y = 520;
  world.player.angle = -0.9;
  world.player.nova = 2;
  world.player.weapon = 1;
  world.player.shards = 10;
  spawnEnemy(world, 'drifter', 850, 90);
  spawnEnemy(world, 'drifter', 120, 110);
  spawnEnemy(world, 'drifter', 880, 470);
  spawnEnemy(world, 'weaver', 130, 420);
  spawnEnemy(world, 'weaver', 830, 300);
  spawnEnemy(world, 'splitter', 780, 80);
  spawnEnemy(world, 'charger', 110, 520);
  spawnEnemy(world, 'drifter', 700, 60);
  world.enemies[0].flash = 0.1;
  seedBullets(world, rng, 7, true);
  seedBullets(world, rng, 2, false);
  seedBurst(world, rng, 850, 120, COLORS.drifter, 16);
  seedBurst(world, rng, 150, 500, COLORS.weaver, 12);
  ring(world.juice, 850, 120, COLORS.drifter, 90);
  ring(world.juice, 150, 500, COLORS.weaver, 70);
  world.pickups.push({ kind: 'shard', x: 700, y: 540, vx: 0, vy: 0, life: 9 });
  world.pickups.push({ kind: 'shard', x: 400, y: 80, vx: 0, vy: 0, life: 9 });
  world.pickups.push({ kind: 'cell', x: 850, y: 540, vx: 0, vy: 0, life: 9 });
  world.enemiesLeft = 0;
  world.waveQueue = ['drifter', 'weaver'];
  settleEnemies(world);
}

// Builds the world for one screenshot. Returns the world and the render
// mode: the title shot is a staged combat scene under the title screen.
export function stageShot(name) {
  if (name === 'title') {
    const world = createWorld(20261118);
    const rng = makeRng(20261118);
    // sin(time * 3) = 1 here, so the pulsing prompt renders at full brightness.
    world.time = Math.PI / 6;
    stageTitle(world, rng);
    return { world, mode: 'title' };
  }
  const world = createWorld(20261118);
  const rng = makeRng(20261118);
  world.time = Math.PI / 6;
  if (name === 'play') stagePlay(world, rng);
  else if (name === 'late') stageLate(world, rng);
  else if (name === 'over') stageOver(world);
  else world.state = 'title';
  return { world, mode: 'game' };
}

// Runs a few headless update steps so staged bullets and particles sit
// mid-flight, then leaves the world frozen for the screenshot.
export function settleShot(world, input, audio) {
  if (world.state !== 'playing') return;
  const frozen = { ...input, firing: false, wasPressed: () => false, buffered: () => false, moveVector: () => ({ x: 0, y: 0 }) };
  for (let i = 0; i < 24; i += 1) update(world, frozen, 1 / 60, audio);
}
