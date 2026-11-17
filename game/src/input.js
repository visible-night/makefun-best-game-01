// Keyboard and pointer state, translated into arena coordinates.
// One Pointer Events stream covers mouse, touch and pen. Handlers only
// record state; the game loop reads it each fixed step. Action presses are
// timestamped so a dash or nova pressed a few milliseconds early still
// lands: buffered() consumes a press made within the buffer window.
import { ARENA_WIDTH, ARENA_HEIGHT } from './config.js';

const BUFFER_MS = 150;

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const pressTimes = new Map();
  const input = {
    keys,
    mouseX: ARENA_WIDTH / 2,
    mouseY: ARENA_HEIGHT / 3,
    firing: false,
    // Called once on the first real gesture; main.js uses it to unlock audio.
    onFirstGesture: null,
  };
  let gestured = false;

  function gesture() {
    if (gestured) return;
    gestured = true;
    if (typeof input.onFirstGesture === 'function') input.onFirstGesture();
  }

  function toArena(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * ARENA_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * ARENA_HEIGHT,
    };
  }

  function notePress(name) {
    pressed.add(name);
    pressTimes.set(name, performance.now());
  }

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
      event.preventDefault();
    }
    gesture();
    if (!event.repeat) {
      notePress(key);
      if (key === ' ') notePress('dash');
      if (key === 'e') notePress('nova');
    }
    keys.add(key);
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.key.toLowerCase());
  });
  window.addEventListener('blur', () => {
    keys.clear();
    pressed.clear();
    input.firing = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const pos = toArena(event);
    input.mouseX = pos.x;
    input.mouseY = pos.y;
  });
  canvas.addEventListener('pointerdown', (event) => {
    gesture();
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (error) {
      // Capture is a nicety; the game plays fine without it.
    }
    const pos = toArena(event);
    input.mouseX = pos.x;
    input.mouseY = pos.y;
    if (event.button === 0) {
      input.firing = true;
      notePress('click'); // edge-triggered, so a held button never restarts a run
    }
    if (event.button === 2) notePress('nova');
  });
  window.addEventListener('pointerup', (event) => {
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

  // Edge-triggered key, true only on the frame it was pressed.
  input.wasPressed = (key) => pressed.has(key);

  // True when the named action was pressed within the buffer window, and
  // consumes it so it fires exactly once.
  input.buffered = (action, windowMs = BUFFER_MS) => {
    const at = pressTimes.get(action);
    if (at === undefined) return false;
    if (performance.now() - at > windowMs) {
      pressTimes.delete(action);
      return false;
    }
    pressTimes.delete(action);
    return true;
  };

  input.endFrame = () => pressed.clear();

  return input;
}
