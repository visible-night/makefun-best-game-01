// Lumen Drift v2 — boot, scene machine and the game loop.
// States: title -> playing <-> paused -> dying -> over -> playing. The title
// runs a demo game behind it (see attract.js). The simulation steps on a
// fixed 120 Hz timestep fed by an accumulator, so it runs at the same speed
// on every machine. A ?shot= parameter renders one staged frame instead,
// for screenshots of the real game.
import { ARENA_WIDTH, ARENA_HEIGHT, JUICE } from './config.js';
import { createWorld, startRun, update, finishRun } from './world.js';
import { render } from './render.js';
import { createInput } from './input.js';
import { createAudio, silentAudio } from './audio.js';
import { createAttract, updateAttract } from './attract.js';
import { stageShot, settleShot } from './shots.js';

const FIXED_DT = 1 / 120;
const MAX_FRAME_MS = 250;
const MAX_STEPS = 12;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const audio = createAudio();
const input = createInput(canvas);
const liveRegion = document.getElementById('score-live');
const muteButton = document.getElementById('mute-btn');

// Sharp on every display: the backing store scales with devicePixelRatio
// and the context draws in logical arena pixels.
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(ARENA_WIDTH * dpr);
  canvas.height = Math.round(ARENA_HEIGHT * dpr);
  return dpr;
}
let dpr = resizeCanvas();
window.addEventListener('resize', () => {
  dpr = resizeCanvas();
});

const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
function applyReducedMotion() {
  world.reduceMotion = reduceMotionQuery.matches;
  attract.world.reduceMotion = reduceMotionQuery.matches;
}
if (typeof reduceMotionQuery.addEventListener === 'function') {
  reduceMotionQuery.addEventListener('change', applyReducedMotion);
}

const world = createWorld();
const attract = createAttract();
applyReducedMotion();

function setMuted(muted) {
  world.muted = muted;
  audio.setMuted(muted);
  if (muteButton) {
    muteButton.textContent = muted ? 'Unmute' : 'Mute';
    muteButton.setAttribute('aria-pressed', String(muted));
  }
}
setMuted(audio.muted);
if (muteButton) {
  muteButton.addEventListener('click', () => {
    audio.ensure();
    setMuted(!audio.muted);
  });
}
input.onFirstGesture = () => audio.ensure();

function announce(text) {
  if (liveRegion) liveRegion.textContent = text;
}

const shotName = new URLSearchParams(window.location.search).get('shot');

if (shotName) {
  // Screenshot mode: stage the scene, settle it a few steps, render once.
  const staged = stageShot(shotName);
  staged.world.reduceMotion = false;
  settleShot(staged.world, input, silentAudio);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render(ctx, staged.world, staged.mode);
  document.title = `Lumen Drift — shot ${shotName}`;
  window.__gameReady = true;
} else {
  let lastTime = performance.now();
  let acc = 0;
  let lastWave = 0;

  // Advance one world by a real-time slice in fixed steps, honouring
  // hit-stop freezes. stepFn runs one fixed step of that world's update.
  function advance(frameMs, juice, stepFn, timeScale = 1) {
    if (juice.hitStop > 0) {
      juice.hitStop -= frameMs / 1000;
      return;
    }
    acc += (frameMs / 1000) * timeScale;
    let steps = 0;
    while (acc >= FIXED_DT && steps < MAX_STEPS) {
      stepFn(FIXED_DT);
      acc -= FIXED_DT;
      steps += 1;
    }
    if (steps === MAX_STEPS) acc = 0; // drop the backlog, never spiral
  }

  function frame(now) {
    const frameMs = Math.min(MAX_FRAME_MS, now - lastTime);
    lastTime = now;

    if (input.wasPressed('m')) setMuted(!audio.muted);

    if (world.state === 'title') {
      advance(frameMs, attract.world.juice, (dt) => updateAttract(attract, dt));
      if (input.wasPressed('enter') || input.wasPressed('click')) {
        audio.ensure();
        audio.click();
        audio.startMusic();
        startRun(world);
        announce('Run started. Wave 1.');
        lastWave = 1;
      }
    } else if (world.state === 'playing') {
      if (input.wasPressed('escape') || input.wasPressed('p')) {
        world.state = 'paused';
        audio.click();
        announce('Paused.');
      } else if (input.wasPressed('r')) {
        startRun(world);
        announce('Run restarted. Wave 1.');
        lastWave = 1;
      } else {
        advance(frameMs, world.juice, (dt) => update(world, input, dt, audio));
        if (world.wave !== lastWave) {
          lastWave = world.wave;
          announce(`Wave ${world.wave}.`);
        }
      }
    } else if (world.state === 'paused') {
      if (input.wasPressed('escape') || input.wasPressed('p')) {
        world.state = 'playing';
        audio.click();
      } else if (input.wasPressed('r')) {
        startRun(world);
        announce('Run restarted. Wave 1.');
        lastWave = 1;
      }
    } else if (world.state === 'dying') {
      advance(frameMs, world.juice, (dt) => update(world, input, dt, audio), JUICE.dyingSlowmo);
      world.dyingTimer -= frameMs / 1000;
      if (world.dyingTimer <= 0) {
        finishRun(world);
        audio.gameOver();
        announce(`Game over. Score ${world.score}, wave ${world.wave}.`);
      }
    } else if (world.state === 'over') {
      world.time += frameMs / 1000;
      if (input.wasPressed('r') || input.wasPressed('enter') || input.wasPressed('click')) {
        audio.click();
        audio.startMusic();
        startRun(world);
        announce('Run started. Wave 1.');
        lastWave = 1;
      }
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (world.state === 'title') {
      render(ctx, attract.world, 'title');
      window.__state = attract.world;
    } else {
      render(ctx, world, 'game');
      window.__state = world;
    }
    input.endFrame();
    requestAnimationFrame(frame);
  }

  // Pause when the tab hides, and reset the clock on return so the game
  // never lurches forward in one giant jump.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && world.state === 'playing') {
      world.state = 'paused';
    }
    if (!document.hidden) {
      lastTime = performance.now();
      acc = 0;
    }
  });

  window.__gameReady = true;
  requestAnimationFrame(frame);
}
