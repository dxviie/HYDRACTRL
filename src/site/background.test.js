import { describe, expect, test } from "bun:test";
import {
  DEFAULTS,
  backdropResolution,
  createBackground,
  createRotation,
  easeInOut,
} from "./background.js";

describe("backdropResolution", () => {
  test("renders at half size, capped on the long side", () => {
    expect(backdropResolution(1280, 720)).toEqual([640, 360]);
    expect(backdropResolution(1920, 1080)).toEqual([960, 540]);
    expect(backdropResolution(3840, 2160)).toEqual([960, 540]);
    expect(backdropResolution(390, 844)).toEqual([195, 422]);
    expect(backdropResolution(0, 0)).toEqual([1, 1]);
  });
});

describe("easeInOut", () => {
  test("clamps and eases", () => {
    expect(easeInOut(-1)).toBe(0);
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(0.5)).toBe(0.5);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(2)).toBe(1);
    expect(easeInOut(0.25)).toBeLessThan(0.25);
  });
});

describe("createRotation", () => {
  test("holds, fades to the next sketch, then shows it", () => {
    const rotation = createRotation({ count: 3, holdMs: 1000, fadeMs: 400 });
    expect(rotation.advance(999)).toEqual([]);
    expect(rotation.mix).toBe(0);
    expect(rotation.advance(1)).toEqual([{ type: "fade", from: 0, to: 1 }]);
    expect(rotation.next).toBe(1);
    rotation.advance(200);
    expect(rotation.mix).toBe(0.5);
    expect(rotation.advance(200)).toEqual([{ type: "show", index: 1 }]);
    expect(rotation.index).toBe(1);
    expect(rotation.next).toBeNull();
  });

  test("wraps around and never fades a single sketch", () => {
    const rotation = createRotation({ count: 2, holdMs: 10, fadeMs: 10 });
    rotation.advance(10);
    rotation.advance(10);
    rotation.advance(10);
    expect(rotation.next).toBe(0);
    const single = createRotation({ count: 1, holdMs: 10, fadeMs: 10 });
    expect(single.advance(1000)).toEqual([]);
  });

  test("cancel returns to holding the current sketch", () => {
    const rotation = createRotation({ count: 2, holdMs: 10, fadeMs: 10 });
    rotation.advance(10);
    rotation.cancel();
    expect(rotation.next).toBeNull();
    expect(rotation.index).toBe(0);
  });
});

function fakeEnvironment() {
  const evaluated = [];
  const ticks = [];
  const outputs = [];
  let frame = null;
  const listeners = {};
  const chain = (label) => ({
    label,
    blend(other, amount) {
      return chain(`${label}.blend(${other.label})`, amount);
    },
    out(output) {
      outputs.push([label, output]);
    },
  });

  class FakeHydra {
    constructor(options) {
      this.options = options;
      this.synth = {
        time: 0,
        o0: "o0",
        o1: "o1",
        o2: "o2",
        o3: "o3",
        src: (output) => chain(`src(${output})`),
        solid: () => chain("solid"),
      };
      FakeHydra.instance = this;
    }
    eval(code) {
      if (code.includes("BROKEN")) throw new Error("does not compile");
      evaluated.push(code);
    }
    tick(dt) {
      ticks.push(dt);
    }
    setResolution(width, height) {
      this.resolution = [width, height];
    }
  }

  const win = {
    innerWidth: 1280,
    innerHeight: 720,
    requestAnimationFrame(callback) {
      frame = callback;
      return 1;
    },
    cancelAnimationFrame() {
      frame = null;
    },
    setTimeout(callback) {
      callback();
      return 1;
    },
    clearTimeout() {},
    addEventListener(type, callback) {
      listeners[type] = callback;
    },
  };
  const canvas = { width: 0, height: 0, addEventListener() {} };
  return {
    FakeHydra,
    win,
    canvas,
    evaluated,
    ticks,
    outputs,
    listeners,
    /** Run animation frames at a fixed interval. */
    run(frames, interval = 1000 / 30) {
      for (let i = 0; i < frames; i++) {
        const callback = frame;
        if (!callback) return;
        frame = null;
        callback((i + 1) * interval);
      }
    },
    hasFrame: () => frame !== null,
  };
}

const SKETCHES = [
  { name: "One", code: "osc(1)", setup: 's0.initImage("/logo.png")' },
  { name: "Broken", code: "BROKEN()" },
  { name: "Two", code: "noise(2)" },
];

