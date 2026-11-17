// Lumen Drift — boot, state machine and the game loop.
// States: title -> playing <-> paused -> over -> playing. A ?shot= parameter
// renders one staged frame instead, for screenshots of the real game.
import { ARENA_WIDTH, ARENA_HEIGHT } from './config.js';
import { createWorld, startRun, update } from './world.js';
import { render } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot, settleShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const audio = createAudio();
const input = createInput(canvas);

const shotName = new URLSearchParams(window.location.search).get('shot');
let world;

if (shotName) {
  // Screenshot mode: stage the scene, settle it a few steps, render once.
  world = stageShot(shotName);
  const silent = { shoot: () => {}, enemyShoot: () => {}, hit: () => {}, explosion: () => {}, pickup: () => {}, heal: () => {}, dash: () => {}, nova: () => {}, hurt: () => {}, wave: () => {}, gameOver: () => {}, stopMusic: () => {} };
  settleShot(world, input, silent);
  render(ctx, world);
  document.title = `Lumen Drift — shot ${shotName}`;
} else {
  world = createWorld();
  let lastTime = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (input.wasPressed('m')) {
      world.muted = !world.muted;
      audio.setMuted(world.muted);
    }

    if (world.state === 'title') {
      world.time += dt;
      if (input.wasPressed('enter') || input.firing) {
        audio.ensure();
        audio.click();
        audio.startMusic();
        startRun(world);
      }
    } else if (world.state === 'playing') {
      if (input.wasPressed('escape') || input.wasPressed('p')) {
        world.state = 'paused';
        audio.click();
      } else if (input.wasPressed('r')) {
        startRun(world);
      } else {
        update(world, input, dt, audio);
      }
    } else if (world.state === 'paused') {
      if (input.wasPressed('escape') || input.wasPressed('p')) {
        world.state = 'playing';
        audio.click();
      } else if (input.wasPressed('r')) {
        startRun(world);
      }
    } else if (world.state === 'over') {
      world.time += dt;
      if (input.wasPressed('r') || input.wasPressed('enter') || input.firing) {
        audio.click();
        audio.startMusic();
        startRun(world);
      }
    }

    render(ctx, world);
    input.endFrame();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
