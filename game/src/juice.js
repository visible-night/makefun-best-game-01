// Lumen Drift — the juice: every feedback system in one place.
// Pooled particles, expanding shockwave rings, dash afterimages, floating
// score text, trauma-based screen shake, hit-stop freezes and the damage
// flash. This module owns the state and the update step; render.js draws it.
// Particles live in a fixed pool so bursts never allocate mid-frame.
import { JUICE } from './config.js';
import { range, clamp } from './random.js';

export function createJuice() {
  const particles = [];
  for (let i = 0; i < JUICE.maxParticles; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#ffffff', drag: 0.96, gravity: 0 });
  }
  return {
    particles,
    cursor: 0,
    rings: [], // {x, y, radius, maxRadius, life, maxLife, color, width}
    ghosts: [], // {x, y, angle, life, maxLife}
    texts: [], // {x, y, text, life, maxLife, color, size}
    trauma: 0, // 0..1, decays; shake amplitude is trauma squared
    hitStop: 0, // seconds of frozen simulation left
    flash: 0, // damage vignette strength, 0..1
    scorePop: 0, // HUD score pop, 1 at the moment of a gain
  };
}

function alloc(juice) {
  for (let tries = 0; tries < JUICE.maxParticles; tries += 1) {
    juice.cursor = (juice.cursor + 1) % JUICE.maxParticles;
    const slot = juice.particles[juice.cursor];
    if (!slot.active) return slot;
  }
  return juice.particles[juice.cursor];
}

export function burst(juice, rng, x, y, color, count, speed, opts = {}) {
  const capped = Math.min(count, JUICE.maxParticles);
  for (let i = 0; i < capped; i += 1) {
    const slot = alloc(juice);
    const angle = rng() * Math.PI * 2;
    const v = range(rng, speed * 0.3, speed);
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.vx = Math.cos(angle) * v;
    slot.vy = Math.sin(angle) * v;
    slot.maxLife = range(rng, 0.3, opts.life || 0.7);
    slot.life = slot.maxLife;
    slot.size = range(rng, 1.5, opts.size || 3.5);
    slot.color = color;
    slot.drag = opts.drag ?? 0.96;
    slot.gravity = opts.gravity || 0;
  }
}

export function spark(juice, x, y, vx, vy, color, size, life) {
  const slot = alloc(juice);
  slot.active = true;
  slot.x = x;
  slot.y = y;
  slot.vx = vx;
  slot.vy = vy;
  slot.maxLife = life;
  slot.life = life;
  slot.size = size;
  slot.color = color;
  slot.drag = 0.96;
  slot.gravity = 0;
}

export function ring(juice, x, y, color, maxRadius, width = 4, life = 0.45) {
  juice.rings.push({ x, y, radius: 6, maxRadius, life, maxLife: life, color, width });
}

export function ghost(juice, x, y, angle) {
  juice.ghosts.push({ x, y, angle, life: 0.22, maxLife: 0.22 });
}

export function floatText(juice, x, y, text, color, size = 14) {
  juice.texts.push({ x, y, text, life: 0.9, maxLife: 0.9, color, size });
}

export function addTrauma(juice, amount) {
  juice.trauma = clamp(juice.trauma + amount, 0, 1);
}

export function freeze(juice, seconds) {
  juice.hitStop = Math.max(juice.hitStop, seconds);
}

export function damageFlash(juice) {
  juice.flash = 1;
}

export function scorePop(juice) {
  juice.scorePop = 1;
}

// Deterministic shake from the clock, so rendering never calls Math.random.
// Trauma squared keeps small hits subtle and big hits dramatic.
export function shakeOffset(juice, time) {
  if (juice.trauma <= 0) return { x: 0, y: 0 };
  const amp = juice.trauma * juice.trauma * JUICE.shakeMax;
  const hash = (seed) => {
    const s = Math.sin(time * 127.1 + seed * 311.7) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };
  return { x: hash(1) * amp, y: hash(2) * amp };
}

export function updateJuice(juice, dt, reduceMotion) {
  juice.trauma = Math.max(0, juice.trauma - dt * 1.6);
  juice.flash = Math.max(0, juice.flash - dt * 1.8);
  juice.scorePop = Math.max(0, juice.scorePop - dt * 3.2);

  const step = reduceMotion ? 0.4 : 1; // fewer, calmer particles when asked
  for (const particle of juice.particles) {
    if (!particle.active) continue;
    particle.life -= dt;
    if (particle.life <= 0) {
      particle.active = false;
      continue;
    }
    particle.x += particle.vx * dt * step;
    particle.y += particle.vy * dt * step;
    particle.vy += particle.gravity * dt;
    particle.vx *= particle.drag;
    particle.vy *= particle.drag;
  }
  for (const ringItem of juice.rings) {
    ringItem.life -= dt;
    const t = 1 - Math.max(0, ringItem.life / ringItem.maxLife);
    ringItem.radius = 6 + (ringItem.maxRadius - 6) * (1 - Math.pow(1 - t, 3));
  }
  juice.rings = juice.rings.filter((item) => item.life > 0);
  for (const ghostItem of juice.ghosts) ghostItem.life -= dt;
  juice.ghosts = juice.ghosts.filter((item) => item.life > 0);
  for (const text of juice.texts) {
    text.y -= 34 * dt;
    text.life -= dt;
  }
  juice.texts = juice.texts.filter((item) => item.life > 0);
}