describe("createBackground", () => {
  test("starts on the first sketch, leaves out sketches that don't compile", async () => {
    const env = fakeEnvironment();
    const shown = [];
    let ready = false;
    const background = createBackground({
      canvas: env.canvas,
      sketches: SKETCHES,
      loadHydra: async () => env.FakeHydra,
      win: env.win,
      options: { startTime: 5 },
      onSketch: (sketch, index) => shown.push([sketch.name, index]),
      onReady: () => {
        ready = true;
      },
    });
    expect(await background.start()).toBe(true);
    expect(ready).toBe(true);
    expect(env.canvas.width).toBe(640);
    expect(env.canvas.height).toBe(360);
    expect(env.win.speed).toBe(DEFAULTS.speed);
    expect(env.win.global).toBe(env.win);
    const options = env.FakeHydra.instance.options;
    expect(options.autoLoop).toBe(false);
    expect(options.detectAudio).toBe(false);
    expect(env.FakeHydra.instance.synth.time).toBe(5);
    expect(env.evaluated[0]).toBe('s0.initImage("/logo.png")');
    expect(env.evaluated).toContain("osc(1)\n.out(o0)");
    expect(shown).toEqual([["One", 0]]);
    // One still frame is rendered without playing
    expect(env.ticks).toEqual([1]);
    expect(background.isPlaying()).toBe(false);
    expect(background.current().name).toBe("One");
  });

  test("plays at the capped frame rate and crossfades between sketches", async () => {
    const env = fakeEnvironment();
    const shown = [];
    const background = createBackground({
      canvas: env.canvas,
      sketches: SKETCHES,
      loadHydra: async () => env.FakeHydra,
      win: env.win,
      options: { holdMs: 1000, fadeMs: 500, fps: 30 },
      onSketch: (sketch) => shown.push(sketch.name),
    });
    await background.start();
    env.ticks.length = 0;
    background.play();
    expect(background.isPlaying()).toBe(true);

    // 60 Hz display, 30 fps backdrop: every other frame renders
    env.run(12, 1000 / 60);
    expect(env.ticks.length).toBe(5);

    env.run(60, 1000 / 30);
    expect(shown).toEqual(["One", "Two"]);
    expect(env.evaluated).toContain("osc(1)\n.out(o1)");
    expect(env.evaluated).toContain("noise(2)\n.out(o2)");
    expect(env.outputs).toContainEqual(["src(o1).blend(src(o2))", "o0"]);
    // After the fade the next sketch renders straight to o0 again
    expect(env.evaluated.at(-1)).toBe("noise(2)\n.out(o0)");

    background.pause();
    expect(background.isPlaying()).toBe(false);
    expect(env.hasFrame()).toBe(false);
  });

  test("re-renders a paused backdrop after a resize", async () => {
    const env = fakeEnvironment();
    const background = createBackground({
      canvas: env.canvas,
      sketches: SKETCHES,
      loadHydra: async () => env.FakeHydra,
      win: env.win,
    });
    await background.start();
    env.ticks.length = 0;
    env.win.innerWidth = 1920;
    env.win.innerHeight = 1080;
    env.listeners.resize();
    expect(env.FakeHydra.instance.resolution).toEqual([960, 540]);
    expect(env.ticks).toEqual([1]);
  });

  test("reports failure when hydra can't start", async () => {
    const env = fakeEnvironment();
    const errors = [];
    const background = createBackground({
      canvas: env.canvas,
      sketches: SKETCHES,
      loadHydra: async () => {
        throw new Error("no WebGL");
      },
      win: env.win,
      onError: (error) => errors.push(error.message),
    });
    expect(await background.start()).toBe(false);
    expect(errors).toEqual(["no WebGL"]);
    background.play();
    expect(background.isPlaying()).toBe(false);
  });

  test("fails when no sketch compiles", async () => {
    const env = fakeEnvironment();
    const errors = [];
    const background = createBackground({
      canvas: env.canvas,
      sketches: [{ name: "Broken", code: "BROKEN()" }],
      loadHydra: async () => env.FakeHydra,
      win: env.win,
      onError: (error) => errors.push(error.message),
    });
    expect(await background.start()).toBe(false);
    expect(errors).toEqual(["no backdrop sketch compiles"]);
  });
});
