// Lumen Drift — the attract mode: a demo run that plays itself behind the
// title screen, so the game looks alive before the first click and the
// cover screenshot shows real combat. A ghost ship orbits the nearest
// enemy, keeps its distance and fires constantly. When it dies the demo
// resets to a fresh run. The demo world never writes a save.
import { ARENA_WIDTH, ARENA_HEIGHT } from './config.js';
import { createWorld, startRun, update } from './world.js';
import { silentAudio } from './audio.js';
import { distance, angleTo } from './random.js';

const DEMO_SEED = 20261118;

export function createAttract() {
  const attract = {
    world: null,
    orbitDir: 1,
    orbitTimer: 4,
    input: {
      mouseX: ARENA_WIDTH / 2,
      mouseY: ARENA_HEIGHT / 3,
      firing: true,
      moveVector: () => attract.move,
      wasPressed: () => false,
      buffered: () => false,
      endFrame: () => {},
    },
    move: { x: 0, y: 0 },
  };
  resetAttract(attract);
  return attract;
}

export function resetAttract(attract) {
  const world = createWorld(DEMO_SEED);
  world.demo = true;
  world.state = 'title';
  attract.world = world;
  attract.orbitDir = 1;
  attract.orbitTimer = 4;
  startRun(world);
  world.demo = true; // startRun rebuilds the world; keep the demo flag
}

function nearestEnemy(world) {
  const player = world.player;
  let best = null;
  let bestDist = Infinity;
  for (const enemy of world.enemies) {
    const d = distance(enemy.x, enemy.y, player.x, player.y);
    if (d < bestDist) {
      bestDist = d;
      best = enemy;
    }
  }
  return best;
}

// Steer the ghost ship, then step the demo simulation one fixed step.
export function updateAttract(attract, dt) {
  const world = attract.world;
  if (world.state === 'over' || world.state === 'dying') {
    resetAttract(attract);
    return;
  }
  if (world.state !== 'playing') return;

  const player = world.player;
  const enemy = nearestEnemy(world);
  attract.orbitTimer -= dt;
  if (attract.orbitTimer <= 0) {
    attract.orbitTimer = 3 + Math.random() * 3;
    attract.orbitDir *= -1;
  }

  if (enemy) {
    // Aim at the target, leading it slightly.
    attract.input.mouseX = enemy.x + enemy.vx * 0.15;
    attract.input.mouseY = enemy.y + enemy.vy * 0.15;
    const dist = distance(player.x, player.y, enemy.x, enemy.y);
    const toEnemy = angleTo(player.x, player.y, enemy.x, enemy.y);
    const radial = dist > 280 ? 1 : dist < 170 ? -1 : 0;
    const mx = Math.cos(toEnemy) * radial + Math.cos(toEnemy + Math.PI / 2) * attract.orbitDir * 0.9;
    const my = Math.sin(toEnemy) * radial + Math.sin(toEnemy + Math.PI / 2) * attract.orbitDir * 0.9;
    const len = Math.hypot(mx, my) || 1;
    attract.move.x = mx / len;
    attract.move.y = my / len;
  } else {
    // Nothing to fight: drift back toward the middle of the arena.
    const toCenter = angleTo(player.x, player.y, ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
    const dist = distance(player.x, player.y, ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
    if (dist > 60) {
      attract.move.x = Math.cos(toCenter);
      attract.move.y = Math.sin(toCenter);
    } else {
      attract.move.x = 0;
      attract.move.y = 0;
    }
    attract.input.mouseX = player.x + Math.cos(player.angle) * 100;
    attract.input.mouseY = player.y + Math.sin(player.angle) * 100;
  }

  update(world, attract.input, dt, silentAudio);
}
