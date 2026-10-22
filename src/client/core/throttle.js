/**
 * Calls `fn` at most once every `interval` ms however often `schedule()` is
 * called: at once after a quiet spell, then once at the end of each interval
 * that had calls. `flush()` calls it now, `cancel()` drops a pending call.
 *
 * Platform pieces are injectable for tests.
 */
export function createThrottle(
  fn,
  interval,
  {
    now = () => globalThis.performance.now(),
    setTimer = (callback, ms) => setTimeout(callback, ms),
    clearTimer = (id) => clearTimeout(id),
  } = {},
) {
  let timer = null;
  let pending = false;
  let last = Number.NEGATIVE_INFINITY;

  function fire() {
    timer = null;
    if (!pending) return;
    pending = false;
    last = now();
    fn();
  }

  return {
    schedule() {
      pending = true;
      if (timer !== null) return;
      const wait = last + interval - now();
      if (wait <= 0) fire();
      else timer = setTimer(fire, wait);
    },
    flush() {
      if (timer !== null) clearTimer(timer);
      timer = null;
      pending = true;
      fire();
    },
    cancel() {
      if (timer !== null) clearTimer(timer);
      timer = null;
      pending = false;
    },
  };
}
