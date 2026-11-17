// Lumen Drift — one namespaced, versioned save blob in localStorage.
// Holds the best score and the mute flag. Every access is guarded: private
// mode and missing storage fall back to an in-memory copy, never a crash.
// Pure enough to run under node --test (no window at module scope).
const KEY = 'lumen-drift:save';
const CURRENT_VERSION = 1;

export const SAVE_DEFAULTS = { version: CURRENT_VERSION, best: 0, muted: false };

const memoryStore = new Map();

function storage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch (error) {
    // Storage exists but is unusable; fall through to the memory copy.
  }
  return {
    getItem: (key) => (memoryStore.has(key) ? memoryStore.get(key) : null),
    setItem: (key, value) => memoryStore.set(key, value),
  };
}

export function loadSave() {
  try {
    const raw = storage().getItem(KEY);
    if (!raw) return { ...SAVE_DEFAULTS };
    const data = JSON.parse(raw);
    // Migration ladder, oldest step first. v1 is the first version, so there
    // is nothing to migrate yet; later versions add their step here.
    if (typeof data.version !== 'number' || data.version < 1) data.version = 1;
    data.version = CURRENT_VERSION;
    return { ...SAVE_DEFAULTS, ...data };
  } catch (error) {
    return { ...SAVE_DEFAULTS };
  }
}

export function saveSave(patch) {
  try {
    const next = { ...loadSave(), ...patch, version: CURRENT_VERSION };
    storage().setItem(KEY, JSON.stringify(next));
    return next;
  } catch (error) {
    return { ...SAVE_DEFAULTS, ...patch };
  }
}
