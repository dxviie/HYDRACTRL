import { describe, expect, test } from "bun:test";
import {
  DEFAULTS,
  backdropResolution,
  createBackground,
  createRotation,
  easeInOut,
  padPosition,
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

describe("padPosition", () => {
  test("drifts around the centre of the pad, within its range", () => {
    const positions = Array.from({ length: 400 }, (_value, i) => padPosition(i * 0.5));
    for (const [x, y] of positions) {
      expect(x).toBeGreaterThanOrEqual(0.2);
      expect(x).toBeLessThanOrEqual(0.8);
      expect(y).toBeGreaterThanOrEqual(0.2);
      expect(y).toBeLessThanOrEqual(0.8);
    }
    expect(padPosition(0)[0]).toBe(0.5);
    expect(padPosition(10)).not.toEqual(padPosition(20));
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

  test("hold starts no new fade but lets a running one finish", () => {
    const rotation = createRotation({ count: 3, holdMs: 100, fadeMs: 50 });
    rotation.hold();
    expect(rotation.held).toBe(true);
    expect(rotation.advance(10_000)).toEqual([]);
    expect(rotation.index).toBe(0);

    rotation.release();
    rotation.advance(100);
    expect(rotation.next).toBe(1);
    rotation.hold();
    expect(rotation.advance(50)).toEqual([{ type: "show", index: 1 }]);
    expect(rotation.advance(10_000)).toEqual([]);
  });

  test("release gives the current sketch a full hold again", () => {
    const rotation = createRotation({ count: 2, holdMs: 100, fadeMs: 50 });
    rotation.advance(90);
    rotation.hold();
    rotation.release();
    expect(rotation.advance(90)).toEqual([]);
    expect(rotation.advance(10)).toEqual([{ type: "fade", from: 0, to: 1 }]);
  });

  test("finish jumps to the end of a running fade", () => {
    const rotation = createRotation({ count: 2, holdMs: 10, fadeMs: 1000 });
    expect(rotation.finish()).toBe(false);
    rotation.advance(10);
    expect(rotation.finish()).toBe(true);
    expect(rotation.index).toBe(1);
    expect(rotation.next).toBeNull();
    expect(rotation.mix).toBe(0);
  });
});

function fakeEnvironment() {
  const evaluated = [];
  const ticks = [];
  const outputs = [];
  let frame = null;
  let clock = 0;
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
      this.s = [0, 1, 2, 3].map((index) => ({ src: null, tex: `tex${index}`, dynamic: true }));
      this.rendered = [];
      // Set while the last program run has a shader that fails at draw time
      this.broken = false;
      this.synth = {
        time: 0,
        o0: "o0",
        o1: "o1",
        o2: "o2",
        o3: "o3",
        s0: this.s[0],
        src: (output) => chain(`src(${output})`),
        solid: () => chain("solid"),
        render: (output) => this.rendered.push(output),
      };
      FakeHydra.instance = this;
    }
    eval(code) {
      if (code.includes("BROKEN")) throw new Error("does not compile");
      evaluated.push(code);
      this.broken = code.includes("DRAWFAIL");
      this.warns = code.includes("nope");
    }
    tick(dt) {
      if (this.broken) throw new Error("shader failed");
      // hydra's own catch around a uniform function that throws
      if (this.warns) win.console?.warn("ERROR", new ReferenceError("nope is not defined"));
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
    /** Run animation frames at a fixed interval; the clock carries on between runs. */
    run(frames, interval = 1000 / 30) {
      for (let i = 0; i < frames; i++) {
        const callback = frame;
        if (!callback) return;
        frame = null;
        clock += interval;
        callback(clock);
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
    // The imaginary XY pad is in place before the first frame
    expect([env.win.nanoX, env.win.nanoY]).toEqual(padPosition(5));
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

/** A started background on the fake environment, playing at 30 fps. */
async function playing(options = {}, callbacks = {}) {
  const env = fakeEnvironment();
  const shown = [];
  const errors = [];
  const codeErrors = [];
  const background = createBackground({
    canvas: env.canvas,
    sketches: SKETCHES,
    loadHydra: async () => env.FakeHydra,
    win: env.win,
    options: { holdMs: 1000, fadeMs: 500, ...options },
    onSketch: (sketch, index, count) => shown.push([sketch.name, index, count]),
    onError: (error) => errors.push(error.message),
    onCodeError: (error) => codeErrors.push(error.message),
    ...callbacks,
  });
  await background.start();
  background.play();
  return { env, background, shown, errors, codeErrors, hydra: env.FakeHydra.instance };
}

describe("the visitor's code", () => {
  test("announces sketches with how many there are", async () => {
    const { shown } = await playing();
    // "Broken" does not compile, so two sketches rotate
    expect(shown).toEqual([["One", 0, 2]]);
  });

  test("perform runs a program and holds the rotation on it", async () => {
    const { env, background, shown } = await playing();
    expect(background.isHeld()).toBe(false);
    expect(background.perform("osc(40).out()")).toEqual({ ok: true });
    expect(env.evaluated.at(-1)).toBe("osc(40).out()");
    expect(background.isHeld()).toBe(true);
    // Long past the hold time, nothing replaces it
    env.run(200);
    expect(shown).toEqual([["One", 0, 2]]);
    expect(env.evaluated.at(-1)).toBe("osc(40).out()");
    expect(background.isPlaying()).toBe(true);
  });

  test("hold alone keeps the current sketch until resume", async () => {
    const { env, background, shown } = await playing();
    background.hold();
    env.run(200);
    expect(shown).toEqual([["One", 0, 2]]);
    background.resume();
    expect(background.isHeld()).toBe(false);
    env.run(40);
    expect(shown.map(([name]) => name)).toEqual(["One", "Two"]);
  });

  test("a program that does not compile leaves the visuals as they were", async () => {
    const { env, background, errors } = await playing();
    const before = env.evaluated.length;
    const result = background.perform("BROKEN(");
    expect(result.ok).toBe(false);
    expect(result.error.message).toBe("does not compile");
    expect(env.evaluated.length).toBe(before);
    expect(errors).toEqual([]);
    env.run(5);
    expect(background.isPlaying()).toBe(true);
  });

  test("a shader that fails to draw reverts to the last program that drew", async () => {
    const { env, background, errors, hydra } = await playing();
    const first = background.perform("DRAWFAIL osc()");
    expect(first.ok).toBe(false);
    expect(first.error.message).toBe("shader failed");
    // Back to the sketch, which draws again
    expect(env.evaluated.at(-1)).toBe("osc(1)\n.out(o0)");
    expect(hydra.broken).toBe(false);

    expect(background.perform("noise(9).out()").ok).toBe(true);
    expect(background.perform("DRAWFAIL noise()").ok).toBe(false);
    // The visitor's previous program, not the sketch
    expect(env.evaluated.at(-1)).toBe("noise(9).out()");
    expect(hydra.rendered.at(-1)).toBe("o0");

    env.run(5);
    expect(errors).toEqual([]);
    expect(background.isPlaying()).toBe(true);
  });

  test("a program that breaks later gives way to the sketch and reports why", async () => {
    const { env, background, errors, codeErrors, hydra } = await playing();
    expect(background.perform("osc(() => later).out()").ok).toBe(true);
    hydra.broken = true;
    env.run(3);
    expect(codeErrors).toEqual(["shader failed"]);
    expect(errors).toEqual([]);
    expect(env.evaluated.at(-1)).toBe("osc(1)\n.out(o0)");
    expect(background.isPlaying()).toBe(true);
    // Still held: the visitor's edit is still theirs to fix
    expect(background.isHeld()).toBe(true);
  });

  test("an error hydra only warns about counts as a failure", async () => {
    const { env, background, errors, codeErrors } = await playing();
    const warnings = [];
    env.win.console = { warn: (...args) => warnings.push(args) };
    const result = background.perform("osc(() => nope * 10).out()");
    expect(result.ok).toBe(false);
    expect(result.error.message).toBe("nope is not defined");
    expect(env.evaluated.at(-1)).toBe("osc(1)\n.out(o0)");
    // Other warnings still reach the console, and the console is itself again
    env.win.console.warn("something else");
    expect(warnings).toEqual([["something else"]]);
    env.run(5);
    expect(errors).toEqual([]);
    expect(codeErrors).toEqual([]);
  });

  test("a sketch of our own that fails still stops the backdrop", async () => {
    const { env, background, errors, codeErrors, hydra } = await playing();
    hydra.broken = true;
    env.run(3);
    expect(errors).toEqual(["shader failed"]);
    expect(codeErrors).toEqual([]);
    expect(background.isPlaying()).toBe(false);
    expect(background.perform("osc().out()").ok).toBe(false);
  });

  test("perform during a crossfade lands on the incoming sketch first", async () => {
    const { env, background, shown } = await playing();
    env.run(32);
    expect(shown.map(([name]) => name)).toEqual(["One", "Two"]);
    expect(background.current().name).toBe("Two");
    expect(background.perform("shape(4).out()").ok).toBe(true);
    const shownTwo = env.evaluated.lastIndexOf("noise(2)\n.out(o0)");
    expect(shownTwo).toBeGreaterThan(-1);
    expect(shownTwo).toBeLessThan(env.evaluated.indexOf("shape(4).out()"));

    background.resume();
    expect(env.evaluated.at(-1)).toBe("noise(2)\n.out(o0)");
    expect(background.current().name).toBe("Two");
  });

  test("resume during a crossfade lands on the incoming sketch", async () => {
    const { env, background, shown } = await playing();
    env.run(32);
    expect(shown.map(([name]) => name)).toEqual(["One", "Two"]);
    // Held mid-fade (the visitor clicked into the code) and released again
    background.hold();
    background.resume();
    expect(env.evaluated.at(-1)).toBe("noise(2)\n.out(o0)");
    expect(background.current().name).toBe("Two");
    // The rotation carries on from there without showing One again
    env.run(10);
    expect(env.evaluated.at(-1)).toBe("noise(2)\n.out(o0)");
  });

  test("resume undoes what the visitor's code changed in hydra", async () => {
    const { env, background, hydra } = await playing();
    const update = env.win.update;
    background.perform("speed = 4; render(o1); s0.initCam(); setResolution(64, 64)");
    // What that program would have done to hydra
    env.win.speed = 4;
    env.win.fps = 2;
    env.win.update = () => {};
    let stopped = 0;
    hydra.s[0].src = { srcObject: { getTracks: () => [{ stop: () => stopped++ }] } };
    hydra.s[0].tex = "camera";
    env.canvas.width = 64;

    background.resume();
    expect(env.win.speed).toBe(DEFAULTS.speed);
    expect(env.win.fps).toBeUndefined();
    expect(env.win.update).toBe(update);
    expect(stopped).toBe(1);
    expect(hydra.s[0].src).toBeNull();
    expect(hydra.s[0].tex).toBe("tex0");
    expect(hydra.resolution).toEqual([640, 360]);
    expect(hydra.rendered.at(-1)).toBe("o0");
    expect(env.evaluated.at(-1)).toBe("osc(1)\n.out(o0)");
    expect(background.isHeld()).toBe(false);
  });

  test("resume renders a still frame when the backdrop is paused", async () => {
    const { env, background } = await playing();
    background.pause();
    background.perform("osc(3).out()");
    env.ticks.length = 0;
    background.resume();
    expect(env.ticks).toEqual([1]);
  });

  test("perform needs a running backdrop", async () => {
    const env = fakeEnvironment();
    const background = createBackground({
      canvas: env.canvas,
      sketches: SKETCHES,
      loadHydra: async () => env.FakeHydra,
      win: env.win,
    });
    const result = background.perform("osc().out()");
    expect(result.ok).toBe(false);
    expect(result.error.message).toMatch(/not running/);
    background.hold();
    background.resume();
    expect(background.isHeld()).toBe(false);
  });
});
