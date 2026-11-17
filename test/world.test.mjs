// Lumen Drift v2 — unit tests for the pure simulation (world.js, juice.js).
// Runs with: node --test test/  (from the repository root). No DOM, no
// canvas, no network: input and audio are stubs.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  startRun,
  nextWave,
  spawnEnemy,
  fireNova,
  multiplier,
  comboFraction,
  weaponProgress,
  finishRun,
  update,
} from '../game/src/world.js';
import { createJuice, burst } from '../game/src/juice.js';
import { makeRng } from '../game/src/random.js';
import { silentAudio } from '../game/src/audio.js';

function stubInput(overrides = {}) {
  return {
    mouseX: 480,
    mouseY: 300,
    firing: false,
    moveVector: () => ({ x: 0, y: 0 }),
    wasPressed: () => false,
    buffered: () => false,
    endFrame: () => {},
    ...overrides,
  };
}

function step(world, input, seconds, dt = 1 / 120) {
  const steps = Math.ceil(seconds / dt);
  for (let i = 0; i < steps; i += 1) update(world, input, dt, silentAudio);
}

describe('createWorld', () => {
  it('starts on the title screen with a full hull and the base gun', () => {
    const world = createWorld(42);
    assert.equal(world.state, 'title');
    assert.equal(world.player.hull, 3);
    assert.equal(world.player.weapon, 0);
    assert.equal(world.wave, 0);
    assert.equal(world.score, 0);
  });
});

describe('startRun', () => {
  it('begins wave 1 with enemies already in the arena', () => {
    const world = createWorld(42);
    startRun(world);
    assert.equal(world.state, 'playing');
    assert.equal(world.wave, 1);
    assert.equal(world.enemies.length, 3);
    assert.ok(world.waveQueue.length > 0);
    assert.equal(world.banner, 'WAVE 1');
  });
});

describe('multiplier and combo', () => {
  it('steps up every 8 kills and caps at x5', () => {
    const world = createWorld(42);
    assert.equal(multiplier(world), 1);
    world.combo = 8;
    assert.equal(multiplier(world), 2);
    world.combo = 40;
    assert.equal(multiplier(world), 5);
  });

  it('resets the combo when the timer runs out', () => {
    const world = createWorld(42);
    startRun(world);
    world.combo = 5;
    world.comboTimer = 0.5;
    assert.ok(comboFraction(world) > 0);
    step(world, stubInput(), 1);
    assert.equal(world.combo, 0);
    assert.equal(comboFraction(world), 0);
  });
});

describe('combat', () => {
  it('a friendly bullet kills a drifter, scores and freezes a beat', () => {
    const world = createWorld(42);
    startRun(world);
    world.enemies = [];
    world.waveQueue = [];
    world.enemiesLeft = 1;
    // Far from the player, so a dropped shard is never collected mid-test.
    spawnEnemy(world, 'drifter', 700, 100);
    world.bullets.push({ x: 700, y: 100, vx: 0, vy: 0, friendly: true, damage: 1, life: 1 });
    update(world, stubInput(), 1 / 120, silentAudio);
    assert.equal(world.enemies.length, 0);
    assert.equal(world.kills, 1);
    assert.equal(world.combo, 1);
    assert.equal(world.score, 50);
    assert.ok(world.juice.hitStop > 0);
    assert.ok(world.juice.trauma > 0);
  });

  it('an enemy bullet hurts the player and resets the combo', () => {
    const world = createWorld(42);
    startRun(world);
    world.combo = 6;
    world.bullets.push({
      x: world.player.x, y: world.player.y, vx: 0, vy: 0, friendly: false, damage: 1, life: 1,
    });
    update(world, stubInput(), 1 / 120, silentAudio);
    assert.equal(world.player.hull, 2);
    assert.equal(world.combo, 0);
    assert.ok(world.player.invulnerable > 0);
    assert.ok(world.juice.flash > 0.9); // set to 1 by the hit, decayed one step
  });

  it('ramming through the swarm on invulnerability frames clears nothing', () => {
    const world = createWorld(42);
    startRun(world);
    world.player.invulnerable = 1;
    world.enemies = [];
    world.waveQueue = [];
    spawnEnemy(world, 'drifter', world.player.x, world.player.y);
    update(world, stubInput(), 1 / 120, silentAudio);
    assert.equal(world.enemies.length, 1);
    assert.equal(world.player.hull, 3);
  });

  it('the last hit starts the slow-motion death, and finishRun settles it', () => {
    const world = createWorld(42);
    startRun(world);
    world.player.hull = 1;
    world.score = 500;
    world.best = 100;
    world.bullets.push({
      x: world.player.x, y: world.player.y, vx: 0, vy: 0, friendly: false, damage: 1, life: 1,
    });
    update(world, stubInput(), 1 / 120, silentAudio);
    assert.equal(world.state, 'dying');
    assert.ok(world.dyingTimer > 0);
    finishRun(world);
    assert.equal(world.state, 'over');
    assert.equal(world.newBest, true);
    assert.equal(world.best, 500);
  });
});

