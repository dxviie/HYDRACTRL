import { describe, expect, test } from "bun:test";
import { createThrottle } from "./throttle.js";

function createClock() {
  let time = 0;
  const timers = new Map();
  let nextId = 1;
  return {
    now: () => time,
    setTimer: (callback, ms) => {
      const id = nextId++;
      timers.set(id, { callback, at: time + ms });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
    advance(ms) {
      time += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= time) {
          timers.delete(id);
          timer.callback();
        }
      }
    },
  };
}

describe("createThrottle", () => {
  test("calls at once after a quiet spell, then once per interval", () => {
    const clock = createClock();
    let calls = 0;
    const throttle = createThrottle(() => calls++, 66, clock);

    throttle.schedule();
    expect(calls).toBe(1);
    throttle.schedule();
    throttle.schedule();
    expect(calls).toBe(1);
    clock.advance(66);
    expect(calls).toBe(2);
    clock.advance(500);
    expect(calls).toBe(2);
    throttle.schedule();
    expect(calls).toBe(3);
  });

  test("flush calls now and drops the pending call", () => {
    const clock = createClock();
    let calls = 0;
    const throttle = createThrottle(() => calls++, 66, clock);
    throttle.schedule();
    throttle.schedule();
    throttle.flush();
    expect(calls).toBe(2);
    clock.advance(100);
    expect(calls).toBe(2);
  });

  test("cancel drops a pending call", () => {
    const clock = createClock();
    let calls = 0;
    const throttle = createThrottle(() => calls++, 66, clock);
    throttle.schedule();
    throttle.schedule();
    throttle.cancel();
    clock.advance(100);
    expect(calls).toBe(1);
  });
});
