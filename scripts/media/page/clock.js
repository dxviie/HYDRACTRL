// Virtual clock, injected before any page script. performance.now, Date.now,
// timers and requestAnimationFrame follow real time until the capture calls
// __clock.setManual(true); from then on time only moves on __clock.step(ms),
// so every recorded frame is exactly 1/fps apart however slow the renderer is.
(() => {
  if (window.__clock) return;
  const native = {
    raf: window.requestAnimationFrame.bind(window),
    perfNow: performance.now.bind(performance),
    dateNow: Date.now.bind(Date),
  };
  const dateOffset = native.dateNow() - native.perfNow();
  let now = native.perfNow();
  let manual = false;
  let lastReal = native.perfNow();
  let seq = 1;
  const timers = new Map();
  let frames = new Map();

  performance.now = () => now;
  Date.now = () => Math.floor(dateOffset + now);

  function addTimer(fn, delay, args, repeat) {
    const id = seq++;
    const ms = Math.max(0, Number(delay) || 0);
    timers.set(id, { at: now + ms, fn, args, every: repeat ? Math.max(4, ms) : 0 });
    return id;
  }
  window.setTimeout = (fn, delay, ...args) => addTimer(fn, delay, args, false);
  window.setInterval = (fn, delay, ...args) => addTimer(fn, delay, args, true);
  window.clearTimeout = (id) => {
    timers.delete(id);
  };
  window.clearInterval = window.clearTimeout;
  window.requestAnimationFrame = (callback) => {
    const id = seq++;
    frames.set(id, callback);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    frames.delete(id);
  };

  // Fire due timers in time order, each at its own moment
  function runTimersUntil(target) {
    for (let guard = 0; guard < 20000; guard++) {
      let nextId = null;
      let next = null;
      for (const [id, timer] of timers) {
        if (timer.at <= target && (!next || timer.at < next.at)) {
          next = timer;
          nextId = id;
        }
      }
      if (!next) break;
      now = Math.max(now, next.at);
      if (next.every) next.at += next.every;
      else timers.delete(nextId);
      if (typeof next.fn !== "function") continue;
      try {
        next.fn(...next.args);
      } catch (error) {
        console.error(error);
      }
    }
    now = Math.max(now, target);
  }

  function runFrame() {
    const due = frames;
    frames = new Map();
    for (const callback of due.values()) {
      try {
        callback(now);
      } catch (error) {
        console.error(error);
      }
    }
  }

  function advance(ms) {
    runTimersUntil(now + ms);
    runFrame();
  }

  function pump() {
    const real = native.perfNow();
    const dt = Math.min(real - lastReal, 100);
    lastReal = real;
    if (!manual) advance(dt);
    native.raf(pump);
  }
  native.raf(pump);

  window.__clock = {
    get now() {
      return now;
    },
    setManual(on = true) {
      manual = on;
      lastReal = native.perfNow();
    },
    step(ms) {
      advance(ms);
    },
  };
})();
