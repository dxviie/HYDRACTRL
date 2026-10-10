import { describe, expect, test } from "bun:test";
import { createRenderLoop } from "./renderLoop.js";

/** Animation frames on demand: `step(ms)` advances the clock and runs the pending frame. */
function createFrames() {
  let time = 1000;
  let nextHandle = 1;
  const pending = new Map();
  return {
    requestFrame: (callback) => {
      const handle = nextHandle++;
      pending.set(handle, callback);
      return handle;
    },
    cancelFrame: (handle) => pending.delete(handle),
    now: () => time,
    advance: (ms) => {
      time += ms;
    },
    step(ms) {
      time += ms;
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback();
    },
    pendingCount: () => pending.size,
  };
}

describe("createRenderLoop", () => {
  test("ticks once per frame with the time since the last one", () => {
    const frames = createFrames();
    const ticks = [];
    const loop = createRenderLoop((dt) => ticks.push(dt), frames);
    expect(loop.isRunning()).toBe(false);
    loop.start();
    expect(loop.isRunning()).toBe(true);
    frames.step(16);
    frames.step(17);
    expect(ticks).toEqual([16, 17]);
    expect(frames.pendingCount()).toBe(1);
  });

  test("stops ticking, and resumes without counting the pause", () => {
    const frames = createFrames();
    const ticks = [];
    const loop = createRenderLoop((dt) => ticks.push(dt), frames);
    loop.start();
    frames.step(16);
    loop.stop();
    expect(loop.isRunning()).toBe(false);
    expect(frames.pendingCount()).toBe(0);
    frames.advance(5000);
    loop.start();
    frames.step(16);
    expect(ticks).toEqual([16, 16]);
  });

  test("start and stop are idempotent", () => {
    const frames = createFrames();
    const ticks = [];
    const loop = createRenderLoop((dt) => ticks.push(dt), frames);
    loop.start();
    loop.start();
    expect(frames.pendingCount()).toBe(1);
    frames.step(10);
    expect(ticks).toEqual([10]);
    loop.stop();
    loop.stop();
    expect(loop.isRunning()).toBe(false);
  });

  test("a tick that throws doesn't stop the loop", () => {
    const frames = createFrames();
    let calls = 0;
    const loop = createRenderLoop(() => {
      calls += 1;
      if (calls === 1) throw new Error("bad frame");
    }, frames);
    loop.start();
    expect(() => frames.step(16)).toThrow("bad frame");
    frames.step(16);
    expect(calls).toBe(2);
  });
});
