// tilt.js
// Turns the way the phone is being held into two numbers between -1 and 1,
// and hands them to whoever asked. Nothing here knows what they are used for.
//
// The numbers are relative to however you were holding the phone when it
// started, not to some absolute upright, because nobody holds a phone at a
// known angle and an effect anchored to one would sit at its limit for half
// the people using it.

/** Degrees of tilt from the resting position that count as all the way over. */
export const TILT_RANGE = 22;

/** How much of the gap to the new reading to close each frame. */
export const SMOOTHING = 0.14;

/** Below this, a change is not worth touching the page for. */
export const EPSILON = 0.002;

export function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

/**
 * gamma is the left to right tilt, beta the front to back one. Both are read
 * against the baseline captured when tilting started.
 */
export function tiltFrom(beta, gamma, base) {
  const zero = base || { beta: 0, gamma: 0 };
  const b = typeof beta === 'number' ? beta : zero.beta;
  const g = typeof gamma === 'number' ? gamma : zero.gamma;
  return {
    x: clamp((g - zero.gamma) / TILT_RANGE, -1, 1),
    y: clamp((b - zero.beta) / TILT_RANGE, -1, 1)
  };
}

export function approach(current, target, rate) {
  return current + (target - current) * (rate === undefined ? SMOOTHING : rate);
}

export function settled(current, target) {
  return Math.abs(target.x - current.x) < EPSILON && Math.abs(target.y - current.y) < EPSILON;
}

const state = {
  running: false,
  base: null,
  target: { x: 0, y: 0 },
  current: { x: 0, y: 0 },
  frame: null,
  onChange: null,
  handler: null
};

export function tiltIsRunning() {
  return state.running;
}

/**
 * True when this device can report its orientation at all. False on a
 * desktop, where the whole thing is skipped rather than faked.
 */
export function tiltAvailable() {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
}

/** iOS will not report anything until it has been asked, from a real tap. */
export function tiltNeedsPermission() {
  return tiltAvailable() &&
    typeof window.DeviceOrientationEvent.requestPermission === 'function';
}

/**
 * Ask for it if it has to be asked for, then start. Returns a promise that
 * says whether it is running, and never rejects: a refused permission is an
 * answer, not a failure.
 */
export function startTilt(onChange) {
  if (!tiltAvailable()) return Promise.resolve(false);
  if (state.running) return Promise.resolve(true);
  if (!tiltNeedsPermission()) {
    listen(onChange);
    return Promise.resolve(true);
  }
  return window.DeviceOrientationEvent.requestPermission()
    .then((answer) => {
      if (answer !== 'granted') return false;
      listen(onChange);
      return true;
    })
    .catch(() => false);
}

function listen(onChange) {
  state.running = true;
  state.onChange = onChange || null;
  state.base = null;
  state.handler = (event) => {
    // Browsers fire an event or two with nothing in them before the sensor
    // has anything to say. Those carry no information, so they are dropped
    // rather than used, which matters most for the very first one: anchoring
    // the baseline to an empty reading is what pins the effect at its edge
    // for the whole session.
    if (typeof event.beta !== 'number' && typeof event.gamma !== 'number') return;
    // The first real reading is wherever the phone happened to be. That
    // becomes the middle, so the effect starts from nothing, not from an edge.
    if (!state.base) {
      state.base = {
        beta: typeof event.beta === 'number' ? event.beta : 0,
        gamma: typeof event.gamma === 'number' ? event.gamma : 0
      };
    }
    state.target = tiltFrom(event.beta, event.gamma, state.base);
    if (!state.frame) state.frame = requestAnimationFrame(tick);
  };
  window.addEventListener('deviceorientation', state.handler, true);
}

function tick() {
  state.frame = null;
  state.current = {
    x: approach(state.current.x, state.target.x),
    y: approach(state.current.y, state.target.y)
  };
  if (state.onChange) state.onChange(state.current.x, state.current.y);
  // Stop asking for frames once it has caught up. A phone lying still should
  // not be running an animation loop.
  if (!settled(state.current, state.target)) {
    state.frame = requestAnimationFrame(tick);
  }
}

export function stopTilt() {
  if (state.handler) window.removeEventListener('deviceorientation', state.handler, true);
  if (state.frame) cancelAnimationFrame(state.frame);
  state.handler = null;
  state.frame = null;
  state.running = false;
  state.base = null;
  state.target = { x: 0, y: 0 };
  state.current = { x: 0, y: 0 };
  if (state.onChange) state.onChange(0, 0);
}

/** Forget the resting position, so the next reading becomes the new middle. */
export function recentreTilt() {
  state.base = null;
}
