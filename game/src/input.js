// Keyboard and mouse state, translated into arena coordinates.
// The canvas is scaled by CSS, so mouse positions are mapped back through
// its bounding box into the fixed logical arena.
import { ARENA_WIDTH, ARENA_HEIGHT } from './config.js';

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    keys,
    mouseX: ARENA_WIDTH / 2,
    mouseY: ARENA_HEIGHT / 3,
    firing: false,
    // Edge-triggered actions, consumed once per frame by the game loop.
    pressed: new Set(),
  };

  function toArena(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * ARENA_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * ARENA_HEIGHT,
    };
  }

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
      event.preventDefault();
    }
    if (!event.repeat) input.pressed.add(key);
    keys.add(key);
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.key.toLowerCase());
  });
  window.addEventListener('blur', () => {
    keys.clear();
    input.firing = false;
  });

  canvas.addEventListener('mousemove', (event) => {
    const pos = toArena(event);
    input.mouseX = pos.x;
    input.mouseY = pos.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) input.firing = true;
    if (event.button === 2) input.pressed.add('nova');
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) input.firing = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  // Movement vector from WASD or arrow keys, normalized.
  input.moveVector = () => {
    let x = 0;
    let y = 0;
    if (keys.has('a') || keys.has('arrowleft')) x -= 1;
    if (keys.has('d') || keys.has('arrowright')) x += 1;
    if (keys.has('w') || keys.has('arrowup')) y -= 1;
    if (keys.has('s') || keys.has('arrowdown')) y += 1;
    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x, y };
  };

  input.wasPressed = (key) => input.pressed.has(key);
  input.endFrame = () => input.pressed.clear();

  return input;
}
