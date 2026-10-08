/**
 * The main hydra instance's animation loop, which can be stopped and started
 * again. hydra-synth runs its own loop that nothing can pause, so the main
 * instance is created with `autoLoop: false` and driven from here instead,
 * the same way: one tick per animation frame with the milliseconds since the
 * last one. The desktop app stops it while the interface shows the
 * Syphon/Spout output's own frames, so a sketch is only rendered once.
 *
 * Platform pieces are injectable for tests.
 */
export function createRenderLoop(
  tick,
  {
    requestFrame = (callback) => globalThis.requestAnimationFrame(callback),
    cancelFrame = (handle) => globalThis.cancelAnimationFrame(handle),
    now = () => globalThis.performance.now(),
  } = {},
) {
  let handle = null;
  let last = 0;

  function frame() {
    handle = requestFrame(frame);
    const time = now();
    const dt = time - last;
    last = time;
    tick(dt);
  }

  /** Start ticking; a loop that was stopped resumes without a jump in time. */
  function start() {
    if (handle !== null) return;
    last = now();
    handle = requestFrame(frame);
  }

  function stop() {
    if (handle === null) return;
    cancelFrame(handle);
    handle = null;
  }

  return { start, stop, isRunning: () => handle !== null };
}