describe('weapons and shards', () => {
  it('collecting the eighth shard upgrades the gun to TWIN', () => {
    const world = createWorld(42);
    startRun(world);
    world.player.shards = 7;
    world.pickups.push({ kind: 'shard', x: world.player.x, y: world.player.y, vx: 0, vy: 0, life: 9 });
    update(world, stubInput(), 1 / 120, silentAudio);
    assert.equal(world.player.shards, 8);
    assert.equal(world.player.weapon, 1);
    assert.equal(weaponProgress(world).name, 'TWIN');
    assert.ok(world.banner.startsWith('WEAPON UP'));
  });

  it('the TWIN gun fires two bullets per shot', () => {
    const world = createWorld(42);
    startRun(world);
    world.player.weapon = 1;
    world.player.fireTimer = 0;
    update(world, stubInput({ firing: true }), 1 / 120, silentAudio);
    const friendly = world.bullets.filter((b) => b.friendly);
    assert.equal(friendly.length, 2);
  });
});

describe('dash and nova', () => {
  it('a buffered dash fires even with no movement input, toward the aim', () => {
    const world = createWorld(42);
    startRun(world);
    let consumed = false;
    const input = stubInput({
      buffered: (action) => {
        if (action === 'dash' && !consumed) {
          consumed = true;
          return true;
        }
        return false;
      },
    });
    update(world, input, 1 / 120, silentAudio);
    assert.ok(world.player.dashTimer > 0);
    assert.ok(world.player.dashCooldown > 0);
  });

  it('a nova spends a charge and clears enemy bullets in range', () => {
    const world = createWorld(42);
    startRun(world);
    world.bullets.push({
      x: world.player.x + 50, y: world.player.y, vx: 0, vy: 0, friendly: false, damage: 1, life: 3,
    });
    world.bullets.push({
      x: world.player.x + 500, y: world.player.y, vx: 0, vy: 0, friendly: false, damage: 1, life: 3,
    });
    assert.equal(fireNova(world, silentAudio), true);
    assert.equal(world.player.nova, 0);
    assert.equal(world.bullets.length, 1);
    assert.ok(world.juice.rings.length > 0);
  });

  it('a nova with no charges does nothing', () => {
    const world = createWorld(42);
    startRun(world);
    world.player.nova = 0;
    assert.equal(fireNova(world, silentAudio), false);
  });
});

describe('waves', () => {
  it('wave 5 opens with the Warden already in the arena', () => {
    const world = createWorld(42);
    world.wave = 4;
    nextWave(world);
    assert.equal(world.wave, 5);
    assert.ok(world.enemies.some((e) => e.kind === 'warden'));
    assert.ok(world.banner.includes('WARDEN'));
  });
});

describe('juice pool', () => {
  it('bursts reuse pool slots instead of growing the array', () => {
    const juice = createJuice();
    const rng = makeRng(7);
    assert.equal(juice.particles.length, 420);
    burst(juice, rng, 100, 100, '#ffffff', 60, 200);
    burst(juice, rng, 200, 200, '#ffffff', 60, 200);
    assert.equal(juice.particles.length, 420);
    assert.equal(juice.particles.filter((p) => p.active).length, 120);
  });
});
