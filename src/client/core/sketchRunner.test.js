import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { checkSketchSyntax, combineSketchCode, executeSketch } from "./sketchRunner.js";

function createFakeHydra(calls) {
  return {
    hush: () => calls.push(["hush"]),
    osc: (...args) => {
      calls.push(["osc", ...args]);
      return { out: () => calls.push(["out"]) };
    },
    eval: () => calls.push(["eval"]),
    notAFunction: 42,
  };
}

let errorSpy;
beforeEach(() => {
  errorSpy = spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  errorSpy.mockRestore();
});

describe("combineSketchCode", () => {
  test("puts setup before main, separated by a blank line", () => {
    expect(combineSketchCode("a.setBins(6)", "osc().out()")).toBe("a.setBins(6)\n\nosc().out()");
  });

  test("trims and tolerates missing parts", () => {
    expect(combineSketchCode("  ", " osc().out() \n")).toBe("osc().out()");
    expect(combineSketchCode(undefined, "osc().out()")).toBe("osc().out()");
    expect(combineSketchCode(null, null)).toBe("");
  });
});

describe("checkSketchSyntax", () => {
  test("accepts code that parses, including top-level await", () => {
    expect(checkSketchSyntax({ main: "osc(10).out()" })).toBe(null);
    expect(checkSketchSyntax({ setup: "const f = 2;", main: "await 1; osc(f).out()" })).toBe(null);
    expect(checkSketchSyntax({})).toBe(null);
  });

  test("reports a syntax error without running anything", () => {
    globalThis.syntaxCheckRan = false;
    const message = checkSketchSyntax({ main: "globalThis.syntaxCheckRan = true; osc((.out()" });
    expect(typeof message).toBe("string");
    expect(message.length).toBeGreaterThan(0);
    expect(globalThis.syntaxCheckRan).toBe(false);
    expect(checkSketchSyntax({ main: "globalThis.syntaxCheckRan = true" })).toBe(null);
    expect(globalThis.syntaxCheckRan).toBe(false);
    globalThis.syntaxCheckRan = undefined;
  });

  test("checks setup code too", () => {
    expect(checkSketchSyntax({ setup: "let = ;", main: "osc().out()" })).not.toBe(null);
  });
});

describe("executeSketch", () => {
  test("hushes, exposes hydra functions as globals and runs the sketch", async () => {
    const calls = [];
    const result = await executeSketch(createFakeHydra(calls), { main: "osc(10, 0.1).out()" });

    expect(result).toEqual({ success: true });
    expect(calls).toEqual([["hush"], ["osc", 10, 0.1], ["out"]]);
    expect(typeof globalThis.osc).toBe("function");
    expect(globalThis.h).toBeDefined();
    // Only functions are exposed
    expect(globalThis.notAFunction).toBeUndefined();
  });

  test("runs setup code before the main sketch", async () => {
    const calls = [];
    const result = await executeSketch(createFakeHydra(calls), {
      setup: "const freq = 7;",
      main: "osc(freq).out()",
    });

    expect(result.success).toBe(true);
    expect(calls).toContainEqual(["osc", 7]);
  });

  test("supports top-level await", async () => {
    const calls = [];
    const result = await executeSketch(createFakeHydra(calls), {
      main: "const f = await Promise.resolve(3); osc(f).out()",
    });

    expect(result.success).toBe(true);
    expect(calls).toContainEqual(["osc", 3]);
  });

  test("reports syntax errors instead of throwing", async () => {
    const calls = [];
    const result = await executeSketch(createFakeHydra(calls), { main: "osc((.out()" });

    expect(result.success).toBe(false);
    expect(typeof result.message).toBe("string");
    expect(result.message.length).toBeGreaterThan(0);
  });

  test("reports runtime errors with the original message", async () => {
    const calls = [];
    const result = await executeSketch(createFakeHydra(calls), {
      main: "definitelyNotAHydraFunction()",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("definitelyNotAHydraFunction");
    expect(calls).toEqual([["hush"]]);
  });

  test("reports a hush failure as an error result", async () => {
    const hydra = {
      hush: () => {
        throw new Error("no outputs yet");
      },
    };
    const result = await executeSketch(hydra, { main: "osc().out()" });

    expect(result.success).toBe(false);
    expect(result.message).toBe("no outputs yet");
  });
});

describe("videos of earlier runs", () => {
  function fakeVideo() {
    return {
      paused: false,
      pause() {
        this.paused = true;
      },
    };
  }

  // hydra's sources: hush() drops them, init() shows a new one straight away
  function hydraWithSources(sources) {
    return {
      s: sources.map((src) => ({
        src,
        init(options) {
          this.src = options.src;
        },
      })),
      hush() {
        for (const source of this.s) source.src = null;
      },
    };
  }

  test("pauses the videos the new run no longer shows", async () => {
    const old = fakeVideo();
    const kept = fakeVideo();
    const image = { width: 1, height: 1 };
    const hydra = hydraWithSources([old, kept, image, null]);
    globalThis.keptVideo = kept;
    const result = await executeSketch(hydra, { main: "h.s[1].init({ src: keptVideo })" });
    expect(result.success).toBe(true);
    expect(old.paused).toBe(true);
    expect(kept.paused).toBe(false);
    globalThis.keptVideo = undefined;
  });

  test("also after a sketch that fails", async () => {
    const old = fakeVideo();
    const hydra = hydraWithSources([old]);
    const result = await executeSketch(hydra, { main: "osc(" });
    expect(result.success).toBe(false);
    expect(old.paused).toBe(true);
  });
});
